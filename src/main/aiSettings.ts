import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  type AiEndpointInput,
  type AiEndpointSaveResult,
  type AiProvider,
  type AiSettings
} from '../shared/types'

interface StoredAiEndpoint {
  id: string
  provider: AiProvider
  baseUrl: string
  model: string
  encryptedApiKey?: string
}

interface StoredAiSettings {
  version: 2
  endpoints: StoredAiEndpoint[]
}

const DEFAULT_PROVIDER =
  AI_PROVIDERS.find((provider) => provider.id === DEFAULT_AI_PROVIDER) ?? AI_PROVIDERS[0]

const DEFAULT_ENDPOINT: StoredAiEndpoint = {
  id: 'default',
  provider: DEFAULT_PROVIDER.id,
  baseUrl: DEFAULT_PROVIDER.baseUrl,
  model: DEFAULT_PROVIDER.defaultModel
}

let cached: StoredAiSettings | null = null

function settingsPath(): string {
  return join(app.getPath('userData'), 'ai-settings.json')
}

function isProvider(value: unknown): value is AiProvider {
  return typeof value === 'string' && AI_PROVIDERS.some((provider) => provider.id === value)
}

function isEndpointId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
}

function normalizeBaseUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('API base URL is required')
  }
  const trimmed = value.trim().replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('API base URL is not a valid URL')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('API base URL must start with https:// or http://')
  }
  if (parsed.username || parsed.password) {
    throw new Error('Do not put credentials in the API base URL')
  }
  return trimmed
}

function normalizeModel(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Model name is required')
  }
  return value.trim().slice(0, 160)
}

function normalizeStoredEndpoint(value: unknown): StoredAiEndpoint | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (
    typeof record.baseUrl !== 'string' ||
    !record.baseUrl.trim() ||
    typeof record.model !== 'string' ||
    !record.model.trim()
  ) {
    return null
  }
  return {
    id: isEndpointId(record.id) ? record.id : `api-${randomUUID()}`,
    provider: isProvider(record.provider) ? record.provider : DEFAULT_PROVIDER.id,
    baseUrl: record.baseUrl.trim().replace(/\/+$/, ''),
    model: record.model.trim().slice(0, 160),
    encryptedApiKey:
      typeof record.encryptedApiKey === 'string' ? record.encryptedApiKey : undefined
  }
}

async function readStored(): Promise<StoredAiSettings> {
  if (cached) return cached
  try {
    const raw: unknown = JSON.parse(await fs.readFile(settingsPath(), 'utf8'))
    const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

    if (Array.isArray(record.endpoints)) {
      const endpoints = record.endpoints
        .map(normalizeStoredEndpoint)
        .filter((endpoint): endpoint is StoredAiEndpoint => endpoint !== null)
      cached = { version: 2, endpoints }
    } else if (typeof record.provider === 'string' || typeof record.baseUrl === 'string') {
      const migrated = normalizeStoredEndpoint({ ...record, id: DEFAULT_ENDPOINT.id })
      cached = { version: 2, endpoints: migrated ? [migrated] : [DEFAULT_ENDPOINT] }
    } else {
      cached = { version: 2, endpoints: [DEFAULT_ENDPOINT] }
    }
  } catch {
    cached = { version: 2, endpoints: [DEFAULT_ENDPOINT] }
  }
  return cached
}

function decryptApiKey(endpoint: StoredAiEndpoint): string | null {
  if (!endpoint.encryptedApiKey || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(endpoint.encryptedApiKey, 'base64'))
  } catch {
    return null
  }
}

function toPublic(stored: StoredAiSettings): AiSettings {
  return {
    endpoints: stored.endpoints.map((endpoint) => ({
      id: endpoint.id,
      provider: endpoint.provider,
      baseUrl: endpoint.baseUrl,
      model: endpoint.model,
      hasApiKey: decryptApiKey(endpoint) !== null
    }))
  }
}

async function writeStored(stored: StoredAiSettings): Promise<void> {
  await fs.writeFile(settingsPath(), JSON.stringify(stored, null, 2), 'utf8')
  cached = stored
}

export async function getAiSettings(): Promise<AiSettings> {
  return toPublic(await readStored())
}

export interface AiRuntimeConfig {
  id: string
  provider: AiProvider
  baseUrl: string
  model: string
  apiKey: string | null
}

export async function getAiConfigs(): Promise<AiRuntimeConfig[]> {
  const stored = await readStored()
  return stored.endpoints.map((endpoint) => ({
    id: endpoint.id,
    provider: endpoint.provider,
    baseUrl: endpoint.baseUrl,
    model: endpoint.model,
    apiKey: decryptApiKey(endpoint)
  }))
}

export async function saveAiEndpoint(input: AiEndpointInput): Promise<AiEndpointSaveResult> {
  const stored = await readStored()
  const provider = isProvider(input.provider) ? input.provider : DEFAULT_PROVIDER.id
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const model = normalizeModel(input.model)
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : ''

  const existingIndex =
    input.id && isEndpointId(input.id)
      ? stored.endpoints.findIndex((endpoint) => endpoint.id === input.id)
      : -1
  const existing = existingIndex >= 0 ? stored.endpoints[existingIndex] : null
  const id = existing?.id ?? `api-${randomUUID()}`

  let encryptedApiKey = existing?.encryptedApiKey
  if (input.clearApiKey) encryptedApiKey = undefined
  if (apiKey) {
    if (apiKey.length > 500) throw new Error('API key is too long')
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable on this system')
    }
    encryptedApiKey = safeStorage.encryptString(apiKey).toString('base64')
  }

  const nextEndpoint: StoredAiEndpoint = { id, provider, baseUrl, model, encryptedApiKey }
  const endpoints = [...stored.endpoints]
  if (existingIndex >= 0) endpoints[existingIndex] = nextEndpoint
  else endpoints.push(nextEndpoint)

  const next: StoredAiSettings = { version: 2, endpoints }
  await writeStored(next)
  return { settings: toPublic(next), endpointId: id }
}

export async function deleteAiEndpoint(id: string): Promise<AiSettings> {
  const stored = await readStored()
  const next: StoredAiSettings = {
    version: 2,
    endpoints: stored.endpoints.filter((endpoint) => endpoint.id !== id)
  }
  await writeStored(next)
  return toPublic(next)
}

export async function reorderAiEndpoints(orderedIds: string[]): Promise<AiSettings> {
  const stored = await readStored()
  const byId = new Map(stored.endpoints.map((endpoint) => [endpoint.id, endpoint]))
  const ordered: StoredAiEndpoint[] = []
  for (const id of orderedIds) {
    const endpoint = byId.get(id)
    if (!endpoint) continue
    ordered.push(endpoint)
    byId.delete(id)
  }
  for (const endpoint of stored.endpoints) {
    if (byId.has(endpoint.id)) ordered.push(endpoint)
  }
  const next: StoredAiSettings = { version: 2, endpoints: ordered }
  await writeStored(next)
  return toPublic(next)
}
