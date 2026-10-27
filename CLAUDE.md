# crypto-recovery

Turborepo + Yarn 4 workspaces for **`@hzblj/crypto-recovery`**: a wallet's sealed backup kept in the platform's
end-to-end encrypted store (iCloud Keychain on iOS, Block Store on Android) for React Native and Expo. It keeps what
[`@hzblj/crypto-vault`](https://github.com/hzblj/crypto-vault)'s `backup` returns and never sees a password or a secret.

Every package has its own `CLAUDE.md`: read that one before touching it.

| Path | Package | What lives there |
| --- | --- | --- |
| `packages/crypto-recovery/` | `@hzblj/crypto-recovery` | The Nitro module: the spec, the platform halves as Hybrid Objects (`ios/` Swift, `android/` Kotlin), the facade (`src/`). ADRs 0001 and 0002. |
| `apps/example/` | `crypto-recovery-example` (private) | Expo Router app built with `@hzblj/kara-ui`: a wallet in `@hzblj/crypto-vault`, backed up under a password or a passkey into the store, removed as if the phone were lost, restored from the store. See its `CLAUDE.md`. |
| `scripts/` | | `pack-check.mjs`, `sync-versions.mjs`. |
| `docs/` | | The decisions (`adr/`). `SECURITY.md` is at the root. |

Dependencies point down: `@hzblj/crypto-recovery` → Nitro, and nothing else. The example adds `@hzblj/crypto-vault` and
`@hzblj/nitro-crypto` from npm: the vault seals and opens, this package keeps.

## Commands

```bash
yarn test                    # the facade's tests, over a stand-in host
yarn typecheck / yarn lint   # tsc, Biome
yarn codegen                 # nitrogen, after editing the spec (nitrogen/generated is checked in)
yarn prebuild                # a clean `expo prebuild` of the example
yarn ios / yarn android      # the example (dev client), Metro included
yarn pack:check              # what npm receives, and a consumer type-check
yarn changeset               # describe a change for the next release
```

## Conventions that bite

**The vault comes first.** The example needs `@hzblj/crypto-vault` 0.3.0 or later (its `backup` and `restore`, under a
password or a passkey) and `@hzblj/nitro-crypto` 0.1.5. A change the example needs in the vault is a release there
first.

**Sealed backups only.** The store is the cloud. The facade refuses bytes without the backup format's magic (`ncbk`)
or shorter than the shortest backup (78 bytes, a passkey's); nothing here takes a password, a passkey's output, words or
entropy, and nothing should. `backupKind` reads the header's key derivation byte, and opens nothing.

**Status names, never messages.** Native code throws `CR_ERR_*`; the facade maps the name to a `RecoveryError` code and
drops the rest.

**The platform halves agree.** `ios/HybridCryptoRecovery.swift` and `android/.../HybridCryptoRecovery.kt` implement
the same spec with the same status names; a change goes into both.

**Docs copy has no em dashes.** Not in the READMEs, the JSDoc in `src/`, changesets or the example's captions.

**Commits are Jan's alone.** Author `Jan Blazej <hello@janblazej.dev>` (set locally in this repo), no co-author or
generated-by lines.

Code style is Biome-enforced (`@hzblj/biome-config`): 2 spaces, 120 cols, single quotes, no semicolons, sorted imports
and object keys. Named exports and `const` arrow functions; `type` over `interface` (the Nitro spec excepted).
