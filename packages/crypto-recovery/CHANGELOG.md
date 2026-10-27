# @hzblj/crypto-recovery

## 0.2.0

### Minor Changes

- [#3](https://github.com/hzblj/crypto-recovery/pull/3) [`1983dd6`](https://github.com/hzblj/crypto-recovery/commit/1983dd633d89285917790662a1f0ec0b689e1943) Thanks [@hzblj](https://github.com/hzblj)! - Backups sealed under a passkey. `@hzblj/crypto-vault` 0.3.0 seals a wallet under a passkey's PRF output in 78 to 94 bytes, and `save` and `isSealedBackup` now take them: the shortest sealed backup is 78 bytes, not 87. `backupKind(bytes)` reads a backup's header and says what opens it, `'password'` or `'passkey'` (`undefined` for anything else), so an app asks for the right one on the next phone. Nothing is stored beside a backup: the vault finds the passkey without a credential id (ADR 0002).

## 0.1.1

### Patch Changes

- [`e7c5536`](https://github.com/hzblj/crypto-recovery/commit/e7c5536deb8ac2bd0bc09d325d8b871f98d26616) Thanks [@hzblj](https://github.com/hzblj)! - The README shows the example app on iOS and Android.

## 0.1.0

### Minor Changes

- [`f3bd6ec`](https://github.com/hzblj/crypto-recovery/commit/f3bd6ec00585c8f3a7b2978fbc6cd09d7b8bf9bb) Thanks [@hzblj](https://github.com/hzblj)! - A wallet's sealed backup kept in the platform's end-to-end encrypted store. `createRecovery()` saves, loads, lists and removes what `@hzblj/crypto-vault`'s `backup` returns: a synchronizable Keychain item on iOS, which iCloud Keychain carries to the Apple Account's devices, and a Block Store entry on Android, saved for Google's end-to-end encrypted backup where it is available. `reach()` says how far a backup travels (`icloud-keychain`, `cloud` or `device-transfer`). The store never sees a password or a secret, and `save` refuses bytes that are not a sealed backup (`NOT_A_BACKUP`). Swift and Kotlin, no cryptography (ADR 0001).
