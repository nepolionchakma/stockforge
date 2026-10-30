import { useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Type,
  X
} from 'lucide-react'
import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  type AiEndpoint,
  type AiProvider,
  type FontScale
} from '@shared/types'
import { useApp } from '../state/AppContext'
import {
  Badge,
  Button,
  FieldLabel,
  IconButton,
  Select,
  TextInput,
  ToggleRow,
  cx
} from './ui'

const FONT_OPTIONS: Array<{ value: FontScale; label: string }> = [
  { value: 0.9, label: 'Small' },
  { value: 1, label: 'Default' },
  { value: 1.1, label: 'Large' },
  { value: 1.2, label: 'Largest' }
]

const FALLBACK_PROVIDER =
  AI_PROVIDERS.find((provider) => provider.id === DEFAULT_AI_PROVIDER) ?? AI_PROVIDERS[0]

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Could not save settings'
}

function providerName(id: AiProvider): string {
  return AI_PROVIDERS.find((provider) => provider.id === id)?.label ?? id
}

function endpointHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl
  }
}

function modelTier(provider: AiProvider, model: string): 'free' | 'paid' | null {
  const preset = AI_PROVIDERS.find((item) => item.id === provider)
  const entry = preset?.models.find((item) => item.id === model)
  if (!entry) return null
  return entry.free ? 'free' : 'paid'
}

