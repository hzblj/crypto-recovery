import {isRecoveryError, type Reach, type RecoveryStore} from '@hzblj/crypto-recovery'
import {isVaultError} from '@hzblj/crypto-vault'
import {Button, Island, LabeledContent, RnText, TextField, VStack} from '@hzblj/kara-ui'
import {useCallback, useEffect, useState} from 'react'

import {Lead, Notice, Page, RowDivider, Rows, Section} from '../../components'
import {ENTRY, exampleEngine} from '../../core/engine'

const STORE: Record<RecoveryStore, string> = {
  'block-store': 'Block Store',
  'icloud-keychain': 'iCloud Keychain',
}

const REACH: Record<Reach, string> = {
  cloud: "Google's backup",
  'device-transfer': 'A phone set up from this one',
  'icloud-keychain': "The Apple Account's devices",
}

/** Who opens the wallet: biometrics, or the passcode, so the flows type the emulator's PIN on Android. */
const ACCESS = 'biometrics-or-passcode'

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

/** What went wrong, for a person: the packages' codes in words, anything else by its message. */
const describe = (error: unknown) => {
  if (isVaultError(error)) {
    return error.code === 'CANCELLED' ? null : error.message
  }
  if (isRecoveryError(error)) {
    return error.message
  }
  return error instanceof Error ? error.message : String(error)
}

const short = (address: string) => `${address.slice(0, 8)}…${address.slice(-6)}`

/**
 * A wallet's way to the next phone, end to end: sealed in the vault, backed up under a password (the engine's seal)
 * into iCloud Keychain or Block Store, removed from this device as if the phone were lost, then restored from the
 * store with the password into a new entry, whose address is the old one's.
 */
