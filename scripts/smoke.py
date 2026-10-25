import argparse
import csv
import io
import json
import secrets
from decimal import Decimal
from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Exercise a disposable Daybook deployment"
    )
    parser.add_argument("--base-url", default="http://localhost:8080")
    arguments = parser.parse_args()
    base_url = arguments.base_url.rstrip("/")
    client = build_opener(HTTPCookieProcessor(CookieJar()))

    def request(path: str, method: str = "GET", data: dict | None = None):
        payload = json.dumps(data).encode() if data is not None else None
        headers = {"Content-Type": "application/json", "Origin": base_url}
        with client.open(
            Request(
                f"{base_url}/api/v1{path}", data=payload, headers=headers, method=method
            ),
            timeout=20,
        ) as response:
            body = response.read().decode()
            if not body:
                return None
            return (
                json.loads(body)
                if "application/json" in response.headers["Content-Type"]
                else body
            )

    user = request(
        "/auth/register",
        "POST",
        {
            "name": "Deployment smoke test",
            "email": f"smoke-{secrets.token_hex(8)}@example.com",
            "password": secrets.token_urlsafe(24),
            "currency": "USD",
        },
    )
    assert request("/auth/me")["id"] == user["id"]
    expense_ids = []
    for amount in ["0.10", "0.20"]:
        created = request(
            "/expenses",
            "POST",
            {
                "description": "Deployment test expense",
                "amount": amount,
                "category": "food",
                "date": "2026-10-25",
                "notes": "Disposable integration test",
            },
        )
        assert created["amount"] == amount
        expense_ids.append(created["id"])
    result = request("/expenses?category=food&page_size=1")
    assert result["total"] == 2 and len(result["items"]) == 1
    dashboard = request("/dashboard?month=2026-10&today=2026-10-25")
    assert dashboard["month_total"] == "0.30"
    assert dashboard["today_total"] == "0.30"
    assert dashboard["expense_count"] == 2
    request(
        f"/expenses/{expense_ids[0]}",
        "PUT",
        {
            "description": "Updated deployment test",
            "amount": "0.40",
            "category": "food",
            "date": "2026-10-25",
            "notes": "Disposable integration test",
        },
    )
    rows = list(csv.DictReader(io.StringIO(request("/expenses/export?category=food"))))
    assert len(rows) == 2
    assert sum(Decimal(row["Amount"]) for row in rows) == Decimal("0.60")
    for expense_id in expense_ids:
        request(f"/expenses/{expense_id}", "DELETE")
    assert request("/expenses")["total"] == 0
    request("/auth/logout", "POST")
    try:
        request("/auth/me")
    except HTTPError as error:
        assert error.code == 401
    else:
        raise AssertionError("Logout did not clear the session")
    print(
        "Deployment smoke passed: auth, CRUD, exact totals, filters, pagination, CSV, logout"
    )


if __name__ == "__main__":
    main()
