// Rate limiting em memória — funciona por instância Vercel (adequado para Hobby plan)
// Para multi-instância em produção, substituir por Upstash Redis
const store = new Map<string, { count: number; resetAt: number }>()

let lastCleanup = Date.now()
function cleanupExpired() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  cleanupExpired()
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}
