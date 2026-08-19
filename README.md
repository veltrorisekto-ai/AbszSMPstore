# AbszSMP Store

Production storefront for **AbszSMP — Return of Eldra, Season 5**.

The repository contains the public store, owner control panel, Vercel Functions, Discord interaction endpoint, and the HTTP API used by AbszStoreBridge.

## Safety model

The store boots in **Setup Mode** (`store.live = false`). Checkout cannot create orders until the owner explicitly presses **GO LIVE**. Launch is blocked unless the store has:

- a Touch 'n Go QR image;
- at least one active product with trusted fulfillment commands;
- Discord approval configuration and a private bot token;
- a generated Minecraft bridge key; and
- a recent AbszStoreBridge heartbeat.

Pressing **I HAVE PAID** never verifies payment. It only creates an `AWAITING_ADMIN` claim. An authorized admin must manually verify Touch 'n Go and approve the order before delivery is queued.

## Production environment

Copy `.env.example` into the hosting provider's secret/environment-variable system. Never commit real values. The required production values are `DATABASE_URL`, `SESSION_SECRET`, and `DISCORD_BOT_TOKEN`. Email password reset additionally uses Resend credentials.

## Main endpoints

- `/api/store` — public catalogue, payment display data, server status
- `/api/order` — order creation, payment claim, private-token tracking
- `/api/admin` — owner setup/auth, products, orders, integrations, launch controls
- `/api/discord` — Discord signed interaction endpoint
- `/api/bridge` — authenticated Minecraft heartbeat/delivery queue/ACK

## Owner setup

After the first deployment, open `/admin/login`. If no owner exists, the site presents the one-time owner creation screen. Save the emergency recovery code immediately; only its hash is stored.

## Minecraft delivery

AbszStoreBridge must send the one-time bridge key as a Bearer token, heartbeat regularly, pull queued delivery jobs, execute only the commands returned by the trusted store backend, and ACK success/failure. Delivery jobs are idempotent and stale in-progress jobs can be reclaimed after a worker interruption.
