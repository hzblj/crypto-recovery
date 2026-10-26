# 1. Sealed backups in the platform's end-to-end encrypted store

Accepted.

## Context

`@hzblj/crypto-vault` keeps a wallet's entropy under this device's security hardware, and its `backup` returns the
entropy sealed by the `@hzblj/nitro-crypto` engine under a password (Argon2id, XChaCha20-Poly1305; nitro-crypto's
ADR 0009, crypto-vault's ADR 0002): 87 to 103 bytes that are safe anywhere, as only the password opens them. A backup
helps only where the next phone can find it. Both platforms have a store for that, end to end encrypted and tied to
the user's account: iCloud Keychain, and Google Play services' Block Store, which other wallets use for the same
purpose.

## Decision

- **A package of its own, and a small one.** It stores and returns bytes, nothing else: no cryptography, no dependency
  on the vault or the engine. An app can keep its backups elsewhere, and this store can keep backups from elsewhere,
  as long as they are sealed.
- **iOS: a synchronizable Keychain item.** A generic password per backup (service `com.hzblj.crypto-recovery`, the id
  as its account), `kSecAttrSynchronizable`, accessible after the first unlock (a synchronizable item cannot be
  this-device-only). iCloud Keychain carries it end to end encrypted to the Apple Account's devices when it is on; an
  app cannot ask whether it is, so `reach()` says `icloud-keychain` and no more.
- **Android: Block Store.** An entry per backup, the id as its key, saved for the cloud when Block Store says end-to-end
  encryption is available (`reach()`: `cloud`), otherwise for device-to-device transfer only (`device-transfer`).
  Block Store restores at a new phone's setup, not later; that is the platform's model, and the README says so.
- **Sealed backups only.** `save` refuses bytes that do not start with the format's magic (`ncbk`) or that no store
  takes (over 1024 bytes). The store is the cloud: words or entropy must not end up there by mistake.
- **Swift and Kotlin, no C++.** Nothing here touches a secret, so the platform halves are the Hybrid Objects, as
  Nitro writes them.

## Consequences

- A wallet survives its device with nothing for the user to keep but a password.
- Whoever runs the store (Apple, Google) sees a sealed backup under the platform's own end-to-end encryption. Both
  layers would have to fail, and the password be guessed at Argon2id's cost, for the wallet to be exposed.
- Android's backup reaches a new phone only at its setup. A wallet backed up later reaches it through the words, or the
  next transfer.
- A passkey in place of the password, and Shamir shares across stores, are later formats; the store keeps any sealed
  backup with the format's magic.
