import {ethereumAdapter} from '@hzblj/crypto-ethereum'
import {createRecovery, isRecoveryError, type Recovery, RecoveryError} from '@hzblj/crypto-recovery'
import {createVault, isVaultError, type Vault, VaultError} from '@hzblj/crypto-vault'
import {CryptoError, createCryptoEngine, isCryptoError} from '@hzblj/nitro-crypto'

const createEngine = () => createCryptoEngine({adapters: [ethereumAdapter()]})

export type ExampleCrypto = ReturnType<typeof createEngine>

type Engine =
  | {
      readonly crypto: ExampleCrypto
      readonly recovery: Recovery
      readonly vault: Vault<ExampleCrypto['chains']>
    }
  | {readonly error: CryptoError | RecoveryError | VaultError}

let engine: Engine | undefined

/**
 * The engine, the vault over it and the store, once per run: a missing native module is a message on screen, not a
 * crash.
 */
export const exampleEngine = (): Engine => {
  if (!engine) {
    try {
      const crypto = createEngine()
      engine = {crypto, recovery: createRecovery(), vault: createVault(crypto)}
    } catch (error) {
      engine = {
        error:
          isCryptoError(error) || isVaultError(error) || isRecoveryError(error)
            ? error
            : new CryptoError('NATIVE_UNAVAILABLE', undefined, {cause: error}),
      }
    }
  }
  return engine
}

/** The one wallet the example keeps, and the id its backup goes under. */
export const ENTRY = 'main'
