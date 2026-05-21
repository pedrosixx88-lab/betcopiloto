'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  date: string
  banca: number
}

export function BankrollChart({ data, initialBankroll }: { data: DataPoint[]; initialBankroll: number }) {
  if (data.length === 0) return null

  const allValues = [initialBankroll, ...data.map(d => d.banca)]
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const padding = (max - min) * 0.1 || 50

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bancaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.63 0.19 145)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="oklch(0.63 0.19 145)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }} tickLine={false} axisLine={false} />
          <YAxis domain={[min - padding, max + padding]} hide />
          <Tooltip
            contentStyle={{ background: 'oklch(0.13 0 0)', border: '1px solid oklch(1 0 0 / 8%)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'oklch(0.55 0 0)' }}
            itemStyle={{ color: 'oklch(0.63 0.19 145)' }}
            formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, 'Banca']}
          />
          <Area type="monotone" dataKey="banca" stroke="oklch(0.63 0.19 145)" strokeWidth={2} fill="url(#bancaGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
