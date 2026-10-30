import type { PromptRecord, PromptStyle, ResolvedEvent } from '@shared/types'
import { WHITE_BACKGROUND_CLAUSE } from '@shared/whiteBackground'

export interface PromptStyleOption {
  value: PromptStyle
  label: string
  short: string
}

export const PROMPT_STYLES: PromptStyleOption[] = [
  { value: 'auto', label: 'Auto mix', short: 'Auto' },
  { value: 'photo', label: 'Photo-real', short: 'Photo' },
  { value: 'render3d', label: '3D render', short: '3D' },
  { value: 'vector', label: 'Flat vector', short: 'Vector' },
  { value: 'watercolor', label: 'Watercolor', short: 'Watercolor' },
  { value: 'minimal', label: 'Minimal', short: 'Minimal' }
]

/**
 * Splits a master-prompt AI response into per-prompt structured blocks.
 * The master prompt asks the model to number concepts as PROMPT [01], PROMPT [02], etc.,
 * each with sections A–H (Concept Title, Design Category, …). Each block is returned
 * verbatim so the full structured output is preserved instead of being collapsed to a
 * single plain paragraph.
 */
export function splitStructuredPrompts(raw: string): string[] {
  return raw
    .split(/\n(?=PROMPT\s*\[)/i)
    .map((block) => block.trim())
    .filter((block) => /^PROMPT\s*\[/i.test(block))
}

type ConcreteStyle = Exclude<PromptStyle, 'auto'>

interface StyleRecipe {
  intros: string[]
  detail: string
  tail: string
}

const RECIPES: Record<ConcreteStyle, StyleRecipe> = {
  photo: {
    intros: [
      'A polished commercial still-life photograph',
      'An editorial product photograph',
      'A high-end studio photograph'
    ],
    detail: 'realistic reflections, fine surface texture and shallow depth of field',
    tail: 'professional stock photography, high resolution, sharp focus, no text, no logos, no watermark'
  },
  render3d: {
    intros: [
      'A premium 3D render',
      'A soft sculptural 3D illustration',
      'A clean stylized 3D scene'
    ],
    detail: 'smooth clay-like materials, soft ambient shadows and subtle studio reflections',
    tail: 'high detail, commercial 3D illustration, no text, no logos, no watermark'
  },
  vector: {
    intros: [
      'A clean flat vector illustration',
      'A modern editorial vector illustration',
      'A crisp geometric vector illustration'
    ],
    detail: 'simple shapes, crisp edges, flat color fills and subtle grain',
    tail: 'commercial stock illustration, balanced composition, no text, no logos, no watermark'
  },
  watercolor: {
    intros: [
      'A delicate watercolor illustration',
      'A loose hand-painted watercolor artwork',
      'An elegant watercolor illustration'
    ],
    detail: 'visible paper texture, soft pigment blooms and organic hand-painted edges',
    tail: 'commercial watercolor illustration, artistic yet clean, no text, no logos, no watermark'
  },
  minimal: {
    intros: [
      'A minimalist still-life photograph',
      'A calm minimalist product photograph',
      'A quiet editorial still life'
    ],
    detail: 'one soft shadow, restrained props and calm negative space',
    tail: 'minimalist commercial stock imagery, clean and modern, no text, no logos, no watermark'
  }
}

const SCENES: Record<string, string[]> = {
  winter: [
    'beside a frosted window with soft snowfall outside',
    'on a wooden mantel with warm bokeh lights',
    'on a marble surface with pine sprigs',
    'on a light linen cloth in cool morning light'
  ],
  spring: [
    'in a sunlit corner with fresh blossoms',
    'on a light linen tablecloth',
    'against a soft pastel studio backdrop',
    'on a pale wooden table with spring branches'
  ],
  summer: [
    'on a sunlit terrace with palm shadows',
    'on a sandy surface at golden hour',
    'beside a pool with turquoise water bokeh',
    'on a bright white studio set with soft shadows'
  ],
  fall: [
    'on a rustic wooden table with autumn leaves',
    'against a textured plaster wall in warm light',
    'on a linen runner with dried botanicals',
    'on a stone surface with soft afternoon shadows'
  ],
  neutral: [
    'on a smooth stone pedestal',
    'against a seamless studio backdrop',
    'on a marble surface with subtle veining',
    'on a round display plinth',
    'on a warm beige paper backdrop'
  ]
}

const COMPOSITIONS = [
  'centered composition with generous negative space above',
  'asymmetric layout with clean copy space on the right',
  'close-up detail with a softly blurred background',
  'top-down flat lay on a clean surface',
  'three-quarter angle with a subtle foreground blur',
  'hero object on the lower third with open space above',
  'minimal composition with plenty of breathing room',
  'layered foreground and background with a clear focal point'
]

const LIGHTING = [
  'soft diffused window light',
  'warm golden-hour glow',
  'bright airy studio lighting with gentle shadows',
  'moody side light with deep contrast',
  'backlit with a soft rim highlight',
  'overcast daylight with even, flattering tones'
]

const KIND_CUES: Record<string, string> = {
  federal: 'dignified editorial mood',
  cultural: 'warm celebratory editorial mood',
  seasonal: 'seasonal editorial mood',
  awareness: 'hopeful and supportive editorial mood',
  shopping: 'retail campaign energy',
  food: 'appetizing food-editorial styling'
}

const STYLE_KEYS: ConcreteStyle[] = ['photo', 'render3d', 'vector', 'watercolor', 'minimal']

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function withArticle(phrase: string): string {
  const lastWord = phrase.split(/\s+/).at(-1) ?? ''
  const looksPlural = lastWord.endsWith('s') && !lastWord.endsWith('ss')
  if (looksPlural) return phrase
  return `${/^[aeiou]/i.test(phrase) ? 'an' : 'a'} ${phrase}`
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function newPromptId(): string {
  return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildPrompt(
  event: ResolvedEvent,
  style: ConcreteStyle = 'photo',
  variant = 0,
  whiteBackground = false
): PromptRecord {
  const recipe = RECIPES[style]
  const objects = shuffle(event.objects)
  const primary = objects[variant % objects.length]
  const secondary = objects[(variant + 2) % objects.length]
  const scene = whiteBackground
    ? WHITE_BACKGROUND_CLAUSE
    : pick(SCENES[event.season] ?? SCENES.neutral)
  const composition = pick(COMPOSITIONS)
  const lighting = whiteBackground
    ? 'bright, even studio lighting with a soft contact shadow'
    : pick(LIGHTING)
  const intro = pick(recipe.intros)
  const cue = KIND_CUES[event.kind] ?? 'editorial seasonal mood'

  const text = [
    `${intro} featuring ${withArticle(primary)}`,
    secondary !== primary ? `with ${withArticle(secondary)}` : '',
    scene,
    composition,
    lighting,
    `${event.palette} palette`,
    recipe.detail,
    cue,
    recipe.tail
  ]
    .filter(Boolean)
    .join(', ')

  return {
    id: newPromptId(),
    text,
    style,
    createdAt: Date.now()
  }
}

export function generatePrompts(
  event: ResolvedEvent,
  style: PromptStyle,
  count: number,
  whiteBackground = false
): PromptRecord[] {
  const safeCount = Math.min(20, Math.max(1, Math.round(count)))
  const styles = style === 'auto' ? shuffle(STYLE_KEYS) : [style]
  return Array.from({ length: safeCount }, (_, index) => {
    const chosen = style === 'auto' ? styles[index % styles.length] : (style as ConcreteStyle)
    return buildPrompt(event, chosen, index + Math.floor(Math.random() * 7), whiteBackground)
  })
}

export function styleShort(style: PromptStyle): string {
  return PROMPT_STYLES.find((option) => option.value === style)?.short ?? 'Prompt'
}
