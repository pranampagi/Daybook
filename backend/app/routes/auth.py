from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool

from app.config import get_settings
from app.models import User
from app.schemas import Login, Registration, UserRead
from app.security import (
    COOKIE_NAME,
    CurrentUser,
    Session,
    dummy_hash,
    password_hash,
    set_session_cookie,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(data: Registration, response: Response, session: Session) -> User:
    if not get_settings().allow_registration:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Registration is currently disabled")
    hashed = await run_in_threadpool(password_hash.hash, data.password)
    user = User(
        name=data.name,
        email=str(data.email).lower(),
        password_hash=hashed,
        currency=data.currency,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This email is already registered") from error
    set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserRead)
async def login(data: Login, response: Response, session: Session) -> User:
    user = await session.scalar(select(User).where(User.email == str(data.email).lower()))
    valid = await run_in_threadpool(
        password_hash.verify, data.password, user.password_hash if user else dummy_hash
    )
    if user is None or not valid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect")
    set_session_cookie(response, user.id)
    return user


@router.get("/me", response_model=UserRead)
async def me(user: CurrentUser) -> User:
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(
        COOKIE_NAME, path="/api", secure=get_settings().cookie_secure, httponly=True, samesite="lax"
    )
