import json

import firebase_admin
from firebase_admin import credentials, firestore

from .config import settings

_initialized = False


def _load_credentials() -> credentials.Certificate:
    # Production (Render): dán nội dung JSON vào biến GOOGLE_CREDENTIALS_JSON.
    # Local: trỏ file qua GOOGLE_APPLICATION_CREDENTIALS.
    if settings.google_credentials_json:
        return credentials.Certificate(json.loads(settings.google_credentials_json))
    return credentials.Certificate(settings.google_application_credentials)


def ensure_app() -> None:
    global _initialized
    if not _initialized:
        firebase_admin.initialize_app(_load_credentials())
        _initialized = True


def get_db() -> firestore.firestore.Client:
    ensure_app()
    return firestore.client()
