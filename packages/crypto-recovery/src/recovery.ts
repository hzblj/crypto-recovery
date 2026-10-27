import {nativeAsync, RecoveryError} from './errors'
import type {CryptoRecovery, Reach, RecoveryStore} from './specs/crypto-recovery.nitro'

/**
 * The platform's end-to-end encrypted store for a wallet's sealed backups: iCloud Keychain on iOS, Block Store on
 * Android. It keeps what `@hzblj/crypto-vault`'s `backup` returns (the engine's seal, which only the password or the
 * passkey it was sealed under opens) and hands it back on another device for `restore`. It never sees a password, a
 * passkey's output or a secret, and refuses bytes that are not a sealed backup, so nothing else ends up in the cloud by
 * mistake.
 */
export type Recovery = {
  /** Where this platform keeps backups: `'icloud-keychain'` or `'block-store'`. */
  readonly store: RecoveryStore
  /** How far a backup saved now travels: to the Apple Account's devices, through Google's cloud, or to a new phone set up from this one. */
  readonly reach: () => Promise<Reach>
  /** Saves `backup` under `id`, replacing what was there. */
  readonly save: (id: string, backup: Uint8Array) => Promise<void>
  /** The backup under `id`, or `undefined`. */
  readonly load: (id: string) => Promise<Uint8Array | undefined>
  /** The ids of every backup this app has saved, sorted. */
  readonly list: () => Promise<string[]>
  /** Deletes the backup under `id`, here and wherever the store carried it. Idempotent. */
  readonly remove: (id: string) => Promise<void>
}

/** What opens a sealed backup: the password it was sealed under, or the passkey (its PRF output). */
export type BackupKind = 'password' | 'passkey'

/** What every sealed backup starts with: nitro-crypto's format magic, `ncbk` (its ADR 0009). */
const MAGIC = [0x6e, 0x63, 0x62, 0x6b]

/**
 * Version 1's kinds, by the key derivation byte after the magic and the version: the header's length (Argon2id's
 * parameters, salt and nonce; HKDF's salt and nonce), so a backup is that, 16 to 32 bytes of entropy and a 16-byte tag
 * (nitro-crypto's ADRs 0009 and 0010).
 */
const KINDS: Record<number, {header: number; kind: BackupKind}> = {
  1: {header: 55, kind: 'password'},
  2: {header: 46, kind: 'passkey'},
}

/** The shortest sealed backup there is (a passkey's: its header, 16 bytes of entropy, the tag), and what the stores take. */
const MIN_LENGTH = 46 + 16 + 16
const MAX_LENGTH = 1024

/**
 * Whether `bytes` look like a sealed backup: nitro-crypto's magic, and a length the stores take. Not a check that the
 * backup opens, which only its password or passkey can tell. A later format with the same magic passes too: the store
 * keeps what it does not read.
 */
export const isSealedBackup = (bytes: unknown): bytes is Uint8Array =>
  bytes instanceof Uint8Array &&
  bytes.length >= MIN_LENGTH &&
  bytes.length <= MAX_LENGTH &&
  MAGIC.every((byte, index) => bytes[index] === byte)

/**
 * What opens a sealed backup, read from its header without opening it: `'password'` or `'passkey'`, so an app asks
 * for the right one on the next phone. `undefined` for bytes that are not a sealed backup, or a kind or version this
 * package does not read.
 */
export const backupKind = (bytes: unknown): BackupKind | undefined => {
  if (!isSealedBackup(bytes) || bytes[4] !== 1) {
    return undefined
  }
  const known = KINDS[bytes[5] ?? 0]
  const entropy = known ? bytes.length - known.header - 16 : 0

  return known && entropy >= 16 && entropy <= 32 && entropy % 4 === 0 ? known.kind : undefined
}

/** An id names a Keychain item and a Block Store key: short, and made of what both take as is. */
const checkedId = (id: unknown) => {
  if (typeof id !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(id)) {
    throw new RecoveryError('INVALID_ARGUMENT', 'An id is 1 to 64 letters, digits, ".", "_" or "-".')
  }

  return id
}

/** A store over a host: the native module on a device, a stand-in in tests. */
export const createRecoveryOn = (host: CryptoRecovery): Recovery =>
  Object.freeze({
    list: () => nativeAsync(() => host.list()),
    load: async (id: string) => {
      const backup = await nativeAsync(() => host.load(checkedId(id)))

      return backup === undefined ? undefined : new Uint8Array(backup)
    },
    reach: () => nativeAsync(() => host.reach()),
    remove: async (id: string) => {
      await nativeAsync(() => host.remove(checkedId(id)))
    },
    save: async (id: string, backup: Uint8Array) => {
      const key = checkedId(id)
      if (!isSealedBackup(backup)) {
        throw new RecoveryError('NOT_A_BACKUP')
      }

      await nativeAsync(() =>
        host.save(key, backup.buffer.slice(backup.byteOffset, backup.byteOffset + backup.byteLength) as ArrayBuffer)
      )
    },
    get store() {
      return host.store
    },
  })
