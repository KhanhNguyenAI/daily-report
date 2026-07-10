from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_application_credentials: str = "./serviceAccountKey.json"
    google_credentials_json: str = ""  # production: dán nội dung JSON thay cho file
    gemini_api_key: str = ""
    cors_origins: str = "http://localhost:5173"
    # Cho phép mọi domain Vercel của project (prod + preview) — auth token vẫn bắt buộc
    cors_origin_regex: str = r"https://daily-report.*\.vercel\.app"

    # Auth: bật ở production để bắt đăng nhập Google. Local dev đặt AUTH_ENABLED=false.
    auth_enabled: bool = True
    dev_uid: str = "dev-user"  # uid giả dùng khi auth_enabled=false


settings = Settings()
