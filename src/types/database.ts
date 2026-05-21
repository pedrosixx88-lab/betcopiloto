export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Plan = 'free' | 'pro'
export type BetStatus = 'pending' | 'won' | 'lost' | 'void'
export type BetMarket = 'match_winner' | 'over_under' | 'both_teams_score' | 'handicap' | 'correct_score' | 'other'

export interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  plan: Plan
  initial_bankroll: number
  current_bankroll: number
  favorite_leagues: string[]
  main_bookmaker: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface Bet {
  id: string
  user_id: string
  home_team: string
  away_team: string
  league: string | null
  market: BetMarket
  selection: string
  odd: number
  stake: number
  potential_return: number
  status: BetStatus
  match_date: string
  fixture_id: number | null
  screenshot_url: string | null
  bookmaker: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'> & {
          plan?: Plan
          initial_bankroll?: number
          current_bankroll?: number
          favorite_leagues?: string[]
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Profile, 'id' | 'email' | 'created_at'>> & { updated_at?: string }
      }
      bets: {
        Row: Bet
        Insert: Omit<Bet, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          status?: BetStatus
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Pick<Bet, 'status' | 'notes' | 'updated_at'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      plan: Plan
      bet_status: BetStatus
      bet_market: BetMarket
    }
  }
}
