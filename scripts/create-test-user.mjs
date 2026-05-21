import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://qwciyudbovdiadnxweac.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3Y2l5dWRib3ZkaWFkbnh3ZWFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3MjI4NCwiZXhwIjoyMDk0OTQ4Mjg0fQ._ocdVDRRaWCKVq85qhI4Aql2gs6FF7saCW5F6egANKE',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const EMAIL = 'teste@betcopiloto.dev'
const PASSWORD = 'Teste@123456'

// Deletar se já existir
const { data: existing } = await supabase.auth.admin.listUsers()
const user = existing?.users?.find(u => u.email === EMAIL)
if (user) {
  await supabase.auth.admin.deleteUser(user.id)
  console.log('Usuário antigo deletado.')
}

// Criar novo
const { data, error } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
})

if (error) {
  console.error('Erro ao criar usuário:', error.message)
  process.exit(1)
}

// Atualizar perfil para onboarding completo
await supabase.from('profiles').update({
  name: 'Teste BetCopiloto',
  onboarding_completed: true,
  initial_bankroll: 500,
  current_bankroll: 500,
}).eq('id', data.user.id)

console.log('Usuário criado com sucesso!')
console.log('Email:', EMAIL)
console.log('Senha:', PASSWORD)
console.log('ID:', data.user.id)
