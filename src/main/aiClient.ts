import { net } from 'electron'
import {
  AI_PROVIDERS,
  type AiPromptRequest,
  type AiPromptResult,
  type AiTestResult
} from '../shared/types'
import { ensureWhiteBackground, WHITE_BACKGROUND_INSTRUCTION } from '../shared/whiteBackground'
import { getAiConfigs, type AiRuntimeConfig } from './aiSettings'

const STYLE_LABELS: Record<AiPromptRequest['style'], string> = {
  auto: 'a varied mix of photo-real, 3D render, flat vector, watercolor and minimalist styles',
  photo: 'polished commercial photo-real photography',
  render3d: 'premium soft 3D render',
  vector: 'clean flat vector illustration',
  watercolor: 'delicate hand-painted watercolor illustration',
  minimal: 'calm minimalist still-life photography'
}

type ChatConfig = AiRuntimeConfig

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

function completionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`
}

function readableError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return 'The AI request timed out. Try again or use a faster model.'
    }
    return error.message
  }
  return 'The AI request failed'
}

async function chat(
  config: ChatConfig,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  if (!config.apiKey) throw new Error('Add and save an API key in Settings first')

  let response: Response
  try {
    response = await net.fetch(completionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'X-Title': 'StockForge Studio'
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.9,
        max_tokens: maxTokens
      }),
      signal: AbortSignal.timeout(90_000)
    })
  } catch (error) {
    throw new Error(readableError(error))
  }

  const raw = await response.text()
  if (!response.ok) {
    let detail = raw.trim()
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } | string }
      if (typeof parsed.error === 'string') detail = parsed.error
      else if (parsed.error?.message) detail = parsed.error.message
    } catch {
      // Providers sometimes return plain text or HTML; keep a short excerpt.
    }
    const message = detail.replace(/\s+/g, ' ').slice(0, 320) || response.statusText
    throw new Error(`AI request failed (${response.status}): ${message}`)
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('The AI provider returned an invalid response')
  }

  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices
  const content = choices?.[0]?.message?.content
  if (typeof content === 'string' && content.trim()) return content
  if (Array.isArray(content)) {
    const joined = content
      .map((part) =>
        part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
          ? (part as { text: string }).text
          : ''
      )
      .join('')
      .trim()
    if (joined) return joined
  }
  throw new Error('The AI provider returned an empty response')
}

function asPromptText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.prompt === 'string') return record.prompt.trim()
    if (typeof record.text === 'string') return record.text.trim()
  }
  return ''
}

function parsePromptList(content: string, count: number): string[] {
  let text = content.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) text = fenced[1].trim()

  const collect = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value.map(asPromptText).filter((prompt) => prompt.length >= 20)
  }

  let prompts: string[] = []
  try {
    const parsed: unknown = JSON.parse(text)
    prompts = collect(parsed)
    if (prompts.length === 0 && parsed && typeof parsed === 'object') {
      prompts = collect((parsed as { prompts?: unknown }).prompts)
    }
  } catch {
    const arrayMatch = text.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      try {
        prompts = collect(JSON.parse(arrayMatch[0]))
      } catch {
        // Fall through to line parsing.
      }
    }
  }

  if (prompts.length === 0) {
    prompts = text
      .split(/\r?\n+/)
      .map((line) =>
        line
          .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
          .replace(/^["'`]+|["'`]+$/g, '')
          .trim()
      )
      .filter(
        (line) =>
          line.length >= 40 &&
          !/^(here|sure|below|the following|prompt \d)/i.test(line)
      )
  }

  const seen = new Set<string>()
  return prompts
    .filter((prompt) => {
      const key = prompt.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, count)
}

function clean(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function cleanList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => clean(item, 80))
    .filter(Boolean)
    .slice(0, limit)
}

