# @hzblj/crypto-recovery

[![npm](https://img.shields.io/npm/v/@hzblj/crypto-recovery.svg)](https://www.npmjs.com/package/@hzblj/crypto-recovery)
[![license](https://img.shields.io/npm/l/@hzblj/crypto-recovery.svg)](https://github.com/hzblj/crypto-recovery/blob/main/LICENSE)

A wallet's sealed backup kept in the platform's end-to-end encrypted store, for React Native and Expo: iCloud Keychain
on iOS, Block Store on Android. It keeps what [`@hzblj/crypto-vault`](https://github.com/hzblj/crypto-vault)'s
`backup` returns, the wallet's entropy sealed by the [`@hzblj/nitro-crypto`](https://github.com/hzblj/nitro-crypto)
engine under a password or a passkey, and hands it back on the next phone for `restore`. The store sees ciphertext:
never a password, a passkey's output or a secret, and nothing that is not a sealed backup.

<p>
  <img alt="The example on iOS: the wallet's sealed backup in iCloud Keychain, 87 bytes, and the wallet unlocked to its address" height="560" src="https://raw.githubusercontent.com/hzblj/crypto-recovery/main/media/ios-recovery.png" />
  <img alt="The same on the Android emulator: the 87-byte backup in Block Store, which a phone set up from this one restores" height="560" src="https://raw.githubusercontent.com/hzblj/crypto-recovery/main/media/android-recovery.png" />
</p>

```sh
npx expo install @hzblj/crypto-recovery react-native-nitro-modules
```

Then a development build (`npx expo prebuild`, `npx expo run:ios`): the store is native code, not in Expo Go.

## The API

```ts
import {createVault} from '@hzblj/crypto-vault'
import {createRecovery} from '@hzblj/crypto-recovery'

const vault = createVault(crypto)
const recovery = createRecovery()

// This phone: the vault seals, the store keeps.
const backup = await vault.backup('main', {password, prompt: 'Back up your wallet'})
await recovery.save('main', backup)

// The next one: the store hands it back, the vault opens it into this phone's hardware.
const saved = await recovery.load('main')
if (saved) {
  await vault.restore('main', saved, {password})
}
```

A backup under a passkey goes the same way, with nothing to remember (the vault's
[passkey backups](https://github.com/hzblj/crypto-vault/blob/main/packages/crypto-vault/README.md#backups-under-a-passkey)):

```ts
import {backupKind, createRecovery} from '@hzblj/crypto-recovery'

const vault = createVault(crypto, {relyingParty: 'wallet.example.com'}) // the app's associated domain
await recovery.save('main', await vault.backup('main', {passkey: {name: 'Main wallet'}, prompt: 'Back up your wallet'}))

// The next phone, once the passkey has synced there: ask for what the backup needs.
const saved = await recovery.load('main')
if (saved && backupKind(saved) === 'passkey') {
  await vault.restore('main', saved, {passkey: true}) // the person picks the passkey from the system's sheet
}
```

| | |
| --- | --- |
| `recovery.save(id, backup)` | Keeps a sealed backup under `id`, replacing what was there |
| `recovery.load(id)` | The backup under `id`, or `undefined` |
| `recovery.list()` | The ids of every backup this app has kept |
| `recovery.remove(id)` | Deletes the backup, here and wherever the store carried it |
| `recovery.store` | `'icloud-keychain'` or `'block-store'` |
| `recovery.reach()` | How far a backup saved now travels (below) |
| `isSealedBackup(bytes)` | Whether bytes look like a sealed backup (the format's magic, a length the stores take) |
| `backupKind(bytes)` | `'password'` or `'passkey'`: what opens a sealed backup, read from its header; `undefined` for anything else |

An `id` is 1 to 64 letters, digits, `-`, `_` or `.`. `save` refuses anything that does not start with the backup
format's magic, `ncbk` (nitro-crypto's ADR 0009), or is shorter than the shortest backup (78 bytes, a passkey's), with
`NOT_A_BACKUP`: words or entropy never reach the cloud by mistake. A password backup is 87 to 103 bytes, a passkey
backup 78 to 94.

The store keeps the backup and nothing beside it. The vault needs no credential id to find the passkey on the next
phone: the person picks it from the system's sheet, and the PRF input is the same for every backup, so the passkey
alone opens it.

Every error is a `RecoveryError` with a `code`:

| Code | When |
| --- | --- |
| `NOT_A_BACKUP` | The bytes to keep are not a sealed backup |
| `UNAVAILABLE` | No Google Play services (Android), or the device is locked since it started (iOS) |
| `FULL` | Block Store holds 16 entries per app, each up to 4 KiB |
| `INVALID_ARGUMENT`, `FAILED` | A malformed call, or anything else the platform reported |

## Where a backup goes

| `reach()` | What it means |
| --- | --- |
| `'icloud-keychain'` | iOS: a synchronizable Keychain item, end to end encrypted, on every device signed in to the Apple Account with iCloud Keychain on (an app cannot ask whether it is) |
| `'cloud'` | Android: Block Store with end-to-end encrypted backup, so a new phone restored from Google's backup gets it |
| `'device-transfer'` | Android: Block Store without that (no screen lock, or backup off), so only a phone set up from this one, by cable or over Wi-Fi |

iCloud Keychain syncs as it goes. Block Store restores when a new phone is set up, not later: a backup saved after the
new phone's setup reaches it only through the next transfer or restore.

## Not in this version

Android's Keychain-like live sync: Block Store has none. Shamir shares across stores.

[Security](https://github.com/hzblj/crypto-recovery/blob/main/SECURITY.md) · [ADR 0001](https://github.com/hzblj/crypto-recovery/blob/main/docs/adr/0001-platform-store-for-sealed-backups.md) · [ADR 0002](https://github.com/hzblj/crypto-recovery/blob/main/docs/adr/0002-passkey-sealed-backups.md)
