'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Zap, Loader2, RefreshCw } from 'lucide-react'
import PushNotifications from '@/components/push-notifications'

interface Props {
  initial: { content: string; games_count: number; created_at: string } | null
}

export default function BriefingCard({ initial }: Props) {
  const [briefing, setBriefing] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function generate(force = false) {
    setLoading(true)
    try {
      const res = await fetch('/api/briefing/gerar', {
        method: 'POST',
        headers: force ? { 'x-force-new': '1' } : {},
      })
      const json = await res.json()
      if (json.success) setBriefing(json.briefing)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-primary/20 bg-brand-muted">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Briefing do dia
          </CardTitle>
          <div className="flex items-center gap-3">
            <PushNotifications />
            <button
              onClick={() => generate(true)}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Regenerar briefing"
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />
              }
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {briefing ? (
          <div className="space-y-2">
            <div className="text-xs text-foreground/90 leading-relaxed prose prose-invert prose-xs max-w-none
              [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mb-1
              [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-primary [&_h2]:mb-1 [&_h2]:mt-2
              [&_strong]:font-semibold [&_strong]:text-foreground
              [&_p]:mb-1 [&_p]:leading-relaxed
              [&_hr]:border-border [&_hr]:my-2
              [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground [&_blockquote]:italic">
              <ReactMarkdown>{briefing.content}</ReactMarkdown>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {briefing.games_count} jogos monitorados hoje
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Briefing ainda não gerado para hoje.
            </p>
            <button
              onClick={() => generate(false)}
              disabled={loading}
              className="text-xs text-primary flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {loading ? 'Gerando...' : 'Gerar agora'}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
