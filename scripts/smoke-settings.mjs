import { _electron as electron } from 'playwright-core'
import { promises as fs } from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const root = process.cwd()
const electronPath = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
const profileDir = path.join(root, 'tmp', 'smoke-settings-profile')
const shotDir = path.join(root, 'screenshots')
const packagedDir = process.env.STOCKFORGE_PACKAGED_DIR
  ? path.resolve(root, process.env.STOCKFORGE_PACKAGED_DIR)
  : null

const LIMITED_KEY = 'limited-key'
const WORKING_KEY = 'working-key'

async function startMockApi() {
  const requests = []
  const server = http.createServer((request, response) => {
    let raw = ''
    request.on('data', (chunk) => {
      raw += chunk
    })
    request.on('end', () => {
      if (request.method !== 'POST' || !request.url?.endsWith('/chat/completions')) {
        response.writeHead(404, { 'Content-Type': 'text/plain' })
        response.end('not found')
        return
      }

      let payload
      try {
        payload = JSON.parse(raw)
      } catch {
        response.writeHead(400, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: { message: 'invalid json' } }))
        return
      }

      const authorization = request.headers.authorization ?? ''
      const entry = {
        authorization,
        model: payload.model,
        body: payload,
        status: 200
      }
      requests.push(entry)

      if (authorization === `Bearer ${LIMITED_KEY}`) {
        entry.status = 429
        response.writeHead(429, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: { message: 'Rate limit reached for this key' } }))
        return
      }

      const system = String(
        payload.messages?.find((message) => message.role === 'system')?.content ?? ''
      )
      let content = 'ready'

      if (!system.toLowerCase().includes('connection test')) {
        let count = 1
        let event = 'US holiday'
        try {
          const user = JSON.parse(
            String(payload.messages?.find((message) => message.role === 'user')?.content ?? '{}')
          )
          count = Math.max(1, Math.min(20, Number(user.count) || 1))
          event = String(user.event ?? event)
        } catch {
          // Keep the defaults if the request body cannot be parsed.
        }
        content = JSON.stringify(
          Array.from(
            { length: count },
            (_, index) =>
              `MOCK AI PROMPT ${requests.length}-${index + 1}: A polished commercial still-life photograph for ${event}, featuring a glass ornament on a marble surface with soft window light, centered composition with generous copy space, warm seasonal palette, shallow depth of field, no text, no logos, no watermark.`
          )
        )
      }

      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content } }]
        })
      )
    })
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Mock server did not bind')

  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve))
  }
}

async function launchApp() {
  const env = {
    ...process.env,
    STOCKFORGE_USER_DATA_DIR: profileDir,
    ELECTRON_ENABLE_LOGGING: '1'
  }
  if (packagedDir) {
    return electron.launch({
      executablePath: path.join(packagedDir, 'StockForge Studio.exe'),
      args: [],
      cwd: packagedDir,
      env
    })
  }
  return electron.launch({
    executablePath: electronPath,
    args: ['.'],
    cwd: root,
    env
  })
}

