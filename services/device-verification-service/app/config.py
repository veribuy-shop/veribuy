from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 3005
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = "veribuy_redis_dev"
    imei_check_api_key: str = ""
    imei_check_api_url: str = "https://api.imeicheck.com"
    ifree_icloud_api_key: str = ""
    ifree_icloud_api_url: str = "https://ifreeicloud.co.uk"
    cache_ttl_seconds: int = 86400

    @property
    def imei_stub_mode(self) -> bool:
        """True when no valid IMEI Check API key is configured."""
        key = self.imei_check_api_key.strip()
        return not key or key.startswith("your-")

    @property
    def icloud_stub_mode(self) -> bool:
        """True when no valid iFreeiCloud API key is configured."""
        key = self.ifree_icloud_api_key.strip()
        return not key or key.startswith("your-")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
