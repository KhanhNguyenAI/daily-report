"""Xác thực bằng Firebase ID token (đăng nhập Google).

App đa người dùng: bất kỳ ai đăng nhập Google đều dùng được, mỗi người có dữ liệu
riêng (scope theo uid). Đặt AUTH_ENABLED=false ở local để dev không cần đăng nhập.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth

from .config import settings
from .firebase import ensure_app

_bearer = HTTPBearer(auto_error=False)


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Trả về {uid, email} của người đang đăng nhập, hoặc 401 nếu token không hợp lệ."""
    if not settings.auth_enabled:
        return {"uid": settings.dev_uid, "email": "dev@local", "dev": True}

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    ensure_app()
    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    uid = decoded.get("uid") or decoded.get("user_id")
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return {"uid": uid, "email": decoded.get("email")}


# Kiểu dùng lại ở router: user = Depends(require_user)
CurrentUser = Depends(require_user)
