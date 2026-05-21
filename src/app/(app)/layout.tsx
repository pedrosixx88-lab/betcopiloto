import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/layout/bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-black flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-background flex flex-col relative shadow-2xl">
        <main className="flex-1 pb-20">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
