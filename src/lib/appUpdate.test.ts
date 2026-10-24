import { describe, expect, it } from 'vitest'
import { getManifestVersion, shouldReloadForManifestVersion } from './appUpdate'

describe('app update version checks', () => {
  it.each([null, [], {}, { version: 3 }, { version: null }, { version: '' }])('rejects an invalid manifest version: %j', (manifest) => {
    expect(getManifestVersion(manifest)).toBeNull()
    expect(shouldReloadForManifestVersion(manifest, '1.2.3')).toBe(false)
  })

  it('keeps the current release loaded when versions match', () => {
    expect(shouldReloadForManifestVersion({ version: '1.2.3' }, '1.2.3')).toBe(false)
  })

  it('reloads for a newer or rolled-back deployed release', () => {
    expect(shouldReloadForManifestVersion({ version: '1.2.4' }, '1.2.3')).toBe(true)
    expect(shouldReloadForManifestVersion({ version: '1.2.2' }, '1.2.3')).toBe(true)
  })
})