export async function generateAiPrompts(request: AiPromptRequest): Promise<AiPromptResult> {
  const configs = (await getAiConfigs()).filter((config) => config.apiKey)
  if (configs.length === 0) throw new Error('Add and save an API key in Settings first')

  const count = Math.max(1, Math.min(20, Math.round(Number(request.count) || 1)))
  const eventName = clean(request.eventName, 120) || 'a US seasonal event'
  const eventDate = clean(request.eventDate, 80) || 'date varies'
  const blurb = clean(request.blurb, 400)
  const palette = clean(request.palette, 160) || 'a versatile commercial palette'
  const kind = clean(request.kind, 40) || 'seasonal'
  const keywords = cleanList(request.keywords, 20)
  const objects = cleanList(request.objects, 20)
  const style = request.style in STYLE_LABELS ? request.style : 'auto'
  const whiteBackground = request.whiteBackground === true
  const existing = cleanList(request.existingPrompts, 24).map((prompt) => prompt.slice(0, 400))
  const masterPrompt =
    typeof request.systemPrompt === 'string' ? request.systemPrompt.trim().slice(0, 80_000) : ''

  const genericSystem = [
    'You are a senior Adobe Stock contributor who writes prompts for commercially successful AI-generated object imagery.',
    `Create exactly ${count} distinct, detailed image-generation prompts for the US occasion "${eventName}" (${eventDate}).`,
    `Occasion type: ${kind}. ${blurb}`,
    `Useful props and subjects: ${objects.join(', ') || eventName}.`,
    `Color palette: ${palette}.`,
    `Visual style: ${STYLE_LABELS[style]}.`,
    'Each prompt must be one paragraph of 45-100 words and describe: the hero object, supporting props, surface or background, composition with copy space, lighting, color palette, and camera/lens or render technique.',
    'Keep the imagery commercially useful and generic. No text, logos, watermarks, brands, celebrities, copyrighted characters or recognizable people.',
    'Do not mention Adobe Stock. Do not number the prompts or add commentary.',
    whiteBackground ? WHITE_BACKGROUND_INSTRUCTION : '',
    'Avoid repeating these existing prompts:',
    existing.length > 0 ? existing.join('\n---\n') : '(none yet)',
    `Return ONLY a JSON array of ${count} strings.`
  ]
    .filter(Boolean)
    .join('\n')

  const outputRules = [
    'OUTPUT FORMAT — HIGHEST PRIORITY, OVERRIDES ANY EARLIER PRESENTATION OR NUMBERING INSTRUCTIONS:',
    `Use the creative direction above, but return ONLY a valid JSON array of exactly ${count} strings.`,
    'Each string must be one complete, independently usable English image-generation prompt, with every important visual instruction written inside that string.',
    'End each string with a final "Negative prompt: ..." line customized to that concept and asset type.',
    'Do not include concept titles, A/B/C section labels, markdown, numbering, commentary, or extra JSON keys.',
    existing.length > 0
      ? `Do not repeat or lightly reword these existing prompts:\n${existing.join('\n---\n')}`
      : 'There are no existing prompts to avoid.',
    style === 'auto'
      ? 'Use a varied, well-balanced mix of visual styles as directed above.'
      : `Preferred visual style for this batch: ${STYLE_LABELS[style]}.`
  ].join('\n')

  const system = masterPrompt
    ? `${masterPrompt}\n\n${outputRules}${
        whiteBackground ? `\n\n${WHITE_BACKGROUND_INSTRUCTION}` : ''
      }`
    : genericSystem

  const user = JSON.stringify({
    event: eventName,
    date: eventDate,
    keywords,
    props: objects,
    palette,
    style,
    count,
    whiteBackground
  })

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
  const failures: string[] = []
  let attempted = 0

  for (const config of configs) {
    attempted += 1
    try {
      const content = await chat(
        config,
        messages,
        masterPrompt ? Math.min(12_000, count * 600 + 600) : Math.min(4000, count * 220 + 180)
      )
      const parsedPrompts = parsePromptList(content, count)
      if (parsedPrompts.length === 0) {
        throw new Error('The AI response did not contain usable prompts')
      }
      const prompts = whiteBackground
        ? parsedPrompts.map(ensureWhiteBackground)
        : parsedPrompts
      return {
        prompts,
        provider: config.provider,
        model: config.model,
        endpointId: config.id,
        attempted
      }
    } catch (error) {
      const label =
        AI_PROVIDERS.find((provider) => provider.id === config.provider)?.label ??
        config.provider
      failures.push(`${label} · ${config.model}: ${readableError(error)}`)
    }
  }

  throw new Error(
    `All ${configs.length} API connection${configs.length === 1 ? '' : 's'} failed: ${failures
      .join(' | ')
      .slice(0, 700)}`
  )
}

export async function testAiConnection(endpointId: string): Promise<AiTestResult> {
  const configs = await getAiConfigs()
  const config = configs.find((item) => item.id === endpointId)
  if (!config) return { ok: false, message: 'That API connection was not found.' }
  if (!config.apiKey) {
    return { ok: false, message: 'Add and save an API key first.' }
  }
  try {
    const reply = await chat(
      config,
      [
        { role: 'system', content: 'You are a connection test. Reply with the single word: ready.' },
        { role: 'user', content: 'Connection test.' }
      ],
      12
    )
    return {
      ok: true,
      message: `Connected to ${config.model}${reply ? ` · ${reply.slice(0, 40)}` : ''}`
    }
  } catch (error) {
    return { ok: false, message: readableError(error) }
  }
}
