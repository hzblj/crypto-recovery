# @hzblj/crypto-recovery

## 0.1.0

### Minor Changes

- [`f3bd6ec`](https://github.com/hzblj/crypto-recovery/commit/f3bd6ec00585c8f3a7b2978fbc6cd09d7b8bf9bb) Thanks [@hzblj](https://github.com/hzblj)! - A wallet's sealed backup kept in the platform's end-to-end encrypted store. `createRecovery()` saves, loads, lists and removes what `@hzblj/crypto-vault`'s `backup` returns: a synchronizable Keychain item on iOS, which iCloud Keychain carries to the Apple Account's devices, and a Block Store entry on Android, saved for Google's end-to-end encrypted backup where it is available. `reach()` says how far a backup travels (`icloud-keychain`, `cloud` or `device-transfer`). The store never sees a password or a secret, and `save` refuses bytes that are not a sealed backup (`NOT_A_BACKUP`). Swift and Kotlin, no cryptography (ADR 0001).
