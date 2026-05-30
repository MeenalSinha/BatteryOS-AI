"""Application lifecycle events."""
import logging

logger = logging.getLogger(__name__)


async def startup_handler():
    logger.info("BatteryOS AI starting up...")
    # DB tables created via Alembic in production; skip auto-create here
    logger.info("Startup complete — BatteryOS AI is operational")


async def shutdown_handler():
    logger.info("BatteryOS AI shutting down...")
