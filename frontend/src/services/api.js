import { auth } from '../lib/firebase'

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  `${window.location.protocol}//${window.location.hostname}:8080`

function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/, '')
  const p = String(path || '')
  if (!p) return b
  if (p.startsWith('/')) return `${b}${p}`
  return `${b}/${p}`
}

async function getToken() {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}

export async function apiFetch(path, init = {}) {
  const headers = new Headers(init?.headers || {})

  if (String(API_BASE || '').includes('ngrok-free')) {
    headers.set('ngrok-skip-browser-warning', 'true')
  }

  const token = await getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && init?.body != null) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(joinUrl(API_BASE, path), {
    ...init,
    headers,
  })

  if (res.status === 401) {
    window.location.assign('/signin')
    throw new Error('Unauthorized')
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }

  return data
}

export function profileInit() {
  return apiFetch('/profile/init', { method: 'POST' })
}

export function me() {
  return apiFetch('/me', { method: 'GET' })
}

export function dashboardStats() {
  return apiFetch('/dashboard/stats', { method: 'GET' })
}

export function adminUsers() {
  return apiFetch('/admin/users', { method: 'GET' })
}

export function adminProblems() {
  return apiFetch('/admin/problems', { method: 'GET' })
}

export function createAdminProblem(problem) {
  return apiFetch('/admin/problems', {
    method: 'POST',
    body: JSON.stringify({ problem }),
  })
}

export function getProblem(id) {
  return apiFetch(`/problems/${id}`, { method: 'GET' })
}

export function createSubmission({ problemId, language, code }) {
  return apiFetch('/submissions', {
    method: 'POST',
    body: JSON.stringify({ problemId, language, code }),
  })
}

export function createMatch({ type, player1 }) {
  return apiFetch('/matches', {
    method: 'POST',
    body: JSON.stringify({ type, player1 }),
  })
}

export function joinMatch(matchId, { player2 }) {
  return apiFetch(`/matches/${matchId}/join`, {
    method: 'POST',
    body: JSON.stringify({ player2 }),
  })
}

export function submitCode(matchId, { player, code }) {
  return apiFetch(`/matches/${matchId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ player, code }),
  })
}

export function listRooms() {
  return apiFetch('/rooms', { method: 'GET' })
}

export function createRoom({ name, isPrivate, password, settings }) {
  return apiFetch('/rooms', {
    method: 'POST',
    body: JSON.stringify({ name, isPrivate, password, settings }),
  })
}

export function getRoom(code) {
  return apiFetch(`/rooms/${code}`, { method: 'GET' })
}

export function joinRoom(code, { password }) {
  return apiFetch(`/rooms/${code}/join`, {
    method: 'POST',
    body: JSON.stringify({ password: password || '' }),
  })
}

export function startRoom(code) {
  return apiFetch(`/rooms/${code}/start`, { method: 'POST' })
}

export function leaveRoom(code) {
  return apiFetch(`/rooms/${code}/leave`, { method: 'POST', body: JSON.stringify({}) })
}

export function deleteRoom(code) {
  return apiFetch(`/rooms/${code}`, { method: 'DELETE' })
}

export function getRoomGame(gameId) {
  return apiFetch(`/room-games/${gameId}`, { method: 'GET' })
}

export function submitRoomGame(gameId, { problemId, code }) {
  return apiFetch(`/room-games/${gameId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ problemId: problemId || '', code }),
  })
}
