import type {HybridObject} from 'react-native-nitro-modules'

/**
 * The native boundary. Nitrogen generates the Swift and Kotlin specs from this file; `ios/` and `android/` implement
 * them over the platform's own end-to-end encrypted store. What crosses is a sealed backup and its id: never a
 * password, never entropy. The module cannot open what it keeps, and has no reason to.
 *
 * Errors thrown across it carry a status name (`CR_ERR_UNAVAILABLE`), never an input.
 */

type Native = {android: 'kotlin'; ios: 'swift'}

/** Where backups go: iCloud Keychain on iOS, Block Store (Google Play services) on Android. */
export type RecoveryStore = 'icloud-keychain' | 'block-store'

/**
 * How far a saved backup travels. `icloud-keychain`: every device signed in to the Apple Account with iCloud Keychain
 * on, which an app cannot ask about. `cloud`: Block Store with end-to-end encrypted backup, so a new phone restored
 * from Google's backup gets it. `device-transfer`: Block Store without that (no screen lock, or backup off), so only a
 * phone set up from this one, by cable or over Wi-Fi.
 */
export type Reach = 'icloud-keychain' | 'cloud' | 'device-transfer'

/** The store. One per runtime, created by name through `NitroModules`. */
export interface CryptoRecovery extends HybridObject<Native> {
  /** Where this platform keeps backups. */
  readonly store: RecoveryStore

  /** How far a backup saved now travels. */
  reach(): Promise<Reach>
  /** Saves `backup` under `id`, replacing what was there. */
  save(id: string, backup: ArrayBuffer): Promise<void>
  /** The backup under `id`, or nothing. */
  load(id: string): Promise<ArrayBuffer | undefined>
  /** The ids of every backup this app has saved, sorted. */
  list(): Promise<string[]>
  /** Deletes the backup under `id`, here and wherever the store carried it. Idempotent. */
  remove(id: string): Promise<void>
}
