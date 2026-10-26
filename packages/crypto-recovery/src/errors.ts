/**
 * The store's errors. Native code throws status names (`CR_ERR_UNAVAILABLE`) and they are mapped here; no message
 * ever carries an input.
 */

export const RECOVERY_ERROR_CODES = ['FAILED', 'FULL', 'INVALID_ARGUMENT', 'NOT_A_BACKUP', 'UNAVAILABLE'] as const

export type RecoveryErrorCode = (typeof RECOVERY_ERROR_CODES)[number]

const DEFAULT_MESSAGES: Record<RecoveryErrorCode, string> = {
  FAILED: 'The platform could not complete the operation.',
  FULL: 'The store holds as many backups as it takes for this app.',
  INVALID_ARGUMENT: 'An argument is not one the store takes.',
  NOT_A_BACKUP: 'These bytes are not a sealed backup: the store keeps nothing else.',
  UNAVAILABLE: 'The store is not available: no Google Play services, or the device is locked since it started.',
}

export class RecoveryError extends Error {
  readonly code: RecoveryErrorCode

  constructor(code: RecoveryErrorCode, message: string = DEFAULT_MESSAGES[code], options?: {cause?: unknown}) {
    super(message, options)
    this.name = 'RecoveryError'
    this.code = code
  }
}

export const isRecoveryError = (error: unknown): error is RecoveryError => error instanceof RecoveryError

const STATUS_PATTERN = /CR_ERR_[A-Z_]+/

/**
 * A `RecoveryError` for whatever native code threw. Nitro prefixes the message with the method
 * ("`CryptoRecovery.save(...)`: CR_ERR_UNAVAILABLE"); only the status name is read, and an error without one is
 * `INVALID_ARGUMENT` (a type Nitro could not convert).
 */
export const toRecoveryError = (error: unknown): RecoveryError => {
  if (isRecoveryError(error)) {
    return error
  }

  const status = error instanceof Error ? STATUS_PATTERN.exec(error.message)?.[0] : undefined

  if (status === undefined) {
    return new RecoveryError('INVALID_ARGUMENT')
  }

  const code = status.slice('CR_ERR_'.length)

  return new RecoveryError(
    (RECOVERY_ERROR_CODES as readonly string[]).includes(code) ? (code as RecoveryErrorCode) : 'FAILED'
  )
}

export const nativeAsync = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call()
  } catch (error) {
    throw toRecoveryError(error)
  }
}
