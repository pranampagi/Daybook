import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table(
        "expenses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("description", sa.String(200), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("notes", sa.String(1000), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("amount > 0", name="ck_expenses_positive_amount"),
        sa.CheckConstraint(
            "category IN ('food', 'transport', 'shopping', 'housing', "
            "'health', 'entertainment', 'other')",
            name="ck_expenses_category",
        ),
    )
    op.create_index("ix_expenses_user_date", "expenses", ["user_id", "date"])
    op.create_index("ix_expenses_user_category_date", "expenses", ["user_id", "category", "date"])


def downgrade():
    op.drop_table("expenses")
    op.drop_table("users")