export function SettingsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const app = useApp()
  const endpoints = app.aiSettings.endpoints
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [provider, setProvider] = useState<AiProvider>(FALLBACK_PROVIDER.id)
  const [baseUrl, setBaseUrl] = useState(FALLBACK_PROVIDER.baseUrl)
  const [model, setModel] = useState(FALLBACK_PROVIDER.defaultModel)
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [existingHasKey, setExistingHasKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const providerMeta = AI_PROVIDERS.find((item) => item.id === provider) ?? AI_PROVIDERS[0]
  const selectedModel = providerMeta.models.find((item) => item.id === model)
  const modelIsFree = selectedModel?.free ?? false
  const editingIndex = editingId
    ? endpoints.findIndex((endpoint) => endpoint.id === editingId)
    : -1

  const resetForm = (): void => {
    setFormOpen(false)
    setEditingId(null)
    setApiKey('')
    setShowKey(false)
    setStatus(null)
  }

  const startAdd = (): void => {
    setFormOpen(true)
    setEditingId(null)
    setProvider(FALLBACK_PROVIDER.id)
    setBaseUrl(FALLBACK_PROVIDER.baseUrl)
    setModel(FALLBACK_PROVIDER.defaultModel)
    setUseCustomModel(false)
    setExistingHasKey(false)
    setApiKey('')
    setStatus(null)
  }

  const startEdit = (endpoint: AiEndpoint): void => {
    const preset = AI_PROVIDERS.find((item) => item.id === endpoint.provider)
    setFormOpen(true)
    setEditingId(endpoint.id)
    setProvider(endpoint.provider)
    setBaseUrl(endpoint.baseUrl)
    setModel(endpoint.model)
    setUseCustomModel(
      !preset || preset.models.length === 0 || !preset.models.some((item) => item.id === endpoint.model)
    )
    setExistingHasKey(endpoint.hasApiKey)
    setApiKey('')
    setStatus(null)
  }

  const changeProvider = (next: AiProvider): void => {
    setProvider(next)
    setStatus(null)
    setUseCustomModel(next === 'custom')
    if (next === 'custom') return
    const preset = AI_PROVIDERS.find((item) => item.id === next)
    if (preset) {
      setBaseUrl(preset.baseUrl)
      setModel(preset.defaultModel)
    }
  }

  const persist = async (showConfirmation: boolean): Promise<string | null> => {
    setSaving(true)
    setStatus(null)
    try {
      const result = await app.saveAiEndpoint({
        id: editingId ?? undefined,
        provider,
        baseUrl,
        model,
        apiKey: apiKey.trim() || undefined
      })
      setEditingId(result.endpointId)
      setApiKey('')
      const savedEndpoint = result.settings.endpoints.find(
        (endpoint) => endpoint.id === result.endpointId
      )
      setExistingHasKey(savedEndpoint?.hasApiKey ?? false)
      if (showConfirmation) {
        setStatus({
          ok: true,
          text: savedEndpoint?.hasApiKey
            ? 'Saved. The API key is encrypted on this computer.'
            : 'Saved. Add an API key to use this connection.'
        })
      }
      return result.endpointId
    } catch (error) {
      setStatus({ ok: false, text: errorMessage(error) })
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setStatus(null)
    try {
      const endpointId = await persist(false)
      if (!endpointId) return
      const result = await app.testAiConnection(endpointId)
      setStatus({ ok: result.ok, text: result.message })
    } catch (error) {
      setStatus({ ok: false, text: errorMessage(error) })
    } finally {
      setTesting(false)
    }
  }

  const handleClearKey = async (): Promise<void> => {
    setSaving(true)
    setStatus(null)
    try {
      const result = await app.saveAiEndpoint({
        id: editingId ?? undefined,
        provider,
        baseUrl,
        model,
        clearApiKey: true
      })
      setEditingId(result.endpointId)
      setExistingHasKey(
        result.settings.endpoints.find((endpoint) => endpoint.id === result.endpointId)
          ?.hasApiKey ?? false
      )
      setApiKey('')
      setStatus({ ok: true, text: 'Saved API key removed from this computer.' })
    } catch (error) {
      setStatus({ ok: false, text: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    await app.deleteAiEndpoint(id)
    if (editingId === id) resetForm()
  }

  const moveEndpoint = async (index: number, delta: number): Promise<void> => {
    const target = index + delta
    if (target < 0 || target >= endpoints.length) return
    const ids = endpoints.map((endpoint) => endpoint.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await app.reorderAiEndpoints(ids)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="panel flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-hidden"
      >
        <header className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent-soft text-accent">
            <Settings2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="settings-title" className="text-[14px] font-medium text-ink">
              Settings
            </h2>
            <p className="mt-0.5 text-[10.5px] text-faint">
              AI API connections, priority fallback and display size.
            </p>
          </div>
          <IconButton label="Close settings" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section className="rounded-xl border border-edge bg-white/[0.022] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <KeyRound className="h-4 w-4 text-accent" />
              <h3 className="text-[12.5px] font-medium text-ink">AI API connections</h3>
              <Badge tone={endpoints.some((endpoint) => endpoint.hasApiKey) ? 'success' : 'neutral'}>
                {endpoints.length} saved
              </Badge>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
              Tried from top to bottom. If one hits a rate limit or fails, the next saved key is
              used automatically.
            </p>

            <div className="mt-4 space-y-2">
              {endpoints.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center">
                  <p className="text-[11.5px] font-medium text-ink">No API connections yet</p>
                  <p className="mt-1 text-[10.5px] text-faint">
                    Add a free provider key, then add a backup if you want automatic failover.
                  </p>
                </div>
              ) : (
                endpoints.map((endpoint, index) => {
                  const tier = modelTier(endpoint.provider, endpoint.model)
                  return (
                    <div
                      key={endpoint.id}
                      className="flex items-center gap-2 rounded-xl border border-edge bg-white/[0.025] px-2.5 py-2"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.03] text-[10px] font-semibold tabular-nums text-muted">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[11.5px] font-medium text-ink">
                            {providerName(endpoint.provider)}
                          </span>
                          <Badge tone={endpoint.hasApiKey ? 'success' : 'danger'}>
                            {endpoint.hasApiKey ? 'Key saved' : 'No key'}
                          </Badge>
                          {tier ? (
                            <Badge tone={tier === 'free' ? 'success' : 'neutral'}>
                              {tier === 'free' ? 'Free' : 'Paid'}
                            </Badge>
                          ) : null}
                        </div>
                        <div
                          className="mt-0.5 truncate text-[9.5px] text-faint"
                          title={`${endpoint.baseUrl} · ${endpoint.model}`}
                        >
                          {endpoint.model}
                          <span className="opacity-70"> · {endpointHost(endpoint.baseUrl)}</span>
                        </div>
                      </div>
                      <IconButton
                        label={`Move ${providerName(endpoint.provider)} up`}
                        disabled={index === 0}
                        onClick={() => void moveEndpoint(index, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label={`Move ${providerName(endpoint.provider)} down`}
                        disabled={index === endpoints.length - 1}
                        onClick={() => void moveEndpoint(index, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="Edit API connection"
                        onClick={() => startEdit(endpoint)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="Remove API connection"
                        tone="danger"
                        onClick={() => void handleDelete(endpoint.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  )
                })
              )}
            </div>

            {!formOpen ? (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={startAdd}
              >
                Add API
              </Button>
            ) : (
              <div className="mt-4 rounded-xl border border-accent/20 bg-white/[0.028] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-[12px] font-medium text-ink">
                      {editingId ? 'Edit API connection' : 'Add API connection'}
                    </h4>
                    <p className="mt-0.5 text-[10px] text-faint">
                      {editingId
                        ? `Priority ${editingIndex + 1} of ${endpoints.length}`
                        : `Will be added as priority ${endpoints.length + 1}`}
                    </p>
                  </div>
                  <IconButton label="Close API editor" onClick={resetForm}>
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <FieldLabel
                      hint={
                        providerMeta.keyUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              void window.stockforge.openExternal(providerMeta.keyUrl)
                            }
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-accent transition-colors hover:text-accent-strong"
                          >
                            {providerMeta.keyLabel}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        ) : undefined
                      }
                    >
                      Provider
                    </FieldLabel>
                    <Select
                      value={provider}
                      onChange={(event) => changeProvider(event.target.value as AiProvider)}
                      aria-label="AI provider"
                    >
                      {AI_PROVIDERS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                          {item.freeTier ? ' (free tier)' : ''}
                        </option>
                      ))}
                    </Select>
                    <p
                      className={cx(
                        'mt-1.5 text-[10px] leading-relaxed',
                        providerMeta.freeTier ? 'text-mint' : 'text-faint'
                      )}
                    >
                      {providerMeta.note}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                    <div>
                      <FieldLabel>API base URL</FieldLabel>
                      <TextInput
                        value={baseUrl}
                        onChange={(event) => setBaseUrl(event.target.value)}
                        placeholder="https://api.openai.com/v1"
                        spellCheck={false}
                        aria-label="API base URL"
                      />
                    </div>
                    <div>
                      <FieldLabel
                        hint={
                          <Badge tone={!useCustomModel && modelIsFree ? 'success' : 'neutral'}>
                            {useCustomModel ? 'Custom' : modelIsFree ? 'Free' : 'Paid'}
                          </Badge>
                        }
                      >
                        Model
                      </FieldLabel>
                      {providerMeta.models.length > 0 ? (
                        <>
                          <Select
                            value={useCustomModel ? '__custom' : model}
                            onChange={(event) => {
                              const next = event.target.value
                              if (next === '__custom') {
                                setUseCustomModel(true)
                                return
                              }
                              setUseCustomModel(false)
                              setModel(next)
                            }}
                            aria-label="AI model"
                          >
                            {providerMeta.models.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label} — {item.free ? 'Free' : 'Paid'}
                              </option>
                            ))}
                            <option value="__custom">Custom model…</option>
                          </Select>
                          {useCustomModel ? (
                            <TextInput
                              value={model}
                              onChange={(event) => setModel(event.target.value)}
                              placeholder="Exact model ID from the provider"
                              spellCheck={false}
                              aria-label="Custom model ID"
                              className="mt-2"
                            />
                          ) : null}
                        </>
                      ) : (
                        <TextInput
                          value={model}
                          onChange={(event) => setModel(event.target.value)}
                          placeholder="Exact model ID from the provider"
                          spellCheck={false}
                          aria-label="AI model"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <FieldLabel
                      hint={
                        <span className="text-[9.5px] text-faint">
                          {existingHasKey ? 'A key is saved' : 'Required for this connection'}
                        </span>
                      }
                    >
                      API key
                    </FieldLabel>
                    <div className="flex items-center gap-2">
                      <div className="relative min-w-0 flex-1">
                        <TextInput
                          type={showKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(event) => setApiKey(event.target.value)}
                          placeholder={
                            existingHasKey
                              ? 'Saved — enter a new key to replace it'
                              : 'Paste your API key'
                          }
                          spellCheck={false}
                          autoComplete="off"
                          aria-label="API key"
                          className="pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((value) => !value)}
                          aria-label={showKey ? 'Hide API key' : 'Show API key'}
                          title={showKey ? 'Hide API key' : 'Show API key'}
                          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-faint transition-colors hover:bg-white/10 hover:text-ink"
                        >
                          {showKey ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      {existingHasKey ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleClearKey()}
                          disabled={saving || testing}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[9.5px] leading-relaxed text-faint">
                      Keys are encrypted with the operating system keychain and never returned to
                      this page.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void persist(true)}
                      loading={saving}
                      disabled={testing}
                    >
                      {editingId ? 'Save API' : 'Add connection'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleTest()}
                      loading={testing}
                      disabled={saving}
                    >
                      Test connection
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetForm} disabled={saving || testing}>
                      Cancel
                    </Button>
                  </div>

                  {status ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className={cx(
                        'flex items-start gap-2 rounded-lg border px-3 py-2 text-[10.5px] leading-relaxed',
                        status.ok
                          ? 'border-mint/20 bg-mint/[0.07] text-mint'
                          : 'border-danger/25 bg-danger/[0.07] text-danger'
                      )}
                    >
                      {status.ok ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="min-w-0 break-words">{status.text}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="mt-4">
              <ToggleRow
                checked={app.aiEnabled}
                onChange={app.setAiEnabled}
                title="Use AI when generating prompts"
                description={
                  endpoints.some((endpoint) => endpoint.hasApiKey)
                    ? 'Generate, Add prompt and Regenerate walk the priority list above.'
                    : 'Without a saved key, the offline prompt builder is used.'
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-edge bg-white/[0.022] p-4">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-accent" />
              <h3 className="text-[12.5px] font-medium text-ink">Text size</h3>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
              Scales the whole interface so labels and prompts stay comfortable to read.
            </p>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {FONT_OPTIONS.map((option) => {
                const active = app.fontScale === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => app.setFontScale(option.value)}
                    aria-pressed={active}
                    aria-label={`${option.label} text size, ${Math.round(option.value * 100)} percent`}
                    className={cx(
                      'rounded-lg border px-2 py-2 text-center transition-colors',
                      active
                        ? 'border-accent/35 bg-accent-soft text-accent'
                        : 'border-edge bg-white/[0.025] text-muted hover:border-edge-strong hover:text-ink'
                    )}
                  >
                    <span className="block text-[11px] font-medium">{option.label}</span>
                    <span className="mt-0.5 block text-[9px] tabular-nums opacity-70">
                      {Math.round(option.value * 100)}%
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3.5">
          <span className="max-w-[300px] text-[9.5px] leading-relaxed text-faint">
            API calls go directly from this app to the provider. Keys stay encrypted on this PC.
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </footer>
      </section>
    </div>
  )
}
