const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export async function apiFetch(path, { token, ...init } = {}) {
  const headers = new Headers(init?.headers || {})
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }

  return data
}

export async function profileInit(idToken) {
  return apiFetch('/profile/init', { method: 'POST', token: idToken })
}

export async function me(idToken) {
  return apiFetch('/me', { method: 'GET', token: idToken })
}

export async function adminUsers(idToken) {
  return apiFetch('/admin/users', { method: 'GET', token: idToken })
}
