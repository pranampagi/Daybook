<div align="center">
  <img src="frontend/public/favicon.svg" width="64" alt="Daybook logo" />

# Daybook

**Everyday expenses, understood.**

A simple, private expense tracker built with FastAPI, PostgreSQL, React, TypeScript, Tailwind CSS, and Docker.
</div>

## What’s included

- Personal accounts with Argon2 password hashing and HTTP-only session cookies.
- Create, edit, and delete expenses with exact decimal amounts, categories, dates, and notes.
- Monthly totals, today’s spending, daily averages, and daily/category charts.
- Search, category filtering, month selection, server-side pagination, and filtered CSV export.
- Responsive desktop/mobile interface with loading, error, and empty states.
- Database migrations, persistent storage, health checks, non-root app containers, dependency lockfiles, and CI.

## Quick start

You need **Docker Engine with Compose v2** and **Python 3** for the setup script.

```bash
bash scripts/setup.sh
docker compose up --build -d
```

Open **http://localhost:8080**, choose **Create an account**, and add your first expense. No demo accounts or sample financial data are inserted.

- API documentation: http://localhost:8080/api/docs (development only)
- Database readiness: http://localhost:8080/api/ready
- Logs: `docker compose logs -f api web`
- Stop, retaining expenses: `docker compose down`

> [!IMPORTANT]
> `scripts/setup.sh` creates a private `.env` with random secrets and never overwrites an existing file. Don’t commit `.env`. `docker compose down -v` permanently removes the database volume and its expenses.

## Architecture

```text
Browser → Nginx / React static assets
                 └── /api → FastAPI replicas → PostgreSQL
                              ↑
                         Alembic migration job
```

| Directory | Purpose |
| --- | --- |
| `backend/app` | Async API, authentication, validation, and database models |
| `backend/migrations` | Versioned Alembic schema migrations |
| `backend/tests` | API tests with isolated SQLite databases |
| `frontend/src` | Strict TypeScript React UI and query caching |
| `frontend/nginx.conf` | Same-origin API proxy, request limits, and security headers |
| `compose.yaml` | Production-shaped local container stack |
| `docs/deployment.md` | HTTPS deployment, scaling, backups, and operational limits |

Only the web container publishes a port. The database sits on an internal network. A separate migration service completes before API startup; API replicas do not race to modify the schema.

## Local development

Requirements: **Python 3.12+**, **uv**, and **Node.js 22.12+** (Node 24 also works).

Start PostgreSQL, exposing its port only on loopback:

```bash
bash scripts/setup.sh
docker compose -f compose.yaml -f compose.dev.yaml up -d db
```

API terminal, from the repository root:

```bash
set -a; source .env; set +a
export DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
cd backend
uv sync --frozen
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

Frontend terminal:

```bash
cd frontend
npm ci --ignore-scripts
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to port 8000, so development and deployment both use same-origin cookies. The browser’s local calendar date is used for expense entry and “today.”

## Validation

```bash
cd backend
uv run pytest
uv run ruff check .
uv run ruff format --check .

cd ../frontend
npm test
npm run build
```

API tests cover authentication, account isolation, CRUD, amount validation, filters, pagination, aggregates, CSV injection protection, and origin checks. They use SQLite for speed; CI also starts the actual PostgreSQL/Docker stack and runs `scripts/smoke.py` against the complete deployment, including authentication, CRUD, decimal totals, and CSV export. GitHub Actions runs all of these checks on pushes and pull requests.

`python3 scripts/smoke.py` can also check a disposable local deployment. It creates a test account and removes its test expenses; don’t run it against a production account database.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_DB` / `POSTGRES_USER` | `daybook` | Database name and role |
| `POSTGRES_PASSWORD` | Generated | URL-safe database password |
| `JWT_SECRET` | Generated | Shared session signing secret, at least 32 characters |
| `APP_ENV` | `development` | `production` disables API docs and requires secure cookies and HTTPS origins |
| `COOKIE_SECURE` | `false` | Set to `true` behind HTTPS |
| `ALLOWED_ORIGINS` | Localhost ports 8080 and 5173 | JSON array of exact browser origins |
| `ALLOW_REGISTRATION` | `true` | Disable new account creation after provisioning users |
| `WEB_PORT` | `8080` | Published web port |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `5` / `10` | Maximum database connections per API replica: 15 |

Each account chooses one currency at registration (USD, EUR, GBP, INR, CAD, or AUD). Existing expenses aren’t converted; currencies cannot be changed after registration. All monetary storage and API aggregation use decimal arithmetic; charts use JavaScript numbers only for display. Month-to-month change compares the selected month’s full total with the preceding month’s full total, not a matched elapsed-day comparison.

## Deploy

For the configured Vercel frontend/backend projects, see **[the Vercel guide](docs/vercel.md)** for production URLs, environment settings, migrations, and redeployment.

See **[the deployment guide](docs/deployment.md)** for HTTPS configuration, scaling, database backups, and production caveats. The included images can run on a Docker host or a container platform with managed PostgreSQL; the Nginx upstream discovery configuration is specifically for Docker Compose and must be adapted to other orchestrators.
