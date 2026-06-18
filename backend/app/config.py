from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "cinesis"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    google_maps_api_key: str = ""
    # Comma-separated frontend URLs, or "*" for all (dev only)
    cors_origins: str = "*"


settings = Settings()
