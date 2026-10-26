# example

The example app for `@hzblj/crypto-recovery`: one wallet's way to the next phone. Seal the published test phrase in
`@hzblj/crypto-vault`, unlock it (Face ID or the fingerprint) to see its address, back it up under a password into
iCloud Keychain or Block Store, remove it from the device as if the phone were lost, and restore it from the store with
the password: the address is the same. Built from `@hzblj/kara-ui` like every hzblj example. Private; never published.

| Path | What it is |
| --- | --- |
| `app/` | Expo Router: one stack under a native large title, `index` the recovery screen. Route files only re-export a screen from `src/`. |
| `src/features/recovery/` | The recovery screen. |
| `src/core/engine.ts` | The engine (`@hzblj/crypto-ethereum` registered), the vault over it and the store, once per run; a missing native module is a message, not a crash. |
| `src/components/` | `Page`, `Section`, `Rows`, `Notice`, as the other hzblj examples draw them. |
| `src/config/theme.ts` | The sky-blue accent, apart from the other examples' emerald, indigo and amber. |
| `e2e/` | Maestro: `recovery` (seal, back up, lose, restore, the same address), over `steps/`; `run.mjs` runs them. |
| `assets/` | The icon (a cloud on sky blue) and the Material Symbols in `icons/`, native assets through kara's plugin. |

**The store runs from source; the vault and nitro-crypto from npm.** `metro.config.js` maps the workspace package to
its `source` export.

**On the simulator and an emulator the store stays local.** The simulator has no iCloud Keychain to sync with, and an
emulator without a Google account has no backup for Block Store: saving, loading and removing work, travelling does
not. A device signed in to its account carries the backup.

**Face ID on the simulator:** Features, Face ID, Enrolled; the e2e runner presents a matching face while the flows run.
Android's flows type the emulator's PIN (1111: `adb shell locksettings set-pin 1111`).

**Native changes need a rebuild**: `yarn prebuild`, then a native run.
