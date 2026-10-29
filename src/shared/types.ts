export type PromptStyle = 'auto' | 'photo' | 'render3d' | 'vector' | 'watercolor' | 'minimal'

export interface PromptRecord {
  id: string
  text: string
  style: Exclude<PromptStyle, 'auto'> | 'auto'
  createdAt: number
}

export type EventKind =
  | 'federal'
  | 'cultural'
  | 'seasonal'
  | 'awareness'
  | 'shopping'
  | 'food'

export interface EventSeed {
  id: string
  name: string
  month: number
  rule: DateRule
  category: number
  kind: EventKind
  blurb: string
  keywords: string[]
  objects: string[]
  palette: string
}

export type DateRule =
  | { type: 'fixed'; month: number; day: number }
  | { type: 'nth'; month: number; weekday: number; n: number }
  | { type: 'last'; month: number; weekday: number }
  | { type: 'easter'; offset?: number }
  | { type: 'thanksgiving'; offset?: number }
  | { type: 'election' }
  | { type: 'month' }
  | { type: 'range'; startMonth: number; startDay: number; endMonth: number; endDay: number }
  | { type: 'table'; dates: Record<number, [number, number]> }

export interface ResolvedEvent extends EventSeed {
  date: Date | null
  dateLabel: string
  isMonthLong: boolean
  season: Season
}

export type Season = 'winter' | 'spring' | 'summer' | 'fall'

export interface ImageAsset {
  id: string
  path: string
  fileName: string
  dir: string
  ext: string
  bytes: number
  width: number
  height: number
  colors: string[]
  brightness: 'light' | 'balanced' | 'dark'
  temperature: 'warm' | 'neutral' | 'cool'
  hasAlpha: boolean
  readable: boolean
}

export interface Metadata {
  title: string
  description: string
  keywords: string[]
  category: number
  releases: string
}

export interface PickedFile {
  path: string
  fileName: string
  dir: string
  ext: string
  bytes: number
}

export interface PickedImageResult {
  files: PickedFile[]
  rejected: string[]
}

export interface EmbedOptions {
  title: boolean
  description: boolean
  keywords: boolean
  overwrite: boolean
}

export interface EmbedItem {
  sourcePath: string
  fileName: string
  metadata: Metadata
}

export interface EmbedResult {
  sourcePath: string
  outPath: string | null
  fileName: string
  status: 'saved' | 'skipped' | 'failed'
  message?: string
}

export interface EmbedProgress {
  done: number
  total: number
  fileName: string
}

export interface StockForgeApi {
  pickImages: () => Promise<PickedImageResult>
  pickOutputFolder: () => Promise<string | null>
  copyText: (text: string) => Promise<void>
  exportCsv: (payload: { fileName: string; csv: string }) => Promise<{ path: string } | null>
  embedMetadata: (payload: {
    items: EmbedItem[]
    outputDir: string
    options: EmbedOptions
  }) => Promise<EmbedResult[]>
  onEmbedProgress: (listener: (progress: EmbedProgress) => void) => () => void
  showItemInFolder: (path: string) => Promise<void>
  openPath: (path: string) => Promise<string>
  openExternal: (url: string) => Promise<void>
  platform: string
}
