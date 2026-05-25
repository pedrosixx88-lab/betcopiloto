/**
 * Script de teste para o endpoint /api/bilhete/avaliar
 * Uso: node scripts/test-avaliar.mjs <caminho-da-imagem>
 * Exemplo: node scripts/test-avaliar.mjs C:\Users\User\Desktop\teste-bet.png
 */

import { readFileSync } from 'fs'
import { resolve, extname } from 'path'

const BASE = 'http://localhost:3001'
const imagePath = process.argv[2]

if (!imagePath) {
  console.error('❌ Informe o caminho da imagem: node scripts/test-avaliar.mjs <path>')
  process.exit(1)
}

const absPath = resolve(imagePath)
console.log(`📷 Imagem: ${absPath}`)

// 1. Login automático via dev-login
console.log('\n🔑 Fazendo login automático...')
const loginRes = await fetch(`${BASE}/api/dev-login`, { redirect: 'manual' })

const setCookieHeader = loginRes.headers.get('set-cookie') ?? ''
if (!setCookieHeader && loginRes.status !== 200) {
  console.error('❌ dev-login falhou:', loginRes.status)
  const text = await loginRes.text()
  console.error(text.slice(0, 500))
  process.exit(1)
}

// Extrai cookies da resposta
const cookies = []
const rawCookies = loginRes.headers.raw?.()?.['set-cookie'] ?? []
for (const c of (Array.isArray(rawCookies) ? rawCookies : [setCookieHeader])) {
  const part = c.split(';')[0]?.trim()
  if (part) cookies.push(part)
}

// Se não há cookies na resposta, lê o body para pegar o redirect via HTML
let sessionCookie = cookies.join('; ')

// Tenta logar via fetch normal (com cookies)
if (!sessionCookie) {
  const bodyText = await loginRes.text()
  console.log('Body dev-login:', bodyText.slice(0, 200))
  // Faz um segundo request seguindo redirect
  const loginRes2 = await fetch(`${BASE}/api/dev-login`, { redirect: 'follow' })
  const cookie2 = loginRes2.headers.get('set-cookie') ?? ''
  sessionCookie = cookie2.split(';')[0] ?? ''
}

console.log(`✅ Cookies obtidos: ${sessionCookie ? sessionCookie.slice(0, 80) + '...' : 'nenhum (pode usar session do browser)'}`)

// 2. Enviar imagem para o avaliador
console.log('\n📊 Enviando imagem para análise...')
const imageBuffer = readFileSync(absPath)
const ext = extname(absPath).replace('.', '')
const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const mimeType = mimeTypes[ext.toLowerCase()] ?? 'image/png'

const formData = new FormData()
const blob = new Blob([imageBuffer], { type: mimeType })
formData.append('screenshot', blob, `ticket.${ext}`)

const headers = { 'Cookie': sessionCookie }

const t0 = Date.now()
const avaliarRes = await fetch(`${BASE}/api/bilhete/avaliar`, {
  method: 'POST',
  headers,
  body: formData,
})
const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

console.log(`\nStatus: ${avaliarRes.status} (${elapsed}s)`)
const result = await avaliarRes.json()

if (result.success) {
  console.log('\n✅ ANÁLISE CONCLUÍDA!\n')
  console.log('━━ BILHETE ━━')
  console.log(`Total odd: ${result.ticket.total_odd}`)
  console.log(`Stake: ${result.ticket.stake}`)

  console.log('\n━━ ANÁLISE POR JOGO ━━')
  for (const leg of result.analysis.legs ?? []) {
    console.log(`\n  ${leg.jogo}`)
    console.log(`  Seleção: ${leg.selecao} @ ${leg.odd}`)
    console.log(`  Avaliação: ${leg.avaliacao} | Confiança: ${leg.confianca}`)
    console.log(`  ${leg.justificativa}`)
    if (leg.alerta) console.log(`  ⚠️ ${leg.alerta}`)
  }

  const r = result.analysis.resumo
  console.log('\n━━ RESUMO ━━')
  console.log(`  Favoráveis: ${r.jogos_favoraveis} | Neutros: ${r.jogos_neutros} | Desfavoráveis: ${r.jogos_desfavoraveis} | Sem dados: ${r.jogos_sem_dados}`)
  console.log(`  Nota: ${r.nota_geral} | Tem valor: ${r.tem_valor}`)
  console.log(`  ${r.parecer}`)

  const g = result.analysis.gestao_banca
  console.log('\n━━ GESTÃO DE BANCA ━━')
  console.log(`  Stake sugerido: R$ ${g.stake_sugerido} (${g.percentual_banca} da banca)`)
  console.log(`  ${g.raciocinio}`)
} else {
  console.log('\n❌ ERRO:', result.error ?? JSON.stringify(result, null, 2))
}
