import { chromium } from '@playwright/test'
import { mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, 'screenshots')
await mkdir(SCREENSHOTS_DIR, { recursive: true })

const BASE = 'http://localhost:3001'
const EMAIL = 'teste@betcopiloto.dev'
const PASSWORD = 'Teste@123456'

const browser = await chromium.launch({ headless: false, slowMo: 150 })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

async function shot(name) {
  await page.waitForTimeout(1000)
  await page.screenshot({ path: join(SCREENSHOTS_DIR, `${name}.png`) })
  console.log(`📸 ${name}.png`)
}

try {
  // 1. Login via formulário
  console.log('--- LOGIN ---')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 })
  await shot('01-login')

  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')

  // Aguarda redirect para dashboard
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  await shot('02-dashboard')

  // 2. Nova aposta
  console.log('--- NOVA APOSTA ---')
  await page.goto(`${BASE}/apostas/nova`, { waitUntil: 'networkidle', timeout: 15000 })
  await shot('03-upload')

  await page.click('button:has-text("Preencher manualmente")')
  await page.waitForTimeout(500)
  await shot('04-form-vazio')

  await page.fill('input[placeholder="Ex: Flamengo"]', 'Corinthians')
  await page.fill('input[placeholder="Ex: Palmeiras"]', 'São Paulo')
  await page.fill('input[placeholder="Ex: Brasileirão Série A"]', 'Brasileirão')
  await page.fill('input[placeholder="Ex: Flamengo vence, Over 2.5..."]', 'Corinthians vence')
  await page.fill('input[placeholder="1.85"]', '2.10')
  await page.fill('input[placeholder="50.00"]', '50')
  await page.fill('input[placeholder="Ex: Betano"]', 'Bet365')
  await page.waitForTimeout(400)
  await shot('05-form-preenchido')

  // Salvar
  await page.click('button:has-text("Registrar aposta")')
  await page.waitForURL(`${BASE}/apostas`, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await shot('06-lista-apostas')

  // 3. Filtros
  console.log('--- FILTROS ---')
  await page.click('a:has-text("Pendentes")')
  await page.waitForLoadState('networkidle')
  await shot('07-filtro-pendentes')

  // 4. Dashboard final
  console.log('--- DASHBOARD FINAL ---')
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 })
  await shot('08-dashboard-final')

  console.log('\n✅ Teste concluído! Screenshots em:', SCREENSHOTS_DIR)

} catch (err) {
  console.error('❌ Erro:', err.message)
  await page.screenshot({ path: join(SCREENSHOTS_DIR, 'erro.png') })
} finally {
  await page.waitForTimeout(2000)
  await browser.close()
}
