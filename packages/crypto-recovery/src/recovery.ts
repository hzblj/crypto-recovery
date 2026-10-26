import {nativeAsync, RecoveryError} from './errors'
import type {CryptoRecovery, Reach, RecoveryStore} from './specs/crypto-recovery.nitro'

/**
 * The platform's end-to-end encrypted store for a wallet's sealed backups: iCloud Keychain on iOS, Block Store on
 * Android. It keeps what `@hzblj/crypto-vault`'s `backup` returns (the engine's seal, which only the password opens)
 * and hands it back on another device for `restore`. It never sees a password or a secret, and refuses bytes that are
 * not a sealed backup, so nothing else ends up in the cloud by mistake.
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

/** What every sealed backup starts with: nitro-crypto's format magic, `ncbk` (its ADR 0009). */
const MAGIC = [0x6e, 0x63, 0x62, 0x6b]

/** The shortest sealed backup there is (version 1's header, 16 bytes of entropy, the tag), and what the stores take. */
const MIN_LENGTH = 55 + 16 + 16
const MAX_LENGTH = 1024

/**
 * Whether `bytes` look like a sealed backup: nitro-crypto's magic, and a length the stores take. Not a check that the
 * backup opens, which only the password can tell.
 */
export const isSealedBackup = (bytes: unknown): bytes is Uint8Array =>
  bytes instanceof Uint8Array &&
  bytes.length >= MIN_LENGTH &&
  bytes.length <= MAX_LENGTH &&
  MAGIC.every((byte, index) => bytes[index] === byte)

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
