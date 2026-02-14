import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { GlassCard } from '../components/GlassCard'
import { SkeletonLoader } from '../components/SkeletonLoader'
import { dashboardStats } from '../services/api'

export function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const s = await dashboardStats()
        if (!alive) return
        setStats(s || null)
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'Failed to load stats')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [])

  const overviewCards = useMemo(() => {
    const solvedTotal = Number(stats?.solvedTotal) || 0
    const submissionsTotal = Number(stats?.submissionsTotal) || 0
    const passedTotal = Number(stats?.passedTotal) || 0
    const passRate = Number(stats?.passRate) || 0
    const passRatePct = `${Math.round(passRate * 100)}%`
    const avgAttempts = (() => {
      const h = stats?.attemptsToSolveHistogram || {}
      const n1 = Number(h['1'] || 0)
      const n2 = Number(h['2'] || 0)
      const n3 = Number(h['3'] || 0)
      const n4 = Number(h['4'] || 0)
      const n5 = Number(h['5+'] || 0)
      const total = n1 + n2 + n3 + n4 + n5
      if (!total) return 0
      const approx = n1 * 1 + n2 * 2 + n3 * 3 + n4 * 4 + n5 * 5
      return approx / total
    })()
    return [
      { label: 'Solved', value: String(solvedTotal), sub: '' },
      { label: 'Submissions', value: String(submissionsTotal), sub: '' },
      { label: 'Pass Rate', value: passRatePct, sub: `${passedTotal} passed` },
      { label: 'Avg Attempts', value: avgAttempts ? avgAttempts.toFixed(1) : '0.0', sub: '' },
    ]
  }, [stats])

  const solvedByDifficultyData = useMemo(() => {
    const m = stats?.solvedByDifficulty || {}
    const keys = ['EASY', 'MEDIUM', 'HARD', 'UNKNOWN']
    return keys
      .map((k) => ({ name: k, value: Number(m[k] || 0) }))
      .filter((x) => x.value > 0)
  }, [stats])

  const submissionsByLanguageData = useMemo(() => {
    const m = stats?.submissionsByLanguage || {}
    const keys = Object.keys(m)
    keys.sort((a, b) => Number(m[b] || 0) - Number(m[a] || 0))
    return keys.map((k) => ({ name: k, value: Number(m[k] || 0) }))
  }, [stats])

  const attemptsHistogramData = useMemo(() => {
    const m = stats?.attemptsToSolveHistogram || {}
    const keys = ['1', '2', '3', '4', '5+']
    return keys.map((k) => ({ attempts: k, count: Number(m[k] || 0) }))
  }, [stats])

  const dailyActivityData = useMemo(() => {
    const subs = Array.isArray(stats?.dailySubmissions) ? stats.dailySubmissions : []
    const solved = Array.isArray(stats?.dailySolved) ? stats.dailySolved : []
    const m = new Map()
    for (const x of subs) {
      const day = String(x?.day || '')
      if (!day) continue
      m.set(day, { day, submissions: Number(x?.count || 0), solved: 0 })
    }
    for (const x of solved) {
      const day = String(x?.day || '')
      if (!day) continue
      const cur = m.get(day) || { day, submissions: 0, solved: 0 }
      cur.solved = Number(x?.count || 0)
      m.set(day, cur)
    }
    const arr = Array.from(m.values())
    arr.sort((a, b) => String(a.day).localeCompare(String(b.day)))
    return arr
  }, [stats])

  const pieColors = ['#34D399', '#FBBF24', '#F87171', '#94A3B8', '#60A5FA', '#A78BFA']

  return (
    <div className="min-h-screen">
      <main className="container-page py-10">
        <GlassCard>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent-steel" />
              <h3 className="font-semibold text-frost-50">Your Stats</h3>
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SkeletonLoader className="h-20 w-full" />
                <SkeletonLoader className="h-20 w-full" />
                <SkeletonLoader className="h-20 w-full" />
                <SkeletonLoader className="h-20 w-full" />
              </div>
            ) : error ? (
              <div className="text-red-300 text-sm">{error}</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {overviewCards.map((c, index) => (
                  <motion.div
                    key={c.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + index * 0.08 }}
                    className="space-y-1"
                  >
                    <div className="text-2xl font-semibold text-frost-50">{c.value}</div>
                    <div className="text-sm text-frost-200">{c.label}</div>
                    {c.sub ? <div className="text-xs text-frost-300">{c.sub}</div> : null}
                  </motion.div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-white/10">
              {loading ? (
                <SkeletonLoader className="h-64 w-full" />
              ) : error ? null : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="text-frost-50 text-sm">Solved by Difficulty</div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={solvedByDifficultyData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                            {solvedByDifficultyData.map((_, i) => (
                              <Cell key={i} fill={pieColors[i % pieColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-frost-50 text-sm">Submissions by Language</div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={submissionsByLanguageData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                            {submissionsByLanguageData.map((_, i) => (
                              <Cell key={i} fill={pieColors[(i + 2) % pieColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-frost-50 text-sm">Attempts to Solve (first AC)</div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attemptsHistogramData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="attempts" stroke="rgba(234,240,255,0.7)" />
                          <YAxis stroke="rgba(234,240,255,0.7)" allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#60A5FA" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-frost-50 text-sm">Daily Activity (14 days)</div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyActivityData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="day" stroke="rgba(234,240,255,0.7)" tick={{ fontSize: 10 }} />
                          <YAxis stroke="rgba(234,240,255,0.7)" allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="submissions" stroke="#A78BFA" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="solved" stroke="#34D399" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </main>
    </div>
  )
}
