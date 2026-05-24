const ASAAS_BASE = 'https://api.asaas.com/v3'

function headers() {
  return {
    'access_token': process.env.ASAAS_API_KEY!,
    'Content-Type': 'application/json',
  }
}

export async function asaasPost(path: string, body: object) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.errors?.[0]?.description ?? JSON.stringify(data))
  return data
}

export async function asaasGet(path: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: headers(),
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.errors?.[0]?.description ?? JSON.stringify(data))
  return data
}

// Criar ou buscar customer no Asaas
export async function getOrCreateCustomer(email: string, name: string, userId: string, cpf?: string) {
  // Busca por email
  const search = await fetch(`${ASAAS_BASE}/customers?email=${encodeURIComponent(email)}`, {
    headers: headers(),
  })
  const searchData = await search.json()
  if (searchData.data?.length > 0) {
    const existing = searchData.data[0]
    // Atualiza CPF se ainda não tem
    if (cpf && !existing.cpfCnpj) {
      await fetch(`${ASAAS_BASE}/customers/${existing.id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ cpfCnpj: cpf }),
      })
    }
    return existing
  }

  // Cria novo com CPF
  return asaasPost('/customers', {
    name: name || email,
    email,
    externalReference: userId,
    notificationDisabled: true,
    ...(cpf && { cpfCnpj: cpf }),
  })
}
