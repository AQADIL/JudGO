import { motion } from 'framer-motion'
import { Plus, Users, FileText, MoreVertical, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { GlassCard } from '../components/GlassCard'
import { BrandMark } from '../components/BrandMark'
import { adminProblems, adminUsers, createAdminProblem } from '../services/api'

export function AdminPanel() {
  const [users, setUsers] = useState([])
  const [problems, setProblems] = useState([])
  const [error, setError] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [pId, setPId] = useState('')
  const [pTitle, setPTitle] = useState('')
  const [pStatement, setPStatement] = useState('')
  const [pInputFormat, setPInputFormat] = useState('')
  const [pOutputFormat, setPOutputFormat] = useState('')
  const [pDifficulty, setPDifficulty] = useState('EASY')
  const [pStatus, setPStatus] = useState('DRAFT')
  const [pTags, setPTags] = useState('')
  const [starterGo, setStarterGo] = useState('')
  const [starterPy, setStarterPy] = useState('')
  const [testCases, setTestCases] = useState([{ input: '', output: '', isHidden: false }])

  const statusColors = {
    Active: 'text-green-400',
    Inactive: 'text-red-400',
    PUBLISHED: 'text-green-400',
    DRAFT: 'text-yellow-400',
    ARCHIVED: 'text-frost-300',
  }

  const difficultyColors = {
    EASY: 'text-green-400',
    MEDIUM: 'text-yellow-400',
    HARD: 'text-red-400',
  }

  const rows = useMemo(() => {
    return users.map((u) => ({
      id: u.id,
      name: u.displayName || u.email,
      email: u.email,
      role: u.role || 'USER',
      status: 'Active',
      problemsSolved: 0,
    }))
  }, [users])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError('')
      try {
        const data = await adminUsers()
        if (!cancelled) setUsers(Array.isArray(data) ? data : [])

        const probs = await adminProblems()
        if (!cancelled) setProblems(Array.isArray(probs) ? probs : [])
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load users')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const trimRight = (s) => String(s || '').replace(/[\s\n\r\t]+$/g, '')

  const onAddTestCase = () => {
    setTestCases((prev) => [...prev, { input: '', output: '', isHidden: false }])
  }

  const onRemoveTestCase = (idx) => {
    setTestCases((prev) => prev.filter((_, i) => i !== idx))
  }

  const onSaveProblem = async () => {
    setError('')
    setSaving(true)
    try {
      const tags = String(pTags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const payload = {
        id: String(pId || '').trim(),
        title: String(pTitle || '').trim(),
        statement: String(pStatement || ''),
        inputFormat: String(pInputFormat || ''),
        outputFormat: String(pOutputFormat || ''),
        difficulty: pDifficulty,
        tags,
        status: pStatus,
        starterCode: {
          go: String(starterGo || ''),
          py: String(starterPy || ''),
        },
        testCases: (testCases || []).map((tc) => ({
          input: trimRight(tc.input),
          output: trimRight(tc.output),
          isHidden: !!tc.isHidden,
        })),
      }

      const created = await createAdminProblem(payload)
      setProblems((prev) => [created, ...(prev || [])])
      setAddOpen(false)
    } catch (e) {
      setError(e?.message || 'Failed to save problem')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="container-page pt-10 pb-6">
        <div className="flex items-center justify-between">
          <BrandMark />
          <div className="flex items-center gap-4">
            <div className="glass px-4 py-2 flex items-center gap-2">
              <Search className="h-4 w-4 text-frost-300" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent outline-none text-frost-100 placeholder-frost-300"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container-page">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-frost-50">Admin Panel</h1>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="glass-strong rounded-xl2 px-4 py-2 text-sm text-frost-50 flex items-center gap-2"
              type="button"
              onClick={() => setAddOpen((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              Add Problem
            </motion.button>
          </div>

          {addOpen ? (
            <GlassCard>
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={pId} onChange={(e) => setPId(e.target.value)} placeholder="ID (slug)" className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent" />
                  <input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="Title" className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent" />
                </div>
                <textarea value={pStatement} onChange={(e) => setPStatement(e.target.value)} placeholder="Statement" className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent min-h-[120px]" />
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={pInputFormat} onChange={(e) => setPInputFormat(e.target.value)} placeholder="Input format" className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent" />
                  <input value={pOutputFormat} onChange={(e) => setPOutputFormat(e.target.value)} placeholder="Output format" className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent" />
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <select value={pDifficulty} onChange={(e) => setPDifficulty(e.target.value)} className="glass px-4 py-3 rounded-lg text-frost-50 bg-transparent">
                    <option className="bg-ink-900" value="EASY">EASY</option>
                    <option className="bg-ink-900" value="MEDIUM">MEDIUM</option>
                    <option className="bg-ink-900" value="HARD">HARD</option>
                  </select>
                  <select value={pStatus} onChange={(e) => setPStatus(e.target.value)} className="glass px-4 py-3 rounded-lg text-frost-50 bg-transparent">
                    <option className="bg-ink-900" value="DRAFT">DRAFT</option>
                    <option className="bg-ink-900" value="PUBLISHED">PUBLISHED</option>
                    <option className="bg-ink-900" value="ARCHIVED">ARCHIVED</option>
                  </select>
                  <input value={pTags} onChange={(e) => setPTags(e.target.value)} placeholder="Tags (comma)" className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent md:col-span-2" />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <textarea value={starterGo} onChange={(e) => setStarterGo(e.target.value)} placeholder="Starter code (Go)" className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent min-h-[120px]" />
                  <textarea value={starterPy} onChange={(e) => setStarterPy(e.target.value)} placeholder="Starter code (Python)" className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent min-h-[120px]" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-frost-50 font-medium">Test cases</div>
                    <button type="button" onClick={onAddTestCase} className="glass px-3 py-2 rounded-lg text-frost-50 text-sm">Add Test Case</button>
                  </div>
                  <div className="space-y-3">
                    {testCases.map((tc, idx) => (
                      <div key={idx} className="glass p-4 rounded-xl2 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-frost-200 text-sm">
                            <input
                              type="checkbox"
                              checked={!!tc.isHidden}
                              onChange={(e) => {
                                setTestCases((prev) => {
                                  const next = [...prev]
                                  next[idx] = { ...next[idx], isHidden: e.target.checked }
                                  return next
                                })
                              }}
                            />
                            Hidden?
                          </label>
                          <button type="button" onClick={() => onRemoveTestCase(idx)} className="glass px-3 py-2 rounded-lg text-frost-50 text-sm">Remove</button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <textarea
                            value={tc.input}
                            onChange={(e) => {
                              const val = e.target.value
                              setTestCases((prev) => {
                                const next = [...prev]
                                next[idx] = { ...next[idx], input: val }
                                return next
                              })
                            }}
                            placeholder="Input"
                            className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent min-h-[120px]"
                          />
                          <textarea
                            value={tc.output}
                            onChange={(e) => {
                              const val = e.target.value
                              setTestCases((prev) => {
                                const next = [...prev]
                                next[idx] = { ...next[idx], output: val }
                                return next
                              })
                            }}
                            placeholder="Output"
                            className="w-full glass px-4 py-3 rounded-lg text-frost-50 bg-transparent min-h-[120px]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={onSaveProblem}
                  className="glass-strong px-4 py-3 rounded-lg text-frost-50 w-full disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Problem'}
                </button>
              </div>
            </GlassCard>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-2">
            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-accent-steel/20 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-accent-steel" />
                </div>
                <div>
                  <h3 className="font-semibold text-frost-50">User Management</h3>
                  <p className="text-sm text-frost-200">Manage platform users</p>
                </div>
              </div>

              {error ? (
                <div className="glass px-3 py-2 rounded-lg text-sm text-red-200 border border-red-500/20 mb-4">
                  {error}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Name</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Role</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Status</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Problems</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((user, index) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-2">
                          <div>
                            <div className="font-medium text-frost-50 text-sm">{user.name}</div>
                            <div className="text-xs text-frost-300">{user.email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-sm text-frost-100">{user.role}</td>
                        <td className="py-3 px-2">
                          <span className={`text-sm ${statusColors[user.status]}`}>{user.status}</span>
                        </td>
                        <td className="py-3 px-2 text-sm text-frost-100">{user.problemsSolved}</td>
                        <td className="py-3 px-2">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            <MoreVertical className="h-4 w-4 text-frost-300" />
                          </motion.button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-accent-lilac/20 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-accent-lilac" />
                </div>
                <div>
                  <h3 className="font-semibold text-frost-50">Problem Management</h3>
                  <p className="text-sm text-frost-200">Manage coding problems</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Title</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Difficulty</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Status</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Submissions</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {problems.map((problem, index) => (
                      <motion.tr
                        key={problem.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-2">
                          <div className="font-medium text-frost-50 text-sm">{problem.title}</div>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-sm ${difficultyColors[problem.difficulty] || 'text-frost-200'}`}>{problem.difficulty}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-sm ${statusColors[problem.status] || 'text-frost-200'}`}>{problem.status}</span>
                        </td>
                        <td className="py-3 px-2 text-sm text-frost-100">{Number(problem.submissions) || 0}</td>
                        <td className="py-3 px-2">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            <MoreVertical className="h-4 w-4 text-frost-300" />
                          </motion.button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        </div>
      </main>

      <motion.button
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 w-14 h-14 glass-strong rounded-full flex items-center justify-center shadow-glow"
      >
        <Plus className="h-6 w-6 text-frost-50" />
      </motion.button>
    </div>
  )
}
