# TradePilot mail worker

The mail worker is the Docker and self-hosted delivery process for `smtp_imap` accounts. It shares PostgreSQL with the TradePilot web app, delivers leased outbox rows through SMTP, and performs incremental IMAP synchronization for active accounts.

Resend accounts do not use this process. Cloudflare Workers send Resend outbox rows from the scheduled handler in `cloudflare-worker.ts`.

## Prerequisites

- Node.js 22 or the repository Docker image.
- A migrated TradePilot PostgreSQL database.
- The same `TRADEPILOT_CREDENTIALS_KEY` used by the web app when it encrypted email credentials.
- Network access from the worker to PostgreSQL and the configured SMTP/IMAP servers.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | None | PostgreSQL connection string |
| `TRADEPILOT_CREDENTIALS_KEY` | Yes | None | 32-byte base64url key for decrypting account credentials |
| `MAIL_WORKER_INTERVAL_MS` | No | `30000` | Poll interval in milliseconds, with a minimum of 5000 |
| `MAIL_WORKER_HEALTH_PORT` | No | `8790` | HTTP health check port |

Do not generate a new credentials key for this process. A different key cannot decrypt accounts already configured in TradePilot.

## Docker Compose

The one-command installers start `mail-worker` automatically. To manage it separately:

```bash
docker compose up -d mail-worker
docker compose logs -f mail-worker
docker compose restart mail-worker
```

Check the internal `/health` endpoint from the container:

```bash
docker compose exec mail-worker node -e "fetch('http://127.0.0.1:8790/health').then(async response => { console.log(await response.text()); process.exit(response.ok ? 0 : 1) })"
```

The JSON response includes database connectivity, the last completed run time, and a process-level failure count. `docker compose ps` should report the service as healthy.

## Manual run

Apply migrations first, export the required variables, then run:

```bash
node workers/mail-worker/server.mjs
```

The process handles `SIGINT` and `SIGTERM`, waits for the active poll to finish, closes the health server, and then closes PostgreSQL connections.

## Delivery behavior

- Claims up to 50 eligible SMTP outbox rows with PostgreSQL `FOR UPDATE SKIP LOCKED`.
- Uses a five-minute lease so another worker can recover abandoned rows.
- Retries failed SMTP delivery up to eight attempts using the configured backoff sequence.
- Stores sent messages and outbox state in one PostgreSQL transaction.
- Uses IMAP UIDVALIDITY and the last UID as the incremental cursor for each account.
- Resets the UID cursor when the server changes UIDVALIDITY.
- Sanitizes inbound HTML before storing it.
- Records safe failure categories without writing passwords or decrypted credentials to logs.

For deployment, Resend, webhook, and secret rotation details, see [the PostgreSQL deployment guide](../../docs/postgresql-deployment.md).
