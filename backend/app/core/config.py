from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_PATH: str = "./data/app.db"
    STORAGE_DIR: str = "./storage"
    MAX_UPLOAD_MB: int = 500
    CORS_ORIGINS: str = "http://localhost:3000"
    MAX_ATTACHMENT_MB: int = 50

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
