from functools import lru_cache
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_uri: str = ""
    mongodb_database: str = "ai_secure_meeting"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    frontend_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    livekit_url: str = ""
    livekit_token_ttl_minutes: int = 10
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    chat_message_max_length: int = 2000
    chat_rate_limit_per_minute: int = 30
    toxicity_warning_threshold: float = 0.5
    toxicity_block_threshold: float = 0.8
    toxicity_model_enabled: bool = True
    voice_moderation_enabled: bool = True
    voice_transcript_max_length: int = 2000
    voice_rate_limit_per_minute: int = 12
    voice_toxicity_warning_threshold: float = 0.5
    voice_toxicity_block_threshold: float = 0.8
    engagement_alert_threshold: float = 0.5
    engagement_alert_duration_seconds: int = 30
    engagement_alert_cooldown_seconds: int = 300
    engagement_metric_stale_seconds: int = 15

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def parse_frontend_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_runtime_limits(self) -> "Settings":
        thresholds = (
            ("toxicity", self.toxicity_warning_threshold, self.toxicity_block_threshold),
            ("voice toxicity", self.voice_toxicity_warning_threshold, self.voice_toxicity_block_threshold),
        )
        for label, warning, block in thresholds:
            if not 0 <= warning < block <= 1:
                raise ValueError(f"{label} thresholds must satisfy 0 <= warning < block <= 1")
        for name, value in (
            ("access_token_expire_minutes", self.access_token_expire_minutes),
            ("livekit_token_ttl_minutes", self.livekit_token_ttl_minutes),
            ("chat_message_max_length", self.chat_message_max_length),
            ("chat_rate_limit_per_minute", self.chat_rate_limit_per_minute),
            ("voice_transcript_max_length", self.voice_transcript_max_length),
            ("voice_rate_limit_per_minute", self.voice_rate_limit_per_minute),
            ("engagement_alert_duration_seconds", self.engagement_alert_duration_seconds),
            ("engagement_alert_cooldown_seconds", self.engagement_alert_cooldown_seconds),
            ("engagement_metric_stale_seconds", self.engagement_metric_stale_seconds),
        ):
            if value <= 0:
                raise ValueError(f"{name} must be greater than zero")
        if not 0 < self.engagement_alert_threshold < 1:
            raise ValueError("engagement_alert_threshold must be between zero and one")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
