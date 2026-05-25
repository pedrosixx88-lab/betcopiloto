import puppeteer from 'puppeteer'
import { mkdirSync } from 'fs'
import path from 'path'

const APP_URL = 'http://localhost:3001'
const OUT_DIR = path.resolve('scripts/screenshots')
mkdirSync(OUT_DIR, { recursive: true })

async function shot(page, name, label) {
  await new Promise(r => setTimeout(r, 1200))
  const file = path.join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(`📸 ${label}`)
  return file
}

async function main() {
  console.log('\n🚀 Abrindo o BetCopiloto...\n')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
  })

  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(30000)

  try {
    // 1. Landing page
    console.log('🌐 Landing page...')
    await page.goto(APP_URL, { waitUntil: 'networkidle0' })
    await shot(page, '01-landing', 'Landing page')

    // 2. Login automático via rota dev
    console.log('🔐 Fazendo login automático...')
    await page.goto(`${APP_URL}/api/dev-login`, { waitUntil: 'networkidle0' })
    await new Promise(r => setTimeout(r, 2000))

    const urlAtual = page.url()
    console.log('   URL após login:', urlAtual)

    if (!urlAtual.includes('/dashboard') && !urlAtual.includes('/onboarding')) {
      console.log('⚠️  Login não funcionou, URL:', urlAtual)
      await shot(page, 'erro-login', 'Erro de login')
      await browser.close()
      return
    }

    // 3. Dashboard
    console.log('📊 Dashboard...')
    await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'networkidle0' })
    await shot(page, '02-dashboard', 'Dashboard completo')

    // 4. Apostas
    console.log('📋 Apostas...')
    await page.goto(`${APP_URL}/apostas`, { waitUntil: 'networkidle0' })
    await shot(page, '03-apostas', 'Lista de apostas')

    // 5. Jogos
    console.log('⚽ Jogos...')
    await page.goto(`${APP_URL}/jogos`, { waitUntil: 'networkidle0' })
    await shot(page, '04-jogos', 'Jogos do dia')

    // 6. Planos
    console.log('💎 Planos...')
    await page.goto(`${APP_URL}/planos`, { waitUntil: 'networkidle0' })
    await shot(page, '05-planos', 'Planos')

    console.log('\n✅ Pronto! Exibindo screenshots...\n')

  } catch (err) {
    console.error('Erro:', err.message)
    await shot(page, 'erro', 'Estado de erro')
  } finally {
    await browser.close()
  }
}

main()
