import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  searchFixture,
  getFixturePredictions,
  getFixtureLineups,
  getFixtureInjuries,
  getFixtureStats,
  getFixturesStats,
  getStandings,
  getH2H,
  getTeamSeasonStats,
  getLastMatches,
  getFixtureOdds,
} from '@/lib/api-football'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!rateLimit(`avaliar:${user.id}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Aguarde alguns minutos.' }, { status: 429 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, current_bankroll, avaliacoes_gratuitas')
    .eq('id', user.id)
    .single<{ plan: string; plan_expires_at: string | null; current_bankroll: number; avaliacoes_gratuitas: number }>()

  const isPro = profile?.plan === 'pro' &&
    (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date())
  const avaliacoesUsadas = profile?.avaliacoes_gratuitas ?? 0

  if (!isPro && avaliacoesUsadas >= 1) {
    return NextResponse.json({ error: 'upgrade_required', message: 'Você já usou sua análise gratuita. Assine o Pro para continuar.' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('screenshot') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Imagem muito grande. Máximo 10MB.' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const hoje = new Date().toISOString().split('T')[0]

  // ── PASSO 1: Extração Vision ──
  const extractRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `Extraia os jogos deste bilhete de apostas esportivas. Retorne APENAS JSON.

DATA DE HOJE: ${hoje}

{
  "total_odd": 4.00,
  "stake": 50.00,
  "legs": [
    {
      "home_team": "Flamengo",
      "away_team": "Vasco",
      "selection": "Flamengo vence",
      "market": "match_winner",
      "odd": 2.00,
      "match_date": "${hoje}"
    }
  ]
}

REGRAS:
- home_team: time da CASA (listado primeiro no formato "Casa v Fora")
- away_team: time de FORA (listado segundo)
- selection: o que o apostador apostou exatamente (ex: "Wolfsburg vence", "Over 2.5", "Ambas marcam - Sim")
- match_date: data visível no bilhete. Se não houver, use hoje: ${hoje}
- stake e total_odd: null se não identificar
- market: match_winner | over_under | both_teams_score | handicap | corners | cards | correct_score | other`,
        },
      ],
    }],
  })

  const extractText = extractRes.content[0].type === 'text' ? extractRes.content[0].text : ''
  const extractMatch = extractText.match(/\{[\s\S]*\}/)
  if (!extractMatch) return NextResponse.json({ error: 'Não consegui ler o bilhete. Tente uma foto mais nítida.' }, { status: 400 })

  let ticketData: { total_odd: number | null; stake: number | null; legs: Array<{ home_team: string; away_team: string; selection: string; market: string; odd: number; match_date: string }> }
  try { ticketData = JSON.parse(extractMatch[0]) } catch {
    return NextResponse.json({ error: 'Erro ao processar bilhete.' }, { status: 400 })
  }

  if (!ticketData.legs?.length) return NextResponse.json({ error: 'Nenhum jogo encontrado no bilhete.' }, { status: 400 })

  // Garante datas válidas
  ticketData.legs = ticketData.legs.map(leg => ({
    ...leg,
    match_date: leg.match_date && /^\d{4}-\d{2}-\d{2}$/.test(leg.match_date) ? leg.match_date : hoje,
  }))

  console.log('[avaliar] Vision:', JSON.stringify(ticketData.legs.map(l => ({ home: l.home_team, away: l.away_team, date: l.match_date, sel: l.selection, odd: l.odd }))))

  const bankroll = profile?.current_bankroll ?? 0

  // ── Helpers ──
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const fmtOdd = (n: number | null) => n ? n.toFixed(2) : 'N/D'
  const pct = (n: number | null) => n ? `${(n * 100).toFixed(1)}%` : 'N/D'
  // Probabilidade implícita de uma odd (remove margem aproximada)
  const impliedProb = (odd: number) => odd > 1 ? (1 / odd * 100).toFixed(1) + '%' : 'N/D'

  // ── PASSO 2: Buscar todos os dados da API para cada jogo ──
  const legsWithData = await Promise.all(
    ticketData.legs.map(async (leg) => {
      try {
        const fixture = await searchFixture(leg.home_team, leg.away_team, leg.match_date)
        if (!fixture) {
          console.log(`[avaliar] NÃO ENCONTRADO: ${leg.home_team} vs ${leg.away_team} @ ${leg.match_date}`)
          return { leg, data: null }
        }

        const fid = fixture.fixture.id
        const homeId = fixture.teams.home.id
        const awayId = fixture.teams.away.id
        const leagueId = fixture.league.id
        const temporada = fixture.league.season ?? new Date().getFullYear()

        console.log(`[avaliar] ENCONTRADO: ${fixture.teams.home.name} vs ${fixture.teams.away.name} | id=${fid} | liga=${fixture.league.name} | temp=${temporada}`)

        const [
          predRes, lineupsRes, lesionsRes, statsJogoRes,
          tabelaRes, h2hRes, statsHomeRes, statsAwayRes,
          formaHomeRes, formaAwayRes, oddsRes,
        ] = await Promise.allSettled([
          getFixturePredictions(fid),
          getFixtureLineups(fid),
          getFixtureInjuries(fid),
          getFixtureStats(fid),
          getStandings(leagueId, temporada),
          getH2H(homeId, awayId),
          getTeamSeasonStats(homeId, leagueId, temporada),
          getTeamSeasonStats(awayId, leagueId, temporada),
          getLastMatches(homeId, 10),
          getLastMatches(awayId, 10),
          getFixtureOdds(fid),
        ])

        const pred = predRes.status === 'fulfilled' ? (predRes.value ?? null) : null
        const escalacoes = lineupsRes.status === 'fulfilled' ? (lineupsRes.value ?? []) : []
        const lesoes = lesionsRes.status === 'fulfilled' ? (lesionsRes.value ?? []) : []
        const statsJogo = statsJogoRes.status === 'fulfilled' ? (statsJogoRes.value ?? []) : []
        const tabelaRaw = tabelaRes.status === 'fulfilled' ? (tabelaRes.value ?? []) : []
        const h2hRaw = h2hRes.status === 'fulfilled' ? (h2hRes.value ?? []) : []
        const statsHome = statsHomeRes.status === 'fulfilled' ? (statsHomeRes.value ?? null) : null
        const statsAway = statsAwayRes.status === 'fulfilled' ? (statsAwayRes.value ?? null) : null
        const formaHomeRaw = formaHomeRes.status === 'fulfilled' ? (formaHomeRes.value ?? []) : []
        const formaAwayRaw = formaAwayRes.status === 'fulfilled' ? (formaAwayRes.value ?? []) : []
        const oddsRaw = oddsRes.status === 'fulfilled' ? (oddsRes.value ?? []) : []

        console.log(`[avaliar] dados: pred=${!!pred} escal=${escalacoes.length} lesoes=${lesoes.length} tabela=${tabelaRaw.length} h2h=${h2hRaw.length} hStats=${!!statsHome} aStats=${!!statsAway} hForma=${formaHomeRaw.length} aForma=${formaAwayRaw.length} odds=${oddsRaw.length}`)

        // ── Tabela ──
        const todosClassificados: any[] = []
        tabelaRaw.forEach((grupo: any) => {
          if (Array.isArray(grupo)) todosClassificados.push(...grupo)
          else if (grupo?.league?.standings) grupo.league.standings.forEach((s: any[]) => todosClassificados.push(...s))
          else if (grupo?.standings) grupo.standings.forEach((s: any[]) => todosClassificados.push(...s))
        })
        const posHome = todosClassificados.find((s: any) => s.team?.id === homeId)
        const posAway = todosClassificados.find((s: any) => s.team?.id === awayId)

        // ── Escalações ──
        const escHome = escalacoes.find((l: any) => l.team?.id === homeId)
        const escAway = escalacoes.find((l: any) => l.team?.id === awayId)

        // ── Lesões formatadas ──
        const lesoesFmt = lesoes.map((p: any) => `${p.player?.name ?? '?'} (${p.team?.name ?? '?'}) — ${p.type ?? '?'}${p.reason ? ': ' + p.reason : ''}`)

        // ── H2H enriquecido ──
        let h2hHomeV = 0, h2hAwayV = 0, h2hEmpates = 0
        let h2hTotalGols = 0, h2hBTTS = 0, h2hOver25 = 0, h2hOver15 = 0
        const h2hLinhas: string[] = []
        for (const m of h2hRaw) {
          const hg = m.score?.fulltime?.home ?? m.goals?.home
          const ag = m.score?.fulltime?.away ?? m.goals?.away
          if (typeof hg !== 'number' || typeof ag !== 'number') continue
          const total = hg + ag
          h2hTotalGols += total
          if (total >= 1.5) h2hOver15++
          if (total >= 2.5) h2hOver25++
          if (hg > 0 && ag > 0) h2hBTTS++
          const mHomeEhCasa = m.teams?.home?.id === homeId
          if (hg === ag) h2hEmpates++
          else if ((mHomeEhCasa && hg > ag) || (!mHomeEhCasa && ag > hg)) h2hHomeV++
          else h2hAwayV++
          if (h2hLinhas.length < 7) {
            const data = m.fixture?.date?.split('T')[0] ?? '?'
            const ven = hg > ag ? m.teams?.home?.name : ag > hg ? m.teams?.away?.name : 'Empate'
            h2hLinhas.push(`  ${data}: ${m.teams?.home?.name} ${hg}x${ag} ${m.teams?.away?.name} → ${ven}`)
          }
        }
        const h2hTotal = h2hHomeV + h2hAwayV + h2hEmpates
        const h2hMediaGols = h2hTotal > 0 ? (h2hTotalGols / h2hTotal).toFixed(2) : 'N/D'
        const h2hPctOver25 = h2hTotal > 0 ? `${Math.round(h2hOver25 / h2hTotal * 100)}%` : 'N/D'
        const h2hPctBTTS = h2hTotal > 0 ? `${Math.round(h2hBTTS / h2hTotal * 100)}%` : 'N/D'

        // ── Forma recente enriquecida (últimas 10 para calcular médias) ──
        const calcForma = (partidas: any[], teamId: number) => {
          let v = 0, e = 0, d = 0, golsMarcados = 0, golsSofridos = 0
          let over15 = 0, over25 = 0, btts = 0, cleanSheets = 0, semMarcar = 0
          const linhas: string[] = []
          const ultimas5 = partidas.slice(0, 5)
          const todas = partidas.slice(0, 10)
          for (const m of todas) {
            const ehCasa = m.teams?.home?.id === teamId
            const tg = ehCasa ? (m.goals?.home ?? null) : (m.goals?.away ?? null)
            const og = ehCasa ? (m.goals?.away ?? null) : (m.goals?.home ?? null)
            if (typeof tg !== 'number' || typeof og !== 'number') continue
            golsMarcados += tg; golsSofridos += og
            const total = tg + og
            if (total >= 1.5) over15++
            if (total >= 2.5) over25++
            if (tg > 0 && og > 0) btts++
            if (og === 0) cleanSheets++
            if (tg === 0) semMarcar++
            if (tg > og) v++; else if (tg < og) d++; else e++
          }
          for (const m of ultimas5) {
            const ehCasa = m.teams?.home?.id === teamId
            const tg = ehCasa ? (m.goals?.home ?? '?') : (m.goals?.away ?? '?')
            const og = ehCasa ? (m.goals?.away ?? '?') : (m.goals?.home ?? '?')
            const opp = ehCasa ? m.teams?.away?.name : m.teams?.home?.name
            const data = m.fixture?.date?.split('T')[0] ?? '?'
            const loc = ehCasa ? 'Casa' : 'Fora'
            const res = typeof tg === 'number' && typeof og === 'number'
              ? (tg > og ? 'V' : tg < og ? 'D' : 'E') : '?'
            linhas.push(`  ${data} [${loc}] vs ${opp} (${m.league?.name ?? '?'}): ${tg}x${og} [${res}]`)
          }
          const n = todas.length || 1
          return {
            linhas,
            resumo: todas.length > 0 ? [
              `  Últimas ${todas.length} partidas: ${v}V ${e}E ${d}D`,
              `  Média gols marcados: ${(golsMarcados / n).toFixed(2)}/jogo | Média gols sofridos: ${(golsSofridos / n).toFixed(2)}/jogo`,
              `  Over 1.5: ${Math.round(over15 / n * 100)}% | Over 2.5: ${Math.round(over25 / n * 100)}% | BTTS: ${Math.round(btts / n * 100)}%`,
              `  Clean sheets: ${cleanSheets} | Jogos sem marcar: ${semMarcar}`,
            ].join('\n') : '  Dados de forma não disponíveis',
          }
        }
        const formaHome = calcForma(formaHomeRaw, homeId)
        const formaAway = calcForma(formaAwayRaw, awayId)

        // ── Médias de escanteios, cartões, xG e chutes dos últimos jogos ──
        const calcMediasJogos = async (partidas: any[], teamId: number) => {
          const jogosEncerrados = partidas.filter(m => {
            const s = m.fixture?.status?.short
            return ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(s)
          }).slice(0, 5)

          if (jogosEncerrados.length === 0) return null

          const ids = jogosEncerrados.map((m: any) => m.fixture.id as number)
          const statsMap = await getFixturesStats(ids)

          let escanteiosPro = 0, escanteirosTotal = 0
          let cartosAmarelos = 0, cartosVermelhos = 0
          let xgPro = 0, chutesGolPro = 0, chutesTotalPro = 0
          let escanteiosOponente = 0
          let n = 0

          for (const m of jogosEncerrados) {
            const stats = statsMap[m.fixture.id]
            if (!stats || stats.length === 0) continue
            const ehCasa = m.teams?.home?.id === teamId
            const teamName = ehCasa ? m.teams.home.name : m.teams.away.name
            const oppName = ehCasa ? m.teams.away.name : m.teams.home.name

            const getSt = (name: string, tipo: string) => {
              const t = stats.find((s: any) => s.team?.name === name || s.team?.id === (ehCasa ? teamId : (teamId === m.teams.home.id ? m.teams.away.id : m.teams.home.id)))
              // busca mais robusta pelo nome parcial
              const team = stats.find((s: any) => {
                const tn = (s.team?.name ?? '').toLowerCase()
                return tn.includes(name.toLowerCase().split(' ')[0]) || name.toLowerCase().includes(tn.split(' ')[0])
              })
              return team?.statistics?.find((s: any) => s.type === tipo)?.value ?? null
            }

            // busca por ID do time
            const teamStats = stats.find((s: any) => s.team?.id === teamId)
            const oppStats = stats.find((s: any) => s.team?.id !== teamId)

            const corners = teamStats?.statistics?.find((s: any) => s.type === 'Corner Kicks')?.value
            const cornersOpp = oppStats?.statistics?.find((s: any) => s.type === 'Corner Kicks')?.value
            const yellow = teamStats?.statistics?.find((s: any) => s.type === 'Yellow Cards')?.value
            const red = teamStats?.statistics?.find((s: any) => s.type === 'Red Cards')?.value
            const xg = teamStats?.statistics?.find((s: any) => s.type === 'expected_goals')?.value
            const shotsOnGoal = teamStats?.statistics?.find((s: any) => s.type === 'Shots on Goal')?.value
            const shotsTotal = teamStats?.statistics?.find((s: any) => s.type === 'Total Shots')?.value

            if (typeof corners === 'number') { escanteiosPro += corners; n++ }
            if (typeof cornersOpp === 'number') escanteiosOponente += cornersOpp
            if (typeof corners === 'number' && typeof cornersOpp === 'number') escanteirosTotal += corners + cornersOpp
            if (typeof yellow === 'number') cartosAmarelos += yellow
            if (typeof red === 'number') cartosVermelhos += red
            if (xg) xgPro += parseFloat(xg)
            if (typeof shotsOnGoal === 'number') chutesGolPro += shotsOnGoal
            if (typeof shotsTotal === 'number') chutesTotalPro += shotsTotal
          }

          if (n === 0) return null

          return {
            jogos_analisados: n,
            escanteios: {
              media_pro: (escanteiosPro / n).toFixed(1),
              media_oponente: (escanteiosOponente / n).toFixed(1),
              media_total_jogo: (escanteirosTotal / n).toFixed(1),
            },
            cartoesAmarelos: {
              media_pro: (cartosAmarelos / n).toFixed(1),
            },
            cartoesVermelhos: {
              media_pro: (cartosVermelhos / n).toFixed(1),
            },
            xg: {
              media_pro: (xgPro / n).toFixed(2),
            },
            chutes: {
              media_ao_gol: (chutesGolPro / n).toFixed(1),
              media_total: (chutesTotalPro / n).toFixed(1),
            },
          }
        }

        // Executa em paralelo para os dois times
        const [mediasHome, mediasAway] = await Promise.all([
          calcMediasJogos(formaHomeRaw, homeId),
          calcMediasJogos(formaAwayRaw, awayId),
        ])

        // ── Cartões da temporada (via teams/statistics) ──
        const totalCartoesTemporada = (ts: any) => {
          if (!ts?.cards) return null
          const yellowTotal = Object.values(ts.cards.yellow ?? {})
            .reduce((s: number, v: any) => s + (v?.total ?? 0), 0)
          const redTotal = Object.values(ts.cards.red ?? {})
            .reduce((s: number, v: any) => s + (v?.total ?? 0), 0)
          const jogos = ts.fixtures?.played?.total || 1
          return {
            amarelos_total: yellowTotal,
            vermelhos_total: redTotal,
            media_amarelos_jogo: (yellowTotal / jogos).toFixed(2),
            media_vermelhos_jogo: (redTotal / jogos).toFixed(2),
          }
        }
        const cartoesHomeTemp = totalCartoesTemporada(statsHome)
        const cartoesAwayTemp = totalCartoesTemporada(statsAway)

        // ── Estatísticas de temporada formatadas ──
        const fmtTemporada = (ts: any, nome: string, ehCasa: boolean) => {
          if (!ts) return `  ${nome}: estatísticas não disponíveis`
          const f = ts.fixtures; const g = ts.goals; const cs = ts.clean_sheet
          const fails = ts.failed_to_score; const big = ts.biggest
          const loc = ehCasa ? 'home' : 'away'
          const locLabel = ehCasa ? 'em casa' : 'fora'
          const totalJ = f?.played?.total || 1
          const locJ = f?.played?.[loc] || 1
          return [
            `  ${nome} — Temporada completa:`,
            `    Geral: ${f?.played?.total ?? 'N/D'}J | ${f?.wins?.total ?? 'N/D'}V ${f?.draws?.total ?? 'N/D'}E ${f?.loses?.total ?? 'N/D'}D (${f?.played?.total ? Math.round(f.wins.total / totalJ * 100) : 'N/D'}% aproveitamento)`,
            `    Gols marcados: ${g?.for?.total?.total ?? 'N/D'} (${g?.for?.average?.total ?? 'N/D'}/jogo) | Gols sofridos: ${g?.against?.total?.total ?? 'N/D'} (${g?.against?.average?.total ?? 'N/D'}/jogo)`,
            `    ${locLabel.charAt(0).toUpperCase() + locLabel.slice(1)}: ${f?.played?.[loc] ?? 'N/D'}J | ${f?.wins?.[loc] ?? 'N/D'}V ${f?.draws?.[loc] ?? 'N/D'}E ${f?.loses?.[loc] ?? 'N/D'}D | Gols marc: ${g?.for?.total?.[loc] ?? 'N/D'} (${g?.for?.average?.[loc] ?? 'N/D'}/jogo) | Gols sofr: ${g?.against?.total?.[loc] ?? 'N/D'} (${g?.against?.average?.[loc] ?? 'N/D'}/jogo)`,
            `    Clean sheets ${locLabel}: ${cs?.[loc] ?? 'N/D'} (${f?.played?.[loc] ? Math.round((cs?.[loc] ?? 0) / locJ * 100) : 'N/D'}%) | Sem marcar ${locLabel}: ${fails?.[loc] ?? 'N/D'}`,
            `    Maior vitória ${locLabel}: ${big?.wins?.[loc] ?? 'N/D'} | Maior derrota ${locLabel}: ${big?.loses?.[loc] ?? 'N/D'}`,
            `    Forma atual (API): ${ts.form ?? 'N/D'}`,
          ].join('\n')
        }

        // ── Odds completas por mercado e por casa ──
        const mercados: Record<string, { nome: string; home: number[]; draw: number[]; away: number[]; over: number[]; under: number[]; sim: number[]; nao: number[]; casas: string[] }> = {}
        const oddsPorCasa: string[] = []
        const casasSharp = ['Pinnacle', 'SBO', 'Betfair']

        for (const bk of oddsRaw) {
          const nomeCasa = bk.name ?? bk.bookmaker?.name ?? 'Desconhecida'
          for (const mercado of (bk.bets ?? [])) {
            const nomeMerc = mercado.name ?? ''
            const key = nomeMerc.toLowerCase().replace(/\s+/g, '_')
            if (!mercados[key]) mercados[key] = { nome: nomeMerc, home: [], draw: [], away: [], over: [], under: [], sim: [], nao: [], casas: [] }
            mercados[key].casas.push(nomeCasa)
            for (const v of (mercado.values ?? [])) {
              const o = parseFloat(v.odd ?? '0')
              if (o <= 1) continue
              const val = (v.value ?? '').toLowerCase()
              if (val === 'home') mercados[key].home.push(o)
              else if (val === 'draw') mercados[key].draw.push(o)
              else if (val === 'away') mercados[key].away.push(o)
              else if (val.includes('over')) mercados[key].over.push(o)
              else if (val.includes('under')) mercados[key].under.push(o)
              else if (val === 'yes' || val === 'sim') mercados[key].sim.push(o)
              else if (val === 'no' || val === 'não' || val === 'nao') mercados[key].nao.push(o)
            }
          }
          // Linha por casa para match winner
          const mw = bk.bets?.find((b: any) => b.id === 1 || b.name?.toLowerCase()?.includes('match winner'))
          if (mw) {
            const h = parseFloat(mw.values?.find((v: any) => v.value === 'Home')?.odd ?? '0')
            const d = parseFloat(mw.values?.find((v: any) => v.value === 'Draw')?.odd ?? '0')
            const a = parseFloat(mw.values?.find((v: any) => v.value === 'Away')?.odd ?? '0')
            if (h > 1 || d > 1 || a > 1) {
              const sharp = casasSharp.some(c => nomeCasa.toLowerCase().includes(c.toLowerCase())) ? ' ⚡SHARP' : ''
              oddsPorCasa.push(`  ${nomeCasa}${sharp}: Casa ${fmtOdd(h > 1 ? h : null)} | Empate ${fmtOdd(d > 1 ? d : null)} | Fora ${fmtOdd(a > 1 ? a : null)}`)
            }
          }
        }

        // Médias de mercado
        const mw = mercados['match_winner'] ?? mercados[Object.keys(mercados).find(k => k.includes('match_winner') || k.includes('winner')) ?? '']
        const ou25 = mercados[Object.keys(mercados).find(k => k.includes('over_under_2.5') || k.includes('goals_over/under_2.5')) ?? '']
        const ou15 = mercados[Object.keys(mercados).find(k => k.includes('over_under_1.5') || k.includes('goals_over/under_1.5')) ?? '']
        const bttsMarket = mercados[Object.keys(mercados).find(k => k.includes('both_teams') || k.includes('btts') || k.includes('goal_goal')) ?? '']
        const dc = mercados[Object.keys(mercados).find(k => k.includes('double_chance')) ?? '']

        const mwHomeAvg = avg(mw?.home ?? [])
        const mwDrawAvg = avg(mw?.draw ?? [])
        const mwAwayAvg = avg(mw?.away ?? [])

        // Detecção de valor: probabilidade implícita da odd do apostador vs prob real da API
        const probRealAPI = (() => {
          const p = pred?.predictions?.percent
          if (!p) return null
          const legSel = leg.selection.toLowerCase()
          if (leg.market === 'match_winner') {
            if (legSel.includes(fixture.teams.home.name.toLowerCase()) || legSel.includes('casa') || legSel === '1')
              return parseFloat(p.home?.replace('%', '') ?? '0')
            if (legSel.includes(fixture.teams.away.name.toLowerCase()) || legSel.includes('fora') || legSel === '2')
              return parseFloat(p.away?.replace('%', '') ?? '0')
            if (legSel.includes('empate') || legSel === 'x')
              return parseFloat(p.draw?.replace('%', '') ?? '0')
          }
          return null
        })()

        const probImplicitaOdd = leg.odd > 1 ? (1 / leg.odd * 100) : null
        const temValor = probRealAPI && probImplicitaOdd ? probRealAPI > probImplicitaOdd : null

        // Stats do jogo se já aconteceu
        const getStat = (teamId: number, tipo: string) => {
          const t = statsJogo.find((s: any) => s.team?.id === teamId)
          return t?.statistics?.find((s: any) => s.type === tipo)?.value ?? null
        }

        return {
          leg,
          fixture: {
            id: fid,
            home: fixture.teams.home.name,
            away: fixture.teams.away.name,
            liga: fixture.league.name,
            data: fixture.fixture.date,
            status: fixture.fixture.status.long,
          },
          analise_valor: {
            prob_real_api: probRealAPI ? `${probRealAPI.toFixed(1)}%` : 'N/D',
            prob_implicita_odd: probImplicitaOdd ? `${probImplicitaOdd.toFixed(1)}%` : 'N/D',
            tem_valor: temValor,
            edge: probRealAPI && probImplicitaOdd ? `${(probRealAPI - probImplicitaOdd).toFixed(1)}pp` : 'N/D',
          },
          data: {
            // Previsão Poisson
            previsao: pred ? {
              favorito: pred.predictions?.winner?.name ?? 'N/D',
              pct_casa: pred.predictions?.percent?.home ?? 'N/D',
              pct_empate: pred.predictions?.percent?.draw ?? 'N/D',
              pct_fora: pred.predictions?.percent?.away ?? 'N/D',
              poisson_casa: pred.comparison?.poisson_distribution?.home ?? 'N/D',
              poisson_fora: pred.comparison?.poisson_distribution?.away ?? 'N/D',
              gols_esperados_casa: pred.predictions?.goals?.home ?? 'N/D',
              gols_esperados_fora: pred.predictions?.goals?.away ?? 'N/D',
              under_over_recomendado: pred.predictions?.under_over ?? 'N/D',
              conselho: pred.predictions?.advice ?? 'N/D',
              forca_ataque_casa: pred.comparison?.att?.home ?? 'N/D',
              forca_ataque_fora: pred.comparison?.att?.away ?? 'N/D',
              forca_defesa_casa: pred.comparison?.def?.home ?? 'N/D',
              forca_defesa_fora: pred.comparison?.def?.away ?? 'N/D',
              forma_comparativa_casa: pred.comparison?.form?.home ?? 'N/D',
              forma_comparativa_fora: pred.comparison?.form?.away ?? 'N/D',
              h2h_historico_api_casa: pred.comparison?.h2h?.home ?? 'N/D',
              h2h_historico_api_fora: pred.comparison?.h2h?.away ?? 'N/D',
            } : null,

            // Tabela
            tabela: {
              casa: posHome ? {
                posicao: posHome.rank,
                pontos: posHome.points,
                jogos: posHome.all?.played,
                vitorias: posHome.all?.win,
                empates: posHome.all?.draw,
                derrotas: posHome.all?.lose,
                gols_pro: posHome.all?.goals?.for,
                gols_contra: posHome.all?.goals?.against,
                saldo: (posHome.all?.goals?.for ?? 0) - (posHome.all?.goals?.against ?? 0),
                forma: posHome.form,
                status: posHome.description ?? null,
                em_casa: {
                  jogos: posHome.home?.played,
                  vitorias: posHome.home?.win,
                  empates: posHome.home?.draw,
                  derrotas: posHome.home?.lose,
                  gols_pro: posHome.home?.goals?.for,
                  gols_contra: posHome.home?.goals?.against,
                },
              } : null,
              fora: posAway ? {
                posicao: posAway.rank,
                pontos: posAway.points,
                jogos: posAway.all?.played,
                vitorias: posAway.all?.win,
                empates: posAway.all?.draw,
                derrotas: posAway.all?.lose,
                gols_pro: posAway.all?.goals?.for,
                gols_contra: posAway.all?.goals?.against,
                saldo: (posAway.all?.goals?.for ?? 0) - (posAway.all?.goals?.against ?? 0),
                forma: posAway.form,
                status: posAway.description ?? null,
                fora_de_casa: {
                  jogos: posAway.away?.played,
                  vitorias: posAway.away?.win,
                  empates: posAway.away?.draw,
                  derrotas: posAway.away?.lose,
                  gols_pro: posAway.away?.goals?.for,
                  gols_contra: posAway.away?.goals?.against,
                },
              } : null,
            },

            // Temporada completa
            stats_temporada: {
              casa: statsHome ? fmtTemporada(statsHome, fixture.teams.home.name, true) : null,
              fora: statsAway ? fmtTemporada(statsAway, fixture.teams.away.name, false) : null,
            },

            // H2H completo
            h2h: {
              total: h2hTotal,
              vitorias_casa: h2hHomeV,
              empates: h2hEmpates,
              vitorias_fora: h2hAwayV,
              media_gols: h2hMediaGols,
              pct_over25: h2hPctOver25,
              pct_btts: h2hPctBTTS,
              historico: h2hLinhas,
            },

            // Forma enriquecida
            forma_casa: { resumo: formaHome.resumo, partidas: formaHome.linhas },
            forma_fora: { resumo: formaAway.resumo, partidas: formaAway.linhas },

            // Médias reais por jogo (escanteios, cartões, xG, chutes)
            medias_jogo: {
              casa: mediasHome,
              fora: mediasAway,
            },

            // Cartões da temporada completa
            cartoes_temporada: {
              casa: cartoesHomeTemp,
              fora: cartoesAwayTemp,
            },

            // Odds por mercado e por casa
            odds: {
              casas_disponiveis: oddsRaw.length,
              match_winner: mw ? {
                media_casa: fmtOdd(mwHomeAvg),
                media_empate: fmtOdd(mwDrawAvg),
                media_fora: fmtOdd(mwAwayAvg),
                prob_implicita_casa: pct(mwHomeAvg ? 1 / mwHomeAvg : null),
                prob_implicita_empate: pct(mwDrawAvg ? 1 / mwDrawAvg : null),
                prob_implicita_fora: pct(mwAwayAvg ? 1 / mwAwayAvg : null),
              } : null,
              over_under_25: ou25 ? {
                media_over: fmtOdd(avg(ou25.over)),
                media_under: fmtOdd(avg(ou25.under)),
              } : null,
              over_under_15: ou15 ? {
                media_over: fmtOdd(avg(ou15.over)),
                media_under: fmtOdd(avg(ou15.under)),
              } : null,
              btts: bttsMarket ? {
                media_sim: fmtOdd(avg(bttsMarket.sim)),
                media_nao: fmtOdd(avg(bttsMarket.nao)),
              } : null,
              double_chance: dc ? {
                media_1x: fmtOdd(avg([...(dc.home ?? []), ...(dc.draw ?? [])])),
                media_x2: fmtOdd(avg([...(dc.draw ?? []), ...(dc.away ?? [])])),
              } : null,
              por_casa: oddsPorCasa,
            },

            // Escalação
            escalacao: {
              casa: escHome ? {
                formacao: escHome.formation,
                tecnico: escHome.coach?.name,
                titulares: escHome.startXI?.map((p: any) => `${p.player?.name} (${p.player?.pos})`),
              } : null,
              fora: escAway ? {
                formacao: escAway.formation,
                tecnico: escAway.coach?.name,
                titulares: escAway.startXI?.map((p: any) => `${p.player?.name} (${p.player?.pos})`),
              } : null,
            },

            // Lesões
            lesoes: lesoesFmt,

            // Stats do jogo (se já aconteceu)
            stats_jogo: statsJogo.length > 0 ? {
              chutes_gol: { casa: getStat(homeId, 'Shots on Goal'), fora: getStat(awayId, 'Shots on Goal') },
              chutes_total: { casa: getStat(homeId, 'Total Shots'), fora: getStat(awayId, 'Total Shots') },
              escanteios: { casa: getStat(homeId, 'Corner Kicks'), fora: getStat(awayId, 'Corner Kicks') },
              posse: { casa: getStat(homeId, 'Ball Possession'), fora: getStat(awayId, 'Ball Possession') },
              amarelos: { casa: getStat(homeId, 'Yellow Cards'), fora: getStat(awayId, 'Yellow Cards') },
              defesas: { casa: getStat(homeId, 'Goalkeeper Saves'), fora: getStat(awayId, 'Goalkeeper Saves') },
              faltas: { casa: getStat(homeId, 'Fouls'), fora: getStat(awayId, 'Fouls') },
              impedimentos: { casa: getStat(homeId, 'Offsides'), fora: getStat(awayId, 'Offsides') },
            } : null,
          },
        }
      } catch (err) {
        console.error('[avaliar] erro no jogo:', err instanceof Error ? err.message : String(err))
        return { leg, data: null }
      }
    })
  )

  // ── PASSO 3: Montar texto completo para o Claude ──
  const jogosTexto = legsWithData.map((item, i) => {
    const { leg, fixture, data, analise_valor } = item as any
    if (!data) return `JOGO ${i + 1}: ${leg.home_team} vs ${leg.away_team}\nSELEÇÃO: ${leg.selection} @ ${leg.odd}x\n⚠️ Jogo não localizado na API.\n`

    const p = data.previsao
    const sh = data.tabela.casa
    const sa = data.tabela.fora
    const h2h = data.h2h
    const odds = data.odds
    const fc = data.forma_casa
    const ff = data.forma_fora
    const av = analise_valor
    const escH = data.escalacao.casa
    const escA = data.escalacao.fora
    const mj = data.medias_jogo
    const ct = data.cartoes_temporada

    return `
════════════════════════════════════════════════════════
JOGO ${i + 1}: ${fixture.home} vs ${fixture.away}
Liga: ${fixture.liga} | Data: ${fixture.data?.split('T')[0]} | Status: ${fixture.status}
SELEÇÃO: ${leg.selection} @ odd ${leg.odd}x
════════════════════════════════════════════════════════

▌ ANÁLISE DE VALOR
  Probabilidade real (API Poisson): ${av.prob_real_api}
  Probabilidade implícita na odd ${leg.odd}x: ${av.prob_implicita_odd}
  Edge (diferença): ${av.edge} → ${av.tem_valor === true ? '✅ HÁ VALOR' : av.tem_valor === false ? '❌ SEM VALOR' : 'dados insuficientes'}

▌ PREVISÃO API (Poisson)
${p ? `  Favorito: ${p.favorito}
  Probabilidades: Casa ${p.pct_casa} | Empate ${p.pct_empate} | Fora ${p.pct_fora}
  Gols esperados: Casa ${p.gols_esperados_casa} | Fora ${p.gols_esperados_fora}
  Poisson: Casa ${p.poisson_casa} | Fora ${p.poisson_fora}
  Linha over/under recomendada: ${p.under_over_recomendado}
  Conselho da API: ${p.conselho}
  Força de ataque: Casa ${p.forca_ataque_casa} | Fora ${p.forca_ataque_fora}
  Força de defesa: Casa ${p.forca_defesa_casa} | Fora ${p.forca_defesa_fora}
  Forma comparativa: Casa ${p.forma_comparativa_casa} | Fora ${p.forma_comparativa_fora}
  H2H histórico (API): Casa ${p.h2h_historico_api_casa} | Fora ${p.h2h_historico_api_fora}` : '  Previsão não disponível para este jogo.'}

▌ TABELA — ${fixture.liga}
${sh ? `  ${fixture.home}: ${sh.posicao}º lugar | ${sh.pontos}pts | ${sh.jogos}J ${sh.vitorias}V ${sh.empates}E ${sh.derrotas}D | Saldo ${sh.saldo > 0 ? '+' : ''}${sh.saldo} | Forma: ${sh.forma ?? 'N/D'} | ${sh.status ?? ''}
  Em casa: ${sh.em_casa.jogos}J ${sh.em_casa.vitorias}V ${sh.em_casa.empates}E ${sh.em_casa.derrotas}D | ${sh.em_casa.gols_pro} gols marcados / ${sh.em_casa.gols_contra} sofridos` : `  ${fixture.home}: não disponível`}
${sa ? `  ${fixture.away}: ${sa.posicao}º lugar | ${sa.pontos}pts | ${sa.jogos}J ${sa.vitorias}V ${sa.empates}E ${sa.derrotas}D | Saldo ${sa.saldo > 0 ? '+' : ''}${sa.saldo} | Forma: ${sa.forma ?? 'N/D'} | ${sa.status ?? ''}
  Fora de casa: ${sa.fora_de_casa.jogos}J ${sa.fora_de_casa.vitorias}V ${sa.fora_de_casa.empates}E ${sa.fora_de_casa.derrotas}D | ${sa.fora_de_casa.gols_pro} gols marcados / ${sa.fora_de_casa.gols_contra} sofridos` : `  ${fixture.away}: não disponível`}

▌ ESTATÍSTICAS DA TEMPORADA
${data.stats_temporada.casa ?? `  ${fixture.home}: não disponível`}
${data.stats_temporada.fora ?? `  ${fixture.away}: não disponível`}

▌ H2H — ${h2h.total} confrontos históricos
${h2h.total > 0
  ? `  ${fixture.home} venceu: ${h2h.vitorias_casa}x | Empates: ${h2h.empates}x | ${fixture.away} venceu: ${h2h.vitorias_fora}x
  Média de gols/jogo: ${h2h.media_gols} | Over 2.5: ${h2h.pct_over25} dos jogos | BTTS: ${h2h.pct_btts} dos jogos
${h2h.historico.join('\n')}`
  : '  Histórico não disponível'}

▌ FORMA RECENTE — ${fixture.home}
${fc.resumo}
  Últimas 5 partidas:
${fc.partidas.length > 0 ? fc.partidas.join('\n') : '  Não disponível'}

▌ FORMA RECENTE — ${fixture.away}
${ff.resumo}
  Últimas 5 partidas:
${ff.partidas.length > 0 ? ff.partidas.join('\n') : '  Não disponível'}

▌ ODDS DE MERCADO (${odds.casas_disponiveis} casas)
${odds.match_winner ? `  Match Winner — Média das casas:
    Casa: ${odds.match_winner.media_casa} (prob implícita ${odds.match_winner.prob_implicita_casa}) | Empate: ${odds.match_winner.media_empate} (${odds.match_winner.prob_implicita_empate}) | Fora: ${odds.match_winner.media_fora} (${odds.match_winner.prob_implicita_fora})` : ''}
${odds.over_under_25 ? `  Over/Under 2.5 — Over: ${odds.over_under_25.media_over} | Under: ${odds.over_under_25.media_under}` : ''}
${odds.over_under_15 ? `  Over/Under 1.5 — Over: ${odds.over_under_15.media_over} | Under: ${odds.over_under_15.media_under}` : ''}
${odds.btts ? `  BTTS (Ambas marcam) — Sim: ${odds.btts.media_sim} | Não: ${odds.btts.media_nao}` : ''}
${odds.double_chance ? `  Double Chance — 1X (casa ou empate): ${odds.double_chance.media_1x} | X2 (empate ou fora): ${odds.double_chance.media_x2}` : ''}
${odds.por_casa.length > 0 ? `\n  ODD DO APOSTADOR: ${leg.odd}x para "${leg.selection}"\n  Por casa de apostas (⚡ = casa sharp/indicador de mercado):\n${odds.por_casa.slice(0, 14).join('\n')}` : ''}

▌ ESCANTEIOS — MÉDIAS REAIS (últimos 5 jogos encerrados)
${mj.casa ? `  ${fixture.home}: ${mj.casa.escanteios.media_pro} escanteios/jogo a favor | ${mj.casa.escanteios.media_oponente} do oponente | Total médio no jogo: ${mj.casa.escanteios.media_total_jogo} (${mj.casa.jogos_analisados} jogos)` : `  ${fixture.home}: dados insuficientes`}
${mj.fora ? `  ${fixture.away}: ${mj.fora.escanteios.media_pro} escanteios/jogo a favor | ${mj.fora.escanteios.media_oponente} do oponente | Total médio no jogo: ${mj.fora.escanteios.media_total_jogo} (${mj.fora.jogos_analisados} jogos)` : `  ${fixture.away}: dados insuficientes`}
${mj.casa && mj.fora ? `  TOTAL ESPERADO COMBINADO (soma das médias pró de cada time): ${(parseFloat(mj.casa.escanteios.media_pro) + parseFloat(mj.fora.escanteios.media_pro)).toFixed(1)} escanteios` : ''}

▌ CARTÕES — MÉDIAS REAIS
${mj.casa ? `  ${fixture.home} (últimos ${mj.casa.jogos_analisados} jogos): ${mj.casa.cartoesAmarelos.media_pro} amarelos/jogo | ${mj.casa.cartoesVermelhos.media_pro} vermelhos/jogo` : `  ${fixture.home}: dados insuficientes`}
${mj.fora ? `  ${fixture.away} (últimos ${mj.fora.jogos_analisados} jogos): ${mj.fora.cartoesAmarelos.media_pro} amarelos/jogo | ${mj.fora.cartoesVermelhos.media_pro} vermelhos/jogo` : `  ${fixture.away}: dados insuficientes`}
${ct.casa ? `  ${fixture.home} temporada inteira: ${ct.casa.amarelos_total} amarelos (${ct.casa.media_amarelos_jogo}/jogo) | ${ct.casa.vermelhos_total} vermelhos (${ct.casa.media_vermelhos_jogo}/jogo)` : ''}
${ct.fora ? `  ${fixture.away} temporada inteira: ${ct.fora.amarelos_total} amarelos (${ct.fora.media_amarelos_jogo}/jogo) | ${ct.fora.vermelhos_total} vermelhos (${ct.fora.media_vermelhos_jogo}/jogo)` : ''}
${mj.casa && mj.fora ? `  TOTAL AMARELOS ESPERADO (soma das médias): ${(parseFloat(mj.casa.cartoesAmarelos.media_pro) + parseFloat(mj.fora.cartoesAmarelos.media_pro)).toFixed(1)} amarelos` : ''}

▌ xG E CHUTES — MÉDIAS REAIS (últimos 5 jogos)
${mj.casa ? `  ${fixture.home}: xG ${mj.casa.xg.media_pro}/jogo | Chutes ao gol: ${mj.casa.chutes.media_ao_gol}/jogo | Chutes totais: ${mj.casa.chutes.media_total}/jogo` : `  ${fixture.home}: dados insuficientes`}
${mj.fora ? `  ${fixture.away}: xG ${mj.fora.xg.media_pro}/jogo | Chutes ao gol: ${mj.fora.chutes.media_ao_gol}/jogo | Chutes totais: ${mj.fora.chutes.media_total}/jogo` : `  ${fixture.away}: dados insuficientes`}

▌ ESCALAÇÃO
${escH ? `  ${fixture.home} (${escH.formacao}) | Técnico: ${escH.tecnico ?? 'N/D'}
  Titulares: ${escH.titulares?.join(', ') ?? 'N/D'}` : `  ${fixture.home}: escalação não confirmada`}
${escA ? `  ${fixture.away} (${escA.formacao}) | Técnico: ${escA.tecnico ?? 'N/D'}
  Titulares: ${escA.titulares?.join(', ') ?? 'N/D'}` : `  ${fixture.away}: escalação não confirmada`}

▌ DESFALQUES E LESÕES
${data.lesoes.length > 0 ? data.lesoes.map((l: string) => `  ⛔ ${l}`).join('\n') : '  Nenhum desfalque registrado'}

${data.stats_jogo ? `▌ ESTATÍSTICAS DO JOGO (já encerrado)
  Chutes a gol: ${fixture.home} ${data.stats_jogo.chutes_gol.casa} | ${fixture.away} ${data.stats_jogo.chutes_gol.fora}
  Chutes totais: ${fixture.home} ${data.stats_jogo.chutes_total.casa} | ${fixture.away} ${data.stats_jogo.chutes_total.fora}
  Posse de bola: ${fixture.home} ${data.stats_jogo.posse.casa} | ${fixture.away} ${data.stats_jogo.posse.fora}
  Escanteios: ${fixture.home} ${data.stats_jogo.escanteios.casa} | ${fixture.away} ${data.stats_jogo.escanteios.fora}
  Cartões amarelos: ${fixture.home} ${data.stats_jogo.amarelos.casa} | ${fixture.away} ${data.stats_jogo.amarelos.fora}
  Defesas do goleiro: ${fixture.home} ${data.stats_jogo.defesas.casa} | ${fixture.away} ${data.stats_jogo.defesas.fora}` : ''}
`.trim()
  }).join('\n\n')

  // ── PASSO 4: Análise profunda com Claude ──
  const prompt = `Você é um analista quantitativo de apostas esportivas, especialista em detecção de valor e gestão de banca. Analise este bilhete com profundidade usando EXCLUSIVAMENTE os dados reais abaixo.

REGRAS ABSOLUTAS:
1. Use APENAS dados dos blocos abaixo — NUNCA invente estatísticas
2. "DADOS INSUFICIENTES" somente se previsão, tabela, forma E médias estiverem TODOS indisponíveis
3. Para escanteios: use bloco "ESCANTEIOS — MÉDIAS REAIS". Para cartões: use bloco "CARTÕES — MÉDIAS REAIS"
4. Se dados de escanteios/cartões forem indisponíveis, diga isso claramente no ponto correspondente

FORMATO DOS PONTOS (campo "pontos"):
- Gere 4 a 6 bullets curtos, cada um começando com um emoji relevante
- Cada bullet: máximo 1 linha, direto ao ponto, com número real quando disponível
- Emojis sugeridos por tipo de dado:
  📊 probabilidade/edge  📋 tabela/posição  📉 forma recente  🔁 H2H
  🤕 desfalques/lesões   ⚽ gols/xG         🟨 cartões         🚩 escanteios
  ⚡ odds sharp          ✅ favorável        ❌ desfavorável
- "veredicto": 1 frase ultra-curta tipo "Apostar com cautela" ou "Não apostar" ou "Boa aposta"

CONTEXTO DO APOSTADOR:
Banca: R$ ${bankroll.toFixed(2)}
Odd total do bilhete: ${ticketData.total_odd ?? 'não identificada'}
Stake apostado: ${ticketData.stake ? `R$ ${ticketData.stake}` : 'não identificado'}
Retorno potencial: ${ticketData.total_odd && ticketData.stake ? `R$ ${(ticketData.total_odd * ticketData.stake).toFixed(2)}` : 'não calculável'}

${jogosTexto}

Retorne APENAS este JSON (sem nenhum texto fora do JSON):
{
  "legs": [
    {
      "jogo": "Time A vs Time B",
      "selecao": "seleção exata do apostador",
      "odd": 2.00,
      "avaliacao": "FAVORÁVEL | NEUTRO | DESFAVORÁVEL | DADOS INSUFICIENTES",
      "confianca": "alta | média | baixa | sem dados",
      "prob_real": "X% (da API)",
      "prob_implicita_odd": "X% (da odd do apostador)",
      "edge": "+Xpp (há valor) OU -Xpp (sem valor)",
      "pontos": [
        "📊 Probabilidade real: 45% vs implícita da odd: 50% → edge -5pp (sem valor)",
        "📋 Tabela: 16º lugar, 29pts, aproveitamento 20%, ameaçado de rebaixamento",
        "📉 Forma: 2V 4E 8D fora de casa na temporada, sofrendo 2.2 gols/jogo",
        "🔁 H2H: 3 vitórias, 2 empates, 0 derrotas — mas último jogo terminou 0x0",
        "🤕 Desfalques: Arnold, Dardai, Fischer, Rogerio, Seelt, Wimmer, Wind (7 fora)"
      ],
      "veredicto": "Não apostar — odd sem valor e time em má fase",
      "alerta": "alerta crítico em 1 frase curta — ou null",
      "valor_detectado": false
    }
  ],
  "resumo": {
    "jogos_favoraveis": 0,
    "jogos_neutros": 0,
    "jogos_desfavoraveis": 0,
    "jogos_sem_dados": 0,
    "probabilidade_combinada": "X% (produto das probabilidades reais de cada perna — calcule apenas se TODAS tiverem prob_real disponível)",
    "probabilidade_implicita_bilhete": "X% (1 / odd_total)",
    "odd_total": 4.00,
    "tem_valor": true,
    "nota_geral": "7/10",
    "parecer": "1 frase curta e direta: ex: 'Bilhete de alto risco — duas seleções sem valor, não recomendado.'"
  },
  "gestao_banca": {
    "stake_sugerido": 25.00,
    "percentual_banca": "5%",
    "raciocinio": "1 frase curta: ex: 'Edge negativo nas duas pernas — aposte no máximo 2% da banca se for seguir.'"
  },
  "alertas_gerais": ["alertas críticos do bilhete inteiro — odds sharp divergentes, acúmulo de seleções desfavoráveis, banca em risco, etc."]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Sem JSON na resposta')

    const analysis = JSON.parse(jsonMatch[0])

    if (!isPro) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('profiles').update({ avaliacoes_gratuitas: avaliacoesUsadas + 1 }).eq('id', user.id)
    }

    return NextResponse.json({ success: true, ticket: ticketData, analysis })
  } catch (err) {
    console.error('[bilhete/avaliar]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Erro ao analisar bilhete. Tente novamente.' }, { status: 500 })
  }
}
