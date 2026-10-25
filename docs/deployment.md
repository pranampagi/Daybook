# Deployment and operations

## Single-host deployment

1. Copy this project to a Linux Docker host and run `bash scripts/setup.sh`.
2. Point your domain at an HTTPS reverse proxy/load balancer in front of port 8080. Terminate TLS there; do not expose development HTTP directly to the public internet.
3. Set these values in `.env` (substitute your actual domain):

```dotenv
APP_ENV=production
COOKIE_SECURE=true
ALLOWED_ORIGINS='["https://expenses.example.com"]'
ALLOW_REGISTRATION=true
WEB_PORT=8080
```

4. Run `docker compose up --build -d`. Restrict port 8080 to your reverse proxy with a firewall, or replace the web port mapping with `127.0.0.1:8080:8080` for a host-local proxy.
5. Verify `/api/ready` and `/healthz`, register your account over HTTPS, and optionally set `ALLOW_REGISTRATION=false` and recreate the API service.

The reverse proxy must preserve the browser’s `Origin` and `Sec-Fetch-Site` headers. Configure HTTPS redirects, HSTS, body/request timeouts, and request logging at the edge. Do not publish the API or database ports. Nginx limits auth traffic to five requests/minute/IP with a burst allowance; other API traffic is limited to ten requests/second/IP. If another proxy is in front of Nginx, configure `set_real_ip_from` with only that proxy’s trusted address range and `real_ip_header`; otherwise all users share the proxy’s IP limit. Never trust arbitrary forwarded IP headers.

## Scale out

The API keeps no per-process session state and can run behind a load balancer. All replicas must share PostgreSQL and the same `JWT_SECRET`.

```bash
docker compose up -d --scale api=3
```

Nginx resolves the Compose `api` service using Docker DNS and balances across its replicas. At the default pool settings, three replicas can open up to 45 PostgreSQL connections; budget connections for migrations, backups, and administration as well. Tune `DB_POOL_SIZE`/`DB_MAX_OVERFLOW` or add a connection pooler before increasing replica counts substantially. PostgreSQL indexes cover account/date and account/category/date lookups. Exports stream batches rather than loading every expense into API memory.

For a managed container platform:

- Build/push `backend/Dockerfile` and `frontend/Dockerfile` to your registry.
- Supply `DATABASE_URL` (async SQLAlchemy format: `postgresql+asyncpg://...`), `JWT_SECRET`, and the production environment values through a secrets manager. Use URL-encoded credentials and require database TLS when your provider mandates it.
- Run `alembic upgrade head` as one release/migration job before rolling out the API. Never launch migrations concurrently in every replica.
- Adjust `frontend/nginx.conf` to resolve your platform’s private API hostname rather than Docker’s `127.0.0.11` DNS resolver, or route `/api` directly to the API at your edge.
- Use `/api/health` as an API liveness probe and `/api/ready` as a database/schema readiness probe. Use `/healthz` for the web container.
- Run one Uvicorn process per container and let the orchestrator scale containers.

## Backups and restoration

Use provider snapshots/point-in-time recovery for managed PostgreSQL. For the included database, create a logical backup:

```bash
mkdir -p backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/daybook.dump
```

Store backups encrypted and off-host. Test restoration in a separate environment before relying on a backup. To restore into an empty replacement database:

```bash
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl' < backups/daybook.dump
```

Do not restore over a live database. Changing `POSTGRES_PASSWORD` in `.env` does not change the password of an already-initialized database; rotate the database role password separately and recreate the API containers with the matching secret.

## Updates

Back up the database, build new images, run the migration job once, then replace application containers. For this single-host stack:

```bash
docker compose build
docker compose run --rm migrate
docker compose up -d
```

Use backward-compatible migrations for rolling deployments. Pin images by digest in a production release and scan both OS and application dependencies regularly. The lockfiles make dependency installation reproducible, while base-image tags intentionally still receive upstream updates.

## Security and scope

- Session JWTs are stored in HTTP-only, same-site cookies; production requires the Secure flag. Signing secrets must be shared and kept private. Sessions expire after 24 hours by default. Signing-key rotation invalidates every existing session.
- Logout removes the browser cookie but does not revoke a copied JWT before expiry. There is no password reset, email verification, MFA, or server-side session revocation. Add these or use a managed identity provider before serving a public, higher-risk audience.
- Origin validation and browser fetch metadata reject cross-site writes. Every expense read, change, aggregate, and export is scoped to the authenticated account.
- Authentication throttling is at the Nginx edge, not distributed account-level throttling. Multi-host deployments should use shared edge limits and abuse monitoring. Public registration is on by default; disable it for personal deployments.
- Search uses escaped literal substring matching and may become expensive at high per-account volumes. Pagination is offset-based; use keyset pagination and PostgreSQL text-search/trigram indexes if usage grows significantly.
- There is no external telemetry, bank integration, budgeting advice, currency conversion, recurring-expense scheduler, or automated backup job. Add observability, retention policies, and disaster-recovery automation to match your deployment’s requirements.
- CI’s API behavior tests run against SQLite. The container smoke job validates PostgreSQL migrations, readiness, and end-to-end API behavior; add PostgreSQL-specific edge-case and load testing as traffic grows.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| API exits at startup | Secret length, non-placeholder secret, production HTTPS origins and secure-cookie settings |
| Web never becomes healthy | `docker compose logs migrate api web`; migrations must succeed first |
| Sign-in succeeds but session disappears | Production must be opened over HTTPS with `/api` on the same origin |
| Writes return 403 | `ALLOWED_ORIGINS` must match the browser scheme, hostname, and port exactly |
| Auth returns 429 | Wait for the edge limit; check trusted real-IP forwarding behind proxies |
| Database won’t accept new connections | Reduce replica pool sizes or increase PostgreSQL’s connection budget |
