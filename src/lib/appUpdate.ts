export function getManifestVersion(manifest: unknown): string | null {
  if (typeof manifest !== 'object' || manifest === null || !('version' in manifest)) return null
  return typeof manifest.version === 'string' && manifest.version.length > 0 ? manifest.version : null
}

/** Reload when a deployed manifest identifies a different app release. */
export function shouldReloadForManifestVersion(manifest: unknown, appVersion: string): boolean {
  const manifestVersion = getManifestVersion(manifest)
  return manifestVersion !== null && manifestVersion !== appVersion
}
