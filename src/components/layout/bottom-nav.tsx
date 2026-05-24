'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, BarChart3, Trophy, Ticket, Crown, Users, MoreHorizontal, X, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/apostas', label: 'Apostas', icon: BarChart3 },
  { href: '/jogos', label: 'Jogos', icon: Trophy },
  { href: '/bilhete', label: 'Bilhete', icon: Ticket },
]

const MORE_ITEMS = [
  { href: '/planos', label: 'Planos', icon: Crown },
  { href: '/afiliado', label: 'Afiliados', icon: Users },
]

const DESKTOP_EXTRA = [
  { href: '/planos', label: 'Planos', icon: Crown },
  { href: '/afiliado', label: 'Afiliados', icon: Users },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile: bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-0',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'text-primary')} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}

          {/* Botão "Mais" */}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
              moreOpen || MORE_ITEMS.some(i => pathname.startsWith(i.href))
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            {moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>

      {/* Menu "Mais" expandido */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed bottom-16 right-0 left-0 z-50 md:hidden bg-card border-t border-border px-4 py-3 space-y-1 shadow-lg">
            {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium',
                    active ? 'bg-brand-muted text-primary' : 'text-foreground hover:bg-secondary'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              )
            })}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium text-destructive hover:bg-destructive/10 w-full"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </div>
        </>
      )}

      {/* Desktop: top nav */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-card border-b border-border h-14">
        <div className="max-w-5xl mx-auto w-full px-6 flex items-center justify-between">
          <span className="font-bold text-primary text-lg">BetCopiloto</span>
          <div className="flex items-center gap-1">
            {[...NAV_ITEMS, ...DESKTOP_EXTRA].map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium',
                    active
                      ? 'bg-brand-muted text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </nav>
    </>
  )
}
