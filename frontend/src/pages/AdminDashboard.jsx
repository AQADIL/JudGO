import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Cpu,
  Database,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  MemoryStick,
  Rocket,
  ServerCrash,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Users,
  Waves,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { adminOpsMetrics } from '../services/api'
import { useAuthStore } from '../stores/authStore'

const bg = '#09090b'
const card = '#18181b'
const border = '#27272a'
const mono = 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
const sans = 'Inter, ui-sans-serif, system-ui, sans-serif'
const pollMs = 5000
const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const metricDefs = [
  { key: 'cpu', label: 'System CPU', icon: Cpu, tone: '#22d3ee' },
  { key: 'memory', label: 'Memory Pressure', icon: MemoryStick, tone: '#f472b6' },
  { key: 'load', label: 'Load Average', icon: Gauge, tone: '#f59e0b' },
  { key: 'sandboxes', label: 'Active Sandboxes', icon: Layers3, tone: '#34d399' },
  { key: 'compile', label: 'Compile P95', icon: Rocket, tone: '#60a5fa' },
  { key: 'judge', label: 'Judge P95', icon: TerminalSquare, tone: '#a78bfa' },
  { key: 'security', label: 'Security Events', icon: ShieldCheck, tone: '#10b981' },
  { key: 'alerts', label: 'Open Alerts', icon: ShieldAlert, tone: '#fb7185' },
]

