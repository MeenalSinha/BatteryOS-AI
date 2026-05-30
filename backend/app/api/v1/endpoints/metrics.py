"""System metrics, Prometheus-compatible output, and observability endpoint."""
import time
import logging
from fastapi import APIRouter, Response

router = APIRouter()
logger = logging.getLogger(__name__)
_start = time.time()

_request_count: dict[str, int] = {}
_prediction_count = 0


@router.get("/system")
async def system_metrics():
    """Detailed system + model health metrics."""
    import psutil
    try:
        cpu  = psutil.cpu_percent(interval=0.1)
        mem  = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        mem_used_mb  = round(mem.used  / 1024**2, 1)
        mem_total_mb = round(mem.total / 1024**2, 1)
        disk_used_gb = round(disk.used / 1024**3, 2)
    except Exception:
        cpu = mem_used_mb = mem_total_mb = disk_used_gb = 0

    from app.services.ai.degradation_predictor import degradation_predictor
    from app.services.ai.anomaly_detector import anomaly_detector
    from app.core.notification_engine import notification_engine

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
        "service": "BatteryOS AI Backend",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - _start, 1),
        "cpu_percent": cpu,
        "memory_used_mb": mem_used_mb,
        "memory_total_mb": mem_total_mb,
        "disk_used_gb": disk_used_gb,
        "models_loaded": {
            "degradation": degradation_predictor.model_loaded,
            "anomaly": anomaly_detector.model is not None,
        },
        "redis_connected": redis_ok,
        "alert_stats": notification_engine.get_stats(),
    }


@router.get("/prometheus")
async def prometheus_metrics():
    """Prometheus text format metrics for scraping."""
    import psutil
    try:
        cpu = psutil.cpu_percent(interval=0.05)
        mem = psutil.virtual_memory()
        mem_pct = mem.percent
    except Exception:
        cpu = mem_pct = 0

    from app.services.ai.degradation_predictor import degradation_predictor
    from app.core.notification_engine import notification_engine

    alert_stats = notification_engine.get_stats()
    uptime = round(time.time() - _start, 1)

    lines = [
        "# HELP batteryos_uptime_seconds Service uptime in seconds",
        "# TYPE batteryos_uptime_seconds gauge",
        f"batteryos_uptime_seconds {uptime}",
        "",
        "# HELP batteryos_cpu_usage_percent CPU utilisation",
        "# TYPE batteryos_cpu_usage_percent gauge",
        f"batteryos_cpu_usage_percent {cpu}",
        "",
        "# HELP batteryos_memory_usage_percent Memory utilisation",
        "# TYPE batteryos_memory_usage_percent gauge",
        f"batteryos_memory_usage_percent {mem_pct}",
        "",
        "# HELP batteryos_model_loaded ML model loaded flag",
        "# TYPE batteryos_model_loaded gauge",
        f'batteryos_model_loaded{{model="degradation"}} {1 if degradation_predictor.model_loaded else 0}',
        "",
        "# HELP batteryos_total_alerts Total alerts generated",
        "# TYPE batteryos_total_alerts counter",
        f"batteryos_total_alerts {alert_stats.get('total_alerts', 0)}",
        "",
        "# HELP batteryos_critical_alerts Critical severity alerts",
        "# TYPE batteryos_critical_alerts gauge",
        f"batteryos_critical_alerts {alert_stats.get('by_severity', {}).get('CRITICAL', 0)}",
    ]
    return Response(content="\n".join(lines), media_type="text/plain; version=0.0.4")


@router.get("/ping")
async def ping():
    return {"pong": True, "ts": round(time.time(), 3)}
