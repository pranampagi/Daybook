import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from pwdlib import PasswordHash
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_session
from app.models import User

password_hash = PasswordHash.recommended()
dummy_hash = password_hash.hash("not-a-real-user-password")
COOKIE_NAME = "daybook_session"


def set_session_cookie(response: Response, user_id: uuid.UUID) -> None:
    settings = get_settings()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(hours=settings.session_hours),
            "iss": "daybook",
            "aud": "daybook-web",
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.session_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/api",
    )


async def get_current_user(
    request: Request, session: Annotated[AsyncSession, Depends(get_session)]
) -> User:
    token = request.cookies.get(COOKIE_NAME)
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in to continue")
    if not token:
        raise unauthorized
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=["HS256"],
            issuer="daybook",
            audience="daybook-web",
            options={"require": ["sub", "iat", "exp", "iss", "aud"]},
        )
        user_id = uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError) as error:
        raise unauthorized from error
    user = await session.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]
