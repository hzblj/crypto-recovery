import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {describe, test} from 'node:test'

import {isRecoveryError, RecoveryError} from '../src/errors'
import {backupKind, createRecoveryOn, isSealedBackup} from '../src/recovery'
import type {CryptoRecovery, Reach} from '../src/specs/crypto-recovery.nitro'
import {VERSION} from '../src/version'

/**
 * Bytes shaped like a sealed backup of 12 words: the format's magic, version 1, the key derivation (1 a password, 2 a
 * passkey), then whatever (the store never opens it).
 */
const sealed = (length = 87, kdf = 1) => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length))
  bytes.set([0x6e, 0x63, 0x62, 0x6b, 1, kdf])
  return bytes
}

/** The native store, played in memory: the contract the facade relies on, not a model of iCloud or Block Store. */
const fakeHost = (reach: Reach = 'icloud-keychain') => {
  const entries = new Map<string, Uint8Array>()
  let failNext: string | undefined

  const fail = () => {
    if (failNext) {
      const status = failNext
      failNext = undefined
      throw new Error(`CryptoRecovery.call(...): ${status}`)
    }
  }

  const host = {
    list: async () => (fail(), [...entries.keys()].sort()),
    load: async (id: string) => {
      fail()
      const found = entries.get(id)
      return found ? (found.slice().buffer as ArrayBuffer) : undefined
    },
    reach: async () => (fail(), reach),
    remove: async (id: string) => {
      fail()
      entries.delete(id)
    },
    save: async (id: string, backup: ArrayBuffer) => {
      fail()
      entries.set(id, new Uint8Array(backup.slice(0)))
    },
    store: 'icloud-keychain',
  }

  return {entries, failNext: (status: string) => (failNext = status), host: host as unknown as CryptoRecovery}
}

const rejectsCode = (run: () => Promise<unknown>, code: string) =>
  assert.rejects(run, error => isRecoveryError(error) && error.code === code, code)

describe('the recovery store', () => {
  test('saves, lists, loads and removes a sealed backup', async () => {
    const {host} = fakeHost()
    const recovery = createRecoveryOn(host)
    const backup = sealed(103)

    assert.equal(recovery.store, 'icloud-keychain')
    assert.equal(await recovery.reach(), 'icloud-keychain')
    assert.deepEqual(await recovery.list(), [])
    assert.equal(await recovery.load('main'), undefined)

    await recovery.save('main', backup)
    assert.deepEqual(await recovery.list(), ['main'])
    assert.deepEqual(await recovery.load('main'), backup)

    // Saving again replaces it.
    const newer = sealed()
    await recovery.save('main', newer)
    assert.deepEqual(await recovery.load('main'), newer)

    await recovery.remove('main')
    await recovery.remove('main')
    assert.deepEqual(await recovery.list(), [])
  })

  test('saves only the view it is given, not the buffer around it', async () => {
    const {entries, host} = fakeHost()
    const recovery = createRecoveryOn(host)
    const around = new Uint8Array(200)
    around.set(sealed(), 10)

    await recovery.save('main', around.subarray(10, 97))
    assert.equal(entries.get('main')?.length, 87)
  })

  test('keeps nothing but sealed backups', async () => {
    const {entries, host} = fakeHost()
    const recovery = createRecoveryOn(host)

    // Words, entropy, or anything else that does not start with the format's magic stays off the cloud.
    const words = new TextEncoder().encode('abandon abandon abandon abandon abandon abandon abandon abandon about')
    await rejectsCode(() => recovery.save('main', words), 'NOT_A_BACKUP')
    await rejectsCode(() => recovery.save('main', new Uint8Array(16)), 'NOT_A_BACKUP')
    await rejectsCode(() => recovery.save('main', sealed(77, 2)), 'NOT_A_BACKUP')
    await rejectsCode(() => recovery.save('main', sealed(1025)), 'NOT_A_BACKUP')
    await rejectsCode(() => recovery.save('main', 'backup' as never), 'NOT_A_BACKUP')
    assert.equal(entries.size, 0)

    assert.equal(isSealedBackup(sealed()), true)
    assert.equal(isSealedBackup(sealed(1024)), true)
    assert.equal(isSealedBackup(words), false)
  })

  test('keeps backups sealed under a passkey, the shortest there are', async () => {
    const {entries, host} = fakeHost()
    const recovery = createRecoveryOn(host)

    // A passkey's: a 46-byte header, 16 to 32 bytes of entropy, the tag.
    for (const length of [78, 94]) {
      const backup = sealed(length, 2)
      assert.equal(isSealedBackup(backup), true)
      await recovery.save(`passkey-${length}`, backup)
      assert.deepEqual(await recovery.load(`passkey-${length}`), backup)
    }
    assert.equal(entries.size, 2)
  })

  test("reads what opens a backup from its header, and nothing it doesn't know", () => {
    assert.equal(backupKind(sealed(87, 1)), 'password')
    assert.equal(backupKind(sealed(103, 1)), 'password')
    assert.equal(backupKind(sealed(78, 2)), 'passkey')
    assert.equal(backupKind(sealed(94, 2)), 'passkey')

    // A length the kind cannot have, a key derivation or version not read here, or no backup at all.
    assert.equal(backupKind(sealed(78, 1)), undefined)
    assert.equal(backupKind(sealed(87, 2)), undefined)
    assert.equal(backupKind(sealed(87, 3)), undefined)
    const later = sealed(87, 1)
    later[4] = 2
    assert.equal(backupKind(later), undefined)
    assert.equal(isSealedBackup(later), true)
    assert.equal(backupKind(new Uint8Array(87)), undefined)
    assert.equal(backupKind('backup'), undefined)
  })

  test('takes ids both stores take as they are', async () => {
    const {host} = fakeHost()
    const recovery = createRecoveryOn(host)

    await recovery.save('wallet-1_main.v2', sealed())
    for (const id of ['', 'a'.repeat(65), 'two words', 'ü', undefined]) {
      await rejectsCode(() => recovery.save(id as string, sealed()), 'INVALID_ARGUMENT')
      await rejectsCode(() => recovery.load(id as string), 'INVALID_ARGUMENT')
      await rejectsCode(() => recovery.remove(id as string), 'INVALID_ARGUMENT')
    }
  })

  test('maps native status names', async () => {
    const {failNext, host} = fakeHost('device-transfer')
    const recovery = createRecoveryOn(host)

    failNext('CR_ERR_UNAVAILABLE')
    await rejectsCode(() => recovery.reach(), 'UNAVAILABLE')
    failNext('CR_ERR_FULL')
    await rejectsCode(() => recovery.save('main', sealed()), 'FULL')
    failNext('CR_ERR_SOMETHING_NEW')
    await rejectsCode(() => recovery.list(), 'FAILED')
    failNext('not a status')
    await rejectsCode(() => recovery.load('main'), 'INVALID_ARGUMENT')
    assert.equal(await recovery.reach(), 'device-transfer')
    assert.ok(new RecoveryError('FAILED') instanceof Error)
  })

  test('VERSION matches package.json', () => {
    const manifest = JSON.parse(readFileSync(path.join(import.meta.dirname, '../package.json'), 'utf8')) as {
      version: string
    }
    assert.equal(VERSION, manifest.version)
  })
})