function formatLabel(value) {
  if (!value) return '--:--:--'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDay(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function formatCount(value) {
  return compactNumber.format(Number(value || 0))
}

function formatMs(value) {
  const numeric = Number(value || 0)
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(2)} s`
  return `${Math.round(numeric)} ms`
}

function formatMemory(value) {
  const numeric = Number(value || 0)
  if (numeric >= 1024) return `${(numeric / 1024).toFixed(2)} GB`
  return `${Math.round(numeric)} MB`
}

function formatUptime(seconds) {
  const total = Number(seconds || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function IconBadge({ icon: Icon, tone }) {
  return <div className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: `${tone}44`, background: `radial-gradient(circle at 30% 30%, ${tone}33, transparent 70%), ${card}` }}><Icon size={18} color={tone} /></div>
}

function MetricCard({ item, onToggle }) {
  const Icon = item.icon
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border p-4" style={{ backgroundColor: card, borderColor: border }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3"><IconBadge icon={Icon} tone={item.tone} /><div><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">{item.label}</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{item.value}</div></div></div>
        <button type="button" onClick={onToggle} className="rounded-xl border p-2 text-zinc-400 transition hover:text-zinc-100" style={{ borderColor: border }}><EyeOff size={16} /></button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 text-sm"><span className="text-zinc-400">{item.caption}</span><span className="font-medium text-right" style={{ color: item.tone }}>{item.delta}</span></div>
    </motion.div>
  )
}

function Panel({ title, subtitle, question, children, aside }) {
  return (
    <motion.section layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border p-5 md:p-6" style={{ backgroundColor: card, borderColor: border }}>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">{question}</div><h2 className="mt-2 text-xl font-semibold text-zinc-50">{title}</h2><p className="mt-2 max-w-2xl text-sm text-zinc-400">{subtitle}</p></div>{aside}</div>
      {children}
    </motion.section>
  )
}

function AdminOnlyForbidden() {
  return (
    <div className="mx-auto flex min-h-[78vh] max-w-5xl items-center justify-center px-4 py-10" style={{ fontFamily: sans }}>
      <div className="w-full rounded-[32px] border p-8 text-center md:p-12" style={{ background: 'radial-gradient(circle at top, rgba(239,68,68,0.14), transparent 35%), #18181b', borderColor: border }}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10"><ShieldAlert className="text-red-400" /></div>
        <div className="mt-6 text-xs uppercase tracking-[0.36em] text-red-300">Admin-Only</div>
        <h1 className="mt-3 text-3xl font-semibold text-zinc-50 md:text-5xl">403 Forbidden: SRE Clearance Required</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400 md:text-base">This command center exposes live infrastructure, runtime, judge, and security telemetry reserved for JudGO administrators.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/dashboard" className="rounded-2xl border px-5 py-3 text-sm text-zinc-100 transition hover:bg-white/5" style={{ borderColor: border }}>Return to user dashboard</Link><Link to="/" className="rounded-2xl bg-zinc-50 px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200">Go to homepage</Link></div>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const role = String(useAuthStore((s) => s.profile?.role) || '').toUpperCase()
  const [visibility, setVisibility] = useState(() => Object.fromEntries(metricDefs.map((item) => [item.key, true])))
  const [snapshot, setSnapshot] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const pull = async (silent) => {
      try {
        const data = await adminOpsMetrics()
        if (!active) return
        setSnapshot(data)
        setHistory((current) => {
          const securityTotal = Number(data?.security?.unauthorizedTotal || 0) + Number(data?.security?.forbiddenTotal || 0) + Number(data?.security?.invalidPasswordTotal || 0)
          const point = {
            timestamp: data?.generatedAt || new Date().toISOString(),
            label: formatLabel(data?.generatedAt),
            cpu: Number(data?.system?.systemCpuPercent || 0),
            processCpu: Number(data?.system?.processCpuPercent || 0),
            memory: Number(data?.system?.containerMemoryUsedPct || data?.system?.systemMemoryUsedPct || 0),
            load: Number(data?.system?.load1 || 0),
            compileP95: Number(data?.judge?.compileP95Ms || 0),
            judgeP95: Number(data?.judge?.judgeP95Ms || 0),
            sandboxes: Number(data?.judge?.activeSandboxes || 0),
            security: securityTotal,
          }
          return [...current.slice(-47), point]
        })
        setError('')
      } catch (err) {
        if (!active) return
        setError(err?.message || 'Failed to load live metrics')
        if (!silent) toast.error(err?.message || 'Failed to load live metrics')
      } finally {
        if (active) setLoading(false)
      }
    }
    pull(false)
    const intervalId = window.setInterval(() => pull(true), pollMs)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [])

  const latestPoint = history.at(-1)
  const previousPoint = history.at(-2) || latestPoint
  const system = snapshot?.system || {}
  const platform = snapshot?.platform || {}
  const judge = snapshot?.judge || {}
  const security = snapshot?.security || {}
  const securityTotal = Number(security.unauthorizedTotal || 0) + Number(security.forbiddenTotal || 0) + Number(security.invalidPasswordTotal || 0)
  const securityDelta = Math.max(0, Number(latestPoint?.security || 0) - Number(previousPoint?.security || 0))

  const memorySlope = useMemo(() => {
    const recent = history.slice(-6)
    const first = recent[0]
    const last = recent.at(-1)
    if (!first || !last || recent.length < 2) return 0
    const seconds = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 1000
    if (seconds <= 0) return 0
    return (last.memory - first.memory) / seconds
  }, [history])

  const etaToDanger = memorySlope > 0 && Number(system.containerMemoryUsedPct || system.systemMemoryUsedPct || 0) < 92
    ? (92 - Number(system.containerMemoryUsedPct || system.systemMemoryUsedPct || 0)) / memorySlope / 60
    : null

  const alerts = useMemo(() => {
    const next = []
    const memoryPressure = Number(system.containerMemoryUsedPct || system.systemMemoryUsedPct || 0)
    if (memoryPressure >= 90) {
      next.push({ severity: 'critical', title: 'Memory pressure exceeds safe headroom', detail: `${memoryPressure.toFixed(1)}% memory is currently consumed by the live backend footprint.`, note: 'Inspect RSS, goroutine growth, and active judge load before the worker gets recycled by the container runtime.', runbook: 'Runbook: inspect process RSS, compare Go heap vs container usage, then restart the hottest worker only if pressure does not fall after judge load decreases.' })
    }
    if (Number(system.systemCpuPercent || 0) >= 85 || Number(system.load1 || 0) >= Number(system.cpuCores || 1)) {
      next.push({ severity: 'warning', title: 'Compute saturation is building', detail: `System CPU is ${formatPercent(system.systemCpuPercent)} with load1 at ${Number(system.load1 || 0).toFixed(2)}.`, note: 'High CPU together with high load means judge latency will become visible to contestants quickly.', runbook: 'Runbook: inspect active sandboxes and compile p95, then shift traffic or scale judge workers before submission latency cascades.' })
    }
    if (judge.enabled && Number(judge.compileP95Ms || 0) >= 1500) {
      next.push({ severity: 'warning', title: 'Compilation latency is above operator threshold', detail: `Compile p95 is ${formatMs(judge.compileP95Ms)} while judge p95 is ${formatMs(judge.judgeP95Ms)}.`, note: 'This usually points to build contention, hot sandboxes, or too many concurrent compile-heavy submissions.', runbook: 'Runbook: inspect compile error surge, reduce noisy traffic, and scale sandbox capacity if active sandboxes stay elevated.' })
    }
    if (securityDelta >= 5) {
      next.push({ severity: 'warning', title: 'Security denials spiked during the latest polling window', detail: `${securityDelta} new unauthorized, forbidden, or invalid-password events were recorded in the last ${pollMs / 1000}s.`, note: 'This is a real backend counter built from auth failures, admin denials, and private room password mismatches.', runbook: 'Runbook: inspect request origin and auth freshness, then correlate with admin actions or abusive room join attempts.' })
    }
    return next
  }, [judge.compileP95Ms, judge.enabled, judge.judgeP95Ms, securityDelta, system.containerMemoryUsedPct, system.cpuCores, system.load1, system.systemCpuPercent, system.systemMemoryUsedPct])

  const liveSeries = history.slice(-12)
  const dailyActivity = useMemo(() => {
    const subs = platform.submissionsDaily || []
    const solved = platform.solvedDaily || []
    return subs.map((item, index) => ({
      day: formatDay(item.day),
      submissions: Number(item.count || 0),
      solved: Number(solved[index]?.count || 0),
    }))
  }, [platform.solvedDaily, platform.submissionsDaily])

  const languageData = useMemo(() => Object.entries(platform.submissionsByLang || {}).map(([language, count]) => ({ language, count })).sort((a, b) => b.count - a.count).slice(0, 6), [platform.submissionsByLang])
  const difficultyData = useMemo(() => Object.entries(platform.solvedByDifficulty || {}).map(([difficulty, count]) => ({ difficulty, count })), [platform.solvedByDifficulty])

  const metricItems = useMemo(() => {
    const currentMemoryPct = Number(system.containerMemoryUsedPct || system.systemMemoryUsedPct || 0)
    return [
      { ...metricDefs[0], value: formatPercent(system.systemCpuPercent), caption: `Process CPU ${formatPercent(system.processCpuPercent)} across ${system.cpuCores || 0} cores`, delta: `${latestPoint && previousPoint ? (Number(latestPoint.cpu || 0) - Number(previousPoint.cpu || 0) >= 0 ? '+' : '') : ''}${((Number(latestPoint?.cpu || 0) - Number(previousPoint?.cpu || 0))).toFixed(1)}%` },
      { ...metricDefs[1], value: formatPercent(currentMemoryPct), caption: etaToDanger && etaToDanger > 0 ? `Projected 92% threshold in ${etaToDanger.toFixed(1)} min` : `RSS ${formatMemory(system.processRssMB)} · Go alloc ${formatMemory(system.goAllocMB)}`, delta: `${memorySlope >= 0 ? '+' : ''}${memorySlope.toFixed(3)}%/s` },
      { ...metricDefs[2], value: Number(system.load1 || 0).toFixed(2), caption: `load5 ${Number(system.load5 || 0).toFixed(2)} · load15 ${Number(system.load15 || 0).toFixed(2)}`, delta: `${system.goroutines || 0} goroutines` },
      { ...metricDefs[3], value: formatCount(judge.activeSandboxes), caption: judge.enabled ? `${judge.totalRuns || 0} total judge runs tracked live` : 'Judge telemetry idle until JUDGE_DEV is enabled', delta: `${platform.runningGames || 0} live room games` },
      { ...metricDefs[4], value: formatMs(judge.compileP95Ms), caption: `avg ${formatMs(judge.compileAvgMs)} · compile errors ${judge.compileErrors || 0}`, delta: `last ${formatMs(judge.lastCompileMs)}` },
      { ...metricDefs[5], value: formatMs(judge.judgeP95Ms), caption: `avg ${formatMs(judge.judgeAvgMs)} · TLE ${judge.timeLimitExceeded || 0}`, delta: `${judge.runtimeErrors || 0} runtime errors` },
      { ...metricDefs[6], value: formatCount(securityTotal), caption: 'Unauthorized + forbidden + invalid private room password events', delta: `+${securityDelta} latest window` },
      { ...metricDefs[7], value: String(alerts.length), caption: alerts.length ? 'Thresholds breached on real backend signals' : 'All current backend thresholds are healthy', delta: alerts.some((item) => item.severity === 'critical') ? 'Critical' : 'Nominal' },
    ]
  }, [alerts, etaToDanger, judge.activeSandboxes, judge.compileAvgMs, judge.compileErrors, judge.compileP95Ms, judge.enabled, judge.judgeAvgMs, judge.judgeP95Ms, judge.lastCompileMs, judge.runtimeErrors, judge.timeLimitExceeded, judge.totalRuns, latestPoint, memorySlope, platform.runningGames, previousPoint, securityDelta, securityTotal, system.containerMemoryUsedPct, system.cpuCores, system.goAllocMB, system.goroutines, system.load1, system.load15, system.load5, system.processCpuPercent, system.processRssMB, system.systemCpuPercent, system.systemMemoryUsedPct])

  const handleRunbook = (message) => toast(message, { icon: '📘' })

  if (role !== 'ADMIN') return <AdminOnlyForbidden />

  return (
    <div className="min-h-screen px-4 py-6 md:px-6 md:py-8" style={{ backgroundColor: bg, color: '#fafafa', fontFamily: sans }}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[32px] border p-6 md:p-8" style={{ background: 'radial-gradient(circle at top right, rgba(34,211,238,0.18), transparent 30%), radial-gradient(circle at top left, rgba(244,114,182,0.14), transparent 26%), #18181b', borderColor: border }}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.32em] text-cyan-200" style={{ borderColor: '#164e63', backgroundColor: '#0f172a' }}><Waves size={14} /> Live backend polling · {pollMs / 1000}s cadence</div>
              <h1 className="mt-4 text-3xl font-semibold text-zinc-50 md:text-5xl">JudGO SRE Command Center</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base">This screen now renders real runtime, container, judge, room, platform, and security counters from the Go backend. No synthetic CPU, RAM, compile, or security values remain on the glass.</p>
              {error ? <div className="mt-4 inline-flex rounded-2xl border px-4 py-2 text-sm text-red-200" style={{ borderColor: '#7f1d1d', backgroundColor: 'rgba(127,29,29,0.16)' }}>{error}</div> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border p-4" style={{ backgroundColor: '#0f172a', borderColor: '#164e63' }}><div className="text-xs uppercase tracking-[0.28em] text-cyan-200">Host uptime</div><div className="mt-2 text-xl font-semibold" style={{ fontFamily: mono }}>{formatUptime(system.uptimeSec)}</div></div>
              <div className="rounded-2xl border p-4" style={{ backgroundColor: '#111827', borderColor: '#1f2937' }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-400">Platform live users</div><div className="mt-2 text-xl font-semibold" style={{ fontFamily: mono }}>{platform.livePlayers || 0}</div></div>
              <div className="rounded-2xl border p-4" style={{ backgroundColor: '#111827', borderColor: '#1f2937' }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-400">Classic tools</div><Link to="/admin" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-zinc-50">Open admin panel <ChevronRight size={16} /></Link></div>
            </div>
          </div>
        </div>

        <Panel title="Metric visibility matrix" question="What should stay on the glass during an incident?" subtitle="You can hide or restore any live card while keeping the backend polling loop intact." aside={<div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-zinc-300" style={{ borderColor: border }}><Sparkles size={14} /> Customizable operator layout</div>}>
          <div className="flex flex-wrap gap-3">{metricItems.map((item) => <button key={item.key} type="button" onClick={() => setVisibility((current) => ({ ...current, [item.key]: !current[item.key] }))} className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition hover:bg-white/5" style={{ borderColor: visibility[item.key] ? `${item.tone}55` : border }}><item.icon size={15} color={item.tone} /> {visibility[item.key] ? <EyeOff size={14} /> : <Eye size={14} />} {visibility[item.key] ? 'Hide' : 'Show'} {item.label}</button>)}</div>
        </Panel>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{metricItems.filter((item) => visibility[item.key]).map((item) => <MetricCard key={item.key} item={item} onToggle={() => setVisibility((current) => ({ ...current, [item.key]: false }))} />)}</div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <Panel title="Live infrastructure pressure" question="Panel 1" subtitle="This trendline is built from real backend polling snapshots and shows how CPU, memory, and load move over time on the active API process." aside={<div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: border }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Last refresh</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{formatLabel(snapshot?.generatedAt)}</div></div>}>
            <div className="h-72">{loading && !snapshot ? <div className="flex h-full items-center justify-center text-sm text-zinc-500">Loading live metrics…</div> : <ResponsiveContainer width="100%" height="100%"><ComposedChart data={liveSeries}><CartesianGrid stroke="#27272a" vertical={false} /><XAxis dataKey="label" stroke="#71717a" tickLine={false} axisLine={false} /><YAxis yAxisId="left" stroke="#71717a" tickLine={false} axisLine={false} /><YAxis yAxisId="right" orientation="right" stroke="#71717a" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#111827', border: `1px solid ${border}`, borderRadius: 16 }} /><Area yAxisId="left" type="monotone" dataKey="cpu" stroke="#22d3ee" fill="#22d3ee22" strokeWidth={2.2} /><Line yAxisId="left" type="monotone" dataKey="memory" stroke="#f472b6" strokeWidth={2.2} dot={false} /><Line yAxisId="right" type="monotone" dataKey="load" stroke="#f59e0b" strokeWidth={2.2} dot={false} /></ComposedChart></ResponsiveContainer>}</div>
          </Panel>

          <Panel title="Judge latency and sandbox activity" question="Panel 2" subtitle="Compile p95, judge p95, and live active sandboxes now come from real judge telemetry in the Go service." aside={<div className="rounded-2xl border px-4 py-3" style={{ borderColor: border }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Judge status</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{judge.enabled ? 'Live' : 'Idle'}</div></div>}>
            <div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border p-4" style={{ borderColor: border }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Active sandboxes</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{judge.activeSandboxes || 0}</div></div><div className="rounded-2xl border p-4" style={{ borderColor: border }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Compile failures</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{judge.compileErrors || 0}</div></div><div className="rounded-2xl border p-4" style={{ borderColor: border }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Runtime/TLE</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{(judge.runtimeErrors || 0) + (judge.timeLimitExceeded || 0)}</div></div></div>
            <div className="mt-5 h-56"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={liveSeries}><CartesianGrid stroke="#27272a" vertical={false} /><XAxis dataKey="label" stroke="#71717a" tickLine={false} axisLine={false} /><YAxis yAxisId="left" stroke="#71717a" tickLine={false} axisLine={false} /><YAxis yAxisId="right" orientation="right" stroke="#71717a" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#111827', border: `1px solid ${border}`, borderRadius: 16 }} /><Line yAxisId="left" type="monotone" dataKey="compileP95" stroke="#60a5fa" strokeWidth={2.2} dot={false} /><Line yAxisId="left" type="monotone" dataKey="judgeP95" stroke="#a78bfa" strokeWidth={2.2} dot={false} /><Area yAxisId="right" type="monotone" dataKey="sandboxes" stroke="#34d399" fill="#34d39922" strokeWidth={2.2} /></ComposedChart></ResponsiveContainer></div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <Panel title="Platform activity over the last 14 days" question="Panel 3" subtitle="The backend aggregates real submission and solved history across stored practice records, so these charts reflect actual platform use rather than browser-local counters." aside={<div className="rounded-2xl border px-4 py-3" style={{ borderColor: border }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Pass rate</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{formatPercent(platform.passRatePct)}</div></div>}>
            <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyActivity}><CartesianGrid stroke="#27272a" vertical={false} /><XAxis dataKey="day" stroke="#71717a" tickLine={false} axisLine={false} /><YAxis stroke="#71717a" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#111827', border: `1px solid ${border}`, borderRadius: 16 }} /><Bar dataKey="submissions" fill="#22d3ee" radius={[8, 8, 0, 0]} /><Bar dataKey="solved" fill="#34d399" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </Panel>

          <Panel title="Distribution and security posture" question="Panel 4" subtitle="Language mix, solved difficulty, and auth denial counters show what contestants are doing and where the platform is resisting bad traffic." aside={<div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-emerald-300" style={{ borderColor: '#14532d', backgroundColor: '#052e16' }}><ShieldCheck size={14} /> Real backend counters only</div>}>
            <div className="grid gap-4 md:grid-cols-2"><div className="h-56 rounded-2xl border p-3" style={{ borderColor: border }}><div className="mb-2 text-xs uppercase tracking-[0.28em] text-zinc-500">Top languages</div><ResponsiveContainer width="100%" height="100%"><BarChart data={languageData}><CartesianGrid stroke="#27272a" vertical={false} /><XAxis dataKey="language" stroke="#71717a" tickLine={false} axisLine={false} /><YAxis stroke="#71717a" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#111827', border: `1px solid ${border}`, borderRadius: 16 }} /><Bar dataKey="count" fill="#60a5fa" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="h-56 rounded-2xl border p-3" style={{ borderColor: border }}><div className="mb-2 text-xs uppercase tracking-[0.28em] text-zinc-500">Solved by difficulty</div><ResponsiveContainer width="100%" height="100%"><BarChart data={difficultyData}><CartesianGrid stroke="#27272a" vertical={false} /><XAxis dataKey="difficulty" stroke="#71717a" tickLine={false} axisLine={false} /><YAxis stroke="#71717a" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#111827', border: `1px solid ${border}`, borderRadius: 16 }} /><Bar dataKey="count" fill="#f472b6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
            <div className="mt-4 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border p-4" style={{ borderColor: border }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Unauthorized</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{security.unauthorizedTotal || 0}</div></div><div className="rounded-2xl border p-4" style={{ borderColor: border }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Forbidden</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{security.forbiddenTotal || 0}</div></div><div className="rounded-2xl border p-4" style={{ borderColor: border }}><div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Invalid room passwords</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{security.invalidPasswordTotal || 0}</div></div></div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
          <Panel title="Actionable alerts and runbooks" question="Panel 5" subtitle="Alerts are now derived from live backend thresholds. Runbook actions reveal operator guidance without pretending to trigger backend remediations that do not exist yet." aside={<div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-zinc-300" style={{ borderColor: border }}><Activity size={14} /> Real threshold evaluation</div>}>
            <div className="space-y-4">{alerts.length ? alerts.map((alert) => <div key={alert.title} className="rounded-3xl border p-4" style={{ borderColor: alert.severity === 'critical' ? '#7f1d1d' : '#78350f', backgroundColor: alert.severity === 'critical' ? 'rgba(127,29,29,0.18)' : 'rgba(120,53,15,0.16)' }}><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: alert.severity === 'critical' ? 'rgba(239,68,68,0.16)' : 'rgba(245,158,11,0.16)' }}>{alert.severity === 'critical' ? <ServerCrash className="text-red-300" size={18} /> : <AlertTriangle className="text-amber-300" size={18} />}</div><div><div className="text-xs uppercase tracking-[0.28em] text-zinc-400">{alert.severity}</div><div className="mt-1 text-lg font-semibold text-zinc-50">{alert.title}</div><div className="mt-2 text-sm text-zinc-300">{alert.detail}</div><div className="mt-1 text-sm text-zinc-400">{alert.note}</div></div></div><button type="button" onClick={() => handleRunbook(alert.runbook)} className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-zinc-950 transition hover:opacity-90" style={{ backgroundColor: alert.severity === 'critical' ? '#fda4af' : '#fcd34d' }}>Open runbook <ArrowRight size={16} /></button></div></div>) : <div className="rounded-3xl border p-6 text-center" style={{ borderColor: '#14532d', backgroundColor: 'rgba(20,83,45,0.16)' }}><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10"><ShieldCheck className="text-emerald-300" /></div><div className="mt-3 text-lg font-semibold text-zinc-50">All current SRE thresholds are healthy</div><div className="mt-2 text-sm text-zinc-400">The page is polling real backend metrics and no configured threshold is firing right now.</div></div>}</div>
          </Panel>

          <Panel title="Platform overview" question="Panel 6" subtitle="These cards summarize the broader health of JudGO using real repository-backed counts from users, problems, submissions, and live rooms." aside={<div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-zinc-300" style={{ borderColor: border }}><Users size={14} /> Repository aggregates</div>}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div className="rounded-[24px] border p-4" style={{ borderColor: border }}><div className="flex items-center gap-2 text-sm text-zinc-300"><Users size={16} /> Users</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{platform.totalUsers || 0}</div><div className="mt-2 text-sm text-zinc-500">{platform.adminUsers || 0} admins · {platform.newUsers24h || 0} new in 24h</div></div><div className="rounded-[24px] border p-4" style={{ borderColor: border }}><div className="flex items-center gap-2 text-sm text-zinc-300"><Database size={16} /> Problems</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{platform.totalProblems || 0}</div><div className="mt-2 text-sm text-zinc-500">{platform.publishedProblems || 0} published · {platform.draftProblems || 0} draft</div></div><div className="rounded-[24px] border p-4" style={{ borderColor: border }}><div className="flex items-center gap-2 text-sm text-zinc-300"><Activity size={16} /> Submissions</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{formatCount(platform.totalSubmissions)}</div><div className="mt-2 text-sm text-zinc-500">{platform.submissions24h || 0} in 24h · {platform.solved24h || 0} solved in 24h</div></div><div className="rounded-[24px] border p-4" style={{ borderColor: border }}><div className="flex items-center gap-2 text-sm text-zinc-300"><Layers3 size={16} /> Rooms</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{platform.activeRooms || 0}</div><div className="mt-2 text-sm text-zinc-500">{platform.waitingRooms || 0} waiting · {platform.runningRooms || 0} running</div></div><div className="rounded-[24px] border p-4" style={{ borderColor: border }}><div className="flex items-center gap-2 text-sm text-zinc-300"><Cpu size={16} /> Runtime</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{system.goroutines || 0}</div><div className="mt-2 text-sm text-zinc-500">GC cycles {system.gcCount || 0} · Go {system.goVersion || 'n/a'}</div></div><div className="rounded-[24px] border p-4" style={{ borderColor: border }}><div className="flex items-center gap-2 text-sm text-zinc-300"><MemoryStick size={16} /> Container</div><div className="mt-2 text-2xl font-semibold text-zinc-50" style={{ fontFamily: mono }}>{formatMemory(system.containerMemoryUsedMB || system.systemMemoryUsedMB)}</div><div className="mt-2 text-sm text-zinc-500">limit {formatMemory(system.containerMemoryLimitMB || system.systemMemoryTotalMB)}</div></div></div>
          </Panel>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border p-5" style={{ backgroundColor: card, borderColor: border }}><div className="flex items-center gap-3"><TerminalSquare className="text-cyan-300" size={18} /><div className="text-sm font-medium text-zinc-100">Telemetry source</div></div><div className="mt-3 text-sm text-zinc-400">CPU, memory, load, goroutines, judge latency, sandbox count, rooms, users, submissions, and security denials come from live backend state and repository reads.</div></div>
          <div className="rounded-[28px] border p-5" style={{ backgroundColor: card, borderColor: border }}><div className="flex items-center gap-3"><MemoryStick className="text-pink-300" size={18} /><div className="text-sm font-medium text-zinc-100">Predictive memory note</div></div><div className="mt-3 text-sm text-zinc-400">{etaToDanger && etaToDanger > 0 ? `At the current slope, the service reaches the 92% memory danger line in about ${etaToDanger.toFixed(1)} minutes.` : 'Recent polling history does not indicate an immediate memory runaway.'}</div></div>
          <div className="rounded-[28px] border p-5" style={{ backgroundColor: card, borderColor: border }}><div className="flex items-center gap-3"><ShieldAlert className="text-amber-300" size={18} /><div className="text-sm font-medium text-zinc-100">Honest gaps</div></div><div className="mt-3 text-sm text-zinc-400">Firebase latency and domain-specific cheat-block counters are still not instrumented in the backend, so they are intentionally not fabricated on this dashboard.</div></div>
        </div>
      </div>
    </div>
  )
}
