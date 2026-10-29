import type { ImageAsset, Metadata, ResolvedEvent } from '@shared/types'
import { categoryName } from '../data/categories'

const GENERIC_FILENAME_WORDS = new Set([
  'final',
  'copy',
  'edit',
  'edited',
  'ai',
  'midjourney',
  'upscaled',
  'upscale',
  'image',
  'img',
  'dsc',
  'photo',
  'photography',
  'stock',
  'design',
  'graphic',
  'version',
  'untitled',
  'export',
  'png',
  'jpg',
  'jpeg',
  'web',
  '4k',
  '8k',
  'hd',
  'raw',
  'render',
  'generated',
  'generator',
  'art',
  'dev',
  'test',
  'new',
  'low',
  'high',
  'res'
])

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'for',
  'with',
  'on',
  'in',
  'at',
  'to',
  'by',
  'from',
  'this',
  'that',
  'my',
  'our',
  'is',
  'are'
])

const COLOR_WORDS = new Set([
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'turquoise',
  'blue',
  'navy',
  'purple',
  'violet',
  'pink',
  'magenta',
  'brown',
  'beige',
  'cream',
  'white',
  'black',
  'gold',
  'golden',
  'silver',
  'gray',
  'grey',
  'pastel'
])

const GENERIC_KEYWORDS = [
  'copy space',
  'background',
  'design',
  'commercial',
  'advertising',
  'marketing',
  'creative',
  'modern',
  'seasonal',
  'decoration',
  'greeting card',
  'banner',
  'template',
  'studio shot',
  'high resolution'
]

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function filenameTokens(fileName: string): string[] {
  const base = fileName.replace(/\.[^.]+$/, '')
  const words = base
    .split(/[^a-zA-Z]+/)
    .map((word) => word.toLowerCase())
    .filter(
      (word) =>
        word.length >= 3 &&
        !GENERIC_FILENAME_WORDS.has(word) &&
        !STOP_WORDS.has(word) &&
        !/^\d+$/.test(word)
    )

  const unique = [...new Set(words)]
  const colors = unique.filter((word) => COLOR_WORDS.has(word))
  const others = unique.filter((word) => !COLOR_WORDS.has(word))
  return [...colors, ...others].slice(0, 4)
}

function eventNameTokens(event: ResolvedEvent): Set<string> {
  return new Set(
    event.name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length >= 3)
  )
}

const PROPER_NOUNS: Record<string, string> = {
  christmas: 'Christmas',
  halloween: 'Halloween',
  easter: 'Easter',
  thanksgiving: 'Thanksgiving',
  hanukkah: 'Hanukkah',
  diwali: 'Diwali',
  kwanzaa: 'Kwanzaa',
  juneteenth: 'Juneteenth',
  valentine: 'Valentine',
  patrick: 'Patrick',
  america: 'America',
  american: 'American',
  african: 'African',
  irish: 'Irish',
  mexican: 'Mexican',
  latino: 'Latino',
  aapi: 'AAPI',
  lgbtq: 'LGBTQ',
  july: 'July',
  december: 'December',
  november: 'November',
  october: 'October',
  september: 'September',
  august: 'August',
  june: 'June',
  april: 'April',
  march: 'March',
  february: 'February',
  january: 'January'
}

