import { _electron as electron } from 'playwright-core'
import { promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const run = promisify(execFile)
const root = process.cwd()
const packagedDir = path.resolve(
  root,
  process.env.STOCKFORGE_PACKAGED_DIR ?? path.join('release', 'win-unpacked')
)
const packagedExe = path.join(packagedDir, 'StockForge Studio.exe')
const fixtures = [
  path.join(root, 'tmp', 'fixtures', 'red_christmas_ornament.jpg'),
  path.join(root, 'tmp', 'fixtures', 'purple_transparent_ornament.png')
]
const exportDir = path.join(root, 'tmp', 'packaged-export')
const csvPath = path.join(exportDir, 'packaged.csv')

await fs.rm(exportDir, { recursive: true, force: true })
await fs.mkdir(exportDir, { recursive: true })
await fs.access(packagedExe)

const app = await electron.launch({
  executablePath: packagedExe,
  args: [],
  cwd: path.dirname(packagedExe)
})

try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })

  await page.waitForSelector('text=Events & prompts', { timeout: 30000 })
  await page.getByRole('button', { name: /Metadata Titles, keywords, CSV/ }).click()
  await page.waitForSelector('text=Metadata lab')

  await app.evaluate(
    async ({ dialog }, paths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths })
    },
    fixtures
  )
  await page.locator('header').getByRole('button', { name: 'Add images' }).click()
  await page.waitForSelector('text=red_christmas_ornament.jpg', { timeout: 20000 })
  await page.waitForTimeout(1200)
  await page.getByLabel('Event context for metadata').selectOption({ label: 'Christmas · Dec 25' })
  await page.locator('header').getByRole('button', { name: /Generate/ }).click()
  await page.waitForFunction(() => {
    const textareas = [...document.querySelectorAll('aside textarea')]
    return textareas.some((textarea) => textarea.value.length > 10)
  })

  await app.evaluate(
    async ({ dialog }, savePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: savePath })
    },
    csvPath
  )
  await page.locator('header').getByRole('button', { name: 'Export CSV' }).click()
  await page.waitForSelector('text=CSV exported', { timeout: 20000 })

  await page.getByRole('button', { name: /Apply & Save Embed/ }).click()
  await page.waitForSelector('text=Embed metadata')
  await app.evaluate(
    async ({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] })
    },
    exportDir
  )
  await page.getByRole('button', { name: 'Choose output folder' }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Save 2 copies/ }).click()
  await page.waitForSelector('text=2 saved', { timeout: 40000 })
  await page.waitForTimeout(400)

  const jpegOut = path.join(exportDir, 'red_christmas_ornament.jpg')
  const pngOut = path.join(exportDir, 'purple_transparent_ornament.png')
  await fs.access(jpegOut)
  await fs.access(pngOut)

  const csv = await fs.readFile(csvPath, 'utf8')
  if (!csv.includes('Filename,Title,Keywords,Category,Releases')) {
    throw new Error('packaged CSV header is wrong')
  }

  const exiftool = path.join(
    root,
    'node_modules',
    'exiftool-vendored.exe',
    'bin',
    'exiftool.exe'
  )
  const { stdout } = await run(exiftool, ['-j', '-Title', '-Subject', jpegOut])
  const [tags] = JSON.parse(stdout)
  console.log('PACKAGED JPEG TAGS:', tags)

  if (!tags.Title || !tags.Subject) throw new Error('packaged ExifTool did not write tags')
  if (errors.length > 0) console.log('RENDERER ERRORS:', errors)
  else console.log('RENDERER ERRORS: none')
  console.log('PACKAGED SMOKE PASSED')
} finally {
  await app.close()
}
