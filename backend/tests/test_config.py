import pytest
from sqlalchemy.engine import make_url

from app.config import Settings


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+asyncpg"])
def test_database_urls_use_asyncpg(scheme: str):
    settings = Settings(database_url=f"{scheme}://daybook:password@db:5432/daybook")
    assert make_url(settings.database_url).drivername == "postgresql+asyncpg"


def test_provider_url_preserves_credentials_and_translates_ssl():
    settings = Settings(
        database_url="postgresql://daybook:p%40ss%2Fword@db/daybook"
        "?sslmode=verify-full&channel_binding=require"
    )
    url = make_url(settings.database_url)
    assert url.password == "p@ss/word"
    assert url.query == {"ssl": "verify-full"}


def test_local_database_url_does_not_force_ssl():
    settings = Settings(database_url="postgresql+asyncpg://daybook:password@db/daybook")
    assert not make_url(settings.database_url).query


@pytest.mark.parametrize("scheme", ["sqlite", "postgresql+psycopg2"])
def test_incompatible_database_drivers_are_rejected(scheme: str):
    with pytest.raises(ValueError, match="asyncpg driver"):
        Settings(database_url=f"{scheme}://daybook:password@db/daybook")


def test_conflicting_ssl_parameters_are_rejected():
    with pytest.raises(ValueError, match="conflicting SSL settings"):
        Settings(
            database_url="postgresql://daybook:password@db/daybook?ssl=require&sslmode=disable"
        )
