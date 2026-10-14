> CURRENT POLICY: 14 October 2026 — verified Discord is the only mandatory identity check. No WhatsApp verification or paid OTP service. Optional Bedrock/Java links remain available.

# AbszRPG Marketplace — Existing Discord Bot & Verified Transactions

This extension uses the **same** bot configured by `DISCORD_BOT_TOKEN` and the **same** Ed25519 interaction endpoint `/api/discord`. No new bot token or new fixed channels are required. The existing join-server buttons and official-store payment approval handlers are untouched.

## Existing Discord channel IDs

| Purpose | Channel ID |
|---|---|
| 🛒 marketplace | 1559255601857433682 |
| 🏷️ marketplace-deals | 1559269419786440805 |
| ✅ verified-trades | 1559269472815161384 |
| ⭐ seller-reviews | 1559269515819356321 |
| 🛡️ middleman-service | 1559269556051255337 |
| 📜 marketplace-guide | 1559269589102231592 |
| 🚨 trade-security-logs | 1559270627234414743 |
| 📊 marketplace-dashboard | 1559270798609485895 |

These IDs are baked in as **fallback targets**. Once the existing owner logs in and opens **Owner Moderation > Connect Existing Bot & 8 Channels**, the endpoint verifies all eight belong to the same Discord server and verifies private staff channel permissions, registers `/marketlink` and `/marketstats` on the existing application, and publishes an updatable guide and dashboard.

The bot cannot post without proper View Channel/Send Messages/Embed Links permissions. Staff-only channels must deny View Channel for everyone and must not grant viewing permission to any unapproved role/user; bot publishing fails closed otherwise. The owner can update guide/dashboard without duplicating fixed messages.

## Verified transaction model

- `PENDING / IN_PROGRESS / DELIVERED`: no verified reputation.
- `COMPLETED + UNVERIFIED`: both parties clicked that the trade finished. **+0 reputation; no trusted review.**
- `COMPLETED + VERIFIED`: trusted server evidence or independent staff-confirmed supervision. This does not automatically mean the trade earns a reputation credit.
- `reputation_eligible=true`: after the buyer and seller have verified Discord links, independent trade evidence, uniqueness checks, and repeated-trade checks. Minecraft linking is optional, not a trading prerequisite.

The system records unique server proof IDs and unique staff evidence references. Buyer/seller must be different account identities. More than four additional trades by the same pair within 24 hours or repeated disputes require review; the same buyer pair earns at most one eligible credit per 24 hours. Owner can revoke a verification and its ranking credit with a recorded reason. Fraud detection cannot prevent every multi-account conspiracy.

The **direct Discord** method cannot obtain staff-only verification; it requires independent Minecraft server transfer proof. **Middleman** method requires owner approval and real staff evidence. No button click alone promotes a trade to verified.

## Discord and Minecraft linking

A player visits My Listings & Orders > Verify Discord to create a 10-minute single-use `/marketlink CODE` for the existing bot. The Discord user ID must match the account. This is the ONLY mandatory identity check. Optional Bedrock/Java linking uses `/market link CODE` only where the Minecraft server bridge is available.

The authenticated bridge endpoint `POST /api/market-proof` uses the existing hashed Minecraft bridge credential. Its `link` operation verifies a real Minecraft UUID on the server side. Its `trade_proof` operation needs the exact order server, linked buyer/seller UUIDs, exact quantity and coin price, a unique transaction ID, an item-transfer event ID, and a currency-ledger event ID. **The endpoint is implemented; this does not imply any of the Bedrock/Java server plugins already send those events.**

Do not send simulated proof events or infer actual inventory/currency transfers from the website.

## Private middleman tickets

Owner moderation can **Open/Find Private Ticket** for each middleman order. The existing bot creates a temporary Discord channel denying visibility to everyone except configured staff roles, bot, and Discord-linked buyer/seller identities. When the ticket is archived, participant permissions are removed and a private staff-only audit record remains. These are *on-demand tickets*, not additional fixed public channels.

Tickets require a staff role already allowed in the official store's Discord integration. Bot requires Manage Channels and access permissions.

## Deals, listings, dashboard and reviews

New listings send item details, optional image and Buy/Seller buttons. Seller price reductions and restocks send announcements to marketplace-deals. Verified-trades and seller-reviews do not post merely from two button clicks; they only post after independent verification. Dashboard reports database numbers, never illustrative figures. Suspected repeated trades and disputes go to private trade-security-logs only after private permissions pass.

## Safety and rollout

Existing official store payments, admin sessions and join features are preserved. The marketplace only alters its own tables through additive migrations. This is **not** financial escrow and does not custody real-world money, in-game items, or coins.

**Before advertising the Discord-only flow as fully working:** test two real accounts and the existing /marketlink slash command, seller QR approval, genuine QR payment claims and manual seller confirmation, private middleman tickets, independent evidence reviews, dispute reversal and review deduplication. Minecraft bridge item-proof tests are optional integrations, not identity prerequisites. A successful Vercel deployment cannot verify the Minecraft plugin or Discord role/channel settings by itself.
