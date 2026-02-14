import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { RotateCcw, Send, Trophy } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { MonacoEditor } from '../components/MonacoEditor'
import { createSubmission, getProblem, adminProblems } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { playSfx } from '../lib/sfxEvents'
import fnafImg from '../assets/fnaf.jpg'

export function ArenaBot() {
  const nav = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const [problems, setProblems] = useState([])
  const [competeWithBot, setCompeteWithBot] = useState(false)
  const [botDifficulty, setBotDifficulty] = useState('MEDIUM')
  const [durationMin, setDurationMin] = useState(20)
  const [started, setStarted] = useState(false)
  const [endsAtMs, setEndsAtMs] = useState(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [botProgressOpen, setBotProgressOpen] = useState(false)
  const [botProgress, setBotProgress] = useState(0)
  const [botCensoredText, setBotCensoredText] = useState('')
  const [selectedProblemId, setSelectedProblemId] = useState('')
  const [problem, setProblem] = useState(null)
  const [language, setLanguage] = useState('py')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loadingProblems, setLoadingProblems] = useState(true)

  const [matchOutcome, setMatchOutcome] = useState(null) // 'WIN' | 'LOSE' | null

  const [botWinOpen, setBotWinOpen] = useState(false)
  const [botWinPending, setBotWinPending] = useState(false)
  const [botWinAtMs, setBotWinAtMs] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (competeWithBot) return
    setStarted(false)
    setEndsAtMs(null)
    setBotProgressOpen(false)
    setMatchOutcome(null)
    setBotWinOpen(false)
    setBotWinPending(false)
    setBotWinAtMs(null)
  }, [competeWithBot])

  useEffect(() => {
    if (!botWinPending) return
    if (!botWinAtMs) return
    if (nowMs < botWinAtMs) return
    setBotWinPending(false)
    setBotWinAtMs(null)
    setBotWinOpen(true)
    playSfx('botWin')
  }, [botWinAtMs, botWinPending, nowMs])

  useEffect(() => {
    if (!competeWithBot || started) return
    if (botDifficulty === 'EASY') setDurationMin(12)
    else if (botDifficulty === 'HARD') setDurationMin(45)
    else setDurationMin(25)
  }, [botDifficulty, competeWithBot, started])

  const remaining = useMemo(() => {
    if (!endsAtMs) return null
    const diff = Math.max(0, endsAtMs - nowMs)
    const totalSec = Math.floor(diff / 1000)
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    return { totalSec, mm, ss }
  }, [endsAtMs, nowMs])

  const timeUp = useMemo(() => {
    return Boolean(endsAtMs && nowMs >= endsAtMs)
  }, [endsAtMs, nowMs])

  const lowTime = useMemo(() => {
    if (!competeWithBot) return false
    if (!started) return false
    if (!remaining) return false
    return remaining.totalSec > 0 && remaining.totalSec <= 10
  }, [competeWithBot, remaining, started])

  useEffect(() => {
    if (!lowTime) return
    playSfx('countdown', { volume: 0.65 })
  }, [lowTime])

  const visibleProblems = useMemo(() => {
    if (!competeWithBot) return problems
    return (problems || []).filter((p) => String(p?.difficulty || '').toUpperCase() === String(botDifficulty || '').toUpperCase())
  }, [botDifficulty, competeWithBot, problems])

  // Load published problems list
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingProblems(true)
      try {
        const list = await adminProblems().catch(() => [])
        const published = (Array.isArray(list) ? list : []).filter(
          (p) => p?.status === 'PUBLISHED'
        )
        if (!cancelled) {
          setProblems(published)
          if (published[0]?.id) setSelectedProblemId(published[0].id)
        }
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setLoadingProblems(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Load selected problem details
  useEffect(() => {
    if (!selectedProblemId) return
    let cancelled = false
    async function load() {
      try {
        const p = await getProblem(selectedProblemId)
        if (!cancelled) {
          setProblem(p)
          const starter = p?.starterCode?.[language] || ''
          if (starter) setCode(starter)
        }
      } catch (e) {
        if (!cancelled) setProblem(null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedProblemId, language])

  useEffect(() => {
    if (!competeWithBot || !started) return
    if (matchOutcome) return
    const durationSec = Math.max(60, Math.floor((durationMin || 1) * 60))
    const baseSpeed = botDifficulty === 'EASY' ? 0.75 : botDifficulty === 'HARD' ? 0.95 : 0.85
    const tickMs = 600
    const incPerTick = (100 / (durationSec * 1000 / tickMs)) * baseSpeed

    const codeMask = (s) => {
      const n = Math.max(6, Math.min(160, s))
      return '█'.repeat(n)
    }

    const t = setInterval(() => {
      setBotProgress((p) => {
        const next = Math.min(100, p + incPerTick)
        return next
      })
      setBotCensoredText((prev) => {
        const maxLines = 22
        const lines = prev ? prev.split('\n') : []
        const shouldAdd = Math.random() > 0.3
        if (shouldAdd && lines.length < maxLines) {
          const len = 40 + Math.floor(Math.random() * 60)
          lines.push(codeMask(len))
        }
        if (lines.length === 0) lines.push(codeMask(60))
        return lines.slice(-maxLines).join('\n')
      })
    }, tickMs)
    return () => clearInterval(t)
  }, [botDifficulty, competeWithBot, durationMin, started, matchOutcome])

  useEffect(() => {
    if (!competeWithBot) return
    if (!started) return
    if (matchOutcome) return
    if (!timeUp) return
    setMatchOutcome('LOSE')
    playSfx('lose')
    setStarted(false)
    setEndsAtMs(null)
    setBotProgressOpen(false)
  }, [competeWithBot, started, matchOutcome, timeUp])

  useEffect(() => {
    if (!competeWithBot) return
    if (!started) return
    if (matchOutcome) return
    if (botProgress < 100) return
    setMatchOutcome('LOSE')
    playSfx('lose')
    setStarted(false)
    setEndsAtMs(null)
    setBotProgressOpen(false)
  }, [botProgress, competeWithBot, matchOutcome, started])

  const monacoLang = useMemo(() => {
    if (language === 'go') return 'go'
    return 'python'
  }, [language])

  const onSubmit = async () => {
    if (!selectedProblemId || !code.trim()) return
    if (competeWithBot && timeUp) return
    if (competeWithBot && matchOutcome) return
    setSubmitting(true)
    setError('')
    setResult(null)
    playSfx('tap', { volume: 0.5 })
    try {
      const res = await createSubmission({
        problemId: selectedProblemId,
        language,
        code,
      })
      setResult(res)

      if (res && res.passed === false) {
        playSfx('error')
      }

      if (competeWithBot && res?.passed) {
        setMatchOutcome('WIN')
        setBotWinPending(true)
        setBotWinAtMs(Date.now() + 5000)
        setStarted(false)
        setEndsAtMs(null)
        setBotProgressOpen(false)
      }
    } catch (e) {
      setError(e?.message || 'Submission failed')
      setResult({ passed: false, error: e?.message })
      playSfx('error')
    } finally {
      setSubmitting(false)
    }
  }

  const onReset = () => {
    playSfx('tap', { volume: 0.5 })
    const starter = problem?.starterCode?.[language] || ''
    setCode(starter)
    setResult(null)
    setError('')
  }

  const onStart = () => {
    if (!selectedProblemId) return
    playSfx('tap', { volume: 0.55 })
    const d = Math.max(1, Number(durationMin) || 1)
    setStarted(true)
    setEndsAtMs(Date.now() + d * 60 * 1000)
    setResult(null)
    setError('')
    setMatchOutcome(null)
    setBotWinOpen(false)
    setBotWinPending(false)
    setBotWinAtMs(null)
    setBotProgress(0)
    setBotCensoredText('')
  }

  const onStop = () => {
    playSfx('tap', { volume: 0.55 })
    setStarted(false)
    setEndsAtMs(null)
    setBotProgressOpen(false)
    setMatchOutcome(null)
    setBotWinOpen(false)
    setBotWinPending(false)
    setBotWinAtMs(null)
  }

  return (
    <div className="container-page py-6">
      {botWinOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setBotWinOpen(false)} />
          <div className="relative w-[min(760px,92vw)] overflow-hidden rounded-2xl border border-white/10 bg-black/70 backdrop-blur-sm">
            <div className="absolute inset-0">
              <img
                src={fnafImg}
                alt=""
                className="h-full w-full object-cover opacity-65 scale-[1.04]"
              />
              <div className="absolute inset-0 bg-black/65" />
              <div
                className="absolute inset-0 pointer-events-none opacity-25 mix-blend-screen"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0, rgba(255,255,255,0.07) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px)',
                }}
              />
              <div className="absolute inset-0 pointer-events-none" style={{
                boxShadow: 'inset 0 0 140px rgba(0,0,0,0.9)',
              }} />
            </div>

            <div className="relative p-6">
              <div className="text-frost-50 text-xl font-semibold tracking-wide">BOT</div>
              <div className="mt-2 text-frost-200 text-sm">
                Connection terminated.
              </div>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-frost-50 font-mono text-sm leading-relaxed">
                  <span className="opacity-90">&gt; </span>
                  I always come back.
                </div>
                <div className="mt-2 text-frost-200 text-xs">
                  The bot is gone… for now.
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  className="glass px-4 py-2 rounded-lg text-frost-50 text-sm"
                  onClick={() => setBotWinOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-frost-50 text-xl font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent-steel" />
              Solo Training Mode
            </div>
            <div className="text-frost-200 text-sm">
              No opponents, just you and the problem.
            </div>
          </div>
          <div className="flex items-center gap-3">
            {competeWithBot && started && remaining ? (
              <div className="glass px-3 py-2 rounded-lg text-frost-50 text-sm flex items-center gap-3">
                <div className="font-mono text-base leading-none tabular-nums">
                  {remaining.mm}:{remaining.ss}
                </div>
                <div className="text-frost-200 text-[11px] uppercase tracking-wide">
                  {competeWithBot ? `BOT ${botDifficulty}` : 'SOLO'}
                </div>
              </div>
            ) : null}
            <button
              onClick={() => nav('/arena')}
              className="glass px-4 py-2 rounded-lg text-frost-50 text-sm"
            >
              Back to Arena
            </button>
          </div>
        </div>

        {/* Problem Selector */}
        <GlassCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-3 text-frost-100 text-sm">
                <input
                  type="checkbox"
                  checked={competeWithBot}
                  disabled={started}
                  onChange={(e) => setCompeteWithBot(Boolean(e.target.checked))}
                  className="h-4 w-4"
                />
                Compete with bot
              </label>

              {competeWithBot ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="text-frost-200 text-sm">Bot difficulty</div>
                    <select
                      value={botDifficulty}
                      onChange={(e) => setBotDifficulty(e.target.value)}
                      disabled={started}
                      className="glass px-3 py-2 text-sm text-frost-50 bg-transparent rounded"
                    >
                      <option value="EASY" className="bg-ink-900">Easy</option>
                      <option value="MEDIUM" className="bg-ink-900">Medium</option>
                      <option value="HARD" className="bg-ink-900">Hard</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-frost-200 text-sm">Time</div>
                    <select
                      value={durationMin}
                      onChange={(e) => setDurationMin(Number(e.target.value) || 1)}
                      disabled={started}
                      className="glass px-3 py-2 text-sm text-frost-50 bg-transparent rounded"
                    >
                      {botDifficulty === 'EASY' ? (
                        <>
                          <option value={10} className="bg-ink-900">10 min</option>
                          <option value={12} className="bg-ink-900">12 min</option>
                          <option value={15} className="bg-ink-900">15 min</option>
                        </>
                      ) : botDifficulty === 'HARD' ? (
                        <>
                          <option value={35} className="bg-ink-900">35 min</option>
                          <option value={45} className="bg-ink-900">45 min</option>
                          <option value={60} className="bg-ink-900">60 min</option>
                        </>
                      ) : (
                        <>
                          <option value={20} className="bg-ink-900">20 min</option>
                          <option value={25} className="bg-ink-900">25 min</option>
                          <option value={30} className="bg-ink-900">30 min</option>
                        </>
                      )}
                    </select>
                  </div>

                  {!started ? (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={onStart}
                      disabled={!selectedProblemId}
                      className="glass-strong px-4 py-2 rounded-lg text-frost-50 text-sm disabled:opacity-50"
                      type="button"
                    >
                      Start
                    </motion.button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setBotProgressOpen(true)}
                        className="glass px-4 py-2 rounded-lg text-frost-50 text-sm"
                        type="button"
                      >
                        View bot progress
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={onStop}
                        className="glass px-4 py-2 rounded-lg text-frost-50 text-sm"
                        type="button"
                      >
                        Stop
                      </motion.button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
              <div className="flex-1">
                <label className="text-frost-200 text-sm mb-2 block">Select Problem</label>
                <select
                  value={selectedProblemId}
                  onChange={(e) => setSelectedProblemId(e.target.value)}
                  disabled={loadingProblems}
                  className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent"
                >
                  {loadingProblems ? (
                    <option>Loading...</option>
                  ) : visibleProblems.length === 0 ? (
                    <option>No published problems</option>
                  ) : (
                    visibleProblems.map((p) => (
                      <option key={p.id} value={p.id} className="bg-ink-900">
                        {p.title} [{p.difficulty}]
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="text-frost-200 text-sm mb-2 block">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={started}
                  className="glass px-4 py-3 rounded-lg text-frost-50 bg-transparent"
                >
                  <option value="py" className="bg-ink-900">Python 3</option>
                  <option value="go" className="bg-ink-900">Go</option>
                </select>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Main Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          {/* Left: Problem */}
          <GlassCard className="overflow-y-auto max-h-[calc(100vh-300px)]">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-frost-50 mb-2">
                  {problem?.title || 'Select a problem'}
                </h2>
                <div className="flex gap-2">
                  {problem?.difficulty ? (
                    <span className={`px-2 py-1 text-xs rounded ${
                      problem.difficulty === 'EASY' ? 'bg-green-500/20 text-green-300' :
                      problem.difficulty === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>
                      {problem.difficulty}
                    </span>
                  ) : null}
                  {problem?.tags?.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-accent-lilac/20 text-accent-lilac text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {problem?.statement ? (
                <div className="space-y-2">
                  <h3 className="font-semibold text-frost-50">Description</h3>
                  <p className="text-sm text-frost-100 leading-relaxed">{problem.statement}</p>
                </div>
              ) : null}

              {problem?.inputFormat ? (
                <div className="space-y-2">
                  <h3 className="font-semibold text-frost-50">Input Format</h3>
                  <p className="text-sm text-frost-100">{problem.inputFormat}</p>
                </div>
              ) : null}

              {problem?.outputFormat ? (
                <div className="space-y-2">
                  <h3 className="font-semibold text-frost-50">Output Format</h3>
                  <p className="text-sm text-frost-100">{problem.outputFormat}</p>
                </div>
              ) : null}

              {/* Examples */}
              {(problem?.testCases || []).filter(tc => !tc.isHidden).length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-semibold text-frost-50">Examples</h3>
                  <div className="space-y-3">
                    {(problem?.testCases || [])
                      .filter(tc => !tc.isHidden)
                      .slice(0, 3)
                      .map((tc, idx) => (
                        <div key={idx} className="bg-white/5 p-3 rounded-lg text-sm">
                          <div className="mb-1">
                            <span className="text-frost-200">Input:</span>
                            <pre className="mt-1 bg-black/20 p-2 rounded text-frost-100 overflow-x-auto">{tc.input}</pre>
                          </div>
                          <div>
                            <span className="text-frost-200">Output:</span>
                            <pre className="mt-1 bg-black/20 p-2 rounded text-frost-100 overflow-x-auto">{tc.output}</pre>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          </GlassCard>

          {/* Right: Code Editor */}
          <GlassCard>
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <div className="text-frost-200 text-sm">
                  {monacoLang === 'go' ? 'Go' : 'Python 3'}
                </div>
                <div className="flex items-center gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onReset}
                    className="glass px-3 py-2 rounded-lg text-frost-50 text-sm flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onSubmit}
                    disabled={submitting || !selectedProblemId || (competeWithBot && (!started || timeUp || matchOutcome))}
                    className="glass-strong px-4 py-2 rounded-lg text-frost-50 text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? 'Running...' : 'Submit'}
                  </motion.button>
                </div>
              </div>

              {/* Editor */}
              <div className="h-[50vh] rounded-lg overflow-hidden border border-white/10">
                <MonacoEditor
                  value={code}
                  onChange={(v) => setCode(v || '')}
                  language={monacoLang}
                  theme="vs-dark"
                  options={{
                    fontSize: 18,
                    lineHeight: 28,
                    padding: { top: 16, bottom: 16 },
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    minimap: { enabled: false },
                  }}
                />
              </div>

              {/* Results */}
              {competeWithBot && !started ? (
                <div className="bg-white/5 text-frost-200 px-4 py-3 rounded-lg text-sm">
                  Press Start to begin.
                </div>
              ) : null}

              {competeWithBot && timeUp ? (
                <div className="bg-yellow-500/20 text-yellow-200 px-4 py-3 rounded-lg text-sm">
                  Time is up.
                </div>
              ) : null}

              {competeWithBot && matchOutcome === 'WIN' ? (
                <div className="bg-green-500/20 text-green-200 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  You beat the bot!
                </div>
              ) : null}

              {competeWithBot && matchOutcome === 'LOSE' ? (
                <div className="bg-red-500/20 text-red-200 px-4 py-3 rounded-lg text-sm">
                  You lost. The bot finished first.
                </div>
              ) : null}

              {error ? (
                <div className="bg-red-500/20 text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              ) : null}

              {result ? (
                <div className={`px-4 py-3 rounded-lg text-sm ${
                  result.passed
                    ? 'bg-green-500/20 text-green-200'
                    : 'bg-yellow-500/20 text-yellow-200'
                }`}>
                  {result?.attemptNumber ? (
                    <div className="text-xs opacity-90 mb-1">
                      Attempt #{result.attemptNumber}
                    </div>
                  ) : null}
                  {result.passed ? (
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      <span>
                        Accepted! All {result.totalCount || result.passedCount} tests passed!
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium mb-1">
                        Wrong Answer: {result.passedCount || 0}/{result.totalCount || '?'} tests passed
                      </div>
                      {result.results?.filter(r => !r.hidden && !r.passed).slice(0, 2).map((r, i) => (
                        <div key={i} className="text-xs mt-1 opacity-90">
                          Test {r.index + 1}: {r.error || 'Wrong output'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </GlassCard>
        </div>

        {botProgressOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setBotProgressOpen(false)} />
            <div className="relative w-[min(900px,92vw)] glass rounded-xl2 border border-white/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-frost-50 text-lg">Bot Progress</div>
                  <div className="text-frost-200 text-sm">Live view is censored.</div>
                </div>
                <button
                  className="glass px-4 py-2 rounded-lg text-frost-50 text-sm"
                  type="button"
                  onClick={() => setBotProgressOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-frost-100">Progress</div>
                  <div className="text-frost-200 tabular-nums">{Math.floor(botProgress)}%</div>
                </div>
                <div className="h-2 rounded bg-white/10 overflow-hidden">
                  <div className="h-full bg-accent-steel/70" style={{ width: `${Math.min(100, botProgress)}%` }} />
                </div>

                <div className="glass rounded-lg border border-white/10 p-4">
                  <pre className="text-frost-50 font-mono text-xs leading-relaxed blur-sm select-none whitespace-pre-wrap">
                    {botCensoredText || '████████████████████████████████████████████████████'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
