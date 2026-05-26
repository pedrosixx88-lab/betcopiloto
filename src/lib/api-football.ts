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
  league: { id: number; name: string; country: string; logo: string; flag: string | null; round: string; season: number }
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

// IDs das principais ligas — foco no apostador brasileiro
export const FEATURED_LEAGUES = [
  // Brasil
  { id: 71, name: 'Brasileirão Série A', country: 'Brasil' },
  { id: 72, name: 'Brasileirão Série B', country: 'Brasil' },
  { id: 73, name: 'Copa do Brasil', country: 'Brasil' },
  { id: 75, name: 'Brasileirão Série C', country: 'Brasil' },
  { id: 76, name: 'Brasileirão Série D', country: 'Brasil' },
  // América do Sul
  { id: 13, name: 'Libertadores', country: 'América do Sul' },
  { id: 11, name: 'Sul-Americana', country: 'América do Sul' },
  { id: 130, name: 'Recopa Sudamericana', country: 'América do Sul' },
  // Argentina
  { id: 128, name: 'Liga Profesional', country: 'Argentina' },
  // Europa — elite
  { id: 2, name: 'Champions League', country: 'Europa' },
  { id: 3, name: 'Europa League', country: 'Europa' },
  { id: 848, name: 'Conference League', country: 'Europa' },
  { id: 39, name: 'Premier League', country: 'Inglaterra' },
  { id: 140, name: 'La Liga', country: 'Espanha' },
  { id: 135, name: 'Serie A', country: 'Itália' },
  { id: 78, name: 'Bundesliga', country: 'Alemanha' },
  { id: 61, name: 'Ligue 1', country: 'França' },
  { id: 94, name: 'Primeira Liga', country: 'Portugal' },
  // Copas nacionais relevantes
  { id: 40, name: 'FA Cup', country: 'Inglaterra' },
  { id: 137, name: 'Copa del Rey', country: 'Espanha' },
]

export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  const data = await apiFetch<Fixture[]>(`/fixtures?date=${date}&timezone=America/Sao_Paulo`)
  return data ?? []
}

export async function getFixturesByLeagueAndDate(leagueId: number, date: string): Promise<Fixture[]> {
  const data = await apiFetch<Fixture[]>(`/fixtures?league=${leagueId}&date=${date}&timezone=America/Sao_Paulo`)
  return data ?? []
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
  const data = await apiFetch<H2HFixture[]>(`/fixtures/headtohead?h2h=${homeId}-${awayId}&last=10`)
  return data ?? []
}

// Últimas N partidas FINALIZADAS de um time (todas as competições)
// API-Football retorna jogos agendados também sem filtro de status, por isso forçamos FT/AET/PEN
export async function getLastMatches(teamId: number, last = 15): Promise<Fixture[]> {
  const data = await apiFetch<Fixture[]>(`/fixtures?team=${teamId}&last=${last}&status=FT-AET-PEN&timezone=America/Sao_Paulo`)
  if (data && data.length > 0) return data
  // Fallback sem filtro de status — caso a API retorne vazio com filtro
  const fallback = await apiFetch<Fixture[]>(`/fixtures?team=${teamId}&last=${last}&timezone=America/Sao_Paulo`)
  return fallback ?? []
}

// Classificação de liga/grupo — retorna array de standings
export async function getStandings(leagueId: number, season: number): Promise<any[]> {
  const data = await apiFetch<any[]>(`/standings?league=${leagueId}&season=${season}`)
  return data ?? []
}

// Estatísticas do time na liga/temporada
export async function getTeamSeasonStats(teamId: number, leagueId: number, season: number): Promise<any> {
  const data = await apiFetch<any>(`/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`)
  return data ?? null
}

// Odds reais de um fixture (14+ casas de apostas)
export async function getFixtureOdds(fixtureId: number): Promise<any[]> {
  const data = await apiFetch<any[]>(`/odds?fixture=${fixtureId}`)
  return data ?? []
}

// Estatísticas detalhadas de um fixture (escanteios, cartões, posse, chutes)
export async function getFixtureStats(fixtureId: number): Promise<any[]> {
  const data = await apiFetch<any[]>(`/fixtures/statistics?fixture=${fixtureId}`)
  return data ?? []
}

