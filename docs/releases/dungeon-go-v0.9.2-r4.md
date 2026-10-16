# Absz Dungeon GO! v0.9.2 R4 / Aegis release

Released after the owner confirmed entry into the game on Android on 16 October 2026. The precise phone model and Android version were not supplied. This confirmation does not independently establish retention of an older guest session after the earlier uninstall.

## Installers and content

| Item | Release | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Android ARM64 APK | 0.9.2 R4, versionCode 11 | 28543876 | d2a5bae7b530e499723429187b14b3e18b3f8239624a562b365fbb2a71442453 |
| Windows ZIP | 0.9.1, unchanged | 35522022 | eff2ed3dc172489f966a36f992cea4f44708f0d78db974a93e097cdd64f5f4d7 |
| Windows EXE | launcher 10, unchanged | 98637864 | 2b131fa96b504b6b5ee294d977bfab91e04078e47d0d4a9091ecbf6db3653519 |
| Shared Aegis content PCK | 0.9.2-aegis-r1 | 22836344 | d7a6c55fac061ba275d378686ef16fbfcc4803a11ff1a824f016fcca45ee65f9 |

Android package: `org.abszgaming.abszdungeongo`. The R4 build was signed with the original Android certificate, SHA-256 `226667a820cad3f531d1a022406ec40c8e96aa522fb1777d936c60b076e69ab2`, matching v0.9.1. Install over the existing app; do not uninstall or clear data.

The Windows download is the existing verified installer. Aegis and server selection arrive as signed compatible game content. No new Windows executable or native Windows build is claimed.

## Published channels

- Android scoped alpha: `channels/android/alpha.json`, sequence 7, Android R4 approval.
- Global alpha used by Windows: `channels/alpha.json`, sequence 7, original Windows launcher approval and R4 Android approval.
- Global cross-platform tester: `channels/tester.json`, sequence 6, tested before alpha promotion.
- Scoped Android tester remains sequence 6.
- Website `_channels/` mirrors use the same signed bytes as Cloudflare R2.
- Immutable signed snapshots: `releases/0.9.2-aegis-r1/alpha-android-seq7.json`, `alpha-cross-platform-seq7.json`, `tester-cross-platform-seq6.json`.
- Public release metadata/checksums: `downloads/0.9.2-r4/release.json` and `SHA256SUMS.txt` in R2; first-party website `downloads/release.json` and `downloads/SHA256SUMS.txt`.

All envelopes use the original protected RSA signing identity. No private credentials are included in the website repository or R2. Existing APKs, Windows ZIP and content objects retain their immutable paths.

## Validation and limits

- Owner reports successful Android entry into the R4 Aegis game through tester.
- Downloaded R4 APK and original Windows ZIP again; full SHA-256 values match.
- Downloaded all six Aegis chunks again; checked each signed SHA-256/size and assembled exact PCK.
- Original public RSA key verifies the new envelopes; live tester downloaded back matches staged bytes.
- Ran Godot 4.5.1 against resources embedded in the actual original Windows EXE: original release verifier accepts the genuine RSA envelope and original EXE version/size/SHA-256; wrong native bytes fail closed; Aegis PCK mounts, compiled main scene loads, server selection appears before authentication. Seven checks pass for the live tester and alpha candidate.
- This compatibility test runs the embedded Windows launcher resources in the matching Linux Godot engine. It is not execution of the PE binary on Windows. Native Windows graphics, input and cross-device multiplayer still require a Windows tester result.
- Website regression suite: 22 passing tests, covering existing storefront/catalogue/order/bridge behavior, platform-specific versions, immutable redirects and rejection of foreign/unsafe release paths.
- The deployment changes download UI/metadata, scoped and global release mirrors, release documentation and downloads CSP only. Marketplace, products, payment handlers, hosting and navigation routes are preserved.

## Realm and data

Aegis runs on Cloudflare Workers with durable SQLite-backed player state. Region label: **Malaysia Community**. Cloudflare-managed Southeast Asia placement was requested; physical hosting in Malaysia is not asserted.

Aegis is a separate realm. Its accounts and character slots do not migrate existing Dawnspire data. Legacy tokens/player progression remain in the original realm; that service previously returned a confirmed Neon quota error. Switching realms must not delete either credential file.

## Rollback

Retain the same Aegis Durable Object namespace and instance identity; never rename/delete them during a code rollback. Prior APK, Windows ZIP and content objects remain available. Release policy explicitly permits the retained previous content hash. A metadata rollback must be newly signed at a sequence greater than the highest published sequence; never republish a sequence-1 envelope as a live rollback. Git parent and Vercel deployment history preserve website rollback references.
