import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'

import { ConfirmModal } from '../components/ConfirmModal'
import { GlassCard } from '../components/GlassCard'
import { deleteRoom, getRoom, joinRoom, leaveRoom, startRoom } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { playSfx } from '../lib/sfxEvents'

function membersArray(room) {
  const m = room?.members || {}
  return Object.values(m).sort((a, b) => (a.joinedAt || '').localeCompare(b.joinedAt || ''))
}

export function RoomLobby() {
  const { code } = useParams()
  const nav = useNavigate()

  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)

  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [pw, setPw] = useState('')
  const [joining, setJoining] = useState(false)
  const [optimisticJoined, setOptimisticJoined] = useState(false)

  const autoJoinTriedRef = useRef(false)

  const skipLeaveRef = useRef(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmMode, setConfirmMode] = useState(null)

  const [startingCountdown, setStartingCountdown] = useState(false)
  const [countdownLeftMs, setCountdownLeftMs] = useState(0)

  const mem = membersArray(room)
  const currentUID = profile?.id || user?.uid
  const isOwner = !!room && !!currentUID && room?.ownerUserId === currentUID

  const joinUrl = useMemo(() => {
    const c = (code || '').toUpperCase()
    return `${window.location.origin}/room/${c}`
  }, [code])

  useEffect(() => {
    autoJoinTriedRef.current = false
    setOptimisticJoined(false)
  }, [code])

  const joined = useMemo(() => {
    const uid = profile?.id || user?.uid
    return !!room?.members && !!uid && !!room?.members?.[uid]
  }, [room, profile, user])

  const joinedEffective = joined || optimisticJoined

  useEffect(() => {
    if (!room) return
    if (room?.status === 'RUNNING' && room?.activeGameId) {
      skipLeaveRef.current = true
      nav(`/arena/game/${room.activeGameId}`, { replace: true })
    }
  }, [room, nav])

  const onRetryPublicJoin = async () => {
    const c = (code || '').trim().toUpperCase()
    if (!c) return
    autoJoinTriedRef.current = false
    setError('')
    setJoining(true)
    try {
      playSfx('tap', { volume: 0.5 })
      await joinRoom(c, { password: '' })
      setOptimisticJoined(true)
      try {
        localStorage.setItem('lastRoomCode', c)
      } catch {
      }
    } catch (e) {
      setError(e?.message || 'failed to join')
      autoJoinTriedRef.current = true
    } finally {
      setJoining(false)
    }
  }

  useEffect(() => {
    const c = (code || '').trim().toUpperCase()
    if (!c) return
    if (!room) return
    if (loading) return
    if (joinedEffective) return
    if (room?.isPrivate) return
    if (joining) return
    if (autoJoinTriedRef.current) return
    if (!(profile?.id || user?.uid)) return

    let alive = true
    const autoJoin = async () => {
      autoJoinTriedRef.current = true
      setJoining(true)
      setError('')
      try {
        await joinRoom(c, { password: '' })
        setOptimisticJoined(true)
        try {
          localStorage.setItem('lastRoomCode', c)
        } catch {
        }
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'failed to join')
      } finally {
        if (!alive) return
        setJoining(false)
      }
    }

    autoJoin()
    return () => {
      alive = false
    }
  }, [code, room, loading, joinedEffective, joining, profile, user])

  const onJoinPrivate = async () => {
    const c = (code || '').trim().toUpperCase()
    if (!c) return
    setJoining(true)
    setError('')
    try {
      playSfx('tap', { volume: 0.5 })
      await joinRoom(c, { password: pw })
      setOptimisticJoined(true)
      try {
        localStorage.setItem('lastRoomCode', c)
      } catch {
      }
      setPw('')
    } catch (e) {
      setError(e?.message || 'failed to join')
    } finally {
      setJoining(false)
    }
  }

  useEffect(() => {
    let alive = true
    const c = (code || '').trim().toUpperCase()
    if (!c) return

    const load = async () => {
      try {
        const r = await getRoom(c)
        if (!alive) return
        setRoom(r)
        setError('')




      } catch (e) {
        if (!alive) return
        const msg = String(e?.message || '').toLowerCase()
        if (msg.includes('404') || msg.includes('not found')) {
          try {
            const last = String(localStorage.getItem('lastRoomCode') || '').trim().toUpperCase()
            if (last && last === c) localStorage.removeItem('lastRoomCode')
          } catch {
          }
          setError('Room was closed')
          setTimeout(() => {
            if (!alive) return
            nav('/arena/rooms', { replace: true })
          }, 1200)
          return
        }
        setError(e?.message || 'failed to load room')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    load()
    const t = setInterval(load, 2000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [code])

  const prevMembersRef = useRef(0)
  useEffect(() => {
    const cnt = Array.isArray(mem) ? mem.length : 0
    if (prevMembersRef.current && cnt > prevMembersRef.current) {
      playSfx('mpJoin', { volume: 0.7 })
    }
    prevMembersRef.current = cnt
  }, [mem])

  useEffect(() => {
    if (!startingCountdown) return
    const t = setInterval(() => {
      setCountdownLeftMs((ms) => Math.max(0, ms - 100))
    }, 100)
    return () => clearInterval(t)
  }, [startingCountdown])

  useEffect(() => {
    if (!startingCountdown) return
    if (countdownLeftMs > 0) return
    setStartingCountdown(false)
    setCountdownLeftMs(0)
    const c = (code || '').trim().toUpperCase()
    if (!c) return
    startRoom(c).catch((e) => setError(e?.message || 'failed to start'))
    playSfx('mpStart', { volume: 0.8 })
  }, [code, countdownLeftMs, startingCountdown])

  const onStart = async () => {
    const c = (code || '').trim().toUpperCase()
    if (!c) return
    if (startingCountdown) return
    playSfx('tap', { volume: 0.55 })
    playSfx('mpStartCountdown', { volume: 0.9 })
    setStartingCountdown(true)
    setCountdownLeftMs(5000)
  }

  const onLeave = async () => {
    const c = (code || '').trim().toUpperCase()
    if (!c) return
    try {
      playSfx('tap', { volume: 0.5 })
      try {
        const last = String(localStorage.getItem('lastRoomCode') || '').trim().toUpperCase()
        if (last && last === c) localStorage.removeItem('lastRoomCode')
      } catch {
      }
      await leaveRoom(c)
      nav('/arena/rooms', { replace: true })
    } catch (e) {
      setError(e?.message || 'failed to leave')
    }
  }

  const onDelete = async () => {
    const c = (code || '').trim().toUpperCase()
    if (!c) return
    try {
      playSfx('tap', { volume: 0.5 })
      try {
        const last = String(localStorage.getItem('lastRoomCode') || '').trim().toUpperCase()
        if (last && last === c) localStorage.removeItem('lastRoomCode')
      } catch {
      }
      await deleteRoom(c)
      nav('/arena/rooms', { replace: true })
    } catch (e) {
      setError(e?.message || 'failed to delete')
    }
  }

  const askLeave = () => {
    setConfirmMode('leave')
    setConfirmOpen(true)
  }

  const askDelete = () => {
    setConfirmMode('delete')
    setConfirmOpen(true)
  }

  const onConfirm = async () => {
    const mode = confirmMode
    setConfirmOpen(false)
    setConfirmMode(null)
    if (mode === 'delete') return onDelete()
    if (mode === 'leave') return onLeave()
  }

  useEffect(() => {
    const c = (code || '').trim().toUpperCase()
    if (!c) return

    window.history.pushState(null, '', window.location.href)
    const onPop = (e) => {
      e.preventDefault()

      setConfirmMode('leave')
      setConfirmOpen(true)
      window.history.pushState(null, '', window.location.href)
    }

    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [code, nav])

  return (
    <div className="container-page py-10">
      {startingCountdown ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative glass-strong px-10 py-8 rounded-2xl border border-white/10 text-center">
            <div className="text-frost-50 text-5xl font-semibold tabular-nums">
              {countdownLeftMs > 3500 ? '3' : countdownLeftMs > 2000 ? '2' : countdownLeftMs > 500 ? '1' : 'GO'}
            </div>
            <div className="mt-2 text-frost-200 text-sm">Match starting…</div>
          </div>
        </div>
      ) : null}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-frost-50 text-lg">Room {String(code || '').toUpperCase()}</div>
            <div className="text-frost-200 text-sm">Waiting lobby</div>
          </div>
          <button className="glass px-4 py-2 rounded-lg text-frost-50 text-sm" type="button" onClick={askLeave}>
            Back
          </button>
        </div>

        <GlassCard>
          <div className="space-y-4">
            {loading ? <div className="text-frost-200 text-sm">loading…</div> : null}
            {error ? <div className="text-red-300 text-sm">{error}</div> : null}

            {room ? (
              <div className="grid gap-6 md:grid-cols-2">
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

                  {!joinedEffective ? (
                    <div className="space-y-2">
                      {room?.isPrivate ? (
                        <input
                          value={pw}
                          onChange={(e) => setPw(e.target.value)}
                          placeholder="Password"
                          className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent"
                        />
                      ) : (
                        <div className="text-frost-200 text-sm">Joining…</div>
                      )}
                      <button
                        disabled={joining || (room?.isPrivate && !String(pw || '').trim())}
                        onClick={room?.isPrivate ? onJoinPrivate : onRetryPublicJoin}
                        className="glass px-4 py-3 rounded-lg text-frost-50 w-full disabled:opacity-50"
                        type="button"
                      >
                        {joining ? 'Joining…' : room?.isPrivate ? 'Join' : 'Retry'}
                      </button>
                    </div>
                  ) : null}

                  {joinedEffective && isOwner && room?.status === 'WAITING' ? (
                    <button
                      onClick={onStart}
                      className="glass px-4 py-3 rounded-lg text-frost-50 w-full"
                      type="button"
                    >
                      Start
                    </button>
                  ) : null}

                  {joinedEffective ? (
                    <button
                      onClick={askLeave}
                      className="glass px-4 py-3 rounded-lg text-frost-50 w-full"
                      type="button"
                    >
                      Leave
                    </button>
                  ) : null}

                  {joinedEffective && isOwner ? (
                    <button
                      onClick={askDelete}
                      className="glass px-4 py-3 rounded-lg text-frost-50 w-full"
                      type="button"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-frost-50">Members ({mem.length})</div>
                    <div className="space-y-2">
                      {mem.map((m) => (
                        <div key={m.userId} className="glass px-4 py-3 rounded-lg text-frost-50 text-sm">
                          {m.displayName}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-frost-50">Invite</div>
                    <div className="glass px-4 py-3 rounded-lg text-frost-200 text-xs break-all">{joinUrl}</div>
                    <div className="glass p-3 rounded-lg inline-block bg-white/5">
                      <QRCode value={joinUrl} size={128} fgColor="#EAF0FF" bgColor="transparent" />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </GlassCard>

        <ConfirmModal
          open={confirmOpen}
          title={confirmMode === 'delete' ? 'Delete room?' : 'Leave room?'}
          message={confirmMode === 'delete' ? 'This will close the room for everyone.' : 'You will leave the room.'}
          confirmText={confirmMode === 'delete' ? 'Delete' : 'Leave'}
          cancelText="Cancel"
          danger={confirmMode === 'delete'}
          onConfirm={onConfirm}
          onCancel={() => {
            setConfirmOpen(false)
            setConfirmMode(null)
          }}
        />
      </div>
    </div>
  )
}
