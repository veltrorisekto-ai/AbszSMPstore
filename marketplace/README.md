# AbszoluteCraft Player Marketplace

Access after deployment: https://abszrpg.shop/marketplace/

This page is separate from the official Store and its Touch 'n Go checkout, Minecraft delivery bridge, and order tables. The original store checkout, products, search, admin orders, catalogue, and server join flow are preserved.

## Player workflow
1. Sign up using a Minecraft username, Discord user ID, Discord display name and strong password of 12 or more characters. Player accounts are **not** connected to Minecraft or Discord OAuth, so identities are initially self-declared and explicitly unverified. Use Discord Developer Mode > Copy User ID.
2. Select **Sell an Item** to create a listing with category, server, exact item details, price, optional HTTPS image and stock. Prices support in-game coins only; no cash-out or conversion to RM.
3. Browse and search listings, view seller profiles, completed-trade counts and reviews, and select **Buy Item**.
4. Buyer selects a route: **Request Midman** for pending staff-supervised trading, or **Chat Seller on Discord** for a direct trade. The direct seller must accept the order before claiming delivery.
5. When an order progresses the seller may click **Mark Item Delivered**. Only the buyer can click **Order Received** after actually receiving the item. This closes the order as completed.
6. A completed order permits exactly **one buyer review per order**. Seller ratings are calculated from real records in the marketplace database. Seller cannot review themselves from the same account.
7. Pending orders can be cancelled with stock restored; active trades can be disputed and moderated by the website owner.

## Owner moderation
- Open https://abszrpg.shop/marketplace/ and select **Owner Moderation** in the footer. The existing official store owner login is used, not a new moderator password.
- Review pending midman requests and disputes. Independently verify real staff member identities inside your official Discord server before approving supervision.
- Manually check Discord and Minecraft identity before using **Staff-Verify Identity**. A staff-checked badge is not insurance, a delivery guarantee, or proof of a payment.
- Owner may approve supervised orders, resume disputes, cancel disputed orders and toggle verified seller badges.

## Protections and limitations
- Player passwords are hashed with bcrypt at cost 12.
- Signed HttpOnly/Secure/SameSite Strict session cookies use the existing SESSION_SECRET; server checks permissions for each sensitive action.
- Failed login lockouts; server validation and parameterized SQL; atomic inventory reservation and restoration on cancellation.
- One review per completed order, enforced by a database uniqueness constraint.
- Direct Discord contact links to the seller-supplied Discord user ID. Seller identity is not independently verified until the owner marks it as manually checked.
- No automatic Minecraft inventory inspection or item movement, no built-in external payment collection, custody, reversal, insurance, or escrow.
- Staff-supervised means a manual staff workflow, not automated escrow or a payment guarantee. Owner can ban fraudulent accounts and remove listings.
- Two colluding accounts could falsify completed trades and reviews. Stronger anti-abuse, Discord OAuth and actual Minecraft delivery proofs are needed before treating seller ratings as fraud-proof.
- No self-service marketplace password recovery or account-ID change workflow yet. The owner should establish a manual support and account-recovery policy.
- Database setup uses CREATE TABLE IF NOT EXISTS only on new market_players, market_listings, market_orders and market_reviews tables. Existing official store data is not migrated or deleted.
- Ensure the existing Neon DATABASE_URL and SESSION_SECRET are configured.
- Specify eligible items in the server rules, confirm Minecraft/Mojang terms and any relevant local laws, and publish a dispute support channel. In-game coins must not acquire real-world value or be exchanged for RM.
- Review responses to external trades cannot reverse payments or force a seller to return items.

## Smoke test status
- [x] Preview marketplace URL HTTP 200.
- [x] Marketplace JavaScript and CSS served.
- [x] Marketplace listing API HTTP 200; new tables initialized.
- [x] Anonymous session API HTTP 200.
- [x] Frontend and backend JavaScript syntax parsed.
- [ ] End-to-end real-account testing of registration, purchases, moderation, delivery, review, cancellations and disputes remains to be completed.
- [ ] Owner verification of the actual Discord staff midman process remains to be completed.

## October 13 integration update

The current marketplace gains an additive, independently verified-trade layer. Buyer confirmation stays unverified and gives no seller reputation, and reviews require independently verified reputation-eligible orders. The existing Discord bot is reused for eight supplied channel IDs, on-demand midman tickets, product/deal embeds, trusted review cards, and an updatable website-derived dashboard. See DISCORD-VERIFIED-TRADE-INTEGRATION.md for IDs, role requirements, evidence checks and the Minecraft plugin dependency.