export const RecoveryScreen = () => {
  const engine = exampleEngine()
  const [version, setVersion] = useState(0)
  const [password, setPassword] = useState('')
  // Kara's fields are uncontrolled: a new key mounts the password fields empty again.
  const [passwordField, setPasswordField] = useState(0)
  const [address, setAddress] = useState<string | null>(null)
  const [saved, setSaved] = useState<Uint8Array | null | undefined>(undefined)
  const [reach, setReach] = useState<Reach | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => setVersion(current => current + 1), [])

  // What the store holds now: read again after every change, since the store is asynchronous on both platforms.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` is the trigger, every operation bumps it
  useEffect(() => {
    if ('error' in engine) {
      return
    }
    let current = true
    Promise.all([engine.recovery.load(ENTRY), engine.recovery.reach()])
      .then(([backup, travels]) => {
        if (current) {
          setSaved(backup ?? null)
          setReach(travels)
        }
      })
      .catch(error => current && setProblem(describe(error)))
    return () => {
      current = false
    }
  }, [engine, version])

  if ('error' in engine) {
    return (
      <Page testID="recovery">
        <Notice text={engine.error.message} title="Recovery is not available" tone="destructive" />
      </Page>
    )
  }

  const {recovery, vault} = engine

  const run = async (operation: () => Promise<void>) => {
    setBusy(true)
    setProblem(null)
    try {
      await operation()
    } catch (error) {
      setProblem(describe(error))
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const showAddress = () =>
    run(async () => {
      const wallet = await vault.unlock(ENTRY, {prompt: 'Unlock your wallet'})
      try {
        setAddress((await wallet.deriveAccount({chain: 'ethereum', index: 0})).address)
      } finally {
        wallet.dispose()
      }
    })

  // Once the password has done its work, it goes from the screen.
  const forgetPassword = () => {
    setPassword('')
    setPasswordField(field => field + 1)
  }

  const backUp = () =>
    run(async () => {
      const backup = await vault.backup(ENTRY, {password, prompt: 'Back up your wallet'})
      await recovery.save(ENTRY, backup)
      forgetPassword()
    })

  const restore = (backup: Uint8Array) =>
    run(async () => {
      await vault.restore(ENTRY, backup, {access: ACCESS, password})
      forgetPassword()
    })

  // As if the phone were lost: the wallet goes from this device, the backup stays in the store.
  const lose = () => {
    vault.remove(ENTRY)
    setAddress(null)
    // The restore field starts empty, so the password typed for the backup goes too.
    setPassword('')
    refresh()
  }

  const forget = () => run(() => recovery.remove(ENTRY))

  const sealed = vault.has(ENTRY)
  const storeName = STORE[recovery.store]

  return (
    <Page testID="recovery">
      <Lead>
        A wallet sealed in the vault, backed up under a password into {storeName}, and restored from there on the next
        phone. The store keeps only the engine's seal: without the password it opens nothing.
      </Lead>

      <Section title="This device">
        <Island>
          <Rows>
            <LabeledContent label="Store" value={storeName} />
            <RowDivider />
            <LabeledContent label="A backup reaches" value={reach ? REACH[reach] : '…'} />
            <RowDivider />
            <LabeledContent
              label="Backup in the store"
              value={saved === undefined ? '…' : saved ? `${saved.length} bytes, sealed` : 'None'}
            />
          </Rows>
        </Island>
      </Section>

      {problem ? <Notice testID="recovery-problem" text={problem} tone="destructive" /> : null}

      {sealed ? (
        <>
          <Section caption="Unlocking derives the first Ethereum account." title="Wallet">
            <Island>
              <Rows>
                <LabeledContent label="Address" value={address ? short(address) : 'Locked'} />
              </Rows>
            </Island>
            <Island>
              <Button
                disabled={busy}
                label="Unlock and show the address"
                onPress={showAddress}
                testID="recovery-unlock"
              />
            </Island>
          </Section>

          <Section
            caption={`The vault opens the wallet, the engine seals it under the password (Argon2id, then XChaCha20-Poly1305), and ${storeName} keeps the sealed bytes.`}
            title="Back up"
          >
            <Island>
              <VStack spacing="s12" wide>
                <TextField
                  key={passwordField}
                  label="Password"
                  onChangeText={setPassword}
                  secure
                  testID="recovery-backup-password"
                />
                <Button
                  disabled={busy || password.length === 0}
                  label={`Back up to ${storeName}`}
                  onPress={backUp}
                  testID="recovery-backup"
                />
              </VStack>
            </Island>
          </Section>

          <Island>
            <Button label="Remove from this device" onPress={lose} testID="recovery-lose" variant="destructive" />
          </Island>
        </>
      ) : (
        <>
          {saved ? (
            <Section caption="Opened natively with the password, straight into this phone's hardware." title="Restore">
              <Island>
                <VStack spacing="s12" wide>
                  <TextField
                    key={passwordField}
                    label="Password"
                    onChangeText={setPassword}
                    secure
                    testID="recovery-restore-password"
                  />
                  <Button
                    disabled={busy || password.length === 0}
                    label={`Restore from ${storeName}`}
                    onPress={() => restore(saved)}
                    testID="recovery-restore"
                  />
                </VStack>
              </Island>
            </Section>
          ) : null}
          <Section
            caption="The published test phrase, whose first Ethereum address is known."
            title="Or start a wallet"
          >
            <Island>
              <Button
                disabled={busy}
                label="Seal the test phrase"
                onPress={() => run(() => vault.importMnemonic(ENTRY, PHRASE, {access: ACCESS}))}
                testID="recovery-seal"
                variant="secondary"
              />
            </Island>
          </Section>
        </>
      )}

      {saved ? (
        <Island>
          <Button
            disabled={busy}
            label={`Delete the backup from ${storeName}`}
            onPress={forget}
            testID="recovery-forget"
            variant="secondary"
          />
        </Island>
      ) : null}

      <RnText color="content.tertiary" variant="footnote">
        Test wallets only: the phrase above is public, and so is anything it signs for.
      </RnText>
    </Page>
  )
}
