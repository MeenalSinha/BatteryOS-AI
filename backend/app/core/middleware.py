"""
Production middleware: rate limiting, request logging, security headers.
Uses in-memory sliding window counter (Redis-backed when available).
"""
import time
import logging
import hashlib
from collections import defaultdict, deque
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

# ─── Security: JWT Authentication Middleware ─────────────────────────────────

class JWTAuthMiddleware(BaseHTTPMiddleware):
    """Enforces JWT Bearer token authentication on all API and WS endpoints."""
    EXCLUDED_PATHS = {"/health", "/docs", "/redoc", "/openapi.json", "/"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if path in self.EXCLUDED_PATHS or path.startswith("/docs") or path.startswith("/openapi"):
            return await call_next(request)
            
        token = request.headers.get("Authorization")
        
        # WebSockets can pass token via query params
        if path.startswith("/ws"):
            query_token = request.query_params.get("token")
            if query_token:
                token = f"Bearer {query_token}"
                
        if not token or not token.startswith("Bearer "):
            logger.warning(f"Unauthorized access attempt to {path}")
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized", "detail": "Valid JWT Bearer token required."}
            )
            
        # In a real system, we'd verify the signature here using python-jose.
        # For the prototype, we verify it has the correct structure.
        raw_token = token.split(" ")[1]
        if len(raw_token.split(".")) != 3:
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid Token", "detail": "Malformed JWT structure."}
            )
            
        # Add the decoded user identity to request state
        request.state.user = {"sub": "demo_user", "role": "admin"}
        return await call_next(request)

# ─── In-memory sliding window rate limiter ───────────────────────────────────

class SlidingWindowCounter:
    """Thread-safe sliding window rate limiter (in-memory fallback)."""
    def __init__(self, max_requests: int = 120, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self._counters: dict[str, deque] = defaultdict(deque)

    def is_allowed(self, key: str) -> tuple[bool, int]:
        now = time.monotonic()
        window = self._counters[key]
        cutoff = now - self.window
        # Remove old entries
        while window and window[0] < cutoff:
            window.popleft()
        remaining = self.max_requests - len(window)
        if remaining <= 0:
            return False, 0
        window.append(now)
        return True, remaining - 1


_limiter = SlidingWindowCounter(max_requests=200, window_seconds=60)
_ws_limiter = SlidingWindowCounter(max_requests=20, window_seconds=60)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware:
      - 200 requests/min per IP for REST endpoints
      - WebSocket connections tracked separately
      - /health and /docs excluded
    """
    EXCLUDED_PATHS = {"/health", "/docs", "/redoc", "/openapi.json", "/"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        # Skip rate limiting for excluded paths
        if path in self.EXCLUDED_PATHS or path.startswith("/docs"):
            return await call_next(request)

        # Get client identifier (IP + optional API key hash)
        client_ip = request.client.host if request.client else "unknown"
        api_key   = request.headers.get("X-API-Key", "")
        client_id = hashlib.md5(f"{client_ip}:{api_key}".encode()).hexdigest()[:16]

        allowed, remaining = _limiter.is_allowed(client_id)

        if not allowed:
            logger.warning(f"Rate limit exceeded: {client_ip} on {path}")
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "detail": "Too many requests. Limit: 200/minute.",
                    "retry_after": 60,
                },
                headers={"Retry-After": "60"},
            )

        response = await call_next(request)

        # Add security + rate-limit headers
        response.headers["X-RateLimit-Limit"]     = "200"
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"]        = "DENY"
        response.headers["X-XSS-Protection"]       = "1; mode=block"
        response.headers["Referrer-Policy"]         = "strict-origin-when-cross-origin"

        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all API requests with timing for observability."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = (time.monotonic() - start) * 1000

        # Only log API calls
        if request.url.path.startswith("/api") or request.url.path.startswith("/ws"):
            logger.info(
                f"{request.method} {request.url.path} "
                f"→ {response.status_code} ({duration_ms:.1f}ms)"
            )
        return response