function watchErrors(page, errors) {
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

async function main() {
  await fs.rm(profileDir, { recursive: true, force: true })
  await fs.mkdir(profileDir, { recursive: true })
  await fs.mkdir(shotDir, { recursive: true })

  const mock = await startMockApi()
  const errors = []
  let app = null

  try {
    app = await launchApp()
    let page = await app.firstWindow()
    watchErrors(page, errors)
    await page.waitForSelector('text=Events & prompts', { timeout: 20000 })
    await page.waitForTimeout(700)

    const baseWindowWidth = await page.evaluate(() => window.innerWidth)
    const expandedWidth = (await page.locator('aside').first().boundingBox())?.width ?? 0
    if (expandedWidth < 200) throw new Error('Expanded sidebar is unexpectedly narrow')

    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await page.waitForTimeout(350)
    const collapsedWidth = (await page.locator('aside').first().boundingBox())?.width ?? 0
    const collapsedText = (await page.locator('aside').first().innerText()).trim()
    if (collapsedWidth > 90) throw new Error(`Sidebar did not collapse: ${collapsedWidth}px`)
    if (collapsedText.length > 0) {
      throw new Error(`Collapsed sidebar still renders text: ${JSON.stringify(collapsedText)}`)
    }
    await page.screenshot({ path: path.join(shotDir, 'sidebar-collapsed.png') })

    await page.getByRole('button', { name: 'Settings' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ timeout: 10000 })

    await dialog.getByRole('button', { name: 'Edit API connection' }).first().click()
    const providerSelect = dialog.getByLabel('AI provider')
    await providerSelect.waitFor()
    const colorScheme = await providerSelect.evaluate(
      (element) => getComputedStyle(element).colorScheme
    )
    if (colorScheme !== 'dark') throw new Error(`Select is not dark themed: ${colorScheme}`)

    const presets = [
      {
        id: 'priyo',
        baseUrl: 'https://api.priyo.ai/v1',
        model: 'priyo-llama'
      },
      {
        id: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-3.8-flash'
      },
      {
        id: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'openai/gpt-oss-20b'
      },
      {
        id: 'openrouter-free',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'openrouter/free'
      },
      {
        id: 'zai',
        baseUrl: 'https://api.z.ai/api/paas/v4',
        model: 'glm-4.7-flash'
      }
    ]

    for (const preset of presets) {
      await providerSelect.selectOption(preset.id)
      await page.waitForTimeout(220)
      if ((await dialog.getByLabel('API base URL').inputValue()) !== preset.baseUrl) {
        throw new Error(`${preset.id} preset did not fill the base URL`)
      }
      const modelSelect = dialog.getByLabel('AI model')
      if ((await modelSelect.inputValue()) !== preset.model) {
        throw new Error(`${preset.id} preset did not fill the model`)
      }
      const selectedLabel = await modelSelect.locator('option:checked').textContent()
      if (!selectedLabel?.includes('Free')) {
        throw new Error(`${preset.id} default model is missing the Free label`)
      }
    }

    await providerSelect.selectOption('custom')
    await dialog.getByLabel('API base URL').fill(mock.url)
    await dialog.getByLabel('AI model').fill('mock-model')
    await dialog.getByLabel('API key', { exact: true }).fill(LIMITED_KEY)
    await dialog.getByRole('button', { name: 'Save API' }).click()
    await dialog.getByText(/Saved\. The API key is encrypted/).waitFor({ timeout: 10000 })

    await dialog.getByRole('button', { name: 'Test connection' }).click()
    await dialog.getByText(/AI request failed \(429\)/).waitFor({ timeout: 15000 })

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await dialog.getByRole('button', { name: 'Add API' }).click()
    await providerSelect.selectOption('custom')
    await dialog.getByLabel('API base URL').fill(mock.url)
    await dialog.getByLabel('AI model').fill('mock-model')
    await dialog.getByLabel('API key', { exact: true }).fill(WORKING_KEY)
    await dialog.getByRole('button', { name: 'Add connection' }).click()
    await dialog.getByText(/2 saved/).waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)

    const settingsFile = path.join(profileDir, 'ai-settings.json')
    const storedRaw = await fs.readFile(settingsFile, 'utf8')
    const stored = JSON.parse(storedRaw)
    if (stored.endpoints?.length !== 2) {
      throw new Error(`Expected 2 stored endpoints, got ${stored.endpoints?.length}`)
    }
    if (storedRaw.includes(LIMITED_KEY) || storedRaw.includes(WORKING_KEY)) {
      throw new Error('An API key was stored in plaintext')
    }
    if (stored.endpoints.some((endpoint) => !endpoint.encryptedApiKey)) {
      throw new Error('An encrypted API key was not saved')
    }
    if (stored.endpoints.some((endpoint) => endpoint.baseUrl !== mock.url)) {
      throw new Error('An API base URL was not persisted correctly')
    }

    await page.screenshot({ path: path.join(shotDir, 'settings.png') })

    const widthBeforeZoom = await page.evaluate(() => window.innerWidth)
    await dialog.getByRole('button', { name: /Large text size/ }).click()
    await page.waitForTimeout(500)
    const widthAfterZoom = await page.evaluate(() => window.innerWidth)
    if (!(widthAfterZoom < widthBeforeZoom - 80)) {
      throw new Error(`Text size did not scale the interface: ${widthBeforeZoom} → ${widthAfterZoom}`)
    }
    const storedScale = await page.evaluate(() => localStorage.getItem('stockforge.fontScale.v1'))
    if (storedScale !== '1.1') throw new Error(`Font scale was not persisted: ${storedScale}`)

    const masterTemplate = await dialog.getByLabel('Master prompt template').inputValue()
    if (!masterTemplate.includes('NICHE NAME: Easter Decorations')) {
      throw new Error('The default master prompt was not loaded in Settings')
    }

    await dialog.getByRole('button', { name: 'Close settings' }).click()
    await page.waitForTimeout(300)

    const nicheInput = page.getByLabel('Niche name')
    await nicheInput.waitFor()
    const baseNiche = await nicheInput.inputValue()
    const firstKeyword = page.locator('button[aria-label^="Add keyword"]').first()
    const keywordLabel = await firstKeyword.getAttribute('aria-label')
    const keyword = String(keywordLabel ?? '')
      .replace(/^Add keyword /, '')
      .replace(/ to niche$/, '')
    await firstKeyword.click()
    const selectedNiche = await nicheInput.inputValue()
    if (!selectedNiche.startsWith(baseNiche) || !selectedNiche.includes(keyword)) {
      throw new Error(`Keyword did not update the niche name: ${JSON.stringify(selectedNiche)}`)
    }

    const whiteBackgroundSwitch = page.getByRole('switch', { name: 'White background' })
    await whiteBackgroundSwitch.waitFor()
    if ((await whiteBackgroundSwitch.getAttribute('aria-checked')) !== 'true') {
      throw new Error('White background is not on by default')
    }

    await page.getByRole('button', { name: 'More prompts' }).click()
    await page.waitForTimeout(200)

    const requestsBeforeGenerate = mock.requests.length
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('textarea[aria-label^="Prompt"]')].some((textarea) =>
          textarea.value.includes('MOCK AI PROMPT')
        ),
      { timeout: 20000 }
    )
    const promptCount = await page.locator('textarea[aria-label^="Prompt"]').count()
    if (promptCount !== 3) throw new Error(`Expected 3 prompts after generation, got ${promptCount}`)
    const generatedPromptTexts = await page
      .locator('textarea[aria-label^="Prompt"]')
      .evaluateAll((elements) => elements.map((element) => element.value))
    if (!generatedPromptTexts.every((text) => /pure white/i.test(text))) {
      throw new Error('White background was not added to every AI prompt')
    }
    if ((await whiteBackgroundSwitch.getAttribute('aria-checked')) !== 'true') {
      throw new Error('White background switch changed unexpectedly during generation')
    }
    await whiteBackgroundSwitch.click()
    await page.waitForTimeout(150)
    if ((await whiteBackgroundSwitch.getAttribute('aria-checked')) !== 'false') {
      throw new Error('White background switch did not turn off')
    }
    const storedWhiteBackground = await page.evaluate(() =>
      localStorage.getItem('stockforge.whiteBackground.v1')
    )
    if (storedWhiteBackground !== 'false') {
      throw new Error(`White background preference was not persisted: ${storedWhiteBackground}`)
    }
    await whiteBackgroundSwitch.click()

    const fallbackRequests = mock.requests.slice(requestsBeforeGenerate)
    const successfulRequest = fallbackRequests.find(
      (request) => request.authorization === `Bearer ${WORKING_KEY}`
    )
    const systemPrompt = String(
      successfulRequest?.body?.messages?.find((message) => message.role === 'system')?.content ??
        ''
    )
    if (!systemPrompt.includes(`NICHE NAME: ${selectedNiche}`)) {
      throw new Error('The selected niche was not substituted into the master prompt')
    }
    if (systemPrompt.includes('NICHE NAME: Easter Decorations')) {
      throw new Error('The placeholder niche was left in the master prompt')
    }
    if (!systemPrompt.includes('generate exactly 2 highly detailed')) {
      throw new Error('The chosen prompt count was not substituted into the master prompt')
    }
    if (!systemPrompt.includes('all 20 styles') ||
        !systemPrompt.includes('20.\tRealistic commercial still life')) {
      throw new Error('Substitution accidentally changed the style library count')
    }
    if (!systemPrompt.includes('OUTPUT FORMAT')) {
      throw new Error('The JSON output override was not appended')
    }
    if (!systemPrompt.includes('WHITE BACKGROUND REQUIREMENT')) {
      throw new Error('The white background rule was not sent to the AI')
    }

    if (
      !fallbackRequests.some((request) => request.authorization === `Bearer ${LIMITED_KEY}`) ||
      !fallbackRequests.some((request) => request.authorization === `Bearer ${WORKING_KEY}`)
    ) {
      throw new Error(`Fallback did not try both keys: ${JSON.stringify(fallbackRequests.map((r) => r.authorization))}`)
    }
    if (fallbackRequests.at(-1)?.authorization !== `Bearer ${WORKING_KEY}`) {
      throw new Error('The working key was not the successful fallback')
    }

    await app.close()
    app = null

    // Relaunch to prove encrypted endpoints, order, sidebar and text size persist.
    app = await launchApp()
    page = await app.firstWindow()
    watchErrors(page, errors)
    await page.waitForSelector('text=Events & prompts', { timeout: 20000 })
    await page.waitForTimeout(900)

    const reloadedCollapsedWidth =
      (await page.locator('aside').first().boundingBox())?.width ?? 999
    if (reloadedCollapsedWidth > 90) throw new Error('Collapsed sidebar state did not persist')
    const reloadedWindowWidth = await page.evaluate(() => window.innerWidth)
    if (!(reloadedWindowWidth < baseWindowWidth - 80)) {
      throw new Error(
        `Text size did not persist across restart: ${baseWindowWidth} → ${reloadedWindowWidth}`
      )
    }

    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Settings' }).click()
    const reloadedDialog = page.getByRole('dialog')
    await reloadedDialog.waitFor()
    await reloadedDialog.getByText(/2 saved/).waitFor({ timeout: 10000 })
    const reloadedTemplate = await reloadedDialog
      .getByLabel('Master prompt template')
      .inputValue()
    if (!reloadedTemplate.includes('NICHE NAME') || reloadedTemplate.length < 10000) {
      throw new Error('The master prompt template did not persist across restart')
    }

    const beforeOrder = JSON.parse(await fs.readFile(settingsFile, 'utf8')).endpoints.map(
      (endpoint) => endpoint.encryptedApiKey
    )
    await reloadedDialog.getByRole('button', { name: 'Move Custom endpoint up' }).last().click()
    await page.waitForTimeout(500)
    const afterOrder = JSON.parse(await fs.readFile(settingsFile, 'utf8')).endpoints.map(
      (endpoint) => endpoint.encryptedApiKey
    )
    if (afterOrder[0] !== beforeOrder[1]) {
      throw new Error('Moving an API connection up did not change its priority')
    }

    await page.getByRole('button', { name: /Default text size/ }).click()
    await page.waitForTimeout(400)
    await reloadedDialog.getByRole('button', { name: 'Close settings' }).click()
    await page.waitForTimeout(300)

    const requestsBeforePriorityGenerate = mock.requests.length
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await page.waitForFunction(
      () => document.querySelectorAll('textarea[aria-label^="Prompt"]').length >= 4,
      { timeout: 20000 }
    )
    const priorityRequests = mock.requests.slice(requestsBeforePriorityGenerate)
    if (priorityRequests.length !== 1) {
      throw new Error(`Expected one request after reorder, got ${priorityRequests.length}`)
    }
    if (priorityRequests[0].authorization !== `Bearer ${WORKING_KEY}`) {
      throw new Error('The reordered priority did not use the working API first')
    }

    if (errors.length > 0) {
      console.log('RENDERER ERRORS:', errors)
      throw new Error(`Renderer reported ${errors.length} error(s)`)
    }

    console.log('AI REQUESTS TOTAL:', mock.requests.length)
    console.log('FALLBACK AUTH:', fallbackRequests.map((request) => request.authorization))
    console.log('PRIORITY AFTER REORDER:', priorityRequests[0]?.authorization)
    console.log('SIDEBAR WIDTHS:', expandedWidth, '→', collapsedWidth)
    console.log('ZOOM WIDTHS:', baseWindowWidth, '→', widthAfterZoom)
    console.log('MULTI-API SMOKE PASSED')
  } finally {
    if (app) await app.close()
    await mock.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
