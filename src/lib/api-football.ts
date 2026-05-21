const BASE = 'https://v3.football.api-sports.io'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'x-apisports-key': process.env.API_FOOTBALL_KEY!,
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`)
  const json = await res.json()
  return json.response as T
}

export interface Fixture {
  fixture: {
    id: number
    date: string
    status: { short: string; elapsed: number | null }
  }
  teams: {
    home: { id: number; name: string }
    away: { id: number; name: string }
  }
  goals: { home: number | null; away: number | null }
  score: {
    fulltime: { home: number | null; away: number | null }
  }
}

export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  return apiFetch<Fixture[]>(`/fixtures?date=${date}&timezone=America/Sao_Paulo`)
}

export async function getFixtureById(id: number): Promise<Fixture | null> {
  const data = await apiFetch<Fixture[]>(`/fixtures?id=${id}`)
  return data[0] ?? null
}

export async function searchFixture(homeTeam: string, awayTeam: string, date: string): Promise<Fixture | null> {
  const fixtures = await getFixturesByDate(date)
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const home = normalize(homeTeam)
  const away = normalize(awayTeam)

  return fixtures.find(f => {
    const fHome = normalize(f.teams.home.name)
    const fAway = normalize(f.teams.away.name)
    return (fHome.includes(home) || home.includes(fHome)) &&
           (fAway.includes(away) || away.includes(fAway))
  }) ?? null
}

// Determina se uma aposta foi won/lost/void com base no resultado
export function resolveMatchWinner(fixture: Fixture, selection: string, market: string): 'won' | 'lost' | 'void' | null {
  const status = fixture.fixture.status.short
  // Jogo não terminou
  if (!['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(status)) return null

  const homeGoals = fixture.score.fulltime.home ?? fixture.goals.home
  const awayGoals = fixture.score.fulltime.away ?? fixture.goals.away

  if (homeGoals === null || awayGoals === null) return 'void'

  const sel = selection.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const homeTeam = fixture.teams.home.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const awayTeam = fixture.teams.away.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  if (market === 'match_winner') {
    if (homeGoals > awayGoals) {
      return sel.includes(homeTeam) || sel.includes('casa') || sel === '1' ? 'won' : 'lost'
    } else if (awayGoals > homeGoals) {
      return sel.includes(awayTeam) || sel.includes('fora') || sel === '2' ? 'won' : 'lost'
    } else {
      return sel.includes('empate') || sel === 'x' || sel === 'draw' ? 'won' : 'lost'
    }
  }

  if (market === 'over_under') {
    const total = homeGoals + awayGoals
    const lineMatch = sel.match(/(\d+\.?\d*)/)
    if (!lineMatch) return 'void'
    const line = parseFloat(lineMatch[1])
    if (sel.includes('over') || sel.includes('mais') || sel.includes('+')) {
      return total > line ? 'won' : 'lost'
    } else {
      return total < line ? 'won' : 'lost'
    }
  }

  if (market === 'both_teams_score') {
    const btts = homeGoals > 0 && awayGoals > 0
    return (sel.includes('sim') || sel.includes('yes')) ? (btts ? 'won' : 'lost') : (!btts ? 'won' : 'lost')
  }

  // Para mercados complexos (handicap, placar exato, other) retorna null — requer atualização manual
  return null
}
