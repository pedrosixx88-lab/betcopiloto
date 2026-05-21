import { chromium } from '@playwright/test'
import { mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, 'screenshots-m4')
await mkdir(SCREENSHOTS_DIR, { recursive: true })

const BASE = 'http://localhost:3001'
const EMAIL = 'teste@betcopiloto.dev'
const PASSWORD = 'Teste@123456'

const browser = await chromium.launch({ headless: false, slowMo: 200 })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

async function shot(name) {
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(SCREENSHOTS_DIR, `${name}.png`) })
  console.log(`📸 ${name}.png`)
}

try {
  // Login
  console.log('--- LOGIN ---')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  console.log('Login OK')

  // Página /jogos
  console.log('\n--- JOGOS DO DIA ---')
  await page.goto(`${BASE}/jogos`, { waitUntil: 'networkidle', timeout: 20000 })
  await shot('01-jogos-lista')

  // Clicar no primeiro jogo disponível
  const firstGame = page.locator('a[href^="/jogos/"]').first()
  const hasGame = await firstGame.count() > 0

  if (hasGame) {
    const gameHref = await firstGame.getAttribute('href')
    console.log(`\n--- JOGO: ${gameHref} ---`)
    await firstGame.click()
    await page.waitForLoadState('networkidle')
    await shot('02-jogo-carregando')

    // Aguarda análise carregar (pode demorar — Claude gerando)
    // Aguarda análise terminar (spinner some quando carrega)
    console.log('Aguardando análise da IA...')
    await page.waitForSelector('text=Tip principal', { timeout: 40000 }).catch(() => {})
    await shot('03-jogo-analise')

    // Tab Chat
    console.log('\n--- CHAT ---')
    const chatTab = page.locator('button').filter({ hasText: 'Chat' }).first()
    await chatTab.click()
    await page.waitForTimeout(600)
    await shot('04-chat-vazio')

    // Enviar pergunta
    await page.fill('input[placeholder="Pergunte sobre o jogo..."]', 'Quem tem melhor forma recente?')
    const sendBtn = page.locator('button[disabled="false"]').filter({ has: page.locator('svg') }).last()
    await page.keyboard.press('Enter')
    console.log('Aguardando resposta do chat...')
    await page.waitForSelector('.rounded-bl-sm', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1000)
    await shot('05-chat-resposta')

    // Tab Bilhete
    console.log('\n--- BILHETE ---')
    const ticketTab = page.locator('button').filter({ hasText: 'Bilhete' }).first()
    await ticketTab.click()
    await page.waitForTimeout(600)
    await shot('06-bilhete-form')

    await page.fill('input[placeholder="50.00"]', '100')
    await page.locator('button').filter({ hasText: 'Montar bilhete com IA' }).click()
    console.log('Aguardando bilhete da IA...')
    await page.waitForSelector('text=Bilhete sugerido', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1000)
    await shot('07-bilhete-resultado')
  } else {
    console.log('Nenhum jogo disponível hoje — capturando estado vazio')
    await shot('02-jogos-vazio')
  }

  console.log('\n✅ Teste M4 concluído!')
  console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}`)

} catch (err) {
  console.error('❌ Erro:', err.message)
  await page.screenshot({ path: join(SCREENSHOTS_DIR, 'erro.png') })
} finally {
  await page.waitForTimeout(2000)
  await browser.close()
}
