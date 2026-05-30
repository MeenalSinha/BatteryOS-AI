"""Redis cache service — TTL-based caching for AI predictions and telemetry."""
import json
import logging
from typing import Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)
_redis_client = None
_redis_unavailable = False


async def get_redis():
    """Lazy-init Redis client."""
    global _redis_client, _redis_unavailable
    
    if _redis_unavailable:
        return None
        
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = await aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
            )
            await _redis_client.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.warning(f"Redis unavailable: {e} — cache disabled permanently for this session")
            _redis_client = None
            _redis_unavailable = True
    return _redis_client


async def cache_get(key: str) -> Optional[Any]:
    """Get a cached value. Returns None on miss or Redis unavailable."""
    try:
        r = await get_redis()
        if not r:
            return None
        raw = await r.get(key)
        if raw:
            return json.loads(raw)
    except Exception as e:
        logger.debug(f"Cache get error [{key}]: {e}")
    return None


async def cache_set(key: str, value: Any, ttl_seconds: int = 30) -> bool:
    """Set a cached value with TTL. Returns False on failure."""
    try:
        r = await get_redis()
        if not r:
            return False
        await r.setex(key, ttl_seconds, json.dumps(value, default=str))
        return True
    except Exception as e:
        logger.debug(f"Cache set error [{key}]: {e}")
        return False


async def cache_delete(key: str) -> bool:
    try:
        r = await get_redis()
        if not r:
            return False
        await r.delete(key)
        return True
    except Exception:
        return False


async def cache_invalidate_vehicle(vehicle_id: str):
    """Invalidate all cached entries for a vehicle."""
    try:
        r = await get_redis()
        if not r:
            return
        keys = await r.keys(f"batteryos:*:{vehicle_id}:*")
        if keys:
            await r.delete(*keys)
    except Exception:
        pass
