export type PromptStyle = 'auto' | 'photo' | 'render3d' | 'vector' | 'watercolor' | 'minimal'

export type AiProvider =
  | 'priyo'
  | 'gemini'
  | 'groq'
  | 'openrouter-free'
  | 'zai'
  | 'openai'
  | 'openrouter'
  | 'custom'

export interface AiModelOption {
  id: string
  label: string
  free: boolean
}

export interface AiProviderInfo {
  id: AiProvider
  label: string
  baseUrl: string
  defaultModel: string
  keyUrl: string
  keyLabel: string
  note: string
  freeTier: boolean
  models: AiModelOption[]
}

export const AI_PROVIDERS: AiProviderInfo[] = [
  {
    id: 'priyo',
    label: 'Priyo Forge',
    baseUrl: 'https://api.priyo.ai/v1',
    defaultModel: 'priyo-llama',
    keyUrl: 'https://forge.priyo.com/dashboard',
    keyLabel: 'Get a Priyo Forge key',
    note: 'Free API for builders in Bangladesh · no credit card · fair-use daily token limits.',
    freeTier: true,
    models: [
      { id: 'priyo-llama', label: 'Priyo Llama', free: true },
      { id: 'priyo-qwen', label: 'Priyo Qwen (Bangla + multilingual)', free: true },
      { id: 'priyo-deepseek-coder', label: 'Priyo DeepSeek Coder', free: true },
      { id: 'priyo-mistral', label: 'Priyo Mistral', free: true },
      { id: 'gpt-5', label: 'OpenAI GPT-5', free: true },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', free: true },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', free: true }
    ]
  },
  {
    id: 'gemini',
    label: 'Google AI Studio (Gemini)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3.8-flash',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyLabel: 'Get a Gemini key',
    note: 'Gemini free tier · no billing required · limits vary by project.',
    freeTier: true,
    models: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', free: true },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', free: true },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', free: true },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', free: true }
    ]
  },
  {
    id: 'groq',
    label: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-20b',
    keyUrl: 'https://console.groq.com/keys',
    keyLabel: 'Get a Groq key',
    note: 'Free tier · no credit card · per-model rate limits apply.',
    freeTier: true,
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', free: true },
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', free: true },
      { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B', free: true }
    ]
  },
  {
    id: 'openrouter-free',
    label: 'OpenRouter Free',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/free',
    keyUrl: 'https://openrouter.ai/keys',
    keyLabel: 'Get an OpenRouter key',
    note: 'Free model router · no credit card · roughly 50 requests/day at the time of writing.',
    freeTier: true,
    models: [{ id: 'openrouter/free', label: 'OpenRouter Free router', free: true }]
  },
  {
    id: 'zai',
    label: 'Z.ai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    defaultModel: 'glm-4.7-flash',
    keyUrl: 'https://z.ai/',
    keyLabel: 'Get a Z.ai key',
    note: 'GLM Flash models are free; other GLM models are paid.',
    freeTier: true,
    models: [
      { id: 'glm-4.7-flash', label: 'GLM-4.7 Flash', free: true },
      { id: 'glm-4.5-flash', label: 'GLM-4.5 Flash', free: true },
      { id: 'glm-5.3-flash', label: 'GLM-5.3 Flash (limited-time free)', free: true },
      { id: 'glm-5.3', label: 'GLM-5.3', free: false }
    ]
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLabel: 'Get an OpenAI key',
    note: 'Paid API — usage is billed to your OpenAI account.',
    freeTier: false,
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', free: false },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', free: false }
    ]
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    keyUrl: 'https://openrouter.ai/keys',
    keyLabel: 'Get an OpenRouter key',
    note: 'One key for free and paid models; free endpoints are rate-limited.',
    freeTier: true,
    models: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', free: false },
      { id: 'z-ai/glm-4.5-air:free', label: 'GLM 4.5 Air', free: true },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', free: false },
      { id: 'openrouter/free', label: 'OpenRouter Free router', free: true }
    ]
  },
  {
    id: 'custom',
    label: 'Custom endpoint',
    baseUrl: '',
    defaultModel: '',
    keyUrl: '',
    keyLabel: '',
    note: 'Any OpenAI-compatible /chat/completions endpoint.',
    freeTier: false,
    models: []
  }
]

export const DEFAULT_AI_PROVIDER: AiProvider = 'priyo'

export interface AiEndpoint {
  id: string
  provider: AiProvider
  baseUrl: string
  model: string
  hasApiKey: boolean
}

export interface AiSettings {
  endpoints: AiEndpoint[]
}

export interface AiEndpointInput {
  id?: string
  provider: AiProvider
  baseUrl: string
  model: string
  apiKey?: string
  clearApiKey?: boolean
}

export interface AiEndpointSaveResult {
  settings: AiSettings
  endpointId: string
}

export interface AiPromptResult {
  prompts: string[]
  provider: AiProvider
  model: string
  endpointId: string
  attempted: number
}

export interface AiPromptRequest {
  eventName: string
  eventDate: string
  blurb: string
  keywords: string[]
  objects: string[]
  palette: string
  kind: EventKind
  style: PromptStyle
  count: number
  existingPrompts: string[]
}

export interface AiTestResult {
  ok: boolean
  message: string
}

export const FONT_SCALES = [0.9, 1, 1.1, 1.2] as const

export type FontScale = (typeof FONT_SCALES)[number]

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
  setZoomFactor: (factor: number) => Promise<void>
  getAiSettings: () => Promise<AiSettings>
  saveAiEndpoint: (input: AiEndpointInput) => Promise<AiEndpointSaveResult>
  deleteAiEndpoint: (id: string) => Promise<AiSettings>
  reorderAiEndpoints: (orderedIds: string[]) => Promise<AiSettings>
  generateAiPrompts: (request: AiPromptRequest) => Promise<AiPromptResult>
  testAiConnection: (endpointId: string) => Promise<AiTestResult>
  platform: string
}
