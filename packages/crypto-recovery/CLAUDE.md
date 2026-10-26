# @hzblj/crypto-recovery

The published package: a Nitro module that keeps a wallet's sealed backup in the platform's end-to-end encrypted
store, iCloud Keychain (iOS) or Block Store (Android). One entry point, `.` (`src/index.ts`): `createRecovery`,
`isSealedBackup`, the types, `RecoveryError`.

| Path | What it is |
| --- | --- |
| `src/specs/crypto-recovery.nitro.ts` | The Nitro spec: `CryptoRecovery`, `RecoveryStore`, `Reach`. Swift and Kotlin, no C++. `yarn codegen` regenerates `nitrogen/generated`, which is checked in. |
| `ios/HybridCryptoRecovery.swift` | The iOS half: a synchronizable generic-password Keychain item per backup, service `com.hzblj.crypto-recovery`. |
| `android/` | `HybridCryptoRecovery.kt` (the Android half: a Block Store entry per backup, saved for the cloud where Block Store encrypts end to end); `CMakeLists.txt` and `src/main/cpp/` are only the JNI glue nitrogen generates. |
| `src/` | The facade: `recovery.ts` (`createRecoveryOn`: checks ids, refuses what is not a sealed backup, maps errors), `errors.ts`, `index.ts` (the native host, once). |
| `test/` | node:test on the facade, over a stand-in host. |

## Rules

- **Sealed backups only.** The store is the cloud: `save` refuses bytes without the format's magic (`ncbk`), and
  Android's `list` reports only entries that carry it (Block Store is the app's, not this module's). Never add a call
  that takes a password, words or entropy.
- **No cryptography.** Sealing and opening are nitro-crypto's engine, through `@hzblj/crypto-vault`. This package
  depends on neither.
- **The two platforms say the same thing.** Status names (`CR_ERR_*`) and the `Reach` values are the spec's; a new one
  goes into Swift, Kotlin and `errors.ts`.

## Commands

```bash
yarn test         # node:test with the source condition
yarn tsc:check
yarn codegen      # nitrogen, after editing the spec
yarn build        # build/ for npm
```
