"""Application configuration via environment variables."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "BatteryOS AI"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://batteryos:batteryos_secret@localhost:5432/batteryos"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # InfluxDB
    INFLUX_URL: str = "http://localhost:8086"
    INFLUX_TOKEN: str = "batteryos-super-secret-auth-token"
    INFLUX_ORG: str = "batteryos"
    INFLUX_BUCKET: str = "telemetry"

    # MQTT
    MQTT_HOST: str = "localhost"
    MQTT_PORT: int = 1883

    # AI Model paths
    DEGRADATION_MODEL_PATH: str = "/app/ml_models/degradation_model.pkl"
    THERMAL_MODEL_PATH: str = "/app/ml_models/thermal_model.pkl"
    ANOMALY_MODEL_PATH: str = "/app/ml_models/anomaly_model.pkl"

    # Fleet defaults
    MAX_FLEET_SIZE: int = 1000
    TELEMETRY_INTERVAL_MS: int = 1000

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
