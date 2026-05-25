/**
 * Script de teste: insere apostas fictícias para visualizar o dashboard.
 * Uso: node scripts/seed-test-bets.mjs [--limpar]
 * --limpar: remove as apostas de teste inseridas anteriormente
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qwciyudbovdiadnxweac.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3Y2l5dWRib3ZkaWFkbnh3ZWFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3MjI4NCwiZXhwIjoyMDk0OTQ4Mjg0fQ._ocdVDRRaWCKVq85qhI4Aql2gs6FF7saCW5F6egANKE'
const USER_EMAIL = 'rita.riobranco1304@gmail.com'
const TEST_TAG = '[TESTE]' // marcador para identificar apostas de teste

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const limpar = process.argv.includes('--limpar')

async function main() {
  // 1. Buscar usuário pelo email
  const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers()
  if (userErr) { console.error('Erro ao buscar usuários:', userErr.message); process.exit(1) }

  const user = users.find(u => u.email === USER_EMAIL)
  if (!user) { console.error(`Usuário ${USER_EMAIL} não encontrado.`); process.exit(1) }

  console.log(`✅ Usuário encontrado: ${user.id}`)

  if (limpar) {
    // Remover apostas de teste
    const { error } = await supabase
      .from('bets')
      .delete()
      .eq('user_id', user.id)
      .like('notes', `${TEST_TAG}%`)

    if (error) { console.error('Erro ao limpar:', error.message); process.exit(1) }
    console.log('🗑️  Apostas de teste removidas com sucesso.')
    return
  }

  // 2. Verificar apostas reais existentes
  const { data: existing } = await supabase
    .from('bets')
    .select('id, notes')
    .eq('user_id', user.id)

  const reais = existing?.filter(b => !b.notes?.startsWith(TEST_TAG)) ?? []
  const testes = existing?.filter(b => b.notes?.startsWith(TEST_TAG)) ?? []

  if (reais.length > 0) {
    console.log(`⚠️  Você já tem ${reais.length} aposta(s) real(is). As apostas de teste serão adicionadas junto.`)
  }
  if (testes.length > 0) {
    console.log(`ℹ️  Já existem ${testes.length} aposta(s) de teste. Removendo antes de reinserir...`)
    await supabase.from('bets').delete().eq('user_id', user.id).like('notes', `${TEST_TAG}%`)
  }

  // 3. Apostas de teste — cenário realista
  const hoje = new Date()
  const dataStr = (diasAtras) => {
    const d = new Date(hoje)
    d.setDate(d.getDate() - diasAtras)
    return d.toISOString().split('T')[0]
  }

  const apostas = [
    // Semana passada
    { home_team: 'Flamengo',       away_team: 'Vasco',        league: 'Brasileirão Série A', market: 'match_winner',     selection: 'Flamengo',      odd: 1.80, stake: 50.00,  potential_return: 90.00,  status: 'won',  match_date: dataStr(10), notes: `${TEST_TAG} Resultado final` },
    { home_team: 'Palmeiras',      away_team: 'Corinthians',  league: 'Brasileirão Série A', market: 'over_under',       selection: 'Over 2.5',      odd: 2.10, stake: 30.00,  potential_return: 63.00,  status: 'lost', match_date: dataStr(9),  notes: `${TEST_TAG} Terminou 1x0` },
    { home_team: 'Santos',         away_team: 'São Paulo',    league: 'Brasileirão Série A', market: 'both_teams_score', selection: 'Ambas marcam',  odd: 1.75, stake: 40.00,  potential_return: 70.00,  status: 'won',  match_date: dataStr(8),  notes: `${TEST_TAG} 2x1` },
    { home_team: 'Real Madrid',    away_team: 'Barcelona',    league: 'La Liga',             market: 'match_winner',     selection: 'Real Madrid',   odd: 2.05, stake: 80.00,  potential_return: 164.00, status: 'lost', match_date: dataStr(7),  notes: `${TEST_TAG} Barcelona venceu` },

    // Esta semana
    { home_team: 'Manchester City', away_team: 'Arsenal',     league: 'Premier League',      market: 'over_under',       selection: 'Over 3.5',      odd: 2.40, stake: 25.00,  potential_return: 60.00,  status: 'won',  match_date: dataStr(5),  notes: `${TEST_TAG} 4x1` },
    { home_team: 'Atletico MG',    away_team: 'Cruzeiro',     league: 'Brasileirão Série A', market: 'match_winner',     selection: 'Atletico MG',   odd: 1.65, stake: 60.00,  potential_return: 99.00,  status: 'won',  match_date: dataStr(4),  notes: `${TEST_TAG} 2x0` },
    { home_team: 'PSG',            away_team: 'Lyon',         league: 'Ligue 1',             market: 'both_teams_score', selection: 'Ambas marcam',  odd: 1.90, stake: 35.00,  potential_return: 66.50,  status: 'lost', match_date: dataStr(3),  notes: `${TEST_TAG} PSG venceu por 1x0` },
    { home_team: 'Inter de Milão', away_team: 'Juventus',     league: 'Serie A',             market: 'match_winner',     selection: 'Empate',        odd: 3.20, stake: 20.00,  potential_return: 64.00,  status: 'won',  match_date: dataStr(2),  notes: `${TEST_TAG} 1x1` },

    // Apostas pendentes (de hoje)
    { home_team: 'Botafogo',       away_team: 'Fluminense',   league: 'Brasileirão Série A', market: 'match_winner',     selection: 'Botafogo',      odd: 1.90, stake: 45.00,  potential_return: 85.50,  status: 'pending', match_date: dataStr(0), notes: `${TEST_TAG} Hoje à noite` },
    { home_team: 'Bayern Munich',  away_team: 'Dortmund',     league: 'Bundesliga',          market: 'over_under',       selection: 'Over 2.5',      odd: 1.70, stake: 30.00,  potential_return: 51.00,  status: 'pending', match_date: dataStr(0), notes: `${TEST_TAG} Hoje à noite` },
  ]

  const { error: insertErr } = await supabase.from('bets').insert(
    apostas.map(a => ({ ...a, user_id: user.id }))
  )

  if (insertErr) { console.error('Erro ao inserir:', insertErr.message); process.exit(1) }

  // 4. Calcular o que o dashboard vai mostrar
  const liquidadas = apostas.filter(a => a.status !== 'pending')
  const ganhas = liquidadas.filter(a => a.status === 'won')
  const perdidas = liquidadas.filter(a => a.status === 'lost')

  const profit = liquidadas.reduce((acc, a) => {
    if (a.status === 'won') return acc + (a.potential_return - a.stake)
    return acc - a.stake
  }, 0)

  const totalStaked = liquidadas.reduce((acc, a) => acc + a.stake, 0)
  const roi = ((profit / totalStaked) * 100).toFixed(1)
  const winRate = ((ganhas.length / liquidadas.length) * 100).toFixed(1)
  const pendentes = apostas.filter(a => a.status === 'pending')

  console.log('\n' + '═'.repeat(50))
  console.log('  SIMULAÇÃO DO DASHBOARD — O QUE VOCÊ VAI VER')
  console.log('═'.repeat(50))
  console.log(`\n  Total de apostas:  ${apostas.length} (${liquidadas.length} liquidadas + ${pendentes.length} pendentes)`)
  console.log(`  Ganhas / Perdidas: ${ganhas.length}W / ${perdidas.length}L`)
  console.log(`  Win Rate:          ${winRate}%`)
  console.log(`  Total apostado:    R$ ${totalStaked.toFixed(2)}`)
  console.log(`  Lucro/Prejuízo:    R$ ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}`)
  console.log(`  ROI:               ${roi}%  ${parseFloat(roi) >= 0 ? '📈 positivo' : '📉 negativo'}`)
  console.log('\n  Breakdown por mercado:')

  const byMarket = {}
  liquidadas.forEach(a => {
    if (!byMarket[a.market]) byMarket[a.market] = { won: 0, total: 0 }
    byMarket[a.market].total++
    if (a.status === 'won') byMarket[a.market].won++
  })
  Object.entries(byMarket).forEach(([m, s]) => {
    const wr = ((s.won / s.total) * 100).toFixed(0)
    const bar = '█'.repeat(Math.round(s.won)) + '░'.repeat(s.total - s.won)
    console.log(`    ${m.padEnd(20)} ${bar}  ${wr}% (${s.won}/${s.total})`)
  })

  console.log('\n' + '═'.repeat(50))
  console.log('  ✅ Apostas inseridas! Abra o app e veja o dashboard.')
  console.log('  Para limpar depois: node scripts/seed-test-bets.mjs --limpar')
  console.log('═'.repeat(50) + '\n')
}

main()
