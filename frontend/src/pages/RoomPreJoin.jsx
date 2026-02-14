import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { GlassCard } from '../components/GlassCard'
import { getRoom, joinRoom } from '../services/api'

export function RoomPreJoin() {
  const { code } = useParams()
  const nav = useNavigate()

  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [pw, setPw] = useState('')
  const [joining, setJoining] = useState(false)

  const roomCode = useMemo(() => String(code || '').trim().toUpperCase(), [code])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const r = await getRoom(roomCode)
        if (!alive) return
        setRoom(r)
        setError('')
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'failed to load room')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    if (roomCode) load()
    return () => {
      alive = false
    }
  }, [roomCode])

  const onJoin = async () => {
    if (!roomCode) return
    setJoining(true)
    setError('')
    try {
      await joinRoom(roomCode, { password: pw })
      try {
        localStorage.setItem('lastRoomCode', roomCode)
      } catch {
      }
      nav(`/arena/room/${roomCode}`)
    } catch (e) {
      setError(e?.message || 'failed to join')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="container-page py-10">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-frost-50 text-lg">Join Room {roomCode}</div>
            <div className="text-frost-200 text-sm">Settings preview (members hidden until join)</div>
          </div>
          <Link className="glass px-4 py-2 rounded-lg text-frost-50 text-sm" to="/arena/rooms">
            Back
          </Link>
        </div>

        <GlassCard>
          <div className="space-y-4">
            {loading ? <div className="text-frost-200 text-sm">loading…</div> : null}
            {error ? <div className="text-red-300 text-sm">{error}</div> : null}

            {room ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-frost-50">Settings</div>
                  <div className="text-frost-200 text-sm">Language: {room?.settings?.language}</div>
                  <div className="text-frost-200 text-sm">Difficulty: {room?.settings?.difficulty}</div>
                  <div className="text-frost-200 text-sm">Duration: {Number(room?.settings?.durationMin) === 0 ? 'No time limit' : `${room?.settings?.durationMin} min`}</div>
                  <div className="text-frost-200 text-sm">Tasks: {room?.settings?.taskCount}</div>
                  {Array.isArray(room?.settings?.taskDifficulties) && room?.settings?.taskDifficulties?.length ? (
                    <div className="text-frost-200 text-sm">
                      Task difficulties: {room?.settings?.taskDifficulties?.join(', ')}
                    </div>
                  ) : null}
                  <div className="text-frost-200 text-sm">Max players: {room?.settings?.maxPlayers}</div>
                  <div className="text-frost-200 text-sm">Private: {room?.isPrivate ? 'yes' : 'no'}</div>
                </div>

                {room?.isPrivate ? (
                  <input
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="Password"
                    className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent"
                  />
                ) : null}

                <button
                  disabled={joining}
                  onClick={onJoin}
                  className="glass px-4 py-3 rounded-lg text-frost-50 w-full disabled:opacity-50"
                  type="button"
                >
                  {joining ? 'Joining…' : 'Join'}
                </button>
              </div>
            ) : null}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
