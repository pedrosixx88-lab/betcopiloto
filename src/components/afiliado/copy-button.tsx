'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function AfiliadoCopyButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      title="Copiar link"
    >
      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}