// Estatísticas individuais dos jogadores no fixture (gols, defesas, cartões, assistências)
export async function getFixturePlayers(fixtureId: number): Promise<any[]> {
  const data = await apiFetch<any[]>(`/fixtures/players?fixture=${fixtureId}`)
  return data ?? []
}

// Escalações confirmadas (formação, titulares, técnico)
export async function getFixtureLineups(fixtureId: number): Promise<any[]> {
  const data = await apiFetch<any[]>(`/fixtures/lineups?fixture=${fixtureId}`)
  return data ?? []
}

// Lesões e suspensões para o fixture
export async function getFixtureInjuries(fixtureId: number): Promise<any[]> {
  const data = await apiFetch<any[]>(`/injuries?fixture=${fixtureId}`)
  return data ?? []
}

// Previsão da API: % vitória/empate/derrota, Poisson, comparativo, conselho
export async function getFixturePredictions(fixtureId: number): Promise<any | null> {
  const data = await apiFetch<any[]>(`/predictions?fixture=${fixtureId}`)
  return data?.[0] ?? null
}

// Eventos do jogo (gols, cartões, substituições)
export async function getFixtureEvents(fixtureId: number): Promise<any[]> {
  const data = await apiFetch<any[]>(`/fixtures/events?fixture=${fixtureId}`)
  return data ?? []
}

