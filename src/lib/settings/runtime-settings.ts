/**
 * In-memory runtime settings.
 * Resets on server restart. No database, no persistence.
 */

const settings: Record<string, string> = {}

export function getRuntimeSetting(key: string): string | undefined {
  return settings[key]
}

export function setRuntimeSetting(key: string, value: string): void {
  settings[key] = value
}

export function getAllRuntimeSettings(): Record<string, string> {
  return { ...settings }
}

export function clearRuntimeSettings(): void {
  for (const key of Object.keys(settings)) {
    delete settings[key]
  }
}
