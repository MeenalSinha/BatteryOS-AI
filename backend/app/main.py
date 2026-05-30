"""BatteryOS AI — FastAPI Application Entry Point"""
import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.middleware import RateLimitMiddleware, RequestLoggingMiddleware, JWTAuthMiddleware
from app.api.v1.router import api_router
from app.api.v1.endpoints.websocket import router as ws_router

logger = logging.getLogger(__name__)
_start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("BatteryOS AI starting up...")

    # Load ML models
    from app.services.ai.degradation_predictor import degradation_predictor
    from app.services.ai.thermal_predictor import thermal_predictor
    from app.services.ai.anomaly_detector import anomaly_detector

    degradation_predictor._load_model(settings.DEGRADATION_MODEL_PATH)
    thermal_predictor._load_model(settings.THERMAL_MODEL_PATH)
    # anomaly_detector already self-initialises; optionally load trained model
    try:
        import os
        anom_path = settings.ANOMALY_MODEL_PATH
        if os.path.exists(anom_path):
            anomaly_detector._load_model(anom_path)
    except Exception:
        pass

    # Load LSTM model
    try:
        import os
        lstm_path = os.path.join(
            os.path.dirname(settings.DEGRADATION_MODEL_PATH), "lstm_model.pkl"
        )
        if os.path.exists(lstm_path):
            from app.services.ai.lstm_predictor import lstm_predictor
            lstm_predictor.load(lstm_path)
            logger.info("LSTM sequence model loaded")
    except Exception as e:
        logger.warning(f"LSTM not loaded: {e}")

    # Warm Redis
    from app.core.cache import get_redis
    await get_redis()

    # Start MQTT subscriber
    from app.core.telemetry_subscriber import start_mqtt_subscriber
    start_mqtt_subscriber()

    logger.info("BatteryOS AI fully operational")
    yield
    logger.info("BatteryOS AI shutting down...")


app = FastAPI(
    title="BatteryOS AI",
    description="AI-Native Operating System for EV Batteries",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Middleware (order matters — outermost first)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(JWTAuthMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/health")
async def health_check():
    from app.services.ai.degradation_predictor import degradation_predictor
    from app.services.ai.thermal_predictor import thermal_predictor
    from app.services.ai.anomaly_detector import anomaly_detector

    redis_ok = False
    try:
        from app.core.cache import get_redis
        r = await get_redis()
        if r:
            await r.ping()
            redis_ok = True
    except Exception:
        pass

    return {
        "status": "operational",
        "service": "BatteryOS AI Backend",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - _start_time, 1),
        "models_loaded": {
            "degradation": degradation_predictor.model_loaded,
            "thermal": thermal_predictor.model is not None,
            "anomaly": anomaly_detector.model is not None,
        },
        "redis_connected": redis_ok,
    }


@app.get("/")
async def root():
    return {
        "message": "BatteryOS AI API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
