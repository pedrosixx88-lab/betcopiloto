import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'BetCopiloto <noreply@betcopiloto.com.br>'

export async function sendWelcomeEmail(to: string, name: string) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: 'Bem-vindo ao BetCopiloto 🎯',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#ffffff">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">

    <div style="margin-bottom:32px">
      <div style="display:inline-flex;align-items:center;gap:8px">
        <div style="width:32px;height:32px;background:#22c55e;border-radius:8px;display:flex;align-items:center;justify-content:center">
          <span style="color:#000;font-weight:900;font-size:16px">↗</span>
        </div>
        <span style="font-weight:700;font-size:18px;color:#ffffff">BetCopiloto</span>
      </div>
    </div>

    <h1 style="font-size:28px;font-weight:800;margin:0 0 12px;line-height:1.2">
      Bem-vindo, ${name}! 👋
    </h1>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 32px">
      Sua conta foi criada com sucesso. Agora você tem tudo que precisa para apostar com inteligência.
    </p>

    <div style="background:#1a1a1a;border:1px solid #262626;border-radius:16px;padding:24px;margin-bottom:32px">
      <p style="font-size:13px;font-weight:600;color:#22c55e;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 16px">O que você pode fazer agora</p>
      <div style="space-y:12px">
        ${[
          ['📸', 'Registre sua primeira aposta', 'Tire um print do bilhete e a IA extrai tudo automaticamente'],
          ['📊', 'Acompanhe seu ROI', 'Dashboard com win rate, lucro/prejuízo e evolução da banca'],
          ['⚡', 'Leia o briefing do dia', 'Análise dos melhores jogos gerada pela IA toda manhã'],
        ].map(([emoji, title, desc]) => `
        <div style="display:flex;gap:12px;margin-bottom:16px">
          <span style="font-size:20px;flex-shrink:0">${emoji}</span>
          <div>
            <p style="margin:0;font-weight:600;font-size:14px;color:#ffffff">${title}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#71717a">${desc}</p>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <a href="https://betcopiloto-app-seven.vercel.app/dashboard"
       style="display:block;background:#22c55e;color:#000000;text-align:center;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:32px">
      Ir para o Dashboard →
    </a>

    <p style="color:#52525b;font-size:12px;text-align:center;line-height:1.5;margin:0">
      BetCopiloto · Aposte com responsabilidade +18<br>
      <a href="https://betcopiloto-app-seven.vercel.app" style="color:#22c55e;text-decoration:none">betcopiloto-app-seven.vercel.app</a>
    </p>
  </div>
</body>
</html>`,
  })
}

export async function sendPaymentReceiptEmail(to: string, name: string) {
  const now = new Date()
  const nextMonth = new Date(now)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return resend.emails.send({
    from: FROM,
    to,
    subject: 'Plano Pro ativado — BetCopiloto ✅',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#ffffff">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">

    <div style="margin-bottom:32px">
      <div style="display:inline-flex;align-items:center;gap:8px">
        <div style="width:32px;height:32px;background:#22c55e;border-radius:8px;display:flex;align-items:center;justify-content:center">
          <span style="color:#000;font-weight:900;font-size:16px">↗</span>
        </div>
        <span style="font-weight:700;font-size:18px;color:#ffffff">BetCopiloto</span>
      </div>
    </div>

    <div style="background:#14290f;border:1px solid #22c55e33;border-radius:16px;padding:24px;margin-bottom:32px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">🏆</div>
      <h1 style="font-size:24px;font-weight:800;margin:0 0 8px;color:#22c55e">Plano Pro ativado!</h1>
      <p style="color:#a1a1aa;font-size:14px;margin:0">${name}, seu acesso completo está liberado.</p>
    </div>

    <div style="background:#1a1a1a;border:1px solid #262626;border-radius:16px;padding:24px;margin-bottom:24px">
      <p style="font-size:13px;font-weight:600;color:#22c55e;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 16px">Recibo de pagamento</p>
      ${[
        ['Plano', 'BetCopiloto Pro — Mensal'],
        ['Valor', 'R$ 49,90'],
        ['Data', fmt(now)],
        ['Próxima cobrança', fmt(nextMonth)],
        ['Status', '✅ Pago'],
      ].map(([k, v]) => `
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #262626">
        <span style="color:#71717a;font-size:13px">${k}</span>
        <span style="color:#ffffff;font-size:13px;font-weight:500">${v}</span>
      </div>`).join('')}
    </div>

    <div style="background:#1a1a1a;border:1px solid #262626;border-radius:16px;padding:24px;margin-bottom:32px">
      <p style="font-size:13px;font-weight:600;color:#22c55e;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 16px">Agora você tem acesso a</p>
      ${[
        'Análise completa de cada jogo com IA',
        'Chat IA sobre qualquer jogo',
        'Montador de bilhete inteligente',
        'Push notification do briefing diário',
        'Suporte prioritário',
      ].map(f => `
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
        <span style="color:#22c55e;font-size:14px">✓</span>
        <span style="font-size:13px;color:#d4d4d8">${f}</span>
      </div>`).join('')}
    </div>

    <a href="https://betcopiloto-app-seven.vercel.app/dashboard"
       style="display:block;background:#22c55e;color:#000000;text-align:center;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:32px">
      Acessar o App →
    </a>

    <p style="color:#52525b;font-size:12px;text-align:center;line-height:1.5;margin:0">
      BetCopiloto · Aposte com responsabilidade +18<br>
      Para cancelar sua assinatura, acesse <a href="https://betcopiloto-app-seven.vercel.app/planos" style="color:#22c55e;text-decoration:none">Planos</a> no app.
    </p>
  </div>
</body>
</html>`,
  })
}
