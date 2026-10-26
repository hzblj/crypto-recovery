/**
 * Checks what npm would receive, the way a consumer meets it. Packs every published package (each `prepack` builds it
 * through turbo's cache), asserts what must and must not ship in each tarball, then installs them into a throwaway
 * app and type-checks real usage with a consumer's TypeScript: no `source` condition, no workspace links, only what
 * the tarballs declare. The native halves ship as sources (the podspec, ios/, android/ and nitrogen's output), and
 * their build output must not.
 *
 * The negative cases matter as much as the positive ones: if a declaration failed to resolve, its imports would
 * quietly become `any` and everything would compile, so each `@ts-expect-error` is there to prove the types are real.
 */
import {execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const WORK = path.join(ROOT, '.pack-check')

const run = (command, args, cwd = ROOT) => execFileSync(command, args, {cwd, encoding: 'utf8', maxBuffer: 64 << 20})

const fail = message => {
  console.error(`pack-check: ${message}`)
  process.exit(1)
}

const REQUIRED = {
  '@hzblj/crypto-recovery': [
    'package.json',
    'README.md',
    'LICENSE',
    'build/index.js',
    'build/index.d.ts',
    'nitro.json',
    'CryptoRecovery.podspec',
    'ios/HybridCryptoRecovery.swift',
    'android/build.gradle',
    'android/CMakeLists.txt',
    'android/src/main/cpp/cpp-adapter.cpp',
    'android/src/main/java/com/margelo/nitro/cryptorecovery/HybridCryptoRecovery.kt',
    'nitrogen/generated/ios/swift/HybridCryptoRecoverySpec.swift',
    'nitrogen/generated/android/kotlin/com/margelo/nitro/cryptorecovery/HybridCryptoRecoverySpec.kt',
  ],
}

// Tests, TypeScript sources, and native build output stay home.
const FORBIDDEN = [/^src\//, /^test\//, /^android\/build\//, /^android\/\.cxx\//, /\.DS_Store$/, /\.tsbuildinfo$/]

const packages = []
for (const directory of await readdir(path.join(ROOT, 'packages'))) {
  const manifestPath = path.join(ROOT, 'packages', directory, 'package.json')
  if (!existsSync(manifestPath)) {
    continue
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (!manifest.private) {
    packages.push({directory, name: manifest.name})
  }
}

await rm(WORK, {force: true, recursive: true})
await mkdir(path.join(WORK, 'tarballs'), {recursive: true})

let fileCount = 0
for (const {directory, name} of packages) {
  const tarball = path.join(WORK, 'tarballs', `${directory}.tgz`)
  run('yarn', ['pack', '--out', tarball], path.join(ROOT, 'packages', directory))

  const files = run('tar', ['-tzf', tarball])
    .split('\n')
    .filter(Boolean)
    .map(file => file.replace(/^package\//, ''))
  const missing = (REQUIRED[name] ?? ['package.json', 'README.md']).filter(file => !files.includes(file))
  const leaked = files.filter(file => FORBIDDEN.some(pattern => pattern.test(file)))
  if (missing.length > 0) {
    fail(`${name} is missing:\n  ${missing.join('\n  ')}`)
  }
  if (leaked.length > 0) {
    fail(`${name} must not ship:\n  ${leaked.join('\n  ')}`)
  }

  const packed = JSON.parse(run('tar', ['-xzOf', tarball, 'package/package.json']))
  for (const field of ['dependencies', 'peerDependencies']) {
    if (JSON.stringify(packed[field] ?? {}).includes('workspace:')) {
      fail(`${name} still declares a workspace: range in ${field}: it would not install outside this repo`)
    }
  }
  // `source` points at src/, which stays home: a consumer that sets the condition (a monorepo's own tests do) would
  // resolve to a file that is not there. `publishConfig.exports` is the published map without it.
  if (JSON.stringify(packed.exports ?? {}).includes('"source"')) {
    fail(`${name} publishes a \`source\` condition in its exports, to a src/ it does not ship`)
  }

  const installed = path.join(WORK, 'node_modules', name)
  await mkdir(installed, {recursive: true})
  run('tar', ['-xzf', tarball, '-C', installed, '--strip-components', '1'])
  fileCount += files.length
}

const consumer = `import {
  createRecovery,
  isRecoveryError,
  isSealedBackup,
  type Reach,
  type Recovery,
  RecoveryError,
  type RecoveryStore,
} from '@hzblj/crypto-recovery'

export const recovered = async (backup: Uint8Array) => {
  const recovery: Recovery = createRecovery()
  const store: RecoveryStore = recovery.store
  const reach: Reach = await recovery.reach()
  if (isSealedBackup(backup)) {
    await recovery.save('main', backup)
  }
  const ids: string[] = await recovery.list()
  const loaded: Uint8Array | undefined = await recovery.load('main')
  await recovery.remove('main')

  // @ts-expect-error: a backup is bytes, never words
  await recovery.save('main', 'abandon abandon abandon')
  // @ts-expect-error: what comes back may be nothing
  const sure: Uint8Array = await recovery.load('main')

  return [store, reach, ids, loaded, sure, isRecoveryError(new RecoveryError('NOT_A_BACKUP'))]
}
`

await writeFile(path.join(WORK, 'consumer.ts'), consumer)
await writeFile(
  path.join(WORK, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {lib: ['ESNext', 'DOM'], noEmit: true, skipLibCheck: true, strict: true, types: []},
      extends: 'expo/tsconfig.base',
      include: ['consumer.ts'],
    },
    null,
    2
  )
)

try {
  run('yarn', ['run', '-T', 'tsc', '-p', WORK])
} catch (error) {
  fail(`a consumer's type check failed:\n${error.stdout}`)
}

await rm(WORK, {force: true, recursive: true})
console.log(`pack-check: ${packages.length} package, ${fileCount} files, and a consumer type-checks`)
