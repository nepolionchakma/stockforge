import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import sharp from 'sharp'
import { exiftool } from 'exiftool-vendored'
import { embedAll } from '../src/main/embedder'
import type { EmbedItem } from '../src/shared/types'

const fixtures = join(process.cwd(), 'tmp', 'fixtures')
const output = join(process.cwd(), 'tmp', 'embedded')
const fakeSender = { send: () => undefined } as never

const jpegSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200">
  <rect width="1600" height="1200" fill="#f3ead9"/>
  <circle cx="1000" cy="470" r="330" fill="#b3222c"/>
  <circle cx="1000" cy="470" r="330" fill="url(#shine)" opacity="0.55"/>
  <rect x="970" y="120" width="60" height="140" rx="20" fill="#d9b36c"/>
  <rect x="700" y="900" width="700" height="30" rx="15" fill="#2e4436"/>
  <defs>
    <radialGradient id="shine" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
</svg>`

const pngSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200">
  <circle cx="800" cy="600" r="360" fill="#c7a4e8"/>
  <circle cx="800" cy="600" r="360" fill="url(#g)" opacity="0.5"/>
  <defs>
    <radialGradient id="g" cx="0.3" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
</svg>`

async function main(): Promise<void> {
  await fs.rm(join(process.cwd(), 'tmp'), { recursive: true, force: true })
  await fs.mkdir(fixtures, { recursive: true })
  await fs.mkdir(output, { recursive: true })

  const jpegPath = join(fixtures, 'red_christmas_ornament.jpg')
  const pngPath = join(fixtures, 'purple_transparent_ornament.png')
  await sharp(Buffer.from(jpegSvg)).jpeg({ quality: 92 }).toFile(jpegPath)
  await sharp(Buffer.from(pngSvg)).png().toFile(pngPath)

  const jpegMetadata = {
    title: 'Deep red Christmas ornament on a warm cream background',
    description:
      'A festive holiday still life with copy space, suitable for greeting cards and seasonal marketing.',
    keywords: [
      'christmas',
      'ornament',
      'red',
      'holiday',
      'festive',
      'copy space',
      'background',
      'día de los muertos',
      'crème brûlée',
      'decoration'
    ],
    category: 8,
    releases: ''
  }

  const items: EmbedItem[] = [
    { sourcePath: jpegPath, fileName: basename(jpegPath), metadata: jpegMetadata },
    { sourcePath: pngPath, fileName: basename(pngPath), metadata: jpegMetadata }
  ]

  const results = await embedAll(fakeSender, items, output, {
    title: true,
    description: true,
    keywords: true,
    overwrite: false
  })
  console.log('EMBED RESULTS:', results)
  assert.equal(results.length, 2)
  assert.equal(results[0].status, 'saved')
  assert.equal(results[1].status, 'saved')

  const jpegOut = join(output, basename(jpegPath))
  const pngOut = join(output, basename(pngPath))

  const jpegTags = await exiftool.read(jpegOut)
  const pngTags = await exiftool.read(pngOut)
  const jpegKeywords = (jpegTags as Record<string, unknown>).Subject
  const pngKeywords = (pngTags as Record<string, unknown>).Subject

  console.log('JPEG TAGS:', {
    title: jpegTags.Title,
    description: jpegTags.Description,
    keywords: jpegKeywords
  })
  console.log('PNG TAGS:', {
    title: pngTags.Title,
    description: pngTags.Description,
    keywords: pngKeywords
  })

  assert.equal(jpegTags.Title, jpegMetadata.title)
  assert.equal(jpegTags.Description, jpegMetadata.description)
  assert.ok(Array.isArray(jpegKeywords), 'JPEG XMP subject should be an array')
  assert.ok((jpegKeywords as string[]).includes('día de los muertos'))
  assert.ok((jpegKeywords as string[]).includes('crème brûlée'))
  assert.equal(pngTags.Title, jpegMetadata.title)
  assert.ok(Array.isArray(pngKeywords), 'PNG XMP subject should be an array')

  const sourceTags = await exiftool.read(jpegPath)
  assert.equal(sourceTags.Title, undefined, 'source must stay untouched')

  const skipped = await embedAll(
    fakeSender,
    [{ sourcePath: jpegPath, fileName: basename(jpegPath), metadata: jpegMetadata }],
    output,
    { title: true, description: true, keywords: true, overwrite: false }
  )
  assert.equal(skipped[0].status, 'skipped')

  const sameFolder = await embedAll(
    fakeSender,
    [{ sourcePath: jpegPath, fileName: basename(jpegPath), metadata: jpegMetadata }],
    fixtures,
    { title: true, description: true, keywords: true, overwrite: false }
  )
  assert.equal(sameFolder[0].status, 'failed')

  const badExtension = await embedAll(
    fakeSender,
    [{ sourcePath: jpegPath, fileName: 'notes.txt', metadata: jpegMetadata }],
    output,
    { title: true, description: true, keywords: true, overwrite: true }
  )
  assert.equal(badExtension[0].status, 'failed')

  await exiftool.end()
  console.log('EMBED CHECKS PASSED')
}

main().catch(async (error) => {
  console.error(error)
  await exiftool.end().catch(() => undefined)
  process.exitCode = 1
})
