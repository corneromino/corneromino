import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const bump = process.argv[2] ?? 'patch'
const BUMPS = new Set(['patch', 'minor', 'major'])
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(root, 'public/manifest.json')
const versionSourcePath = resolve(root, 'src/lib/appVersion.ts')
const releaseFiles = ['public/manifest.json', 'src/lib/appVersion.ts']

function fail(message) {
  console.error(`Release failed: ${message}`)
  process.exit(1)
}

function git(args, options = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', ...options })
  if (result.error) fail(result.error.message)
  return result
}

function ensureClean(path) {
  for (const args of [['diff', '--quiet', '--', path], ['diff', '--cached', '--quiet', '--', path]]) {
    const result = git(args)
    if (result.status === 1) fail(`${path} already has uncommitted changes.`)
    if (result.status !== 0) fail(result.stderr.trim() || `Could not inspect ${path}.`)
  }
}

function incrementVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version)
  if (!match) fail(`Version "${version}" must use MAJOR.MINOR.PATCH format.`)
  const [major, minor, patch] = match.slice(1).map(Number)
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

if (!BUMPS.has(bump)) fail('Usage: npm run release -- [patch|minor|major]')
for (const file of releaseFiles) ensureClean(file)

let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (error) {
  fail(`Could not read ${manifestPath}: ${error.message}`)
}
if (typeof manifest.version !== 'string') fail('public/manifest.json must have a string version attribute.')

const previousVersion = manifest.version
const nextVersion = incrementVersion(previousVersion)
const versionSource = readFileSync(versionSourcePath, 'utf8')
const nextVersionSource = versionSource.replace(
  /export const APP_VERSION = '([^']+)'/,
  `export const APP_VERSION = '${nextVersion}'`,
)
if (nextVersionSource === versionSource) fail('Could not find APP_VERSION in src/lib/appVersion.ts.')

manifest.version = nextVersion
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(versionSourcePath, nextVersionSource)

const add = git(['add', '--', ...releaseFiles])
if (add.status !== 0) fail(add.stderr.trim() || 'Could not stage release files.')
const commit = git(['commit', '--only', '-m', `release version ${nextVersion}`, '--', ...releaseFiles])
if (commit.status !== 0) fail(commit.stderr.trim() || 'Could not create release commit.')
const push = git(['push', 'origin', 'master'])
if (push.status !== 0) fail(push.stderr.trim() || 'Could not push release commit.')

console.log(`Released ${nextVersion} (${bump} bump).`)
