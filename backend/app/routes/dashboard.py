import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.models import Expense
from app.schemas import CategoryTotal, DailyTotal, Dashboard
from app.security import CurrentUser, Session

router = APIRouter(tags=["Dashboard"])
ZERO = Decimal("0.00")


@router.get("/dashboard", response_model=Dashboard)
async def dashboard(
    user: CurrentUser,
    session: Session,
    month: Annotated[str, Query(pattern=r"^\d{4}-\d{2}$")],
    today: date | None = None,
) -> Dashboard:
    try:
        start = date.fromisoformat(f"{month}-01")
        if not 1900 <= start.year <= 9998:
            raise ValueError("Month must be between 1900-01 and 9998-12")
        previous_end = start - timedelta(days=1)
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid month") from error
    day_count = calendar.monthrange(start.year, start.month)[1]
    end = start.replace(day=day_count)
    current_day = today or date.today()
    conditions = [Expense.user_id == user.id, Expense.date >= start, Expense.date <= end]
    total, count = (
        await session.execute(
            select(func.coalesce(func.sum(Expense.amount), 0), func.count()).where(*conditions)
        )
    ).one()
    previous_total = await session.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.user_id == user.id,
            Expense.date >= previous_end.replace(day=1),
            Expense.date <= previous_end,
        )
    )
    today_total = await session.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.user_id == user.id, Expense.date == current_day
        )
    )
    daily_rows = await session.execute(
        select(Expense.date, func.sum(Expense.amount)).where(*conditions).group_by(Expense.date)
    )
    daily_lookup = dict(daily_rows.all())
    category_rows = await session.execute(
        select(Expense.category, func.sum(Expense.amount), func.count())
        .where(*conditions)
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
    )
    average_days = min(max((current_day - start).days + 1, 1), day_count)
    previous_total = previous_total or ZERO
    return Dashboard(
        month=month,
        month_total=total,
        previous_month_total=previous_total,
        change_percent=(
            ((total - previous_total) / previous_total * 100).quantize(Decimal("0.1"))
            if previous_total
            else None
        ),
        today_total=today_total or ZERO,
        daily_average=(total / average_days).quantize(Decimal("0.01")),
        expense_count=count,
        daily=[
            DailyTotal(
                date=start + timedelta(days=offset),
                total=daily_lookup.get(start + timedelta(days=offset), ZERO),
            )
            for offset in range(day_count)
        ],
        categories=[
            CategoryTotal(category=category, total=amount, count=count)
            for category, amount, count in category_rows
        ],
    )
