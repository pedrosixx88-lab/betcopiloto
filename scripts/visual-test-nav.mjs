import { chromium } from '@playwright/test'
import { mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, 'screenshots-nav')
await mkdir(DIR, { recursive: true })

const BASE = 'http://localhost:3001'
const browser = await chromium.launch({ headless: false, slowMo: 150 })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

async function shot(name) {
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(DIR, `${name}.png`) })
  console.log(`📸 ${name}.png`)
}

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', 'teste@betcopiloto.dev')
await page.fill('input[type="password"]', 'Teste@123456')
await page.click('button[type="submit"]')
await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 })
await page.waitForLoadState('networkidle')

// Screenshots das 4 abas
await shot('01-dashboard')

await page.click('a[href="/apostas"]')
await page.waitForLoadState('networkidle')
await shot('02-apostas')

await page.click('a[href="/jogos"]')
await page.waitForLoadState('networkidle')
await shot('03-jogos')

await page.click('a[href="/bilhete"]')
await page.waitForLoadState('networkidle')
await shot('04-bilhete')

await browser.close()
console.log('✅ Pronto!')
