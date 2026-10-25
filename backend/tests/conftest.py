import os
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ["JWT_SECRET"] = "test-only-secret-never-use-in-production-123456789"
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://daybook:daybook@localhost:5432/daybook"

from app.database import get_session
from app.main import app
from app.models import Base


@pytest.fixture
async def client(tmp_path) -> AsyncIterator[AsyncClient]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/test.db")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.fixture
async def signed_in(client: AsyncClient) -> AsyncClient:
    response = await client.post(
        "/api/v1/auth/register",
        json={"name": "Alex", "email": "alex@example.com", "password": "a-long-test-password"},
    )
    assert response.status_code == 201
    return client
