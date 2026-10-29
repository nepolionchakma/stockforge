import { _electron as electron } from 'playwright-core'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const electronPath = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
const fixtures = [
  path.join(root, 'tmp', 'fixtures', 'red_christmas_ornament.jpg'),
  path.join(root, 'tmp', 'fixtures', 'purple_transparent_ornament.png')
]
const exportDir = path.join(root, 'tmp', 'ui-export')
const csvPath = path.join(root, 'tmp', 'ui-export', 'check.csv')
const shotDir = path.join(root, 'screenshots')

async function waitForFile(filePath, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  return false
}

async function main() {
  await fs.mkdir(shotDir, { recursive: true })
  await fs.rm(exportDir, { recursive: true, force: true })
  await fs.mkdir(exportDir, { recursive: true })

  const errors = []
  const app = await electron.launch({
    executablePath: electronPath,
    args: ['.'],
    cwd: root,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  })

  try {
    const page = await app.firstWindow()
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`)
    })

    await page.waitForSelector('text=Events & prompts', { timeout: 20000 })
    await page.waitForTimeout(800)
    const seededPrompts = await page.locator('textarea[aria-label^="Prompt"]').count()
    console.log('EVENT TAB PROMPTS:', seededPrompts)
    if (seededPrompts < 1) throw new Error('Expected one seeded prompt on the events tab')
    const promptValue = await page.locator('textarea[aria-label^="Prompt"]').first().inputValue()
    if (promptValue.length < 80) throw new Error('Seeded prompt looks too short')
    await page.screenshot({ path: path.join(shotDir, 'events.png') })

    const promptField = page.locator('textarea[aria-label^="Prompt"]').first()
    await promptField.fill(`${promptValue} Refined test edit.`)
    await page.locator('button').filter({ hasText: /^Copy$/ }).first().click()
    await page.waitForTimeout(250)
    const copiedPrompt = await app.evaluate(({ clipboard }) => clipboard.readText())
    if (!copiedPrompt.endsWith('Refined test edit.')) {
      throw new Error('Prompt copy did not reflect the inline edit')
    }
    await page.getByRole('button', { name: 'Remove prompt' }).first().click()
    await page.waitForTimeout(250)
    if ((await page.locator('textarea[aria-label^="Prompt"]').count()) !== 0) {
      throw new Error('Prompt removal did not work')
    }
    await page.getByRole('button', { name: 'Add a prompt' }).click()
    await page.waitForTimeout(300)
    if ((await page.locator('textarea[aria-label^="Prompt"]').count()) !== 1) {
      throw new Error('Prompt addition did not work')
    }

    await page.getByRole('button', { name: /Metadata Titles, keywords, CSV/ }).click()
    await page.waitForSelector('text=Metadata lab')
    await page.waitForTimeout(400)
    await page.getByLabel('Event context for metadata').selectOption({ label: 'Christmas · Dec 25' })
    await page.screenshot({ path: path.join(shotDir, 'metadata-empty.png') })

    await app.evaluate(
      async ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths })
      },
      fixtures
    )

    await page.locator('header').getByRole('button', { name: 'Add images' }).click()
    await page.waitForSelector('text=red_christmas_ornament.jpg', { timeout: 15000 })
    await page.waitForFunction(() => {
      const text = document.body.innerText
      return text.includes('prepared') && text.includes('red_christmas_ornament.jpg')
    })
    await page.waitForTimeout(1200)

    const bodyAfterImport = await page.locator('body').innerText()
    console.log('COLOR ANALYSIS VISIBLE:', /red|green|cream/i.test(bodyAfterImport))
    console.log('IMPORT STATE:', bodyAfterImport.includes('2 prepared') ? 'metadata already?' : 'metadata pending')

    await page.locator('header').getByRole('button', { name: /Generate/ }).click()
    await page.waitForFunction(() => {
      const textareas = [...document.querySelectorAll('aside textarea')]
      return textareas.some((textarea) => textarea.value.length > 10)
    })
    await page.waitForTimeout(500)
    const generatedTitle = await page.locator('aside textarea').first().inputValue()
    console.log('GENERATED TITLE:', generatedTitle)
    const overflow = await page.evaluate(() => {
      const element = document.querySelector('section.panel .overflow-auto')
      return element
        ? { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }
        : null
    })
    console.log('TABLE OVERFLOW:', overflow)
    if (overflow && overflow.scrollWidth > overflow.clientWidth + 2) {
      throw new Error('Metadata table still scrolls horizontally')
    }
    const pageOverflow = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      view: window.innerWidth
    }))
    if (pageOverflow.body > pageOverflow.view + 2) {
      throw new Error(`Page overflows horizontally: ${JSON.stringify(pageOverflow)}`)
    }
    await page.waitForTimeout(5000)
    await page.screenshot({ path: path.join(shotDir, 'metadata.png') })

    await page.getByRole('button', { name: 'Copy metadata' }).click()
    await page.waitForTimeout(300)
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
    console.log('CLIPBOARD LENGTH:', copied.length)
    if (!copied.startsWith('Title:') || !copied.includes('Keywords')) {
      throw new Error('Clipboard metadata was not written correctly')
    }

    await app.evaluate(
      async ({ dialog }, savePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: savePath })
      },
      csvPath
    )
    await page.locator('header').getByRole('button', { name: 'Export CSV' }).click()
    await page.waitForSelector('text=CSV exported', { timeout: 15000 })
    const csv = await fs.readFile(csvPath, 'utf8')
    console.log('CSV HEAD:', csv.split('\r\n')[0])
    console.log('CSV ROWS:', csv.trim().split('\r\n').length - 1)
    if (!csv.startsWith('Filename,Title,Keywords,Category,Releases')) {
      throw new Error('CSV header is incorrect')
    }

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
    await page.waitForSelector('text=2 saved', { timeout: 30000 })
    const savedJpeg = await waitForFile(
      path.join(exportDir, 'red_christmas_ornament.jpg')
    )
    const savedPng = await waitForFile(
      path.join(exportDir, 'purple_transparent_ornament.png')
    )
    console.log('OUTPUT FILES:', savedJpeg, savedPng)
    if (!savedJpeg || !savedPng) throw new Error('Embedded copies were not created')
    await page.waitForTimeout(5000)
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((element) => {
        if (element.scrollTop > 0) element.scrollTop = 0
      })
    })
    await page.screenshot({ path: path.join(shotDir, 'apply.png') })

    if (errors.length > 0) {
      console.log('RENDERER ERRORS:\n' + errors.join('\n'))
    } else {
      console.log('RENDERER ERRORS: none')
    }
    console.log('UI SMOKE PASSED')
  } finally {
    await app.close()
  }
}

main().catch((error) => {
  console.error('UI SMOKE FAILED:', error)
  process.exitCode = 1
})
