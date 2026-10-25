import csv
import io

import pytest
from httpx import AsyncClient

from app.config import Settings

EXPENSE = {
    "description": "Morning coffee",
    "amount": "4.50",
    "category": "food",
    "date": "2026-10-25",
    "notes": "With a friend",
}


async def test_authentication_and_session_cookie(client: AsyncClient):
    assert (await client.get("/api/v1/expenses")).status_code == 401
    response = await client.post(
        "/api/v1/auth/register",
        json={"name": "Alex", "email": "ALEX@example.com", "password": "a-long-test-password"},
    )
    assert response.status_code == 201
    assert response.json()["email"] == "alex@example.com"
    assert "password_hash" not in response.json()
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/api" in cookie
    assert (await client.get("/api/v1/auth/me")).status_code == 200
    duplicate = await client.post(
        "/api/v1/auth/register",
        json={"name": "Other", "email": "alex@example.com", "password": "a-long-test-password"},
    )
    assert duplicate.status_code == 409
    assert (await client.post("/api/v1/auth/logout")).status_code == 204
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login", json={"email": "alex@example.com", "password": "wrong"}
        )
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "alex@example.com", "password": "a-long-test-password"},
        )
    ).status_code == 200


async def test_crud_and_decimal_precision(signed_in: AsyncClient):
    created = await signed_in.post("/api/v1/expenses", json=EXPENSE)
    assert created.status_code == 201
    expense = created.json()
    assert expense["amount"] == "4.50"
    expense_id = expense["id"]
    result = await signed_in.get("/api/v1/expenses")
    assert result.json()["total"] == 1
    updated = await signed_in.put(
        f"/api/v1/expenses/{expense_id}", json={**EXPENSE, "amount": "6.25"}
    )
    assert updated.json()["amount"] == "6.25"
    assert (await signed_in.delete(f"/api/v1/expenses/{expense_id}")).status_code == 204
    assert (await signed_in.get("/api/v1/expenses")).json()["total"] == 0
    assert (await signed_in.delete(f"/api/v1/expenses/{expense_id}")).status_code == 404


async def test_user_isolation(signed_in: AsyncClient):
    expense = (await signed_in.post("/api/v1/expenses", json=EXPENSE)).json()
    await signed_in.post("/api/v1/auth/logout")
    response = await signed_in.post(
        "/api/v1/auth/register",
        json={"name": "Blair", "email": "blair@example.com", "password": "another-long-password"},
    )
    assert response.status_code == 201
    assert (await signed_in.get("/api/v1/expenses")).json()["total"] == 0
    assert (
        await signed_in.put(f"/api/v1/expenses/{expense['id']}", json=EXPENSE)
    ).status_code == 404
    assert (await signed_in.delete(f"/api/v1/expenses/{expense['id']}")).status_code == 404
    assert (
        len(list(csv.reader(io.StringIO((await signed_in.get("/api/v1/expenses/export")).text))))
        == 1
    )
    summary = (await signed_in.get("/api/v1/dashboard?month=2026-10")).json()
    assert summary["month_total"] == "0.00"


@pytest.mark.parametrize("amount", ["0", "-1", "1.001", "10000000000", "NaN", "Infinity"])
async def test_invalid_amounts(signed_in: AsyncClient, amount: str):
    response = await signed_in.post("/api/v1/expenses", json={**EXPENSE, "amount": amount})
    assert response.status_code == 422


@pytest.mark.parametrize(
    "changes",
    [
        {"category": "invalid"},
        {"date": "not-a-date"},
        {"description": "   "},
        {"description": "a" * 201},
        {"notes": "a" * 1001},
    ],
)
async def test_invalid_expense_data(signed_in: AsyncClient, changes: dict):
    response = await signed_in.post("/api/v1/expenses", json={**EXPENSE, **changes})
    assert response.status_code == 422


async def test_filters_pagination_and_literal_search(signed_in: AsyncClient):
    for description, category, day in [
        ("100% juice", "food", "25"),
        ("Taxi", "transport", "24"),
        ("Coffee", "food", "23"),
    ]:
        await signed_in.post(
            "/api/v1/expenses",
            json={
                **EXPENSE,
                "description": description,
                "category": category,
                "date": f"2026-10-{day}",
            },
        )
    result = (await signed_in.get("/api/v1/expenses?category=food&page_size=1&page=2")).json()
    assert result["total"] == 2
    assert result["items"][0]["description"] == "Coffee"
    assert (await signed_in.get("/api/v1/expenses?search=%25")).json()["total"] == 1
    assert (await signed_in.get("/api/v1/expenses?date_from=2026-10-24&date_to=2026-10-25")).json()[
        "total"
    ] == 2
    assert (await signed_in.get("/api/v1/expenses?page_size=101")).status_code == 422
    assert (
        await signed_in.get("/api/v1/expenses?date_from=2026-10-25&date_to=2026-10-01")
    ).status_code == 422


async def test_dashboard_rollups(signed_in: AsyncClient):
    for amount, category, day in [
        ("0.10", "food", "2026-10-01"),
        ("0.20", "food", "2026-10-25"),
        ("9.70", "transport", "2026-10-25"),
        ("5.00", "other", "2026-09-01"),
    ]:
        response = await signed_in.post(
            "/api/v1/expenses",
            json={**EXPENSE, "amount": amount, "category": category, "date": day},
        )
        assert response.status_code == 201
    result = (await signed_in.get("/api/v1/dashboard?month=2026-10&today=2026-10-25")).json()
    assert result["month_total"] == "10.00"
    assert result["previous_month_total"] == "5.00"
    assert result["today_total"] == "9.90"
    assert result["change_percent"] == "100.0"
    assert result["daily_average"] == "0.40"
    assert result["expense_count"] == 3
    assert len(result["daily"]) == 31
    assert result["daily"][0]["total"] == "0.10"
    assert result["daily"][1]["total"] == "0.00"
    assert result["categories"][0]["category"] == "transport"
    assert (await signed_in.get("/api/v1/dashboard?month=2026-13")).status_code == 422


async def test_export_filters_and_formula_injection(signed_in: AsyncClient):
    await signed_in.post(
        "/api/v1/expenses", json={**EXPENSE, "description": '=HYPERLINK("bad")', "notes": "@SUM(1)"}
    )
    await signed_in.post("/api/v1/expenses", json={**EXPENSE, "category": "shopping"})
    response = await signed_in.get("/api/v1/expenses/export?category=food")
    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(response.text)))
    assert len(rows) == 2
    assert rows[1][1].startswith("'=")
    assert rows[1][5].startswith("'@")


async def test_csrf_and_response_headers(signed_in: AsyncClient):
    response = await signed_in.post(
        "/api/v1/expenses", json=EXPENSE, headers={"Origin": "https://malicious.example"}
    )
    assert response.status_code == 403
    response = await signed_in.post(
        "/api/v1/expenses", json=EXPENSE, headers={"Origin": "http://localhost:8080"}
    )
    assert response.status_code == 201
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    response = await signed_in.post(
        "/api/v1/expenses", json=EXPENSE, headers={"Sec-Fetch-Site": "cross-site"}
    )
    assert response.status_code == 403


def test_production_settings_require_https():
    with pytest.raises(ValueError):
        Settings(app_env="production", cookie_secure=False)
    with pytest.raises(ValueError):
        Settings(app_env="production", cookie_secure=True, allowed_origins=["http://localhost"])
    assert Settings(
        app_env="production", cookie_secure=True, allowed_origins=["https://expenses.example.com"]
    ).cookie_secure
