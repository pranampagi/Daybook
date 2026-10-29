# Daybook on Vercel

## Current deployment

| Component | Project | Production address |
| --- | --- | --- |
| React frontend | `daybook` | `https://daybook-iota-blue.vercel.app` |
| FastAPI backend | `daybook-mlny` | `https://daybook-mlny.vercel.app` |

The projects share this repository but use different root directories: `frontend` and `backend`. `frontend/vercel.json` proxies `/api/*` to the backend with its `/api` prefix intact. The browser therefore uses same-origin requests and HTTP-only session cookies.

The backend explicitly exports `app.main:app` through `pyproject.toml` and pins Python 3.13. Vercel uses Python functions, not the Docker Compose services. Keep Docker for local development.

## Environment variables

Store these in the backend Vercel project's environment settings, never in Git:

| Name | Production value |
| --- | --- |
| `DATABASE_URL` | Your hosted PostgreSQL connection string |
| `JWT_SECRET` | Your private, random signing secret |
| `APP_ENV` | `production` |
| `COOKIE_SECURE` | `true` |
| `ALLOWED_ORIGINS` | `["https://daybook-iota-blue.vercel.app","https://daybook-pranampagis-projects.vercel.app"]` |
| `ALLOW_REGISTRATION` | `true`, or `false` after provisioning your accounts |
| `DB_POOL_SIZE` | `1` |
| `DB_MAX_OVERFLOW` | `0` |

The API accepts standard `postgres://`/`postgresql://` provider URLs and normalizes them to `postgresql+asyncpg://`. It translates `sslmode` into asyncpg's `ssl` parameter and removes the unsupported libpq `channel_binding` parameter. Use `sslmode=verify-full` or `ssl=verify-full` when your provider supports certificate and hostname verification. Never disable TLS for a remote production database.

On Vercel, SQLAlchemy uses `NullPool`, closing connections when a request's session finishes. This prevents per-function idle connection pools from accumulating and avoids reusing async connections across event-loop lifecycles. For higher traffic, use your provider's compatible connection pooler and validate its prepared-statement behavior with asyncpg.

The initial setup had shared production/preview environment-variable entries. Updating one shared entry updates both environments. Before using previews, create separate preview database credentials and signing secrets, and explicitly allow only trusted preview origins. Do not allow every `*.vercel.app` origin.

## Database migrations

The initial PostgreSQL schema migration has been run. Future schema changes still require `alembic upgrade head` once before application rollout.

Preferred workflow: run Alembic from a trusted release job with the production `DATABASE_URL`. Do not run migrations in API request handlers, and do not run multiple migration jobs concurrently.

Vercel Secret values may not be downloadable with `vercel env pull`. For the initial setup, a one-time, unpublished production deployment ran `python -m alembic upgrade head` as its build command, using Vercel's existing secrets. This command was not saved as the project's permanent build command. Regular deployments need no migration build override.

## Deploy updates

From the repository root, after the CLI is authenticated:

```bash
npx vercel deploy . --project daybook-mlny --scope pranampagis-projects --prod
npx vercel deploy . --project daybook --scope pranampagis-projects --prod
```

Commit the deployment configuration before relying on Git-triggered deployments. `.vercelignore` excludes local `.env` files, virtual environments, generated caches, and dependencies from CLI uploads. `.gitignore` separately excludes credentials and Vercel link metadata from commits.

Redeploy the backend after updating environment variables. If you add a custom frontend domain, add its exact HTTPS origin to `ALLOWED_ORIGINS`, then redeploy. The backend's production address must be reachable by the frontend proxy; a protected preview URL is not a substitute for the stable production hostname.

## Verify

```bash
curl --fail https://daybook-mlny.vercel.app/api/ready
curl --fail https://daybook-iota-blue.vercel.app/api/ready
```

Both should return `{"status":"ready"}`. Test login, expense actions, CSV export, and logout from the frontend domain. `/api/docs` is deliberately disabled in production.

Do not run `scripts/smoke.py` against production unless you intend to leave a test account in the database. It removes its expenses but does not remove its account. Use isolated test databases for routine automated deployment checks.

## Public deployment caveats

The Docker Nginx request limits do not apply on Vercel. Configure suitable Vercel Firewall or another trusted edge's rate limits before opening registration to an untrusted audience. The frontend has equivalent security headers in `vercel.json`, but headers are not a replacement for abuse protection.

Keep database backups, monitor backend function errors and database connection usage, and consider disabling public registration for a personal expense tracker. The app does not yet provide email verification, password reset, MFA, or session revocation.
