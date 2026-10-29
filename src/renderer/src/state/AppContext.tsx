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
import type {
  EmbedOptions,
  EmbedProgress,
  EmbedResult,
  ImageAsset,
  Metadata,
  PromptRecord,
  PromptStyle
} from '@shared/types'
import { buildCsv, csvFileName } from '../lib/csv'
import { YEAR_OPTIONS, pickDefaultEvent, resolveEvents } from '../lib/dates'
import { analyzeFiles } from '../lib/imageAnalysis'
import {
  generateMetadata,
  keywordSuggestions,
  metadataToText
} from '../lib/metadataEngine'
import { generatePrompts } from '../lib/promptEngine'

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
  generatePromptsFor: (eventId: string, style: PromptStyle, count: number) => void
  updatePrompt: (eventId: string, promptId: string, text: string) => void
  removePrompt: (eventId: string, promptId: string) => void
  regeneratePrompt: (eventId: string, promptId: string) => void
  addPrompt: (eventId: string, style: PromptStyle) => void
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

  const selectEvent = useCallback((eventId: string) => {
    setSelectedEventId(eventId)
  }, [])

  const seedPrompts = useCallback(
    (eventId: string) => {
      const event = events.find((item) => item.id === eventId)
      if (!event) return
      setPrompts((current) => {
        if (current[eventId] !== undefined) return current
        return { ...current, [eventId]: generatePrompts(event, 'auto', 1) }
      })
    },
    [events]
  )

  const generatePromptsFor = useCallback(
    (eventId: string, style: PromptStyle, count: number) => {
      const event = events.find((item) => item.id === eventId)
      if (!event) return
      const fresh = generatePrompts(event, style, count)
      setPrompts((current) => ({
        ...current,
        [eventId]: [...(current[eventId] ?? []), ...fresh]
      }))
    },
    [events]
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
    (eventId: string, promptId: string) => {
      const event = events.find((item) => item.id === eventId)
      if (!event) return
      setPrompts((current) => {
        const list = current[eventId] ?? []
        const existing = list.find((prompt) => prompt.id === promptId)
        if (!existing) return current
        const fresh = generatePrompts(event, existing.style ?? 'auto', 1)[0]
        return {
          ...current,
          [eventId]: list.map((prompt) =>
            prompt.id === promptId
              ? { ...fresh, id: prompt.id, createdAt: Date.now() }
              : prompt
          )
        }
      })
      notify('Prompt regenerated', 'success')
    },
    [events, notify]
  )

  const addPrompt = useCallback(
    (eventId: string, style: PromptStyle) => {
      const event = events.find((item) => item.id === eventId)
      if (!event) return
      const fresh = generatePrompts(event, style, 1)
      setPrompts((current) => ({
        ...current,
        [eventId]: [...(current[eventId] ?? []), ...fresh]
      }))
      notify('Prompt added', 'success')
    },
    [events, notify]
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
