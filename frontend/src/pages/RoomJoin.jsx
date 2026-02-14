import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { GlassCard } from '../components/GlassCard'

export function RoomJoin() {
  const { code } = useParams()
  const nav = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const c = (code || '').trim().toUpperCase()
    if (!c) {
      setError('invalid code')
      return
    }
    nav(`/arena/room/${c}`, { replace: true })
  }, [code, nav])

  return (
    <div className="container-page py-10">
      <GlassCard>
        <div className="space-y-2">
          <div className="text-frost-50">Joining…</div>
          {error ? <div className="text-red-300 text-sm">{error}</div> : null}
        </div>
      </GlassCard>
    </div>
  )
}
