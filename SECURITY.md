# Security

> [!WARNING]
> **Not security audited. Do not use with real funds.** crypto-recovery is a foundation and a demonstration: it uses
> the platforms' stores as their documentation says to, but no independent party has reviewed this code.

## Reporting a vulnerability

Please report privately, through GitHub's [private vulnerability reporting](https://github.com/hzblj/crypto-recovery/security/advisories/new)
on this repository, not in a public issue. Include what you found, how to reproduce it, and which version. You will get
an acknowledgement, and a fix or an explanation, as soon as it can be worked out; a confirmed issue is disclosed in the
changelog and a GitHub advisory once a fixed version is published.

The seal itself (Argon2id or HKDF-SHA256, XChaCha20-Poly1305, the format) is [`@hzblj/nitro-crypto`](https://github.com/hzblj/nitro-crypto)'s
engine, and sealing and opening a wallet, under a password or a passkey, is [`@hzblj/crypto-vault`](https://github.com/hzblj/crypto-vault)'s:
report anything about them there.

## What the store protects

`@hzblj/crypto-recovery` keeps sealed backups in the platform's end-to-end encrypted store
([ADR 0001](docs/adr/0001-platform-store-for-sealed-backups.md)):

- **It holds ciphertext only.** What it keeps is the engine's seal, which only the password or the passkey it was
  sealed under opens. No call takes a password, a passkey's output, words or entropy, and `save` refuses bytes that do
  not carry the backup format's magic ([ADR 0002](docs/adr/0002-passkey-sealed-backups.md) for passkey backups).
- **Two layers.** iCloud Keychain and Block Store encrypt end to end under the user's account (Block Store only where
  it says so, which `reach()` reports). Under that, the engine's seal: under a password, Argon2id makes each guess cost
  about half a second and 64 MiB; under a passkey, the key is 32 random bytes the passkey gives only after its own
  user verification.
- **Nothing beside the backup.** No credential id or salt is stored: the vault finds the passkey without them.
- **No cryptography here.** Nothing in this package derives a key, encrypts or decrypts.

## Out of scope

- The password: how strong it is, and how the person keeps it. A backup is as strong as its password.
- The passkey: who can use it. Anyone with a device it synced to, or its provider's account, can open a backup sealed
  under it, and losing it loses the backup.
- Who can read the store: anyone with the user's Apple Account or Google Account and its devices can copy a backup.
  The seal is what keeps it then.
- A compromised or rooted device, or code execution in the app's process.

## Known limitations

- **iOS cannot tell whether iCloud Keychain is on.** A backup saved while it is off stays on the device until it is
  turned on.
- **Block Store restores at a new phone's setup,** not later, and holds 16 entries per app.
