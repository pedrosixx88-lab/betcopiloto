const BASE = 'https://v3.football.api-sports.io'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! },
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
    status: { short: string; long: string; elapsed: number | null }
  }
  league: { id: number; name: string; country: string; logo: string; flag: string | null; round: string }
  teams: {
    home: { id: number; name: string; logo: string }
    away: { id: number; name: string; logo: string }
  }
  goals: { home: number | null; away: number | null }
  score: { fulltime: { home: number | null; away: number | null } }
}

export interface TeamForm {
  team: { id: number; name: string }
  form: string // ex: "WWLDW"
  fixtures: { played: { total: number }; wins: { total: number }; draws: { total: number }; loses: { total: number } }
  goals: { for: { total: { total: number }; average: { total: string } }; against: { total: { total: number }; average: { total: string } } }
}

export interface H2HFixture extends Fixture {}

// IDs das principais ligas brasileiras e europeias
export const FEATURED_LEAGUES = [
  { id: 71, name: 'Brasileirão Série A', country: 'Brazil' },
  { id: 72, name: 'Brasileirão Série B', country: 'Brazil' },
  { id: 73, name: 'Copa do Brasil', country: 'Brazil' },
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 140, name: 'La Liga', country: 'Spain' },
  { id: 135, name: 'Serie A', country: 'Italy' },
  { id: 78, name: 'Bundesliga', country: 'Germany' },
  { id: 61, name: 'Ligue 1', country: 'France' },
  { id: 2, name: 'Champions League', country: 'Europe' },
  { id: 3, name: 'Europa League', country: 'Europe' },
]

export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  return apiFetch<Fixture[]>(`/fixtures?date=${date}&timezone=America/Sao_Paulo`)
}

export async function getFixturesByLeagueAndDate(leagueId: number, date: string): Promise<Fixture[]> {
  return apiFetch<Fixture[]>(`/fixtures?league=${leagueId}&date=${date}&timezone=America/Sao_Paulo`)
}

export async function getFixtureById(id: number): Promise<Fixture | null> {
  const data = await apiFetch<Fixture[]>(`/fixtures?id=${id}`)
  return data[0] ?? null
}

export async function getTeamStats(teamId: number, leagueId: number, season: number): Promise<TeamForm | null> {
  const data = await apiFetch<TeamForm[]>(`/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`)
  return (data as unknown as TeamForm) ?? null
}

export async function getH2H(homeId: number, awayId: number): Promise<H2HFixture[]> {
  return apiFetch<H2HFixture[]>(`/fixtures/headtohead?h2h=${homeId}-${awayId}&last=5`)
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

export function resolveMatchWinner(fixture: Fixture, selection: string, market: string): 'won' | 'lost' | 'void' | null {
  const status = fixture.fixture.status.short
  if (!['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(status)) return null

  const homeGoals = fixture.score.fulltime.home ?? fixture.goals.home
  const awayGoals = fixture.score.fulltime.away ?? fixture.goals.away
  if (homeGoals === null || awayGoals === null) return 'void'

  const sel = selection.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const homeTeam = fixture.teams.home.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const awayTeam = fixture.teams.away.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  if (market === 'match_winner') {
    if (homeGoals > awayGoals) return sel.includes(homeTeam) || sel.includes('casa') || sel === '1' ? 'won' : 'lost'
    if (awayGoals > homeGoals) return sel.includes(awayTeam) || sel.includes('fora') || sel === '2' ? 'won' : 'lost'
    return sel.includes('empate') || sel === 'x' || sel === 'draw' ? 'won' : 'lost'
  }

  if (market === 'over_under') {
    const total = homeGoals + awayGoals
    const lineMatch = sel.match(/(\d+\.?\d*)/)
    if (!lineMatch) return 'void'
    const line = parseFloat(lineMatch[1])
    return (sel.includes('over') || sel.includes('mais') || sel.includes('+'))
      ? total > line ? 'won' : 'lost'
      : total < line ? 'won' : 'lost'
  }

  if (market === 'both_teams_score') {
    const btts = homeGoals > 0 && awayGoals > 0
    return (sel.includes('sim') || sel.includes('yes')) ? (btts ? 'won' : 'lost') : (!btts ? 'won' : 'lost')
  }

  return null
}
