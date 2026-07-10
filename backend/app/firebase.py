import firebase_admin
from firebase_admin import credentials, firestore

from .config import settings

_initialized = False


def get_db() -> firestore.firestore.Client:
    global _initialized
    if not _initialized:
        cred = credentials.Certificate(settings.google_application_credentials)
        firebase_admin.initialize_app(cred)
        _initialized = True
    return firestore.client()
