from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_application_credentials: str = "./serviceAccountKey.json"
    gemini_api_key: str = ""
    jwt_secret: str = ""
    cors_origins: str = "http://localhost:5173"


settings = Settings()
