# AbszRPG Marketplace — Triple Identity and QR Security (October 2026)

This is an **additive marketplace-only implementation**. The original store's Touch 'n Go checkout, store orders, Discord bot and Minecraft delivery bridge remain unchanged.

## Trading eligibility

**No player may publish listings, purchase, accept/confirm receipt, verify payment, or receive trusted reputation until both buyer and seller have all three independently verified:**

1. **Discord user ID** — /marketlink one-time code through the existing Discord interaction bot. The matched Discord ID is frozen after verification; no self-service unlink/swap.
2. **WhatsApp number** — real provider OTP (Twilio Verify, WhatsApp channel), limited rate and attempts. One verified number per account, no self-service change; masked in UI and never listed publicly.
3. **Minecraft identity** — authenticated game-server bridge verifies either **Bedrock XUID** or **Java UUID** and in-game username. Once linked, that edition's identity is immutable. The same marketplace profile may bind a **second Java account after Bedrock**, or Bedrock after Java. A second edition never replaces an existing edition. Duplicate XUID/UUID binding across players is rejected.

The user can still browse and sign in with incomplete identity. Old legacy self-declared Discord IDs and old minecraft_uuid strings do NOT count as verified Bedrock/Java identity. Old listing orders are preserved; unverified accounts cannot create new trades. Sellers can still PAUSE an old listing.

**Staff recovery:** do not provide a self-service identity swap API. Account deletion/exceptional recovery needs owner review, auditable records, and compliance with applicable privacy rights.

## WhatsApp setup — required before any player can trade

The Vercel project was checked during implementation. It has **no configured WhatsApp verification provider credentials**.

Set these as encrypted Vercel environment variables, not in ChatGPT or GitHub:
- TWILIO_VERIFY_SERVICE_SID (VA...)
- TWILIO_API_KEY_SID (SK...)
- TWILIO_API_KEY_SECRET

Use a real Twilio Verify Service configured for the **WhatsApp** delivery channel, and verify it can send international Malaysian +60 OTPs. Service must be approved/configured with any required WhatsApp sender or authentication template. API uses TLS+Basic Auth to POST /v2/Services/{ServiceSid}/Verifications with Channel=whatsapp and /VerificationCheck with the user-entered OTP.

**No mock OTP fallback, manual 'WhatsApp verified' owner override or bypass for missing credentials.** The backend returns an explicit 503 until real provider credentials exist, without consuming attempts. SMS is NOT silently substituted for WhatsApp.

Rate limits: max 5 OTP starts per 24-hour window per account, >=60 seconds between requests, max 6 OTP check attempts, expiry of 10 minutes. Phone only persisted to the player after provider reports approved. Avoid exposing phone numbers in Discord logs or public API.

## Minecraft server bridge — required before trading

Existing server API credential is HTTP **Authorization: Bearer <existing BRIDGE API KEY>** over TLS, supplied only from trusted Minecraft server code. The bridge key is **not** exposed to players. To link, the real in-game player enters /market link <one-time code> and the server retrieves actual platform identity from authenticated server identity APIs.

POST https://abszrpg.shop/api/market-proof with JSON. Example format — this is **documentation, not a fabricated verification**:

For Java:
{
 "op":"link","code":"<ONE_TIME_CODE>","edition":"JAVA",
 "minecraft_uuid":"<ACTUAL_JAVA_UUID>","minecraft_name":"<ACTUAL_IGN>",
 "server":"Java 1.21.1"
}

For Bedrock:
{
 "op":"link","code":"<ONE_TIME_CODE>","edition":"BEDROCK",
 "bedrock_xuid":"<ACTUAL_MICROSOFT_XUID>","minecraft_name":"<ACTUAL_IGN>",
 "server":"Bedrock Realms"
}

**Do not derive XUID from display name.** The Bedrock player identity must originate from the authenticated Bedrock login/bridge. Do not use Java UUID for Bedrock identity. Never accept buyer-posted / self-provided UUID/XUID as proof.

Current Minecraft server plugins were **not modified by this website rollout**. The code above is an authenticated backend integration contract; the actual Paper/Geyser and Bedrock add-on must be updated and tested before users can link.

## Seller QR registration & manual payment

- Verified seller submits a small QR PNG/JPEG/WebP file (under 100KB) or an HTTPS image URL and the bank/e-wallet recipient name.
- QR status starts PENDING. Owner checks actual recipient identity independently, then APPROVES or REJECTS. QR is immutable from player side after submission, including rejected QR; owner-assisted recovery required.
- A new MYR listing is only permitted with an APPROVED QR.
- Buyer and seller must both be triple verified before order creation.
- The order **snapshots** the approved recipient name and QR. The QR is served privately to authenticated order participants only when the order is in progress, not in the public listing API or bot.
- Buyer pays **directly to seller** using the QR in the order. Middleman option coordinates/order ticket; it DOES NOT receive, custody, disburse or escrow the money.
- 'I Have Paid' is only a **CLAIM**. Seller must check incoming funds in their own bank/e-wallet app; seller confirmation remains **self-reported**. Screenshot is not confirmation from a payment service or bank. The seller cannot mark the RM order delivered until confirming payment.
- Buyer confirms item delivery separately. Verified seller reputation still requires independently checked evidence. A dispute suspends verified reputation credit.
- Launch marketplace service fee remains **0%**. No wallet balance, paid coin cash-out or withdrawable virtual-currency ledger is created. COINS listings continue separately as non-cash-out in-game currency.

## Critical caveats

1. Microsoft/Mojang Minecraft monetization requirements can restrict real-money server/item sales, virtual currencies, server rewards and pay-to-earn. Confirm the allowed product categories before encouraging real-money trading.
2. A direct QR transfer is **not escrow**; refunds and payment disputes cannot be automatically enforced by this platform. Middleman-held money is **not implemented** (would require a suitable licensed/contracted payment provider).
3. Discord + WhatsApp + Minecraft identity linking reduces obvious fake trades but cannot eliminate fraud by users owning multiple legitimate accounts/phone numbers. Keep pairwise trade limits, unique proof IDs, reputation revocation and moderator investigation.
4. WhatsApp phone numbers are personal data. Retain/use only as needed for identity verification, protect access, publish a privacy notice and handle legitimate deletion/account-recovery requests; never expose phone to other users.
5. The QR flow is not a guarantee that Minecraft items can legally be traded for RM; users need to verify both game policies and local financial/consumer obligations.

## What was tested

Static JS syntax and Vercel preview GET/unauthenticated API smoke tests. Real WhatsApp OTP delivery, real authenticated Bedrock XUID/Paper UUID game bridge, production QR money movement and player-to-player item delivery cannot be tested until the user configures a provider and server extension. Do NOT claim full end-to-end live verification yet.
