import {NitroModules} from 'react-native-nitro-modules'

import {createRecoveryOn, type Recovery} from './recovery'
import type {CryptoRecovery} from './specs/crypto-recovery.nitro'

let host: CryptoRecovery | undefined

/** The platform's end-to-end encrypted store for sealed backups: iCloud Keychain on iOS, Block Store on Android. */
export const createRecovery = (): Recovery => {
  host ??= NitroModules.createHybridObject<CryptoRecovery>('CryptoRecovery')

  return createRecoveryOn(host)
}

export {isRecoveryError, RECOVERY_ERROR_CODES, RecoveryError, type RecoveryErrorCode} from './errors'
export {type BackupKind, backupKind, isSealedBackup, type Recovery} from './recovery'
export type {Reach, RecoveryStore} from './specs/crypto-recovery.nitro'
export {VERSION} from './version'
