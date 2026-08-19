# AbszSMP Store API

Production serverless API layer.

Endpoints:

- `/api/store`
- `/api/order?action=create`
- `/api/order?action=claim-paid`
- `/api/order?action=track`
- `/api/admin`
- `/api/discord`
- `/api/bridge`

Required Vercel environment variables:

- `DATABASE_URL`
- `SESSION_SECRET`
- `DISCORD_BOT_TOKEN`
- `DISCORD_PUBLIC_KEY`

The API intentionally keeps Touch 'n Go verification manual:

Buyer pays QR → buyer claims paid → Discord approval → Minecraft delivery queue.
