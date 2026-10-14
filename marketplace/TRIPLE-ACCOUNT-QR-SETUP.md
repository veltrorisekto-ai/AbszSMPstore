# Marketplace Identity & Seller QR Setup — Current Policy (14 October 2026)

> This guide **supersedes the previous triple-account verification design**. WhatsApp verification and Minecraft account linking are NOT mandatory. There is no paid WhatsApp OTP provider requirement.

## Only Discord verification is required

1. A player registers/signs in at https://abszrpg.shop/marketplace/.
2. In **My Listings & Orders**, click **Verify Discord (/marketlink)** to request a one-time code (valid for 10 minutes).
3. In the **official AbszRPG Discord server**, run `/marketlink <CODE>` using the same Discord user ID as the account registration. This slash command runs through the **existing** bot and verifies control of that Discord account.
4. The Discord ID is locked after verified. Players cannot swap it from the website. Identity recovery requires audited staff intervention.
5. Once verified, a player can buy/sell and register a seller QR. **No WhatsApp phone number, paid OTP service or Minecraft plugin is required just to trade.**

**Never credit a Discord ID merely because a player typed a number or a moderator marked `is_verified`; `discord_verified_at` must be set by the actual /marketlink interaction.** Users with older marketplace accounts remain gated until they link Discord.

## Optional Minecraft profiles

- Players may link a Bedrock XUID and a Java UUID as optional identity/profile enhancements, separately.
- Linked edition identities cannot be silently changed; adding Java does not replace Bedrock.
- The `/market link` server bridge is required only to use this optional feature. It is **not a prerequisite for creating listings or orders**.
- Independent Minecraft item-transfer evidence remains useful for verified trade reputation where supported; otherwise owner-reviewed staff-supervised trades can be considered with real evidence.

## Seller direct QR payments

- Seller submits own QR image or HTTPS link and actual bank/e-wallet recipient name; owner reviews and approves.
- An RM listing needs an approved QR and verified Discord for the seller and buyer.
- Order snapshots the QR and recipient. Only order participants can view the QR while the order is in progress.
- Buyer pays seller directly in their bank/e-wallet app; `I Have Paid` means **buyer claims to have paid**, not that payment was verified.
- Seller checks actual incoming bank/e-wallet transaction before marking payment received. **Self-reported payment is not independent bank evidence.**
- Staff midman coordinates a private ticket and never holds RM funds as escrow in this setup.
- Seller trust increases only after independently checked evidence and anti-abuse rules; fake / repeated orders don't automatically increase reputation.
- Launch service fee remains 0%.

## Discord bot onboarding

Owner logs in and opens Owner Moderation > Connect Existing Bot & 8 Channels. Use the existing eight supplied channel IDs. Then **Publish / Refresh All 8 Channels** to update previous messages; do not create an extra bot. Channels with no actual events can still show informational welcome posts.

## Safeguards and limitations

Discord-only is free but **less resistant to alt accounts** than multiple independently verified identities. Keep limits on pending orders, repeated-pair fraud reviews, payment disputes, unique evidence IDs, seller QR locking and owner reputation reversals. Discord verification alone **does not verify funds or Minecraft item delivery**.

The backend API and UI are deployed separately from actual Discord bot slash-command registration, private-channel permissions, bank payments or optional Minecraft bridge testing. Do not claim real end-to-end confirmation until those systems are exercised with test participants. Minecraft/Mojang rules and Malaysia's applicable laws still apply to selling items for RM.

Official store checkout and payments are not changed by this marketplace identity policy.
