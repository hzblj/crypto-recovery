---
'@hzblj/crypto-recovery': minor
---

A wallet's sealed backup kept in the platform's end-to-end encrypted store. `createRecovery()` saves, loads, lists and removes what `@hzblj/crypto-vault`'s `backup` returns: a synchronizable Keychain item on iOS, which iCloud Keychain carries to the Apple Account's devices, and a Block Store entry on Android, saved for Google's end-to-end encrypted backup where it is available. `reach()` says how far a backup travels (`icloud-keychain`, `cloud` or `device-transfer`). The store never sees a password or a secret, and `save` refuses bytes that are not a sealed backup (`NOT_A_BACKUP`). Swift and Kotlin, no cryptography (ADR 0001).
