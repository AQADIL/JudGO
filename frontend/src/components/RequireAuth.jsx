import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function RequireAuth({ children }) {
  const status = useAuthStore((s) => s.status)

  if (status === 'idle') return null
  if (status === 'hydrating') return null
  if (status !== 'auth') return <Navigate to="/signin" replace />

  return children
}

export function RequireAdmin({ children }) {
  const status = useAuthStore((s) => s.status)
  const role = useAuthStore((s) => s.profile?.role)

  if (status === 'idle') return null
  if (status === 'hydrating') return null
  if (status !== 'auth') return <Navigate to="/signin" replace />
  if (role !== 'ADMIN') return <Navigate to="/dashboard" replace />

  return children
}
