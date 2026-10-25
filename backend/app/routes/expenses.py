import csv
import io
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.sql.elements import ColumnElement

from app.models import Expense
from app.schemas import Category, ExpensePage, ExpenseRead, ExpenseWrite
from app.security import CurrentUser, Session

router = APIRouter(prefix="/expenses", tags=["Expenses"])


def expense_filters(
    user_id: uuid.UUID,
    date_from: date | None,
    date_to: date | None,
    category: Category | None,
    search: str | None,
) -> list[ColumnElement[bool]]:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Start date must precede end date")
    filters = [Expense.user_id == user_id]
    if date_from:
        filters.append(Expense.date >= date_from)
    if date_to:
        filters.append(Expense.date <= date_to)
    if category:
        filters.append(Expense.category == category)
    if search and search.strip():
        filters.append(Expense.description.icontains(search.strip(), autoescape=True))
    return filters


@router.get("", response_model=ExpensePage)
async def list_expenses(
    user: CurrentUser,
    session: Session,
    date_from: date | None = None,
    date_to: date | None = None,
    category: Category | None = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1, le=100000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
) -> ExpensePage:
    filters = expense_filters(user.id, date_from, date_to, category, search)
    total = await session.scalar(select(func.count()).select_from(Expense).where(*filters))
    expenses = await session.scalars(
        select(Expense)
        .where(*filters)
        .order_by(Expense.date.desc(), Expense.created_at.desc(), Expense.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return ExpensePage(items=list(expenses), total=total or 0, page=page, page_size=page_size)


def safe_csv_cell(value: str) -> str:
    if value.startswith(("\t", "\r", "\n")) or value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


@router.get("/export")
async def export_expenses(
    user: CurrentUser,
    session: Session,
    date_from: date | None = None,
    date_to: date | None = None,
    category: Category | None = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
) -> StreamingResponse:
    filters = expense_filters(user.id, date_from, date_to, category, search)
    result = await session.stream_scalars(
        select(Expense)
        .where(*filters)
        .order_by(Expense.date.desc(), Expense.id.desc())
        .execution_options(yield_per=500)
    )

    async def rows():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Date", "Description", "Category", "Amount", "Currency", "Notes"])
        yield buffer.getvalue()
        try:
            async for expense in result:
                buffer.seek(0)
                buffer.truncate(0)
                writer.writerow(
                    [
                        expense.date.isoformat(),
                        safe_csv_cell(expense.description),
                        expense.category,
                        str(expense.amount),
                        user.currency,
                        safe_csv_cell(expense.notes),
                    ]
                )
                yield buffer.getvalue()
        finally:
            await result.close()

    return StreamingResponse(
        rows(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="daybook-expenses.csv"'},
    )


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_expense(data: ExpenseWrite, user: CurrentUser, session: Session) -> Expense:
    expense = Expense(**data.model_dump(), user_id=user.id)
    session.add(expense)
    await session.commit()
    await session.refresh(expense)
    return expense


async def owned_expense(expense_id: uuid.UUID, user: CurrentUser, session: Session) -> Expense:
    expense = await session.scalar(
        select(Expense).where(Expense.id == expense_id, Expense.user_id == user.id)
    )
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found")
    return expense


@router.put("/{expense_id}", response_model=ExpenseRead)
async def update_expense(
    expense_id: uuid.UUID, data: ExpenseWrite, user: CurrentUser, session: Session
) -> Expense:
    expense = await owned_expense(expense_id, user, session)
    for field, value in data.model_dump().items():
        setattr(expense, field, value)
    await session.commit()
    await session.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(expense_id: uuid.UUID, user: CurrentUser, session: Session) -> None:
    expense = await owned_expense(expense_id, user, session)
    await session.delete(expense)
    await session.commit()
