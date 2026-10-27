# 2. Backups sealed under a passkey, kept as they are

Accepted. Amends [0001](0001-platform-store-for-sealed-backups.md).

## Context

`@hzblj/crypto-vault` 0.3.0 seals a wallet's entropy under a passkey's PRF output as well as under a password
(crypto-vault's ADR 0003, nitro-crypto's ADR 0010): the same `ncbk` format at version 1, with key derivation 2 in the
header's sixth byte and a 46-byte header, so such a backup is 78 to 94 bytes. The store refused anything shorter than
the shortest password backup, 87 bytes, and so the shortest passkey backups.

The vault finds the passkey on the next phone as a discoverable credential: the person picks it from the system's
sheet, and the PRF salt is fixed, so nothing but the backup has to travel.

## Decision

- **The shortest sealed backup is a passkey's, 78 bytes.** `isSealedBackup` and `save` take the format's magic and a
  length from 78 to 1024 bytes; a later format with the same magic is still kept, as ADR 0001 said.
- **Nothing beside the backup.** No credential id, no salt: the vault needs neither (its ADR 0003), so the store keeps
  one item per backup as before, on both platforms, and the native halves do not change.
- **`backupKind(bytes)` reads the header, in JavaScript:** `'password'` for key derivation 1 and a password backup's
  length, `'passkey'` for key derivation 2 and a passkey backup's, `undefined` for anything else (no backup, or a
  version or kind this package does not read). It opens nothing and depends on neither the vault nor the engine, so an
  app can say what to ask for before it loads a wallet; the vault reads the same byte through the engine before it
  restores, and refuses the wrong secret.

## Consequences

- A wallet backed up under a passkey reaches the next phone through iCloud Keychain or Block Store like one under a
  password, and the person needs the passkey there, synced by its provider, instead of a password.
- Two layers still: the platform's end-to-end encryption, and under it the engine's seal, which only the passkey opens.
  Whoever can use the passkey, on a device it synced to or through its provider's account, can open the backup.
