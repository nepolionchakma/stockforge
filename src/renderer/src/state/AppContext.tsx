import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  FONT_SCALES,
  type AiEndpointInput,
  type AiEndpointSaveResult,
  type AiSettings,
  type AiTestResult,
  type EmbedOptions,
  type EmbedProgress,
  type EmbedResult,
  type FontScale,
  type ImageAsset,
  type Metadata,
  type PromptRecord,
  type PromptStyle
} from '@shared/types'
import { DEFAULT_MASTER_PROMPT } from '../data/defaultMasterPrompt'
import { buildCsv, csvFileName } from '../lib/csv'
import { YEAR_OPTIONS, pickDefaultEvent, resolveEvents } from '../lib/dates'
import { buildMasterPrompt } from '../lib/masterPrompt'
import { analyzeFiles } from '../lib/imageAnalysis'
import {
  generateMetadata,
  keywordSuggestions,
  metadataToText
} from '../lib/metadataEngine'
import { generatePrompts, newPromptId } from '../lib/promptEngine'

export type AppTab = 'events' | 'metadata' | 'apply'
export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface AppContextValue {
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void
  year: number
  setYear: (year: number) => void
  events: ReturnType<typeof resolveEvents>
  selectedEventId: string
  selectEvent: (eventId: string) => void
  selectedEvent: ReturnType<typeof resolveEvents>[number]
  metadataEventId: string | null
  setMetadataEventId: (eventId: string | null) => void
  metadataEvent: ReturnType<typeof resolveEvents>[number] | null
  prompts: Record<string, PromptRecord[]>
  seedPrompts: (eventId: string) => void
  generatePromptsFor: (
    eventId: string,
    style: PromptStyle,
    count: number,
    niche?: string
  ) => Promise<void>
  updatePrompt: (eventId: string, promptId: string, text: string) => void
  removePrompt: (eventId: string, promptId: string) => void
  regeneratePrompt: (eventId: string, promptId: string, niche?: string) => Promise<void>
  addPrompt: (eventId: string, style: PromptStyle, niche?: string) => Promise<void>
  generatePromptsWithAi: boolean
  generatingPrompts: boolean
  masterPrompt: string
  setMasterPrompt: (template: string) => void
  whiteBackground: boolean
  setWhiteBackground: (enabled: boolean) => void
  aiSettings: AiSettings
  aiEnabled: boolean
  setAiEnabled: (enabled: boolean) => void
  saveAiEndpoint: (input: AiEndpointInput) => Promise<AiEndpointSaveResult>
  deleteAiEndpoint: (id: string) => Promise<void>
  reorderAiEndpoints: (orderedIds: string[]) => Promise<void>
  testAiConnection: (endpointId: string) => Promise<AiTestResult>
  fontScale: FontScale
  setFontScale: (scale: FontScale) => void
  copyText: (text: string, message?: string) => Promise<void>
  images: ImageAsset[]
  importing: boolean
  addImages: () => Promise<void>
  removeImage: (id: string) => void
  clearImages: () => void
  metadata: Record<string, Metadata>
  activeImageId: string | null
  activeImage: ImageAsset | null
  activeMetadata: Metadata | null
  setActiveImageId: (id: string | null) => void
  selectedImageIds: string[]
  toggleSelectedImage: (id: string) => void
  selectAllImages: () => void
  clearSelection: () => void
  generateMetadataFor: (ids?: string[]) => void
  updateMetadata: (id: string, patch: Partial<Metadata>) => void
  copyMetadata: (id: string) => Promise<void>
  suggestionsFor: (image: ImageAsset) => string[]
  exportCsv: () => Promise<void>
  lastExportPath: string | null
  showExportFile: () => Promise<void>
  outputDir: string
  chooseOutputFolder: () => Promise<void>
  embedOptions: EmbedOptions
  setEmbedOption: (key: keyof EmbedOptions, value: boolean) => void
  embedResults: EmbedResult[]
  embedProgress: EmbedProgress | null
  embedding: boolean
  applyMetadata: () => Promise<void>
  openOutputFolder: () => Promise<void>
  toasts: Toast[]
  notify: (message: string, tone?: ToastTone) => void
  dismissToast: (id: number) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const PROMPT_STORAGE_KEY = 'stockforge.prompts.v1'
const AI_ENABLED_KEY = 'stockforge.ai.enabled.v1'
const FONT_SCALE_KEY = 'stockforge.fontScale.v1'
const MASTER_PROMPT_KEY = 'stockforge.masterPrompt.v1'
const WHITE_BACKGROUND_KEY = 'stockforge.whiteBackground.v1'
const MAX_MASTER_PROMPT_LENGTH = 80_000

const DEFAULT_PROVIDER =
  AI_PROVIDERS.find((provider) => provider.id === DEFAULT_AI_PROVIDER) ?? AI_PROVIDERS[0]

const DEFAULT_AI_SETTINGS: AiSettings = {
  endpoints: [
    {
      id: 'default',
      provider: DEFAULT_PROVIDER.id,
      baseUrl: DEFAULT_PROVIDER.baseUrl,
      model: DEFAULT_PROVIDER.defaultModel,
      hasApiKey: false
    }
  ]
}

function readAiEnabled(): boolean {
  return localStorage.getItem(AI_ENABLED_KEY) !== 'false'
}

function readFontScale(): FontScale {
  const stored = Number(localStorage.getItem(FONT_SCALE_KEY))
  return FONT_SCALES.includes(stored as FontScale) ? (stored as FontScale) : 1
}

function readWhiteBackground(): boolean {
  return localStorage.getItem(WHITE_BACKGROUND_KEY) !== 'false'
}

function readMasterPrompt(): string {
  try {
    const stored = localStorage.getItem(MASTER_PROMPT_KEY)
    return stored === null ? DEFAULT_MASTER_PROMPT : stored
  } catch {
    return DEFAULT_MASTER_PROMPT
  }
}

function toPromptRecords(texts: string[], style: PromptStyle): PromptRecord[] {
  return texts.map((text) => ({
    id: newPromptId(),
    text,
    style,
    createdAt: Date.now()
  }))
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

const initialYear = YEAR_OPTIONS.includes(new Date().getFullYear())
  ? new Date().getFullYear()
  : YEAR_OPTIONS[1]
const initialEvent = pickDefaultEvent(resolveEvents(initialYear))

function readStoredPrompts(): Record<string, PromptRecord[]> {
  try {
    const raw = localStorage.getItem(PROMPT_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Record<string, PromptRecord[]> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue
      result[key] = value
        .filter(
          (item): item is PromptRecord =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as PromptRecord).id === 'string' &&
            typeof (item as PromptRecord).text === 'string'
        )
        .map((item) => ({
          id: item.id,
          text: item.text,
          style: item.style ?? 'photo',
          createdAt: item.createdAt ?? Date.now()
        }))
    }
    return result
  } catch {
    return {}
  }
}

export function AppProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AppTab>('events')
  const [year, setYear] = useState(initialYear)
  const events = useMemo(() => resolveEvents(year), [year])
  const [selectedEventId, setSelectedEventId] = useState(initialEvent.id)
  const [metadataEventId, setMetadataEventId] = useState<string | null>(initialEvent.id)
  const [prompts, setPrompts] = useState<Record<string, PromptRecord[]>>(readStoredPrompts)
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS)
  const [aiEnabled, setAiEnabled] = useState(readAiEnabled)
  const [generatingPrompts, setGeneratingPrompts] = useState(false)
  const [masterPrompt, setMasterPromptState] = useState(readMasterPrompt)
  const [whiteBackground, setWhiteBackground] = useState(readWhiteBackground)
  const [fontScale, setFontScale] = useState<FontScale>(readFontScale)

  const [images, setImages] = useState<ImageAsset[]>([])
  const [importing, setImporting] = useState(false)
  const [metadata, setMetadata] = useState<Record<string, Metadata>>({})
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [activeImageId, setActiveImageId] = useState<string | null>(null)

  const [lastExportPath, setLastExportPath] = useState<string | null>(null)
  const [outputDir, setOutputDir] = useState('')
  const [embedOptions, setEmbedOptions] = useState<EmbedOptions>({
    title: true,
    description: true,
    keywords: true,
    overwrite: false
  })
  const [embedResults, setEmbedResults] = useState<EmbedResult[]>([])
  const [embedProgress, setEmbedProgress] = useState<EmbedProgress | null>(null)
  const [embedding, setEmbedding] = useState(false)

  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    toastId.current += 1
    const id = toastId.current
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4600)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(prompts))
    } catch {
      // Persistence is a convenience; quota or storage errors should not break the app.
    }
  }, [prompts])

  useEffect(() => {
    let cancelled = false
    void window.stockforge
      .getAiSettings()
      .then((settings) => {
        if (!cancelled) setAiSettings(settings)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(AI_ENABLED_KEY, String(aiEnabled))
  }, [aiEnabled])

  useEffect(() => {
    localStorage.setItem(FONT_SCALE_KEY, String(fontScale))
    void window.stockforge.setZoomFactor(fontScale).catch(() => undefined)
  }, [fontScale])

  useEffect(() => {
    localStorage.setItem(WHITE_BACKGROUND_KEY, String(whiteBackground))
  }, [whiteBackground])

  const setMasterPrompt = useCallback((template: string) => {
    setMasterPromptState(template.slice(0, MAX_MASTER_PROMPT_LENGTH))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(MASTER_PROMPT_KEY, masterPrompt)
    } catch {
      // The template is a convenience; storage errors should not break generation.
    }
  }, [masterPrompt])

  useEffect(() => {
    return window.stockforge.onEmbedProgress((progress) => setEmbedProgress(progress))
  }, [])

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? initialEvent,
    [events, selectedEventId]
  )

  const metadataEvent = useMemo(
    () =>
      metadataEventId ? (events.find((event) => event.id === metadataEventId) ?? null) : null,
    [events, metadataEventId]
  )

  const activeImage = useMemo(
    () => images.find((image) => image.id === activeImageId) ?? null,
    [images, activeImageId]
  )

  const activeMetadata = activeImageId ? (metadata[activeImageId] ?? null) : null
  const hasAiKey = aiSettings.endpoints.some((endpoint) => endpoint.hasApiKey)

  const selectEvent = useCallback((eventId: string) => {
    setSelectedEventId(eventId)
  }, [])

  const seedPrompts = useCallback(
    (eventId: string) => {
      const event = events.find((item) => item.id === eventId)
      if (!event) return
      setPrompts((current) => {
        if (current[eventId] !== undefined) return current
        return { ...current, [eventId]: generatePrompts(event, 'auto', 1, whiteBackground) }
      })
    },
    [events, whiteBackground]
  )

  const appendPrompts = useCallback(
    async (
      eventId: string,
      style: PromptStyle,
      count: number,
      mode: 'generate' | 'add',
      niche?: string
    ) => {
      if (generatingPrompts) return
      const event = events.find((item) => item.id === eventId)
      if (!event) return
      const customPrompt = masterPrompt.trim()
        ? buildMasterPrompt(masterPrompt, niche?.trim() || event.name, count)
        : undefined

      if (aiEnabled && hasAiKey) {
        setGeneratingPrompts(true)
        try {
          const result = await window.stockforge.generateAiPrompts({
            eventName: event.name,
            eventDate: event.dateLabel,
            blurb: event.blurb,
            keywords: event.keywords,
            objects: event.objects,
            palette: event.palette,
            kind: event.kind,
            style,
            count,
            existingPrompts: (prompts[eventId] ?? []).map((prompt) => prompt.text),
            whiteBackground,
            systemPrompt: customPrompt
          })
          const fresh = toPromptRecords(result.prompts, style)
          setPrompts((current) => ({
            ...current,
            [eventId]: [...(current[eventId] ?? []), ...fresh]
          }))
          const provider =
            AI_PROVIDERS.find((item) => item.id === result.provider)?.label ?? result.provider
          notify(
            `${fresh.length} AI prompt${fresh.length === 1 ? '' : 's'} ${
              mode === 'add' ? 'added' : 'generated'
            } · ${provider}${result.attempted > 1 ? ' (fallback)' : ''}`,
            'success'
          )
        } catch (error) {
          notify(errorText(error, 'AI prompt generation failed'), 'error')
        } finally {
          setGeneratingPrompts(false)
        }
        return
      }

      const fresh = generatePrompts(event, style, count, whiteBackground)
      setPrompts((current) => ({
        ...current,
        [eventId]: [...(current[eventId] ?? []), ...fresh]
      }))
      if (mode === 'add') notify('Prompt added', 'success')
    },
    [
      aiEnabled,
      events,
      generatingPrompts,
      hasAiKey,
      masterPrompt,
      notify,
      prompts,
      whiteBackground
    ]
  )

  const generatePromptsFor = useCallback(
    async (eventId: string, style: PromptStyle, count: number, niche?: string) => {
      await appendPrompts(eventId, style, count, 'generate', niche)
    },
    [appendPrompts]
  )

  const updatePrompt = useCallback((eventId: string, promptId: string, text: string) => {
    setPrompts((current) => ({
      ...current,
      [eventId]: (current[eventId] ?? []).map((prompt) =>
        prompt.id === promptId ? { ...prompt, text } : prompt
      )
    }))
  }, [])

  const removePrompt = useCallback((eventId: string, promptId: string) => {
    setPrompts((current) => ({
      ...current,
      [eventId]: (current[eventId] ?? []).filter((prompt) => prompt.id !== promptId)
    }))
  }, [])

  const regeneratePrompt = useCallback(
    async (eventId: string, promptId: string, niche?: string) => {
      if (generatingPrompts) return
      const event = events.find((item) => item.id === eventId)
      const list = prompts[eventId] ?? []
      const existing = list.find((prompt) => prompt.id === promptId)
      if (!event || !existing) return
      const customPrompt = masterPrompt.trim()
        ? buildMasterPrompt(masterPrompt, niche?.trim() || event.name, 1)
        : undefined

      if (aiEnabled && hasAiKey) {
        setGeneratingPrompts(true)
        try {
          const result = await window.stockforge.generateAiPrompts({
            eventName: event.name,
            eventDate: event.dateLabel,
            blurb: event.blurb,
            keywords: event.keywords,
            objects: event.objects,
            palette: event.palette,
            kind: event.kind,
            style: existing.style ?? 'auto',
            count: 1,
            existingPrompts: list
              .filter((prompt) => prompt.id !== promptId)
              .map((prompt) => prompt.text),
            whiteBackground,
            systemPrompt: customPrompt
          })
          const text = result.prompts[0]?.trim()
          if (!text) throw new Error('The AI response did not contain a usable prompt')
          setPrompts((current) => ({
            ...current,
            [eventId]: (current[eventId] ?? []).map((prompt) =>
              prompt.id === promptId
                ? { ...prompt, text, style: existing.style, createdAt: Date.now() }
                : prompt
            )
          }))
          const provider =
            AI_PROVIDERS.find((item) => item.id === result.provider)?.label ?? result.provider
          notify(
            `Prompt regenerated · ${provider}${
              result.attempted > 1 ? ' (fallback)' : ''
            }`,
            'success'
          )
        } catch (error) {
          notify(errorText(error, 'AI prompt generation failed'), 'error')
        } finally {
          setGeneratingPrompts(false)
        }
        return
      }

      setPrompts((current) => {
        const currentList = current[eventId] ?? []
        const currentPrompt = currentList.find((prompt) => prompt.id === promptId)
        if (!currentPrompt) return current
        const fresh = generatePrompts(
          event,
          currentPrompt.style ?? 'auto',
          1,
          whiteBackground
        )[0]
        return {
          ...current,
          [eventId]: currentList.map((prompt) =>
            prompt.id === promptId
              ? { ...fresh, id: prompt.id, createdAt: Date.now() }
              : prompt
          )
        }
      })
      notify('Prompt regenerated', 'success')
    },
    [
      aiEnabled,
      events,
      generatingPrompts,
      hasAiKey,
      masterPrompt,
      notify,
      prompts,
      whiteBackground
    ]
  )

  const addPrompt = useCallback(
    async (eventId: string, style: PromptStyle, niche?: string) => {
      await appendPrompts(eventId, style, 1, 'add', niche)
    },
    [appendPrompts]
  )

  const saveAiEndpoint = useCallback(
    async (input: AiEndpointInput): Promise<AiEndpointSaveResult> => {
      const saved = await window.stockforge.saveAiEndpoint(input)
      setAiSettings(saved.settings)
      if (saved.settings.endpoints.some((endpoint) => endpoint.hasApiKey)) {
        setAiEnabled(true)
      }
      notify('API connection saved', 'success')
      return saved
    },
    [notify]
  )

  const deleteAiEndpoint = useCallback(
    async (id: string): Promise<void> => {
      try {
        const settings = await window.stockforge.deleteAiEndpoint(id)
        setAiSettings(settings)
        notify('API connection removed', 'info')
      } catch (error) {
        notify(errorText(error, 'Could not remove the API connection'), 'error')
      }
    },
    [notify]
  )

  const reorderAiEndpoints = useCallback(
    async (orderedIds: string[]): Promise<void> => {
      try {
        const settings = await window.stockforge.reorderAiEndpoints(orderedIds)
        setAiSettings(settings)
      } catch (error) {
        notify(errorText(error, 'Could not change the API priority'), 'error')
      }
    },
    [notify]
  )

  const testAiConnection = useCallback(
    async (endpointId: string): Promise<AiTestResult> => {
      try {
        return await window.stockforge.testAiConnection(endpointId)
      } catch (error) {
        return { ok: false, message: errorText(error, 'Could not reach the AI provider') }
      }
    },
    []
  )

  const copyText = useCallback(
    async (text: string, message = 'Copied to clipboard') => {
      try {
        await window.stockforge.copyText(text)
        notify(message, 'success')
      } catch {
        notify('Could not copy to clipboard', 'error')
      }
    },
    [notify]
  )

  const addImages = useCallback(async () => {
    if (importing) return
    const selection = await window.stockforge.pickImages()
    if (selection.files.length === 0) {
      if (selection.rejected.length > 0) notify('Only JPG and PNG images are supported', 'error')
      return
    }

    const knownPaths = new Set(images.map((image) => image.path.toLowerCase()))
    const newFiles = selection.files.filter((file) => !knownPaths.has(file.path.toLowerCase()))
    if (newFiles.length === 0) {
      notify('Those images are already in the library', 'info')
      return
    }

    setImporting(true)
    try {
      const analyzed = await analyzeFiles(newFiles)
      setImages((current) => [...current, ...analyzed])
      setSelectedImageIds((current) => [
        ...new Set([...current, ...analyzed.map((image) => image.id)])
      ])
      setActiveImageId(analyzed[0]?.id ?? null)
      const unreadable = analyzed.filter((image) => !image.readable).length
      notify(
        `${analyzed.length} image${analyzed.length === 1 ? '' : 's'} added`,
        unreadable > 0 ? 'info' : 'success'
      )
      if (unreadable > 0) {
        notify(`${unreadable} image${unreadable === 1 ? '' : 's'} could not be analyzed`, 'error')
      }
    } finally {
      setImporting(false)
    }
  }, [images, importing, notify])

  const removeImage = useCallback((id: string) => {
    setImages((current) => current.filter((image) => image.id !== id))
    setMetadata((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setSelectedImageIds((current) => current.filter((imageId) => imageId !== id))
    setActiveImageId((current) => (current === id ? null : current))
    setEmbedResults((current) => current.filter((result) => result.sourcePath !== id))
  }, [])

  const clearImages = useCallback(() => {
    setImages([])
    setMetadata({})
    setSelectedImageIds([])
    setActiveImageId(null)
    setEmbedResults([])
    setEmbedProgress(null)
  }, [])

  const toggleSelectedImage = useCallback((id: string) => {
    setSelectedImageIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }, [])

  const selectAllImages = useCallback(() => {
    setSelectedImageIds(images.map((image) => image.id))
  }, [images])

  const clearSelection = useCallback(() => setSelectedImageIds([]), [])

  const generateMetadataFor = useCallback(
    (ids?: string[]) => {
      const targets = images.filter((image) =>
        ids ? ids.includes(image.id) : selectedImageIds.length > 0 ? selectedImageIds.includes(image.id) : true
      )
      if (targets.length === 0) {
        notify('Add images first, then generate metadata', 'error')
        return
      }
      const generated: Record<string, Metadata> = {}
      for (const image of targets) {
        generated[image.id] = generateMetadata(image, metadataEvent)
      }
      setMetadata((current) => ({ ...current, ...generated }))
      if (!activeImageId && targets[0]) setActiveImageId(targets[0].id)
      notify(
        `Metadata generated for ${targets.length} image${targets.length === 1 ? '' : 's'}`,
        'success'
      )
    },
    [activeImageId, images, metadataEvent, notify, selectedImageIds]
  )

  const updateMetadata = useCallback((id: string, patch: Partial<Metadata>) => {
    setMetadata((current) => {
      const existing = current[id]
      if (!existing) return current
      return { ...current, [id]: { ...existing, ...patch } }
    })
  }, [])

  const copyMetadata = useCallback(
    async (id: string) => {
      const entry = metadata[id]
      if (!entry) {
        notify('Generate metadata for this image first', 'error')
        return
      }
      await copyText(metadataToText(entry), 'Metadata copied')
    },
    [copyText, metadata, notify]
  )

  const suggestionsFor = useCallback(
    (image: ImageAsset) => keywordSuggestions(metadataEvent, image),
    [metadataEvent]
  )

  const exportCsv = useCallback(async () => {
    const targets = images.filter(
      (image) =>
        metadata[image.id] &&
        (selectedImageIds.length > 0 ? selectedImageIds.includes(image.id) : true)
    )
    if (targets.length === 0) {
      notify('Generate metadata before exporting a CSV', 'error')
      return
    }
    const csv = buildCsv(
      targets.map((image) => ({ fileName: image.fileName, metadata: metadata[image.id] }))
    )
    const saved = await window.stockforge.exportCsv({ fileName: csvFileName(), csv })
    if (!saved) return
    setLastExportPath(saved.path)
    notify(
      `Exported ${targets.length} row${targets.length === 1 ? '' : 's'} to CSV`,
      'success'
    )
  }, [images, metadata, notify, selectedImageIds])

  const showExportFile = useCallback(async () => {
    if (lastExportPath) await window.stockforge.showItemInFolder(lastExportPath)
  }, [lastExportPath])

  const chooseOutputFolder = useCallback(async () => {
    const folder = await window.stockforge.pickOutputFolder()
    if (folder) {
      setOutputDir(folder)
      setEmbedResults([])
    }
  }, [])

  const setEmbedOption = useCallback((key: keyof EmbedOptions, value: boolean) => {
    setEmbedOptions((current) => ({ ...current, [key]: value }))
  }, [])

  const applyMetadata = useCallback(async () => {
    const targets = images.filter(
      (image) => selectedImageIds.includes(image.id) && metadata[image.id]
    )
    if (targets.length === 0) {
      notify('Select at least one image with metadata', 'error')
      return
    }
    if (!outputDir) {
      notify('Choose an output folder first', 'error')
      return
    }
    if (!embedOptions.title && !embedOptions.description && !embedOptions.keywords) {
      notify('Choose at least one metadata field to write', 'error')
      return
    }

    setEmbedding(true)
    setEmbedResults([])
    setEmbedProgress({ done: 0, total: targets.length, fileName: '' })
    try {
      const results = await window.stockforge.embedMetadata({
        items: targets.map((image) => ({
          sourcePath: image.path,
          fileName: image.fileName,
          metadata: metadata[image.id]
        })),
        outputDir,
        options: embedOptions
      })
      setEmbedResults(results)
      const saved = results.filter((result) => result.status === 'saved').length
      const failed = results.filter((result) => result.status === 'failed').length
      if (saved > 0) {
        notify(
          `${saved} file${saved === 1 ? '' : 's'} saved with metadata${
            failed > 0 ? `, ${failed} failed` : ''
          }`,
          failed > 0 ? 'info' : 'success'
        )
      } else {
        notify('No files were saved. Check the message for each file.', 'error')
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Metadata export failed', 'error')
    } finally {
      setEmbedding(false)
    }
  }, [embedOptions, images, metadata, notify, outputDir, selectedImageIds])

  const openOutputFolder = useCallback(async () => {
    if (!outputDir) return
    const error = await window.stockforge.openPath(outputDir)
    if (error) notify(error, 'error')
  }, [notify, outputDir])

  const value: AppContextValue = {
    activeTab,
    setActiveTab,
    year,
    setYear,
    events,
    selectedEventId,
    selectEvent,
    selectedEvent,
    metadataEventId,
    setMetadataEventId,
    metadataEvent,
    prompts,
    seedPrompts,
    generatePromptsFor,
    updatePrompt,
    removePrompt,
    regeneratePrompt,
    addPrompt,
    generatePromptsWithAi: aiEnabled && hasAiKey,
    generatingPrompts,
    masterPrompt,
    setMasterPrompt,
    whiteBackground,
    setWhiteBackground,
    aiSettings,
    aiEnabled,
    setAiEnabled,
    saveAiEndpoint,
    deleteAiEndpoint,
    reorderAiEndpoints,
    testAiConnection,
    fontScale,
    setFontScale,
    copyText,
    images,
    importing,
    addImages,
    removeImage,
    clearImages,
    metadata,
    activeImageId,
    activeImage,
    activeMetadata,
    setActiveImageId,
    selectedImageIds,
    toggleSelectedImage,
    selectAllImages,
    clearSelection,
    generateMetadataFor,
    updateMetadata,
    copyMetadata,
    suggestionsFor,
    exportCsv,
    lastExportPath,
    showExportFile,
    outputDir,
    chooseOutputFolder,
    embedOptions,
    setEmbedOption,
    embedResults,
    embedProgress,
    embedding,
    applyMetadata,
    openOutputFolder,
    toasts,
    notify,
    dismissToast
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
