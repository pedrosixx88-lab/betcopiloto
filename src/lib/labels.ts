export const MARKET_LABELS: Record<string, string> = {
  match_winner: 'Resultado final (1X2)',
  over_under: 'Mais/Menos gols',
  both_teams_score: 'Ambas marcam',
  corners: 'Escanteios',
  cards: 'Cartões',
  handicap: 'Handicap',
  correct_score: 'Placar exato',
  other: 'Outro',
}

export const MARKET_LABELS_SHORT: Record<string, string> = {
  match_winner: '1X2',
  over_under: 'Mais/Menos',
  both_teams_score: 'Ambas marcam',
  corners: 'Escanteios',
  cards: 'Cartões',
  handicap: 'Handicap',
  correct_score: 'Placar',
  other: 'Outro',
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  won: 'Green ✓',
  lost: 'Red ✗',
  void: 'Anulada',
}

// Traduz seleções geradas pela IA (Over/Under/Home/Away)
export function translateSelection(selection: string): string {
  return selection
    .replace(/\bOver\b/gi, 'Mais de')
    .replace(/\bUnder\b/gi, 'Menos de')
    .replace(/\bHome\b/gi, 'Casa')
    .replace(/\bAway\b/gi, 'Fora')
    .replace(/\bDraw\b/gi, 'Empate')
    .replace(/\bBTTS Yes\b/gi, 'Ambas marcam: Sim')
    .replace(/\bBTTS No\b/gi, 'Ambas marcam: Não')
    .replace(/\bYes\b/gi, 'Sim')
    .replace(/\bNo\b/gi, 'Não')
}