export async function searchFixture(homeTeam: string, awayTeam: string, date: string): Promise<Fixture | null> {
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[-_.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  // Palavras genéricas removidas ao extrair tokens identificadores do time
  const GENERIC = new Set([
    'fc', 'cf', 'sc', 'ac', 'rc', 'cd', 'sd', 'ca', 'ec', 'se', 'aa', 'ab', 'bk', 'sk', 'cr',
    'club', 'clube', 'sport', 'sporting',
    'atletico', 'atletica', 'athletic', 'athletico',
    'deportivo', 'deportiva',
    'futbol', 'futebol', 'football',
  ])

  // Nome como a IA extrai → nome canônico como a API retorna (normalizado)
  const ALIASES: Record<string, string> = {
    'ldu':                           'ldu quito',
    'ldu de quito':                  'ldu quito',
    'liga de quito':                 'ldu quito',
    'liga deportiva universitaria':  'ldu quito',
    'atletico mg':                   'atletico mineiro',
    'atletico-mg':                   'atletico mineiro',
    'atletico minas':                'atletico mineiro',
    'galo':                          'atletico mineiro',
    'cr flamengo':                   'flamengo',
    'clube de regatas flamengo':     'flamengo',
    'sc internacional':              'internacional',
    'inter':                         'internacional',
    'club bolivar':                  'bolivar',
    'cusco fc':                      'atletico cusco',
    'racing':                        'racing club',
    'river':                         'river plate',
    'boca':                          'boca juniors',
    'santos fc':                     'santos',
    'sport club corinthians':        'corinthians',
    'sociedade esportiva palmeiras': 'palmeiras',
    'spfc':                          'sao paulo',
    'sao paulo fc':                  'sao paulo',
    'gremio fbpa':                   'gremio',
    'vasco da gama':                 'vasco',
    'crvg':                          'vasco',
    'botafogo fr':                   'botafogo',
  }

  const resolveAlias = (name: string): string => {
    const n = normalize(name)
    return ALIASES[n] ?? n
  }

  // Tokens identificadores: filtra genéricos; fallback para todos se tudo for genérico
  const keyTokens = (name: string): string[] => {
    const words = normalize(name).split(' ').filter(w => w.length >= 3)
    const key = words.filter(w => !GENERIC.has(w))
    return key.length > 0 ? key : words
  }

  const teamMatch = (input: string, fixtureName: string): boolean => {
    const inpNorm = normalize(input)
    const fixNorm = normalize(fixtureName)
    const inpAlias = resolveAlias(input)
    const fixAlias = resolveAlias(fixtureName)

    if (inpNorm === fixNorm) return true
    if (inpAlias === fixAlias) return true

    // Um contém o outro (ex: "LDU" está dentro de "LDU Quito")
    if (fixNorm.includes(inpNorm) || inpNorm.includes(fixNorm)) return true
    if (fixNorm.includes(inpAlias) || inpAlias.includes(fixNorm)) return true

    // TODOS os tokens-chave do input devem aparecer no fixture (e vice-versa)
    // Evita falso-positivo entre "Atletico Mineiro" e "Atletico Cusco"
    const inpKey = keyTokens(input)
    const fixKey = keyTokens(fixtureName)
    if (inpKey.length === 0 || fixKey.length === 0) return false
    const inpInFix = inpKey.every(iw => fixKey.some(fw => fw.includes(iw) || iw.includes(fw)))
    const fixInInp = fixKey.every(fw => inpKey.some(iw => iw.includes(fw) || fw.includes(iw)))
    return inpInFix || fixInInp
  }

  // Tenta ordem direta E invertida — na Libertadores o bilhete pode listar o time visitante primeiro
  const findInList = (fixtures: Fixture[]): Fixture | null => {
    const direct = fixtures.find(f =>
      teamMatch(homeTeam, f.teams.home.name) && teamMatch(awayTeam, f.teams.away.name)
    )
    if (direct) return direct
    return fixtures.find(f =>
      teamMatch(homeTeam, f.teams.away.name) && teamMatch(awayTeam, f.teams.home.name)
    ) ?? null
  }

  // Aritmética de datas em UTC para evitar problemas com DST
  const addDays = (n: number): string => {
    const [y, mo, d] = date.split('-').map(Number)
    return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().split('T')[0]
  }

  // 1. Data exata
  const exact = await getFixturesByDate(date)
  const r0 = findInList(exact)
  if (r0) {
    console.log(`[searchFixture] ENCONTRADO (data exata): ${r0.teams.home.name} vs ${r0.teams.away.name}`)
    return r0
  }

  // 2. ±1 dia (diferença de fuso horário)
  const [prev1, next1] = await Promise.all([
    getFixturesByDate(addDays(-1)),
    getFixturesByDate(addDays(1)),
  ])
  const r1 = findInList(prev1) ?? findInList(next1)
  if (r1) {
    console.log(`[searchFixture] ENCONTRADO (±1 dia): ${r1.teams.home.name} vs ${r1.teams.away.name}`)
    return r1
  }

  // 3. ±2 dias
  const [prev2, next2] = await Promise.all([
    getFixturesByDate(addDays(-2)),
    getFixturesByDate(addDays(2)),
  ])
  const r2 = findInList(prev2) ?? findInList(next2)
  if (r2) {
    console.log(`[searchFixture] ENCONTRADO (±2 dias): ${r2.teams.home.name} vs ${r2.teams.away.name}`)
    return r2
  }

  // 4. Fallback: busca por nome do time via /teams?search=
  const searchWord = keyTokens(homeTeam).find(w => w.length >= 4)
    ?? resolveAlias(homeTeam).split(' ').find((w: string) => w.length >= 4)
  if (searchWord) {
    try {
      const teams = await apiFetch<any[]>(`/teams?search=${encodeURIComponent(searchWord)}`)
      if (teams?.length > 0) {
        for (const td of teams.slice(0, 3)) {
          const teamId = td.team?.id
          if (!teamId) continue
          const teamFixtures = await apiFetch<Fixture[]>(
            `/fixtures?team=${teamId}&from=${addDays(-2)}&to=${addDays(2)}&timezone=America/Sao_Paulo`
          )
          if (teamFixtures?.length > 0) {
            const rf = findInList(teamFixtures)
            if (rf) {
              console.log(`[searchFixture] ENCONTRADO (team search "${searchWord}"): ${rf.teams.home.name} vs ${rf.teams.away.name}`)
              return rf
            }
          }
        }
      }
    } catch (e) {
      console.warn('[searchFixture] fallback por team search falhou:', e)
    }
  }

  const sample = [...exact, ...prev1, ...next1]
    .slice(0, 15)
    .map(f => `${f.teams.home.name} vs ${f.teams.away.name}`)
    .join(' | ')
  console.log(`[searchFixture] NÃO ENCONTRADO: "${homeTeam}" vs "${awayTeam}" @ ${date}. Disponíveis: ${sample}`)

  return null
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function statValue(stats: any[], teamName: string, type: string): number {
  const t = stats.find((s: any) => norm(s.team?.name ?? '').includes(norm(teamName)))
  return t?.statistics?.find((s: any) => norm(s.type) === norm(type))?.value ?? 0
}

function totalStat(stats: any[], type: string): number {
  return stats.reduce((sum: number, t: any) => {
    return sum + (t.statistics?.find((s: any) => norm(s.type) === norm(type))?.value ?? 0)
  }, 0)
}

function lineOver(sel: string, actual: number, line: number): 'won' | 'lost' {
  const isOver = sel.includes('over') || sel.includes('mais') || sel.includes('+') || sel.includes('acima')
  return isOver ? (actual > line ? 'won' : 'lost') : (actual < line ? 'won' : 'lost')
}

// Resolver principal — detecta automaticamente o mercado e busca estatísticas quando necessário
export async function resolveWithStats(
  fixture: Fixture,
  selection: string,
  market: string,
  fixtureId: number
): Promise<'won' | 'lost' | 'void' | null> {
  const status = fixture.fixture.status.short
  if (!['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(status)) return null

  const homeGoals = fixture.score.fulltime.home ?? fixture.goals.home
  const awayGoals = fixture.score.fulltime.away ?? fixture.goals.away
  if (homeGoals === null || awayGoals === null) return 'void'

  const sel = norm(selection)
  const home = norm(fixture.teams.home.name)
  const away = norm(fixture.teams.away.name)

  // --- Resultado final ---
  if (market === 'match_winner') {
    if (homeGoals > awayGoals) return sel.includes(home) || sel.includes('casa') || sel === '1' ? 'won' : 'lost'
    if (awayGoals > homeGoals) return sel.includes(away) || sel.includes('fora') || sel === '2' ? 'won' : 'lost'
    return sel.includes('empate') || sel === 'x' || sel === 'draw' ? 'won' : 'lost'
  }

  // --- Over/Under gols ---
  if (market === 'over_under') {
    const total = homeGoals + awayGoals
    const m = sel.match(/(\d+\.?\d*)/)
    if (!m) return 'void'
    return lineOver(sel, total, parseFloat(m[1]))
  }

  // --- Ambas marcam ---
  if (market === 'both_teams_score') {
    const btts = homeGoals > 0 && awayGoals > 0
    return (sel.includes('sim') || sel.includes('yes')) ? (btts ? 'won' : 'lost') : (!btts ? 'won' : 'lost')
  }

  // --- Placar exato ---
  if (market === 'correct_score') {
    const m = sel.match(/(\d+)\s*[x\-:]\s*(\d+)/)
    if (!m) return 'void'
    return homeGoals === parseInt(m[1]) && awayGoals === parseInt(m[2]) ? 'won' : 'lost'
  }

  // --- Handicap ---
  if (market === 'handicap') {
    const m = sel.match(/([+-]?\d+\.?\d*)/)
    if (!m) return 'void'
    const h = parseFloat(m[1])
    const isHome = sel.includes(home) || sel.includes('casa')
    const diff = isHome ? (homeGoals - awayGoals + h) : (awayGoals - homeGoals + h)
    return diff > 0 ? 'won' : diff < 0 ? 'lost' : 'void'
  }

  // --- Mercados com estatísticas do jogo ---
  const wantsCorners = sel.includes('escanteio') || sel.includes('corner') || sel.includes('canto') || market === 'corners'
  const wantsCards   = sel.includes('cartao') || sel.includes('cartoes') || sel.includes('amarelo') || sel.includes('vermelho') || sel.includes('card') || market === 'cards'
  const wantsSaves   = sel.includes('defesa') || sel.includes('save') || sel.includes('goleiro')
  const wantsPlayer  = sel.includes('gol') || sel.includes('marcar') || sel.includes('assistencia') || sel.includes('scorer') || wantsSaves

  if (!wantsCorners && !wantsCards && !wantsSaves && !wantsPlayer) return null

  // Busca paralela de stats e players
  const [fixtureStats, playerStats] = await Promise.all([
    (wantsCorners || wantsCards || wantsSaves) ? getFixtureStats(fixtureId) : Promise.resolve([]),
    wantsPlayer ? getFixturePlayers(fixtureId) : Promise.resolve([]),
  ])

  // --- Escanteios ---
  if (wantsCorners) {
    const m = sel.match(/(\d+\.?\d*)/)
    if (!m || fixtureStats.length === 0) return 'void'
    const line = parseFloat(m[1])
    const total = sel.includes(home) ? statValue(fixtureStats, fixture.teams.home.name, 'Corner Kicks')
      : sel.includes(away) ? statValue(fixtureStats, fixture.teams.away.name, 'Corner Kicks')
      : totalStat(fixtureStats, 'Corner Kicks')
    return lineOver(sel, total, line)
  }

  // --- Cartões ---
  if (wantsCards) {
    const m = sel.match(/(\d+\.?\d*)/)
    if (!m || fixtureStats.length === 0) return 'void'
    const line = parseFloat(m[1])
    const type = (sel.includes('vermelho') || sel.includes('red')) ? 'Red Cards' : 'Yellow Cards'
    const total = sel.includes(home) ? statValue(fixtureStats, fixture.teams.home.name, type)
      : sel.includes(away) ? statValue(fixtureStats, fixture.teams.away.name, type)
      : totalStat(fixtureStats, type)
    return lineOver(sel, total, line)
  }

  // --- Defesas do goleiro ---
  if (wantsSaves) {
    const m = sel.match(/(\d+)/)
    if (!m) return 'void'
    const line = parseInt(m[1])

    // Tenta por nome de jogador
    for (const teamData of playerStats) {
      for (const p of teamData.players ?? []) {
        const pname = norm(p.player?.name ?? '')
        const words = pname.split(' ').filter((w: string) => w.length > 3)
        if (sel.includes(pname) || words.some((w: string) => sel.includes(w))) {
          const saves = p.statistics?.[0]?.goals?.saves ?? 0
          return lineOver(sel, saves, line)
        }
      }
    }

    // Fallback: defesas de time pelo contexto
    if (fixtureStats.length > 0) {
      const saves = sel.includes(away)
        ? statValue(fixtureStats, fixture.teams.away.name, 'Goalkeeper Saves')
        : statValue(fixtureStats, fixture.teams.home.name, 'Goalkeeper Saves')
      return lineOver(sel, saves, line)
    }
    return 'void'
  }

  // --- Gol / assistência de jogador ---
  if (wantsPlayer && playerStats.length > 0) {
    for (const teamData of playerStats) {
      for (const p of teamData.players ?? []) {
        const pname = norm(p.player?.name ?? '')
        const words = pname.split(' ').filter((w: string) => w.length > 3)
        if (sel.includes(pname) || words.some((w: string) => sel.includes(w))) {
          const stats = p.statistics?.[0]
          const isAssist = sel.includes('assistencia') || sel.includes('assist')
          const actual = isAssist ? (stats?.goals?.assists ?? 0) : (stats?.goals?.total ?? 0)
          const m = sel.match(/(\d+)/)
          return lineOver(sel, actual, m ? parseInt(m[1]) : 1)
        }
      }
    }
  }

  return null
}

// Estatísticas de múltiplos fixtures de uma vez (para calcular médias de escanteios/cartões)
export async function getFixturesStats(fixtureIds: number[]): Promise<Record<number, any[]>> {
  if (fixtureIds.length === 0) return {}
  const results = await Promise.allSettled(
    fixtureIds.map(id => getFixtureStats(id).then(stats => ({ id, stats })))
  )
  const map: Record<number, any[]> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') map[r.value.id] = r.value.stats
  }
  return map
}

// Mantido para compatibilidade legada — use resolveWithStats sempre que possível
export function resolveMatchWinner(fixture: Fixture, selection: string, market: string): 'won' | 'lost' | 'void' | null {
  const status = fixture.fixture.status.short
  if (!['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(status)) return null
  const homeGoals = fixture.score.fulltime.home ?? fixture.goals.home
  const awayGoals = fixture.score.fulltime.away ?? fixture.goals.away
  if (homeGoals === null || awayGoals === null) return 'void'
  const sel = norm(selection)
  const home = norm(fixture.teams.home.name)
  const away = norm(fixture.teams.away.name)
  if (market === 'match_winner') {
    if (homeGoals > awayGoals) return sel.includes(home) || sel.includes('casa') || sel === '1' ? 'won' : 'lost'
    if (awayGoals > homeGoals) return sel.includes(away) || sel.includes('fora') || sel === '2' ? 'won' : 'lost'
    return sel.includes('empate') || sel === 'x' ? 'won' : 'lost'
  }
  if (market === 'over_under') {
    const total = homeGoals + awayGoals
    const m = sel.match(/(\d+\.?\d*)/)
    if (!m) return 'void'
    return lineOver(sel, total, parseFloat(m[1]))
  }
  if (market === 'both_teams_score') {
    const btts = homeGoals > 0 && awayGoals > 0
    return (sel.includes('sim') || sel.includes('yes')) ? (btts ? 'won' : 'lost') : (!btts ? 'won' : 'lost')
  }
  return null
}
