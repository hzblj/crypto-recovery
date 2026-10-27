---
'@hzblj/crypto-recovery': minor
---

Backups sealed under a passkey. `@hzblj/crypto-vault` 0.3.0 seals a wallet under a passkey's PRF output in 78 to 94 bytes, and `save` and `isSealedBackup` now take them: the shortest sealed backup is 78 bytes, not 87. `backupKind(bytes)` reads a backup's header and says what opens it, `'password'` or `'passkey'` (`undefined` for anything else), so an app asks for the right one on the next phone. Nothing is stored beside a backup: the vault finds the passkey without a credential id (ADR 0002).
