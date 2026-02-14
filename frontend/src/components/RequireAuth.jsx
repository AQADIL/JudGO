import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function RequireAuth({ children }) {
  const status = useAuthStore((s) => s.status)
  const rulesAccepted = useAuthStore((s) => s.rulesAccepted)

  if (status === 'idle') return null
  if (status === 'hydrating') return null
  if (status !== 'auth') return <Navigate to="/signin" replace />
  if (!rulesAccepted) return <Navigate to="/" replace />

  return children
}

export function RequireAdmin({ children }) {
  const status = useAuthStore((s) => s.status)
  const role = useAuthStore((s) => s.profile?.role)
  const rulesAccepted = useAuthStore((s) => s.rulesAccepted)

  if (status === 'idle') return null
  if (status === 'hydrating') return null
  if (status !== 'auth') return <Navigate to="/signin" replace />
  if (!rulesAccepted) return <Navigate to="/" replace />
  if (role !== 'ADMIN') return <Navigate to="/dashboard" replace />

  return children
}
