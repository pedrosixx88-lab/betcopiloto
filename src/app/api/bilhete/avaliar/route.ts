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
  getStandings,
} from '@/lib/api-football'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!rateLimit(`avaliar:${user.id}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Aguarde alguns minutos.' }, { status: 429 })
  }

  // Gate: exclusivo Pro
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, current_bankroll')
    .eq('id', user.id)
    .single<{ plan: string; plan_expires_at: string | null; current_bankroll: number }>()

  const isPro = profile?.plan === 'pro' &&
    (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date())
  if (!isPro) {
    return NextResponse.json({ error: 'upgrade_required', message: 'O avaliador de bilhete é exclusivo do plano Pro.' }, { status: 403 })
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

  // PASSO 1 — Extrair jogos do bilhete via Vision
  const extractRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `Extraia os jogos deste bilhete de apostas. Retorne APENAS JSON no formato:
{
  "total_odd": 8.50,
  "stake": 50.00,
  "legs": [
    {
      "home_team": "Flamengo",
      "away_team": "Vasco",
      "selection": "Flamengo vence",
      "market": "match_winner",
      "odd": 1.80,
      "match_date": "2026-05-25"
    }
  ]
}
Se não conseguir identificar stake ou total_odd, use null.
market deve ser: match_winner | over_under | both_teams_score | handicap | corners | cards | correct_score | other`,
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

  const bankroll = profile?.current_bankroll ?? 0
  const season = new Date().getFullYear()

  // PASSO 2 — Buscar dados reais para cada jogo em paralelo
  const legsWithData = await Promise.all(
    ticketData.legs.map(async (leg) => {
      try {
        const fixture = await searchFixture(leg.home_team, leg.away_team, leg.match_date)
        if (!fixture) return { leg, data: null, reason: 'Jogo não encontrado na API' }

        const fid = fixture.fixture.id
        const homeId = fixture.teams.home.id
        const awayId = fixture.teams.away.id
        const leagueId = fixture.league.id

        // Busca paralela de TODOS os dados disponíveis
        const [predictions, lineups, injuries, fixtureStats, homeStandings, awayStandings] = await Promise.allSettled([
          getFixturePredictions(fid),
          getFixtureLineups(fid),
          getFixtureInjuries(fid),
          getFixtureStats(fid),
          getStandings(leagueId, season),
          getStandings(leagueId, season), // mesmo endpoint — compartilhado abaixo
        ])

        const pred = predictions.status === 'fulfilled' ? predictions.value : null
        const lu = lineups.status === 'fulfilled' ? lineups.value : []
        const inj = injuries.status === 'fulfilled' ? injuries.value : []
        const stats = fixtureStats.status === 'fulfilled' ? fixtureStats.value : []
        const standingsRaw = homeStandings.status === 'fulfilled' ? homeStandings.value : []

        // Encontrar posição na tabela dos dois times
        const allStandings: any[] = []
        standingsRaw.forEach((group: any) => {
          if (Array.isArray(group)) allStandings.push(...group)
          else if (group?.standings) group.standings.forEach((s: any[]) => allStandings.push(...s))
        })

        const findTeamStanding = (teamId: number) =>
          allStandings.find((s: any) => s.team?.id === teamId)

        const homeStanding = findTeamStanding(homeId)
        const awayStanding = findTeamStanding(awayId)

        // Lesões relevantes
        const injuriesFormatted = inj.map((p: any) => ({
          player: p.player?.name,
          team: p.team?.name,
          type: p.type ?? 'Indisponível',
          reason: p.reason ?? null,
        }))

        // Escalações
        const homeLineup = lu.find((l: any) => l.team?.id === homeId)
        const awayLineup = lu.find((l: any) => l.team?.id === awayId)

        // Estatísticas do fixture (se jogo já aconteceu)
        const getTeamStat = (teamId: number, statType: string) => {
          const t = stats.find((s: any) => s.team?.id === teamId)
          return t?.statistics?.find((s: any) => s.type === statType)?.value ?? null
        }

        return {
          leg,
          fixture: {
            id: fid,
            home: fixture.teams.home.name,
            away: fixture.teams.away.name,
            league: fixture.league.name,
            date: fixture.fixture.date,
            status: fixture.fixture.status.long,
          },
          data: {
            predictions: pred ? {
              winner: pred.predictions?.winner?.name ?? null,
              percent: pred.predictions?.percent ?? null,
              advice: pred.predictions?.advice ?? null,
              goals_home: pred.predictions?.goals?.home ?? null,
              goals_away: pred.predictions?.goals?.away ?? null,
              under_over: pred.predictions?.under_over ?? null,
              win_or_draw: pred.predictions?.win_or_draw ?? null,
              comparison: pred.comparison ?? null,
            } : null,
            standings: {
              home: homeStanding ? {
                position: homeStanding.rank,
                points: homeStanding.points,
                played: homeStanding.all?.played,
                won: homeStanding.all?.win,
                drawn: homeStanding.all?.draw,
                lost: homeStanding.all?.lose,
                goals_for: homeStanding.all?.goals?.for,
                goals_against: homeStanding.all?.goals?.against,
                form: homeStanding.form,
                description: homeStanding.description ?? null,
              } : null,
              away: awayStanding ? {
                position: awayStanding.rank,
                points: awayStanding.points,
                played: awayStanding.all?.played,
                won: awayStanding.all?.win,
                drawn: awayStanding.all?.draw,
                lost: awayStanding.all?.lose,
                goals_for: awayStanding.all?.goals?.for,
                goals_against: awayStanding.all?.goals?.against,
                form: awayStanding.form,
                description: awayStanding.description ?? null,
              } : null,
            },
            lineups: {
              home: homeLineup ? {
                formation: homeLineup.formation,
                coach: homeLineup.coach?.name,
                starters: homeLineup.startXI?.map((p: any) => `${p.player?.name} (${p.player?.pos})`),
              } : null,
              away: awayLineup ? {
                formation: awayLineup.formation,
                coach: awayLineup.coach?.name,
                starters: awayLineup.startXI?.map((p: any) => `${p.player?.name} (${p.player?.pos})`),
              } : null,
            },
            injuries: injuriesFormatted,
            fixture_stats: stats.length > 0 ? {
              home_shots_on: getTeamStat(homeId, 'Shots on Goal'),
              away_shots_on: getTeamStat(awayId, 'Shots on Goal'),
              home_corners: getTeamStat(homeId, 'Corner Kicks'),
              away_corners: getTeamStat(awayId, 'Corner Kicks'),
              home_possession: getTeamStat(homeId, 'Ball Possession'),
              away_possession: getTeamStat(awayId, 'Ball Possession'),
              home_yellow: getTeamStat(homeId, 'Yellow Cards'),
              away_yellow: getTeamStat(awayId, 'Yellow Cards'),
              home_saves: getTeamStat(homeId, 'Goalkeeper Saves'),
              away_saves: getTeamStat(awayId, 'Goalkeeper Saves'),
            } : null,
          },
        }
      } catch {
        return { leg, data: null, reason: 'Erro ao buscar dados' }
      }
    })
  )

  // PASSO 3 — Montar prompt com TODOS os dados reais para o Claude analisar
  const jogosTexto = legsWithData.map((item, i) => {
    const { leg, fixture, data } = item as any
    if (!data) return `JOGO ${i + 1}: ${leg.home_team} vs ${leg.away_team}\nSELEÇÃO: ${leg.selection} @ ${leg.odd}\n⚠️ Dados não disponíveis na API para este jogo.\n`

    const p = data.predictions
    const sh = data.standings.home
    const sa = data.standings.away
    const lh = data.lineups.home
    const la = data.lineups.away
    const inj = data.injuries
    const fs = data.fixture_stats

    return `
════════════════════════════════════
JOGO ${i + 1}: ${fixture.home} vs ${fixture.away}
Liga: ${fixture.league} | Data: ${fixture.date?.split('T')[0]}
SELEÇÃO DO APOSTADOR: ${leg.selection} @ ${leg.odd}x
════════════════════════════════════

PREVISÃO DA API (dados reais, distribuição Poisson):
${p ? `
  Favorito: ${p.winner ?? 'N/D'}
  % Vitória casa: ${p.percent?.home ?? 'N/D'}
  % Empate: ${p.percent?.draw ?? 'N/D'}
  % Vitória fora: ${p.percent?.away ?? 'N/D'}
  Distribuição Poisson: casa ${p.comparison?.poisson_distribution?.home ?? 'N/D'} | fora ${p.comparison?.poisson_distribution?.away ?? 'N/D'}
  Gols esperados: casa ${p.goals_home ?? 'N/D'} | fora ${p.goals_away ?? 'N/D'}
  Under/Over: ${p.under_over ?? 'N/D'}
  Conselho: ${p.advice ?? 'N/D'}
  Forma recente: casa ${p.comparison?.form?.home ?? 'N/D'} | fora ${p.comparison?.form?.away ?? 'N/D'}
  Força de ataque: casa ${p.comparison?.att?.home ?? 'N/D'} | fora ${p.comparison?.att?.away ?? 'N/D'}
  Força de defesa: casa ${p.comparison?.def?.home ?? 'N/D'} | fora ${p.comparison?.def?.away ?? 'N/D'}
  H2H (histórico): casa ${p.comparison?.h2h?.home ?? 'N/D'} | fora ${p.comparison?.h2h?.away ?? 'N/D'}
  Gols marcados (temporada): casa ${p.comparison?.goals?.home ?? 'N/D'} | fora ${p.comparison?.goals?.away ?? 'N/D'}
` : '  Dados de previsão não disponíveis para este jogo.'}

POSIÇÃO NA TABELA:
${sh ? `  ${fixture.home}: ${sh.position}º lugar | ${sh.points} pts | ${sh.played} jogos | ${sh.won}V ${sh.drawn}E ${sh.lost}D | Gols: ${sh.goals_for} marcados, ${sh.goals_against} sofridos | Forma: ${sh.form ?? 'N/D'}` : `  ${fixture.home}: dados de tabela não disponíveis`}
${sa ? `  ${fixture.away}: ${sa.position}º lugar | ${sa.points} pts | ${sa.played} jogos | ${sa.won}V ${sa.drawn}E ${sa.lost}D | Gols: ${sa.goals_for} marcados, ${sa.goals_against} sofridos | Forma: ${sa.form ?? 'N/D'}` : `  ${fixture.away}: dados de tabela não disponíveis`}

ESCALAÇÃO CONFIRMADA:
${lh ? `  ${fixture.home} (${lh.formation}) | Técnico: ${lh.coach ?? 'N/D'}
  Titulares: ${lh.starters?.join(', ') ?? 'N/D'}` : `  ${fixture.home}: escalação não confirmada ainda`}
${la ? `  ${fixture.away} (${la.formation}) | Técnico: ${la.coach ?? 'N/D'}
  Titulares: ${la.starters?.join(', ') ?? 'N/D'}` : `  ${fixture.away}: escalação não confirmada ainda`}

DESFALQUES E LESÕES:
${inj.length > 0 ? inj.map((p: any) => `  ⛔ ${p.player} (${p.team})${p.reason ? ` — ${p.reason}` : ''}`).join('\n') : '  Nenhum desfalque registrado na API'}

${fs ? `ESTATÍSTICAS DO JOGO (jogo já aconteceu):
  Chutes a gol: ${fixture.home} ${fs.home_shots_on} | ${fixture.away} ${fs.away_shots_on}
  Escanteios: ${fixture.home} ${fs.home_corners} | ${fixture.away} ${fs.away_corners}
  Posse: ${fixture.home} ${fs.home_possession} | ${fixture.away} ${fs.away_possession}
  Cartões amarelos: ${fixture.home} ${fs.home_yellow} | ${fixture.away} ${fs.away_yellow}
  Defesas do goleiro: ${fixture.home} ${fs.home_saves} | ${fixture.away} ${fs.away_saves}` : ''}
`.trim()
  }).join('\n\n')

  const prompt = `Você é um analista esportivo especialista em apostas. Analise este bilhete múltiplo com os dados REAIS fornecidos.

⚠️ REGRA ABSOLUTA: Use APENAS os dados fornecidos abaixo. Se um dado aparecer como "N/D" ou "não disponível", diga exatamente isso. JAMAIS invente ou estime números que não estejam nos dados.

BANCA DO APOSTADOR: R$ ${bankroll.toFixed(2)}
ODD TOTAL DO BILHETE: ${ticketData.total_odd ?? 'não identificada'}
VALOR APOSTADO: ${ticketData.stake ? `R$ ${ticketData.stake}` : 'não identificado'}
RETORNO POTENCIAL: ${ticketData.total_odd && ticketData.stake ? `R$ ${(ticketData.total_odd * ticketData.stake).toFixed(2)}` : 'não calculável'}

${jogosTexto}

Retorne APENAS este JSON (sem texto fora do JSON):
{
  "legs": [
    {
      "jogo": "Time A vs Time B",
      "selecao": "seleção do apostador",
      "odd": 1.80,
      "avaliacao": "FAVORÁVEL | NEUTRO | DESFAVORÁVEL | DADOS INSUFICIENTES",
      "confianca": "alta | média | baixa | sem dados",
      "justificativa": "2-3 frases com dados REAIS dos campos acima — se dado indisponível, diga explicitamente",
      "alerta": "alerta específico se houver desfalque importante, forma ruim ou divergência com a seleção — null se não houver"
    }
  ],
  "resumo": {
    "jogos_favoraveis": 0,
    "jogos_neutros": 0,
    "jogos_desfavoraveis": 0,
    "jogos_sem_dados": 0,
    "probabilidade_estimada": "X% (baseado nas % da API — só calcule se todos os jogos tiverem dados de predictions)",
    "odd_total": 8.50,
    "tem_valor": true,
    "nota_geral": "7/10",
    "parecer": "2-3 frases sobre a qualidade geral da múltipla com base nos dados reais"
  },
  "gestao_banca": {
    "stake_sugerido": 25.00,
    "percentual_banca": "7%",
    "raciocinio": "justificativa baseada na qualidade das seleções e banca disponível"
  },
  "alertas_gerais": ["lista de alertas importantes sobre o bilhete como um todo"]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Sem JSON na resposta')

    const analysis = JSON.parse(jsonMatch[0])
    return NextResponse.json({ success: true, ticket: ticketData, analysis })
  } catch (err) {
    console.error('[bilhete/avaliar]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Erro ao analisar bilhete. Tente novamente.' }, { status: 500 })
  }
}
