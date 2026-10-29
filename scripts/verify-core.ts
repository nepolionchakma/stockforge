import assert from 'node:assert/strict'
import { EVENTS } from '../src/renderer/src/data/events'
import { buildCsv } from '../src/renderer/src/lib/csv'
import { resolveEvents } from '../src/renderer/src/lib/dates'
import { generateMetadata, metadataToText } from '../src/renderer/src/lib/metadataEngine'
import { generatePrompts } from '../src/renderer/src/lib/promptEngine'
import type { ImageAsset } from '../src/shared/types'

function iso(date: Date | null): string {
  if (!date) return 'none'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

assert.ok(EVENTS.length >= 60, `expected a broad event set, got ${EVENTS.length}`)
assert.equal(new Set(EVENTS.map((event) => event.id)).size, EVENTS.length, 'event ids must be unique')

const years = [2025, 2026, 2027, 2028, 2029, 2030]
for (const year of years) {
  const resolved = resolveEvents(year)
  assert.equal(resolved.length, EVENTS.length)
  for (const event of resolved) {
    if (event.rule.type === 'month' || event.rule.type === 'range') continue
    assert.ok(event.date, `${event.id} has no date for ${year}`)
    assert.equal(event.date?.getFullYear(), year, `${event.id} escaped ${year}`)
  }
}

const events2026 = new Map(resolveEvents(2026).map((event) => [event.id, event]))
const expected: Record<string, string> = {
  'new-years-day': '2026-01-01',
  'martin-luther-king-jr-day': '2026-01-19',
  'presidents-day': '2026-02-16',
  'lunar-new-year': '2026-02-17',
  'valentines-day': '2026-02-14',
  'mardi-gras': '2026-02-17',
  easter: '2026-04-05',
  'arbor-day': '2026-04-24',
  'mothers-day': '2026-05-10',
  'memorial-day': '2026-05-25',
  'fathers-day': '2026-06-21',
  juneteenth: '2026-06-19',
  'independence-day': '2026-07-04',
  'labor-day': '2026-09-07',
  'indigenous-peoples-day': '2026-10-12',
  halloween: '2026-10-31',
  'election-day': '2026-11-03',
  diwali: '2026-11-08',
  'veterans-day': '2026-11-11',
  thanksgiving: '2026-11-26',
  'black-friday': '2026-11-27',
  'small-business-saturday': '2026-11-28',
  'cyber-monday': '2026-11-30',
  'giving-tuesday': '2026-12-02',
  hanukkah: '2026-12-04',
  'christmas-eve': '2026-12-24',
  christmas: '2026-12-25',
  kwanzaa: '2026-12-26',
  'new-years-eve': '2026-12-31'
}
for (const [id, date] of Object.entries(expected)) {
  assert.equal(iso(events2026.get(id)?.date ?? null), date, `${id} date mismatch`)
}

const christmas = events2026.get('christmas')
assert.ok(christmas)
const prompts = generatePrompts(christmas, 'auto', 3)
assert.equal(prompts.length, 3)
for (const prompt of prompts) {
  assert.ok(prompt.text.length > 140, 'prompt should be detailed')
  assert.ok(prompt.text.includes('no text'), 'prompt should avoid embedded text')
}

const image: ImageAsset = {
  id: 'test-1',
  path: 'C:\\fixtures\\red_christmas_ornament_01.jpg',
  fileName: 'red_christmas_ornament_01.jpg',
  dir: 'C:\\fixtures',
  ext: 'jpg',
  bytes: 1_200_000,
  width: 1600,
  height: 1200,
  colors: ['red', 'green'],
  brightness: 'balanced',
  temperature: 'warm',
  hasAlpha: false,
  readable: true
}

const metadata = generateMetadata(image, christmas)
assert.ok(metadata.title.length > 0 && metadata.title.length <= 200)
assert.ok(metadata.keywords.length >= 5 && metadata.keywords.length <= 49)
assert.equal(metadata.category, christmas.category)
assert.ok(metadata.keywords.includes('red'), 'dominant color should become a keyword')
assert.ok(metadata.keywords.includes('horizontal'), 'orientation should become a keyword')

const generic = generateMetadata(
  {
    ...image,
    id: 'test-2',
    path: 'C:\\fixtures\\sunset_beach_umbrella.png',
    fileName: 'sunset_beach_umbrella.png',
    ext: 'png',
    hasAlpha: true,
    colors: ['orange', 'teal']
  },
  null
)
assert.ok(generic.title.length > 0)
assert.ok(generic.keywords.includes('isolated'))

const csv = buildCsv([
  { fileName: image.fileName, metadata },
  {
    fileName: 'quote,"test".jpg',
    metadata: { ...metadata, title: 'A title with "quotes" and, commas', releases: 'release-1.pdf' }
  }
])
const lines = csv.split('\r\n').filter(Boolean)
assert.equal(lines[0], 'Filename,Title,Keywords,Category,Releases')
assert.equal(lines.length, 3)
assert.ok(lines[1].startsWith('"red_christmas_ornament_01.jpg","'))
assert.ok(lines[2].includes('""quotes""'))
assert.ok(lines[2].includes('"release-1.pdf"'))

console.log('EVENTS:', EVENTS.length)
console.log('PROMPT SAMPLE:\n', prompts[0].text, '\n')
console.log('METADATA:\n', metadataToText(metadata), '\n')
console.log('CSV HEAD:\n', lines.slice(0, 2).join('\n'), '\n')
console.log('CORE CHECKS PASSED')
