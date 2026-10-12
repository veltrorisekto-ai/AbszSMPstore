# Proposed Marketplace Coin Launch — RM1 per Coin / 0% fee

## What is ready right now

- The official store already displays the owner's Touch 'n Go QR from the existing payment settings.
- Existing QR purchases are **manual payment claims** requiring owner review; “I HAVE PAID” is not proof.
- The player marketplace currently stores listing prices as COINS but has **no actual linked coin wallet, top-up ledger, automatic balance debit, funds reservation or seller credit transfer**.
- Posting a Discord guide must **never** be interpreted as live coin payments or an entitlement to credits.

## Decision needed before enabling paid top-ups

**Will sellers spend their earned Marketplace Coins only within their own Minecraft server, or will they be allowed to cash out coins into Malaysian Ringgit?**

If coin withdrawal is allowed, this is a different financial product requiring appropriate payment provider, safeguarding, risk checks and legal/regulatory review; do not accept paid top-ups first.

Minecraft's Usage Guidelines permit sale and use of virtual currencies only if there is no real-world value, no cash-out, no conversion into real-world currency and no transfers or use across servers. Thus “RM1 per Coin” can only describe a **purchase price** and must not suggest that a Coin is redeemable for RM1. Multiple Minecraft servers must not share spendable server coin balances.

## Minimum safe engineering design if sellers cannot cash out

1. **Separate one wallet per player per server**, with a fixed `server_id`, so balances and earn/spend are not transferable between the Bedrock Realms, Economy and Java servers.
2. **Top-up request:** an authenticated player selects their server and exact whole Coin amount. Server creates a unique short `topup_code` and locked RM amount at RM1 per Coin, showing the existing configured Touch ’n Go QR. Record `WAITING_PAYMENT`, `CLAIMED`, `PAID`, `REJECTED`, `REFUNDED` transitions and payment details in a separate table, never in the existing product order table.
3. **Evidence check:** the buyer clicks I HAVE PAID, but only the owner's manual approval of a verified incoming payment may call the idempotent credit transaction. No payment screenshot alone unlocks funds.
4. **Double-entry ledger:** credit approved paid amount exactly once; record transaction ID, buyer wallet ID, server, unique payment reference, audit actor and timestamp. A repeated approval cannot credit twice. Never trust a balance from the browser.
5. **Buying:** server-side transactional stock reservation and wallet debit of exact Coin price. Reserve buyer Coins pending delivery; do not release to seller while contested. No conversion to RM or payout. Buyer/seller cannot manipulate balances by “Order Received.”
6. **Settlement:** independent server trade proof or staff review, unique transaction IDs, dispute window and owner arbitration; ensure seller wallet is credited only once for a valid fulfilled order. Refund buyer once for a cancelled/no-delivery order.
7. **Anti-abuse:** link actual Minecraft and Discord identities, rate limits, suspicious patterns, self-trade blocking, independent verified reputation and seller flags. Never credit reviews from account clicks.
8. **0% launch service fee:** fee applies to the marketplace transfer only and is exactly zero; payment-provider fees, if any, should be disclosed and never hidden.

## Channel onboarding

The existing bot now has an owner-only publish action for eight existing channels. The bot can post public **welcome/instructions**, not fabricated listings or trades; verified-trades and seller-reviews remain quiet until real evidence-backed events. The existing guide is edited instead of duplicated where an earlier message ID is stored. Private security/dashboard posts fail closed if channel access rules have not been confirmed.
