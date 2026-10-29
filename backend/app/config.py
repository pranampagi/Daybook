from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://daybook:daybook@localhost:5432/daybook"
    jwt_secret: str = Field(min_length=32)
    app_env: Literal["development", "test", "production"] = "development"
    cookie_secure: bool = False
    allowed_origins: list[str] = ["http://localhost:8080", "http://localhost:5173"]
    allow_registration: bool = True
    session_hours: int = Field(default=24, ge=1, le=168)
    db_pool_size: int = Field(default=5, ge=1, le=100)
    db_max_overflow: int = Field(default=10, ge=0, le=100)

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        url = make_url(value)
        if url.drivername not in {"postgres", "postgresql", "postgresql+asyncpg"}:
            raise ValueError("DATABASE_URL must use PostgreSQL with the asyncpg driver")
        query = dict(url.query)
        sslmode = query.pop("sslmode", None)
        if sslmode is not None:
            if "ssl" in query and query["ssl"] != sslmode:
                raise ValueError("DATABASE_URL has conflicting SSL settings")
            query["ssl"] = sslmode
        query.pop("channel_binding", None)
        return url.set(drivername="postgresql+asyncpg", query=query).render_as_string(
            hide_password=False
        )

    @model_validator(mode="after")
    def validate_security(self) -> "Settings":
        if self.jwt_secret.startswith("replace-with"):
            raise ValueError("Generate a JWT_SECRET before starting the API")
        if self.app_env == "production":
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")
            if not self.allowed_origins or any(
                not origin.startswith("https://") for origin in self.allowed_origins
            ):
                raise ValueError("Production ALLOWED_ORIGINS must be explicit HTTPS origins")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
