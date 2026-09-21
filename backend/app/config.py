from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_version: str = "0.1.0"
    database_url: str = "sqlite:///./namelens.db"
    cors_origins: str = "http://localhost:5173"
    web_dist: str = "../web/dist"

    # Retrieval
    enable_wikidata: bool = True
    enable_wikipedia: bool = True
    enable_demo_provider: bool = True
    http_timeout_seconds: float = 6.0
    cache_ttl_seconds: int = 3600
    user_agent: str = "NameLens/0.1 (independent portfolio project; https://github.com/leumaslarotrebor/namelens)"

    # Input limits
    max_raw_length: int = 500
    max_name_length: int = 100
    max_name_tokens: int = 10

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