function capitalise(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function titleCaseSubject(value: string): string {
  return capitalise(
    value
      .split(' ')
      .map((word) => PROPER_NOUNS[word.toLowerCase()] ?? word)
      .join(' ')
  )
}

function cleanPhrase(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(/\.$/, '')
}

function articleFor(value: string): string {
  return /^[aeiou]/i.test(value) ? 'an' : 'a'
}

function truncateTitle(title: string): string {
  if (title.length <= 200) return title
  const shortened = title.slice(0, 197)
  const lastSpace = shortened.lastIndexOf(' ')
  return `${(lastSpace > 140 ? shortened.slice(0, lastSpace) : shortened).trim()}...`
}

function subjectFor(image: ImageAsset, event: ResolvedEvent | null, tokens: string[]): string {
  const eventWords = event ? eventNameTokens(event) : new Set<string>()
  const usefulTokens = tokens.filter((token) => !eventWords.has(token))
  const chosenTokens = (usefulTokens.length > 0 ? usefulTokens : tokens).slice(0, 3)

  if (chosenTokens.length > 0) {
    return chosenTokens.join(' ')
  }

  if (event && event.objects.length > 0) {
    const index = hashString(image.fileName + image.path) % event.objects.length
    return event.objects[index]
  }

  const color = image.colors[0]
  return color ? `${color} decorative composition` : 'decorative still life composition'
}

function paletteFor(image: ImageAsset, event: ResolvedEvent | null): string {
  if (event) {
    return event.palette.split(',')[0].replace(/\s+and\s+/g, ' ').trim()
  }
  return image.colors[0] ?? 'neutral'
}

function makeTitle(
  subject: string,
  event: ResolvedEvent | null,
  palette: string,
  image: ImageAsset
): string {
  const titled = titleCaseSubject(subject)
  const lower = subject.toLowerCase()
  const article = articleFor(palette)
  const variants = event
    ? [
        `${titled} for ${event.name} designs`,
        `${event.name} concept with ${lower} and clean copy space`,
        `${titled} on ${article} ${palette} background for ${event.name}`,
        `Minimal ${lower} composition for ${event.name} campaigns`,
        `${event.name} celebration with ${lower}`,
        `${titled} styled for ${event.name} marketing`
      ]
    : [
        `${titled} on ${article} ${palette} background`,
        `${titled} studio stock image with copy space`,
        `Minimal ${lower} composition on a neutral background`,
        `${titled} with soft studio lighting and open copy space`
      ]

  const index = hashString(image.fileName + image.path + subject) % variants.length
  return truncateTitle(cleanPhrase(variants[index]))
}

function makeDescription(
  title: string,
  subject: string,
  event: ResolvedEvent | null,
  palette: string,
  image: ImageAsset
): string {
  const lower = subject.toLowerCase()
  const article = articleFor(palette)
  const articleCap = capitalise(article)
  const variants = event
    ? [
        `${articleCap} ${palette} stock image of ${lower} created for ${event.name} campaigns. The clean composition leaves copy space for seasonal messaging.`,
        `Stylized ${event.name} concept featuring ${lower}. Soft editorial styling makes it suitable for greeting cards, social posts and advertising.`,
        `${capitalise(subject)} with ${article} ${palette} color story, ideal for ${event.name} promotions and commercial design projects.`,
        `A polished ${event.name} visual built around ${lower}, with a calm layout and room for headlines.`
      ]
    : [
        `${capitalise(title)}. ${articleCap} ${palette} stock image with a clean composition and copy space for commercial design and social media.`,
        `${articleCap} ${palette} visual of ${lower} styled for modern advertising, presentations and creative projects.`,
        `Minimal stock image featuring ${lower}, with soft lighting and open copy space for headlines.`
      ]

  const index = hashString(image.fileName + image.path + title) % variants.length
  return cleanPhrase(variants[index])
}

function makeKeywords(
  image: ImageAsset,
  event: ResolvedEvent | null,
  tokens: string[],
  subject: string
): string[] {
  const keywords: string[] = []
  const push = (value: string): void => {
    const keyword = value
      .toLowerCase()
      .replace(/[",\n\r]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (keyword.length >= 2 && keyword.length <= 45) keywords.push(keyword)
  }

  for (const token of tokens) push(token)
  for (const token of subject.split(/\s+/)) {
    if (token.length >= 3 && !STOP_WORDS.has(token)) push(token)
  }

  if (event) {
    for (const keyword of event.keywords) push(keyword)
    if (event.kind === 'federal') {
      push('patriotic')
      push('holiday')
    } else if (event.kind === 'cultural') {
      push('holiday')
      push('celebration')
    } else if (event.kind === 'awareness') {
      push('awareness')
      push('support')
    } else if (event.kind === 'shopping') {
      push('sale')
      push('retail')
      push('shopping')
    } else if (event.kind === 'food') {
      push('food')
      push('delicious')
    } else if (event.kind === 'seasonal') {
      push('season')
    }
  }

  for (const color of image.colors) push(color)

  if (image.width > 0 && image.height > 0) {
    if (image.width > image.height) push('horizontal')
    else if (image.height > image.width) push('vertical')
    else push('square')
  }

  if (image.brightness === 'light') push('bright')
  else if (image.brightness === 'dark') push('moody')
  if (image.temperature === 'warm') push('warm')
  else if (image.temperature === 'cool') push('cool')
  if (image.hasAlpha) {
    push('isolated')
    push('transparent background')
  }

  for (const keyword of GENERIC_KEYWORDS) push(keyword)

  const deduped: string[] = []
  const seen = new Set<string>()
  for (const keyword of keywords) {
    if (seen.has(keyword)) continue
    seen.add(keyword)
    deduped.push(keyword)
    if (deduped.length >= 49) break
  }
  return deduped
}

export function generateMetadata(
  image: ImageAsset,
  event: ResolvedEvent | null
): Metadata {
  const tokens = filenameTokens(image.fileName)
  const subject = subjectFor(image, event, tokens)
  const palette = paletteFor(image, event)
  const title = makeTitle(subject, event, palette, image)
  const description = makeDescription(title, subject, event, palette, image)
  const keywords = makeKeywords(image, event, tokens, subject)

  return {
    title,
    description,
    keywords,
    category: event?.category ?? 8,
    releases: ''
  }
}

export function metadataToText(metadata: Metadata): string {
  return [
    `Title: ${metadata.title}`,
    `Keywords (${metadata.keywords.length}/49): ${metadata.keywords.join(', ')}`,
    `Category: ${metadata.category} - ${categoryName(metadata.category)}`,
    `Description: ${metadata.description}`
  ].join('\n\n')
}

export function keywordSuggestions(event: ResolvedEvent | null, image: ImageAsset): string[] {
  const values = [
    ...(event ? event.keywords : []),
    ...(event ? event.objects.flatMap((object) => object.split(/\s+/)) : []),
    ...image.colors,
    ...GENERIC_KEYWORDS
  ]
  const seen = new Set<string>()
  const suggestions: string[] = []
  for (const raw of values) {
    const value = raw.toLowerCase().replace(/[",\n]/g, '').trim()
    if (value.length < 3 || seen.has(value)) continue
    seen.add(value)
    suggestions.push(value)
    if (suggestions.length >= 24) break
  }
  return suggestions
}

export function metadataIssues(metadata: Metadata): string[] {
  const issues: string[] = []
  if (!metadata.title.trim()) issues.push('Title is required.')
  if (metadata.title.length > 200) issues.push('Title is over the 200 character limit.')
  else if (metadata.title.length > 70) issues.push('Titles over 70 characters are less scannable.')
  if (metadata.keywords.length < 5) issues.push('Add at least 5 keywords.')
  if (metadata.keywords.length > 49) issues.push('Adobe Stock allows up to 49 keywords.')
  if (!metadata.description.trim()) issues.push('Description is empty.')
  if (metadata.category < 1 || metadata.category > 21) issues.push('Choose a category.')
  return issues
}

export function imageIssues(image: ImageAsset): string[] {
  const issues: string[] = []
  if (!image.readable) issues.push('Preview could not be read.')
  if (!['jpg', 'jpeg', 'png'].includes(image.ext)) {
    issues.push('Adobe Stock accepts JPG or PNG files.')
  }
  if (image.width > 0 && image.height > 0) {
    const megapixels = (image.width * image.height) / 1_000_000
    if (megapixels < 4) issues.push('Below Adobe Stock’s 4 MP minimum.')
    if (megapixels > 100) issues.push('Above Adobe Stock’s 100 MP maximum.')
  }
  if (image.bytes > 45 * 1024 * 1024) issues.push('File is over the 45 MB limit.')
  return issues
}
