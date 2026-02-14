import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { GlassCard } from '../components/GlassCard'
import { createRoom, listRooms } from '../services/api'
import { useAuthStore } from '../stores/authStore'

export function ArenaRooms() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()

  const profile = useAuthStore((s) => s.profile)

  const [activeTab, setActiveTab] = useState('browse')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)

  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState('')
  const [language, setLanguage] = useState('GO')
  const [difficulty, setDifficulty] = useState('EASY')
  const [durationMin, setDurationMin] = useState(30)
  const [noTimeLimit, setNoTimeLimit] = useState(false)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [taskCount, setTaskCount] = useState(1)
  const [taskDifficulties, setTaskDifficulties] = useState(['EASY'])

  const joinFromUrl = useMemo(() => {
    return (searchParams.get('code') || '').trim().toUpperCase()
  }, [searchParams])

  useEffect(() => {
    if (!joinFromUrl) return
    setJoinCode(joinFromUrl)
    setActiveTab('join')
  }, [joinFromUrl])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const data = await listRooms()
        if (!alive) return
        setRooms(Array.isArray(data) ? data : [])
      } catch {
        if (!alive) return
        setRooms([])
      } finally {
        if (!alive) return
        setRoomsLoading(false)
      }
    }

    load()
    const t = setInterval(load, 3000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const onJoin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const c = (joinCode || '').trim().toUpperCase()
      if (!c) throw new Error('code is required')
      nav(`/arena/room/${c}`)
    } catch (err) {
      setError(err?.message || 'failed to open room')
    }
  }

  const onCreate = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const rootDifficulty = taskDifficulties?.[0] || difficulty
      const room = await createRoom({
        name,
        isPrivate,
        password,
        settings: {
          language,
          difficulty: rootDifficulty,
          durationMin: noTimeLimit ? 0 : Number(durationMin) || 30,
          taskCount: Number(taskCount),
          taskDifficulties,
          maxPlayers: Number(maxPlayers),
        },
      })
      const c = String(room?.code || '').trim().toUpperCase()
      if (!c) throw new Error('failed to create room')
      nav(`/arena/room/${c}`)
    } catch (err) {
      setError(err?.message || 'failed to create room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-page py-10">
      <GlassCard>
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-frost-50 text-lg">Rooms / Friends</div>
              <div className="text-frost-200 text-sm">Up to 4 players. Share code, link or QR.</div>
            </div>
            <div className="text-frost-200 text-xs">{profile?.displayName || profile?.email || ''}</div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setActiveTab('browse')} className={`glass px-3 py-2 rounded-lg text-sm ${activeTab === 'browse' ? 'text-frost-50' : 'text-frost-200'}`}>
              Browse
            </button>
            <button type="button" onClick={() => setActiveTab('join')} className={`glass px-3 py-2 rounded-lg text-sm ${activeTab === 'join' ? 'text-frost-50' : 'text-frost-200'}`}>
              Join
            </button>
            <button type="button" onClick={() => setActiveTab('create')} className={`glass px-3 py-2 rounded-lg text-sm ${activeTab === 'create' ? 'text-frost-50' : 'text-frost-200'}`}>
              Create
            </button>
          </div>

          {error ? <div className="text-red-300 text-sm">{error}</div> : null}

          {activeTab === 'browse' ? (
            <div className="space-y-3">
              {roomsLoading ? <div className="text-frost-200 text-sm">loading…</div> : null}
              <div className="grid gap-3 md:grid-cols-2">
                {rooms.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => nav(`/arena/room/${String(r.code || '').toUpperCase()}`)}
                    className="glass px-4 py-4 rounded-xl2 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-frost-50">{String(r.code || '').toUpperCase()}</div>
                        <div className="text-frost-200 text-xs">{r.name || 'Room'}</div>
                      </div>
                      <div className="text-frost-200 text-xs">{r.isPrivate ? 'LOCK' : 'OPEN'}</div>
                    </div>
                    <div className="pt-3 text-frost-200 text-xs">
                      {r.settings?.language} · {r.settings?.difficulty} · {Number(r.settings?.durationMin) === 0 ? 'No limit' : `${r.settings?.durationMin}m`}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === 'join' ? (
            <form onSubmit={onJoin} className="space-y-3">
              <input
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value)
                  if (error) setError('')
                }}
                placeholder="Room code (8 chars)"
                className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent"
              />
              <button
                disabled={loading || !(joinCode || '').trim()}
                className="glass px-4 py-3 rounded-lg text-frost-50 w-full disabled:opacity-50"
                type="submit"
              >
                Open Lobby
              </button>
            </form>
          ) : null}

          {activeTab === 'create' ? (
            <form onSubmit={onCreate} className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Room name (optional)"
                className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent"
              />

              <div className="grid gap-3 md:grid-cols-3">
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="glass px-4 py-3 rounded-lg text-frost-50 bg-transparent">
                  <option className="bg-ink-900" value="GO">GO</option>
                  <option className="bg-ink-900" value="PY">PY</option>
                </select>

                <input
                  type="number"
                  min={5}
                  max={240}
                  value={durationMin}
                  disabled={noTimeLimit}
                  onChange={(e) => setDurationMin(e.target.value)}
                  className="glass px-4 py-3 rounded-lg text-frost-50 bg-transparent disabled:opacity-50"
                  placeholder="Time limit (min)"
                />

                <input
                  type="number"
                  min={1}
                  max={50}
                  value={taskCount}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setTaskCount(n)
                    const base = taskDifficulties?.[0] || difficulty
                    const next = Array.from({ length: Math.max(1, n) }, (_, i) => taskDifficulties[i] || base)
                    setTaskDifficulties(next)
                  }}
                  className="glass px-4 py-3 rounded-lg text-frost-50 bg-transparent"
                  placeholder="Tasks count"
                />
              </div>

              <label className="flex items-center gap-3 text-frost-200 text-sm">
                <input
                  type="checkbox"
                  checked={noTimeLimit}
                  onChange={(e) => {
                    setNoTimeLimit(e.target.checked)
                    if (e.target.checked) setDurationMin(0)
                    else if (!Number(durationMin)) setDurationMin(30)
                  }}
                />
                No time limit
              </label>

              <div className="space-y-2">
                <div className="text-frost-200 text-sm">Task difficulties</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {taskDifficulties.map((d, idx) => (
                    <select
                      key={idx}
                      value={d}
                      onChange={(e) => {
                        const next = [...taskDifficulties]
                        next[idx] = e.target.value
                        setTaskDifficulties(next)
                      }}
                      className="glass px-4 py-3 rounded-lg text-frost-50 bg-transparent"
                    >
                      <option className="bg-ink-900" value="EASY">EASY</option>
                      <option className="bg-ink-900" value="MEDIUM">MEDIUM</option>
                      <option className="bg-ink-900" value="HARD">HARD</option>
                    </select>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 text-frost-200 text-sm">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                Private room (password)
              </label>

              {isPrivate ? (
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent"
                />
              ) : null}

              <button
                disabled={loading}
                className="glass px-4 py-3 rounded-lg text-frost-50 w-full disabled:opacity-50"
                type="submit"
              >
                {loading ? 'Creating…' : 'Create Room'}
              </button>
            </form>
          ) : null}
        </div>
      </GlassCard>
    </div>
  )
}
