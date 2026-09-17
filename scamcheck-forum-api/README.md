# ScamCheck Forum API

This service provides the members-only ScamCheck Forum. It is designed for Railway + PostgreSQL.

## Required Railway variables

- `DATABASE_URL` — reference the Railway PostgreSQL service, for example `${{Postgres.DATABASE_URL}}`.
- `FORUM_JWT_SECRET` — a long random secret. Never expose this in the website.
- `CORS_ORIGINS` — comma-separated web origins, including `https://scamcheck-azure.vercel.app`.

Optional:

- `FORUM_ADMIN_EMAIL` — the email address that should be given moderator access when it registers.

## Run locally

```powershell
npm install
$env:DATABASE_URL = 'postgresql://...'
$env:FORUM_JWT_SECRET = 'replace-with-a-long-random-secret'
npm start
```

The server initializes its schema safely on startup. The `/health` endpoint is public; every Forum endpoint requires a valid session token.
