import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Category = Literal["food", "transport", "shopping", "housing", "health", "entertainment", "other"]
Currency = Literal["USD", "EUR", "GBP", "INR", "CAD", "AUD"]
Money = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]


class Registration(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=10, max_length=128)
    currency: Currency = "USD"

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name cannot be blank")
        return value.strip()


class Login(BaseModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    currency: Currency


class ExpenseWrite(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    amount: Money
    category: Category
    date: Annotated[date, Field(ge=date(1900, 1, 1), le=date(9998, 12, 31))]
    notes: str = Field(default="", max_length=1000)

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Description cannot be blank")
        return value.strip()


class ExpenseRead(ExpenseWrite):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


class ExpensePage(BaseModel):
    items: list[ExpenseRead]
    total: int
    page: int
    page_size: int


class DailyTotal(BaseModel):
    date: date
    total: Decimal


class CategoryTotal(BaseModel):
    category: Category
    total: Decimal
    count: int


class Dashboard(BaseModel):
    month: str
    month_total: Decimal
    previous_month_total: Decimal
    change_percent: Decimal | None
    today_total: Decimal
    daily_average: Decimal
    expense_count: int
    daily: list[DailyTotal]
    categories: list[CategoryTotal]
