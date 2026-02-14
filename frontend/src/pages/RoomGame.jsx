import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ConfirmModal } from '../components/ConfirmModal'
import { GlassCard } from '../components/GlassCard'
import { MonacoEditor } from '../components/MonacoEditor'
import { getRoomGame, leaveRoom, submitRoomGame } from '../services/api'
import { playSfx } from '../lib/sfxEvents'

export function RoomGame() {
  const { gameId } = useParams()
  const nav = useNavigate()
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [nowMs, setNowMs] = useState(() => Date.now())

  const [confirmOpen, setConfirmOpen] = useState(false)

  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)

  const [activeProblemId, setActiveProblemId] = useState('')

  const gid = useMemo(() => String(gameId || '').trim(), [gameId])

  const remaining = useMemo(() => {
    const ends = game?.endsAt
    if (!ends) return null
    const endsMs = new Date(ends).getTime()
    if (!Number.isFinite(endsMs)) return null
    const diff = Math.max(0, endsMs - nowMs)
    const totalSec = Math.floor(diff / 1000)
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    return { totalSec, mm, ss }
  }, [game?.endsAt, nowMs])

  const monacoLang = useMemo(() => {
    const l = String(game?.language || '').toUpperCase()
    if (l === 'GO') return 'go'
    if (l === 'PY' || l === 'PYTHON') return 'python'
    return 'plaintext'
  }, [game?.language])

  const problems = useMemo(() => {
    if (!game) return []
    if (Array.isArray(game?.problems) && game.problems.length) return game.problems
    if (game?.problem?.id) return [game.problem]
    return []
  }, [game])

  const myUserId = useMemo(() => String(game?.myUserId || '').trim(), [game?.myUserId])

  const myProgress = useMemo(() => {
    if (!myUserId) return null
    return game?.progress?.[myUserId] || null
  }, [game?.progress, myUserId])

  const solvedCount = useMemo(() => {
    if (!myProgress?.solved) return 0
    return problems.reduce((acc, p) => acc + (myProgress?.solved?.[p.id] ? 1 : 0), 0)
  }, [myProgress, problems])

  const totalCount = useMemo(() => problems.length, [problems])

  const scoreboard = useMemo(() => {
    const pr = game?.progress || {}
    const users = Object.values(pr)
    const scored = users.map((u) => {
      const cnt = problems.reduce((acc, p) => acc + (u?.solved?.[p.id] ? 1 : 0), 0)
      return { userId: u?.userId || '', displayName: u?.displayName || u?.userId || '', solved: cnt }
    })
    scored.sort((a, b) => b.solved - a.solved)
    return scored
  }, [game?.progress, problems])

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!game) return
    if (game?.status !== 'FINISHED') return
    const t = setTimeout(() => {
      nav('/arena/rooms', { replace: true })
    }, 2000)
    return () => clearTimeout(t)
  }, [game, nav])

  useEffect(() => {
    let alive = true

    if (!gid) {
      setLoading(false)
      return () => {
        alive = false
      }
    }

    const id = setInterval(async () => {
      try {
        const g = await getRoomGame(gid)
        if (!alive) return
        setGame(g)
        setLoading(false)
      } catch (e) {
        const msg = String(e?.message || '').toLowerCase()
        if (msg.includes('404') || msg.includes('not found')) {
          nav('/arena/rooms', { replace: true })
          return
        }
        setError(e?.message || 'failed to load game')
        setLoading(false)
      }
    }, 1500)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [gid, nav])

  useEffect(() => {
    if (!problems.length) return
    if (activeProblemId && problems.some((p) => p.id === activeProblemId)) return
    setActiveProblemId(problems[0].id)
  }, [problems, activeProblemId])

  const onSubmit = async () => {
    if (!gid) return
    if (!activeProblemId) return
    setSubmitting(true)
    setError('')
    setSubmitResult(null)
    try {
      playSfx('tap', { volume: 0.5 })
      const resp = await submitRoomGame(gid, { problemId: activeProblemId, code })
      const g = await getRoomGame(gid)
      setGame(g)

      const sub = resp?.submission
      if (sub?.correct) {
        playSfx('win', { volume: 0.75 })
        setSubmitResult({ type: 'success', message: 'Accepted' })
      } else {
        playSfx('error', { volume: 0.8 })
        setSubmitResult({ type: 'error', message: sub?.errorMessage || 'Wrong answer' })
      }
    } catch (e) {
      setError(e?.message || 'submit failed')
      playSfx('error', { volume: 0.8 })
      setSubmitResult({ type: 'error', message: e?.message || 'Submit failed' })
    } finally {
      setSubmitting(false)
    }
  }

  const onExit = async () => {
    const c = String(game?.roomCode || '').trim().toUpperCase()
    if (c) {
      try {
        const last = String(localStorage.getItem('lastRoomCode') || '').trim().toUpperCase()
        if (last && last === c) localStorage.removeItem('lastRoomCode')
      } catch {
      }
      await leaveRoom(c).catch(() => null)
    }
    nav('/arena/rooms', { replace: true })
  }

  return (
    <div className="py-10 px-4">
      <div className="mx-auto w-full max-w-[1600px]">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-frost-50 text-lg">Room Game</div>
            <div className="text-frost-200 text-sm">{gid}</div>
          </div>
          <div className="flex items-center gap-3">
            {game ? (
              <div className="glass px-3 py-2 rounded-lg text-frost-50 text-sm flex items-center gap-3">
                <div className="font-mono text-base leading-none tabular-nums">
                  {remaining ? `${remaining.mm}:${remaining.ss}` : '--:--'}
                </div>
                <div className="text-frost-200 text-[11px] uppercase tracking-wide">
                  {game?.status}
                </div>
              </div>
            ) : null}
            {game ? (
              <div className="glass px-3 py-2 rounded-lg text-frost-50 text-sm">
                {solvedCount}/{totalCount}
              </div>
            ) : null}
            <button className="glass px-4 py-2 rounded-lg text-frost-50 text-sm" type="button" onClick={() => setConfirmOpen(true)}>
              Exit
            </button>
          </div>
        </div>

        <GlassCard>
          <div className="space-y-4">
            {loading ? <div className="text-frost-200 text-sm">loading…</div> : null}
            {error ? <div className="text-red-300 text-sm">{error}</div> : null}
            {submitResult ? (
              <div className={`text-sm px-4 py-2 rounded-lg ${submitResult.type === 'success' ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'}`}>
                {submitResult.message}
              </div>
            ) : null}

            {game ? (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[320px,1fr,260px]">
                  <div className="space-y-4">
                    <div className="glass px-4 py-3 rounded-lg border border-white/10">
                      <div className="text-frost-50 text-sm">Tasks</div>
                      <div className="mt-3 grid gap-2">
                        {problems.map((p, idx) => {
                          const solved = !!myProgress?.solved?.[p.id]
                          const active = p.id === activeProblemId
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                playSfx('tap', { volume: 0.4 })
                                setActiveProblemId(p.id)
                                setSubmitResult(null)
                              }}
                              className={`text-left px-4 py-3 rounded-lg border ${active ? 'border-blue-400/50 bg-blue-500/10' : 'border-white/10 bg-white/5'} ${solved ? 'opacity-80' : ''}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-frost-50 text-sm font-medium">#{idx + 1} {p.title}</div>
                                <div className={`text-[11px] ${solved ? 'text-green-300' : 'text-frost-200'}`}>{solved ? 'SOLVED' : p.difficulty}</div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="glass rounded-lg border border-white/10 overflow-hidden">
                      <div className="max-h-[740px] overflow-auto p-4 space-y-3">
                        {(() => {
                          const p = problems.find((x) => x.id === activeProblemId) || null
                          if (!p) return null
                          return (
                            <div className="space-y-3">
                              <div className="text-frost-50 text-lg">{p.title}</div>
                              <div className="text-frost-200 text-sm whitespace-pre-wrap">{p.statement}</div>

                              {p.outputFormat ? (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                  <div className="text-frost-50 text-sm">Output Format</div>
                                  <div className="mt-2 text-frost-200 text-xs whitespace-pre-wrap">{p.outputFormat}</div>
                                </div>
                              ) : null}

                              {p.inputFormat ? (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                  <div className="text-frost-50 text-sm">Input</div>
                                  <div className="mt-2 text-frost-200 text-xs whitespace-pre-wrap">{p.inputFormat}</div>
                                </div>
                              ) : null}

                              {Array.isArray(p.samples) && p.samples.length ? (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                  <div className="text-frost-50 text-sm">Examples</div>
                                  <div className="mt-3 space-y-3">
                                    {p.samples.map((s, i) => (
                                      <div key={i} className="space-y-2">
                                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                          <div className="text-frost-200 text-[11px] uppercase tracking-wide">Input</div>
                                          <pre className="mt-1 text-frost-50 text-xs whitespace-pre-wrap">{s?.input || ''}</pre>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                          <div className="text-frost-200 text-[11px] uppercase tracking-wide">Output</div>
                                          <pre className="mt-1 text-frost-50 text-xs whitespace-pre-wrap">{s?.output || ''}</pre>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {game?.status === 'FINISHED' ? (
                      <div className="glass px-4 py-3 rounded-lg text-frost-50">
                        {game?.winnerUserId ? (
                          <>Finished. Winner: {game?.winnerUserId}</>
                        ) : (
                          <>Time is up. Room will be closed.</>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="h-[860px] glass rounded-lg overflow-hidden border border-white/10">
                          <MonacoEditor
                            value={code}
                            onChange={(v) => setCode(v || '')}
                            language={monacoLang}
                            theme="vs-dark"
                            options={{
                              fontSize: 19,
                              lineHeight: 26,
                              padding: { top: 14, bottom: 14 },
                              cursorSmoothCaretAnimation: 'on',
                              smoothScrolling: true,
                            }}
                          />
                        </div>
                        <button
                          disabled={submitting || !activeProblemId}
                          onClick={onSubmit}
                          className="glass px-4 py-3 rounded-lg text-frost-50 w-full disabled:opacity-50"
                          type="button"
                        >
                          {submitting ? 'Submitting…' : 'Submit'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 xl:block hidden">
                    <div className="glass px-4 py-3 rounded-lg border border-white/10">
                      <div className="text-frost-50 text-sm">Scoreboard</div>
                      <div className="mt-3 space-y-2">
                        {scoreboard.map((u) => (
                          <div key={u.userId} className="glass px-3 py-2 rounded-lg text-frost-50 text-sm flex items-center justify-between">
                            <div className="truncate">{u.displayName}</div>
                            <div className="font-mono tabular-nums text-frost-200">{u.solved}/{totalCount}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {myProgress?.lastSubmit?.[activeProblemId] ? (
                      <div className="glass px-4 py-3 rounded-lg border border-white/10">
                        <div className="text-frost-50 text-sm">Last check</div>
                        <div className="mt-2 text-frost-200 text-xs whitespace-pre-wrap">
                          {myProgress?.lastSubmit?.[activeProblemId]?.correct ? 'Accepted' : (myProgress?.lastSubmit?.[activeProblemId]?.errorMessage || 'Wrong answer')}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4 xl:hidden">
                  <div className="glass px-4 py-3 rounded-lg border border-white/10">
                    <div className="text-frost-50 text-sm">Scoreboard</div>
                    <div className="mt-3 space-y-2">
                      {scoreboard.map((u) => (
                        <div key={u.userId} className="glass px-3 py-2 rounded-lg text-frost-50 text-sm flex items-center justify-between">
                          <div className="truncate">{u.displayName}</div>
                          <div className="font-mono tabular-nums text-frost-200">{u.solved}/{totalCount}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {myProgress?.lastSubmit?.[activeProblemId] ? (
                    <div className="glass px-4 py-3 rounded-lg border border-white/10">
                      <div className="text-frost-50 text-sm">Last check</div>
                      <div className="mt-2 text-frost-200 text-xs whitespace-pre-wrap">
                        {myProgress?.lastSubmit?.[activeProblemId]?.correct ? 'Accepted' : (myProgress?.lastSubmit?.[activeProblemId]?.errorMessage || 'Wrong answer')}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </GlassCard>

        <ConfirmModal
          open={confirmOpen}
          title="Leave room?"
          message="You will leave the room."
          confirmText="Leave"
          cancelText="Cancel"
          onConfirm={() => {
            setConfirmOpen(false)
            onExit()
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
      </div>
    </div>
  )
}
