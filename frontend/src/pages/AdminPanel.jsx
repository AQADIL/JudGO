import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Users, FileText, Search, ChevronLeft, ChevronRight, 
  BarChart3, Code2, UserCheck, Trash2, Eye,
  TrendingUp, Calendar, Activity
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { GlassCard } from '../components/GlassCard'
import { BrandMark } from '../components/BrandMark'
import { adminProblems, adminUsers, adminUserStats, adminUserSubmissions, createAdminProblem } from '../services/api'

const ITEMS_PER_PAGE = 10

export function AdminPanel() {
  const [users, setUsers] = useState([])
  const [userStats, setUserStats] = useState([])
  const [userSubmissions, setUserSubmissions] = useState([])
  const [problems, setProblems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  
  const [activeTab, setActiveTab] = useState('overview')
  const [problemPage, setProblemPage] = useState(1)
  const [userPage, setUserPage] = useState(1)
  
  const [userSearch, setUserSearch] = useState('')
  const [problemSearch, setProblemSearch] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('ALL')

  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pId, setPId] = useState('')
  const [pTitle, setPTitle] = useState('')
  const [pStatement, setPStatement] = useState('')
  const [pDifficulty, setPDifficulty] = useState('EASY')
  const [pStatus, setPStatus] = useState('DRAFT')

  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedUserTab, setSelectedUserTab] = useState('solved') // 'solved' | 'all'

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

  const difficultyBg = {
    EASY: 'bg-green-500/20',
    MEDIUM: 'bg-yellow-500/20',
    HARD: 'bg-red-500/20',
  }

  const stats = useMemo(() => {
    const totalUsers = users.length
    const totalProblems = problems.length
    const publishedProblems = problems.filter(p => p.status === 'PUBLISHED').length
    const draftProblems = problems.filter(p => p.status === 'DRAFT').length
    const admins = users.filter(u => u.role === 'ADMIN').length
    
    // Calculate total submissions from actual practice data
    const totalSubmissions = userStats.reduce((sum, s) => sum + (s.totalSubmissions || 0), 0)
    const totalSolved = userStats.reduce((sum, s) => sum + (s.solvedCount || 0), 0)
    const totalPassed = userStats.reduce((sum, s) => sum + (s.passedCount || 0), 0)
    
    const problemsByDifficulty = {
      EASY: problems.filter(p => p.difficulty === 'EASY').length,
      MEDIUM: problems.filter(p => p.difficulty === 'MEDIUM').length,
      HARD: problems.filter(p => p.difficulty === 'HARD').length,
    }

    return {
      totalUsers,
      totalProblems,
      publishedProblems,
      draftProblems,
      totalSubmissions,
      totalSolved,
      totalPassed,
      admins,
      problemsByDifficulty,
    }
  }, [users, problems, userStats])

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const searchLower = userSearch.toLowerCase()
      const nameMatch = (u.displayName || u.email || '').toLowerCase().includes(searchLower)
      const emailMatch = (u.email || '').toLowerCase().includes(searchLower)
      return nameMatch || emailMatch
    })
  }, [users, userSearch])

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * ITEMS_PER_PAGE
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredUsers, userPage])

  const totalUserPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)

  const filteredProblems = useMemo(() => {
    return problems.filter(p => {
      const searchLower = problemSearch.toLowerCase()
      const titleMatch = (p.title || '').toLowerCase().includes(searchLower)
      const idMatch = (p.id || '').toLowerCase().includes(searchLower)
      const difficultyMatch = difficultyFilter === 'ALL' || p.difficulty === difficultyFilter
      return (titleMatch || idMatch) && difficultyMatch
    })
  }, [problems, problemSearch, difficultyFilter])

  const paginatedProblems = useMemo(() => {
    const start = (problemPage - 1) * ITEMS_PER_PAGE
    return filteredProblems.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredProblems, problemPage])

  const totalProblemPages = Math.ceil(filteredProblems.length / ITEMS_PER_PAGE)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError('')
      setLoading(true)
      try {
        const [data, probs, stats] = await Promise.all([
          adminUsers(),
          adminProblems(),
          adminUserStats()
        ])
        if (!cancelled) {
          setUsers(Array.isArray(data) ? data : [])
          setProblems(Array.isArray(probs) ? probs : [])
          setUserStats(Array.isArray(stats) ? stats : [])
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load data')
          toast.error('Failed to load admin data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const onSaveProblem = async () => {
    setError('')
    setSaving(true)
    try {
      const payload = {
        id: String(pId || '').trim(),
        title: String(pTitle || '').trim(),
        statement: String(pStatement || ''),
        difficulty: pDifficulty,
        status: pStatus,
        tags: [],
        starterCode: { go: '', py: '' },
        testCases: [],
      }

      const created = await createAdminProblem(payload)
      setProblems((prev) => [created, ...(prev || [])])
      setAddOpen(false)
      toast.success('Problem created successfully!')
      
      setPId('')
      setPTitle('')
      setPStatement('')
      setPDifficulty('EASY')
      setPStatus('DRAFT')
    } catch (e) {
      setError(e?.message || 'Failed to save problem')
      toast.error(e?.message || 'Failed to save problem')
    } finally {
      setSaving(false)
    }
  }

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <GlassCard className="p-3">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-frost-50" />
        </div>
        <div>
          <p className="text-frost-200 text-xs">{title}</p>
          <p className="text-xl font-bold text-frost-50">{value}</p>
          {subtitle && <p className="text-[10px] text-frost-400">{subtitle}</p>}
        </div>
      </div>
    </GlassCard>
  )

  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null
    
    return (
      <div className="flex items-center justify-center gap-1 mt-4">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg glass disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        
        <div className="flex items-center gap-0.5">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum
            if (totalPages <= 5) {
              pageNum = i + 1
            } else if (currentPage <= 3) {
              pageNum = i + 1
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i
            } else {
              pageNum = currentPage - 2 + i
            }
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                  currentPage === pageNum
                    ? 'bg-accent-steel text-frost-50'
                    : 'glass hover:bg-white/10'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>
        
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg glass disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-frost-50 text-lg">Loading admin panel...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="container-page pt-4 pb-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="h-5 w-px bg-white/20" />
            <h1 className="text-lg font-semibold text-frost-50">Admin</h1>
          </div>
          
          <div className="flex items-center gap-1 p-1 glass rounded-lg overflow-x-auto max-w-full">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'problems', label: 'Problems', icon: FileText },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === id
                    ? 'bg-accent-steel/30 text-frost-50'
                    : 'text-frost-300 hover:text-frost-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="container-page">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard
                  title="Users"
                  value={stats.totalUsers}
                  icon={Users}
                  color="bg-blue-500/20"
                  subtitle={`${stats.admins} admins`}
                />
                <StatCard
                  title="Problems"
                  value={stats.totalProblems}
                  icon={FileText}
                  color="bg-purple-500/20"
                  subtitle={`${stats.publishedProblems} pub`}
                />
                <StatCard
                  title="Submissions"
                  value={stats.totalSubmissions}
                  icon={Activity}
                  color="bg-green-500/20"
                  subtitle={`${stats.totalPassed} passed`}
                />
                <StatCard
                  title="Solved"
                  value={stats.totalSolved}
                  icon={Code2}
                  color="bg-cyan-500/20"
                />
                <StatCard
                  title="Drafts"
                  value={stats.draftProblems}
                  icon={BarChart3}
                  color="bg-yellow-500/20"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <GlassCard className="p-6">
                  <h3 className="text-lg font-semibold text-frost-50 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Problems by Difficulty
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(stats.problemsByDifficulty).map(([diff, count]) => (
                      <div key={diff} className="flex items-center gap-3">
                        <span className={`text-sm font-medium w-16 ${difficultyColors[diff]}`}>{diff}</span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${difficultyBg[diff]}`}
                            style={{ width: `${stats.totalProblems ? (count / stats.totalProblems) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm text-frost-200 w-8 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="p-6">
                  <h3 className="text-lg font-semibold text-frost-50 mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Quick Actions
                  </h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setActiveTab('problems')}
                      className="w-full glass p-4 rounded-xl2 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                          <Plus className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium text-frost-50">Add New Problem</p>
                          <p className="text-sm text-frost-300">Create a new coding challenge</p>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setActiveTab('users')}
                      className="w-full glass p-4 rounded-xl2 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-frost-50">Manage Users</p>
                          <p className="text-sm text-frost-300">View and manage user accounts</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </GlassCard>
              </div>

              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-frost-50">Recent Problems</h3>
                  <button
                    onClick={() => setActiveTab('problems')}
                    className="text-sm text-accent-steel hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Title</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Difficulty</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Status</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-frost-200">Submissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {problems.slice(0, 5).map((problem, index) => (
                        <motion.tr
                          key={problem.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-3 px-2">
                            <div className="font-medium text-frost-50 text-sm">{problem.title}</div>
                            <div className="text-xs text-frost-400">{problem.id}</div>
                          </td>
                          <td className="py-3 px-2">
                            <span className={`text-sm ${difficultyColors[problem.difficulty] || 'text-frost-200'}`}>
                              {problem.difficulty}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <span className={`text-sm ${statusColors[problem.status] || 'text-frost-200'}`}>
                              {problem.status}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-sm text-frost-100">
                            {(() => {
                              // Calculate actual submissions per problem from userStats
                              const problemSubs = userStats.reduce((sum, u) => {
                                if (u.solvedProblems) {
                                  const solved = u.solvedProblems.find(sp => sp.problemId === problem.id)
                                  if (solved) return sum + (solved.attemptsToSolve || 1)
                                }
                                return sum
                              }, 0)
                              return problemSubs || Number(problem.submissions) || 0
                            })()}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-frost-50">Users ({filteredUsers.length})</h2>
                <div className="glass px-3 py-1.5 flex items-center gap-2 w-full sm:w-auto">
                  <Search className="h-3.5 w-3.5 text-frost-300" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1) }}
                    className="bg-transparent outline-none text-frost-100 placeholder-frost-300 text-sm w-full sm:w-48"
                  />
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="block sm:hidden space-y-2">
                {paginatedUsers.map((user, index) => {
                  const stats = userStats.find(s => s.userId === user.id) || {}
                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="glass p-3 rounded-xl2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-accent-steel/30 flex items-center justify-center text-sm font-medium">
                            {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-frost-50 text-sm">{user.displayName || 'No name'}</div>
                            <div className="text-xs text-frost-400">{user.email}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedUser({ ...user, stats })}
                          className="p-1.5 hover:bg-white/10 rounded-lg"
                        >
                          <Eye className="h-4 w-4 text-frost-300" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/10 text-xs">
                        <span className="text-green-400">{stats.solvedCount || 0} solved</span>
                        <span className="text-frost-300">{stats.totalSubmissions || 0} subs</span>
                        <span className={stats.successRate >= 70 ? 'text-green-400' : stats.successRate >= 40 ? 'text-yellow-400' : 'text-red-400'}>
                          {stats.successRate || 0}%
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Desktop Table */}
              <GlassCard className="hidden sm:block p-4">
                {error ? (
                  <div className="glass px-3 py-2 rounded-lg text-sm text-red-200 border border-red-500/20 mb-4">
                    {error}
                  </div>
                ) : null}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-2 px-2 text-xs font-medium text-frost-300">User</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-frost-300">Role</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-frost-300">Solved</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-frost-300">Subs</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-frost-300">Rate</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-frost-300"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((user, index) => {
                        const stats = userStats.find(s => s.userId === user.id) || {}
                        return (
                          <motion.tr
                            key={user.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-accent-steel/30 flex items-center justify-center text-xs font-medium">
                                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-frost-50 text-sm">{user.displayName || 'No name'}</div>
                                  <div className="text-[10px] text-frost-400">{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                user.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {user.role === 'ADMIN' ? 'ADM' : 'USR'}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center text-green-400 font-medium">{stats.solvedCount || 0}</td>
                            <td className="py-2 px-2 text-center text-frost-300">{stats.totalSubmissions || 0}</td>
                            <td className="py-2 px-2 text-center">
                              <span className={`text-xs font-medium ${
                                (stats.successRate || 0) >= 70 ? 'text-green-400' :
                                (stats.successRate || 0) >= 40 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {stats.successRate ? `${Math.round(stats.successRate)}%` : '0%'}
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              <button
                                onClick={() => setSelectedUser({ ...user, stats })}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5 text-frost-300" />
                              </button>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <Pagination 
                  currentPage={userPage} 
                  totalPages={totalUserPages} 
                  onPageChange={setUserPage} 
                />
              </GlassCard>

              <Pagination 
                currentPage={userPage} 
                totalPages={totalUserPages} 
                onPageChange={setUserPage} 
              />

              {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-xl"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-accent-steel/30 flex items-center justify-center text-lg font-medium">
                          {(selectedUser.displayName || selectedUser.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-frost-50 text-sm">{selectedUser.displayName || 'No name'}</p>
                          <p className="text-xs text-frost-400">{selectedUser.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setSelectedUser(null); setUserSubmissions([]); setSelectedUserTab('solved'); }}
                        className="p-1.5 hover:bg-white/10 rounded-lg"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <div className="glass p-2 rounded-lg text-center">
                        <p className="text-[10px] text-frost-400">Subs</p>
                        <p className="text-lg font-bold text-frost-50">{selectedUser.stats?.totalSubmissions || 0}</p>
                      </div>
                      <div className="glass p-2 rounded-lg text-center">
                        <p className="text-[10px] text-frost-400">Solved</p>
                        <p className="text-lg font-bold text-green-400">{selectedUser.stats?.solvedCount || 0}</p>
                      </div>
                      <div className="glass p-2 rounded-lg text-center">
                        <p className="text-[10px] text-frost-400">Passed</p>
                        <p className="text-lg font-bold text-blue-400">{selectedUser.stats?.passedCount || 0}</p>
                      </div>
                      <div className="glass p-2 rounded-lg text-center">
                        <p className="text-[10px] text-frost-400">Rate</p>
                        <p className={`text-lg font-bold ${
                          (selectedUser.stats?.successRate || 0) >= 70 ? 'text-green-400' :
                          (selectedUser.stats?.successRate || 0) >= 40 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {Math.round(selectedUser.stats?.successRate || 0)}%
                        </p>
                      </div>
                    </div>

                    {/* Languages */}
                    {selectedUser.stats?.submissionsByLanguage && Object.keys(selectedUser.stats.submissionsByLanguage).length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(selectedUser.stats.submissionsByLanguage).map(([lang, count]) => (
                            <span key={lang} className="px-2 py-0.5 rounded glass text-xs text-frost-100">
                              {lang}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-1 mb-3 p-1 glass rounded-lg">
                      <button
                        onClick={() => setSelectedUserTab('solved')}
                        className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                          selectedUserTab === 'solved' ? 'bg-accent-steel/30 text-frost-50' : 'text-frost-300 hover:text-frost-100'
                        }`}
                      >
                        Solved ({selectedUser.stats?.solvedCount || 0})
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUserTab('all');
                          if (userSubmissions.length === 0) {
                            adminUserSubmissions(selectedUser.id).then(setUserSubmissions).catch(() => toast.error('Failed to load submissions'));
                          }
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                          selectedUserTab === 'all' ? 'bg-accent-steel/30 text-frost-50' : 'text-frost-300 hover:text-frost-100'
                        }`}
                      >
                        All Attempts ({selectedUser.stats?.totalSubmissions || 0})
                      </button>
                    </div>

                    {/* Solved Problems Tab */}
                    {selectedUserTab === 'solved' && selectedUser.stats?.solvedProblems && selectedUser.stats.solvedProblems.length > 0 && (
                      <div className="glass rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-white/5 sticky top-0">
                            <tr>
                              <th className="text-left py-1.5 px-2 font-medium text-frost-400">Problem</th>
                              <th className="text-center py-1.5 px-2 font-medium text-frost-400">Diff</th>
                              <th className="text-center py-1.5 px-2 font-medium text-frost-400">Att</th>
                              <th className="text-right py-1.5 px-2 font-medium text-frost-400">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedUser.stats.solvedProblems.map((prob, idx) => (
                              <tr key={idx} className="border-b border-white/5 last:border-0">
                                <td className="py-1.5 px-2 text-frost-100 truncate max-w-[100px]">{prob.problemId}</td>
                                <td className="py-1.5 px-2 text-center">
                                  <span className={`${difficultyColors[prob.difficulty] || 'text-frost-300'}`}>
                                    {prob.difficulty?.slice(0, 1) || '?'}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-center text-frost-300">{prob.attemptsToSolve}</td>
                                <td className="py-1.5 px-2 text-right text-[10px] text-frost-400">
                                  {prob.solvedAt ? new Date(prob.solvedAt).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* All Submissions Tab */}
                    {selectedUserTab === 'all' && (
                      <div className="glass rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                        {userSubmissions.length === 0 ? (
                          <div className="p-4 text-center text-xs text-frost-400">Loading...</div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="bg-white/5 sticky top-0">
                              <tr>
                                <th className="text-left py-1.5 px-2 font-medium text-frost-400">Problem</th>
                                <th className="text-center py-1.5 px-2 font-medium text-frost-400">#</th>
                                <th className="text-center py-1.5 px-2 font-medium text-frost-400">Res</th>
                                <th className="text-right py-1.5 px-2 font-medium text-frost-400">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userSubmissions.map((sub, idx) => (
                                <tr key={idx} className="border-b border-white/5 last:border-0">
                                  <td className="py-1.5 px-2 text-frost-100 truncate max-w-[100px]">{sub.problemId}</td>
                                  <td className="py-1.5 px-2 text-center text-frost-300">{sub.attemptNumber}</td>
                                  <td className="py-1.5 px-2 text-center">
                                    <span className={sub.passed ? 'text-green-400' : 'text-red-400'}>
                                      {sub.passed ? '✓' : '✗'} {sub.passedCount}/{sub.totalCount}
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-2 text-right text-[10px] text-frost-400">
                                    {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10 text-xs text-frost-400">
                      <span className="font-mono">{selectedUser.id?.slice(0, 12)}...</span>
                      <span>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'problems' && (
            <motion.div
              key="problems"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-frost-50">Problems ({filteredProblems.length})</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="glass px-3 py-1.5 flex items-center gap-2 flex-1 sm:flex-none">
                    <Search className="h-3.5 w-3.5 text-frost-300" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={problemSearch}
                      onChange={(e) => { setProblemSearch(e.target.value); setProblemPage(1) }}
                      className="bg-transparent outline-none text-frost-100 placeholder-frost-300 text-sm w-full sm:w-32"
                    />
                  </div>
                  <select
                    value={difficultyFilter}
                    onChange={(e) => { setDifficultyFilter(e.target.value); setProblemPage(1) }}
                    className="glass px-2 py-1.5 rounded-lg text-frost-100 bg-transparent text-xs"
                  >
                    <option value="ALL">All</option>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Med</option>
                    <option value="HARD">Hard</option>
                  </select>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setAddOpen(true)}
                    className="glass-strong px-3 py-1.5 rounded-lg text-frost-50 flex items-center gap-1 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </motion.button>
                </div>
              </div>

              {/* Mobile Problem Cards */}
              <div className="block sm:hidden space-y-2">
                {paginatedProblems.map((problem, index) => (
                  <motion.div
                    key={problem.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="glass p-3 rounded-xl2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-frost-50 text-sm">{problem.title}</div>
                        <div className="text-[10px] text-frost-400">{problem.id}</div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        problem.status === 'PUBLISHED' ? 'bg-green-500/20 text-green-400' :
                        problem.status === 'DRAFT' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {problem.status?.slice(0, 3)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className={difficultyColors[problem.difficulty] || 'text-frost-300'}>{problem.difficulty}</span>
                      <span className="text-frost-400">{Number(problem.submissions) || 0} subs</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Add Problem Modal - Compact */}
              <AnimatePresence>
                {addOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <GlassCard className="p-4 mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-frost-50">Add Problem</h3>
                        <button onClick={() => setAddOpen(false)} className="p-1 hover:bg-white/10 rounded">✕</button>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="grid gap-2 grid-cols-2">
                          <input value={pId} onChange={(e) => setPId(e.target.value)} placeholder="ID" className="glass px-3 py-2 rounded-lg text-frost-50 bg-transparent text-sm" />
                          <input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="Title" className="glass px-3 py-2 rounded-lg text-frost-50 bg-transparent text-sm" />
                        </div>
                        <textarea value={pStatement} onChange={(e) => setPStatement(e.target.value)} placeholder="Statement" className="w-full glass px-3 py-2 rounded-lg text-frost-50 bg-transparent text-sm min-h-[60px]" />
                        <div className="grid gap-2 grid-cols-2">
                          <select value={pDifficulty} onChange={(e) => setPDifficulty(e.target.value)} className="glass px-3 py-2 rounded-lg text-frost-50 bg-transparent text-sm">
                            <option value="EASY">Easy</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HARD">Hard</option>
                          </select>
                          <select value={pStatus} onChange={(e) => setPStatus(e.target.value)} className="glass px-3 py-2 rounded-lg text-frost-50 bg-transparent text-sm">
                            <option value="DRAFT">Draft</option>
                            <option value="PUBLISHED">Published</option>
                          </select>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => setAddOpen(false)} className="glass px-3 py-2 rounded-lg text-frost-50 flex-1 text-sm">Cancel</button>
                          <button disabled={saving} onClick={onSaveProblem} className="glass-strong px-3 py-2 rounded-lg text-frost-50 flex-1 text-sm">{saving ? '…' : 'Save'}</button>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Desktop Problems Table */}
              <GlassCard className="hidden sm:block p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-2 px-2 text-xs font-medium text-frost-300">Problem</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-frost-300">Diff</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-frost-300">Status</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-frost-300">Subs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProblems.map((problem, index) => (
                        <motion.tr
                          key={problem.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-2 px-2">
                            <div className="font-medium text-frost-50 text-sm">{problem.title}</div>
                            <div className="text-[10px] text-frost-400">{problem.id}</div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`text-xs ${difficultyColors[problem.difficulty] || 'text-frost-300'}`}>
                              {problem.difficulty?.slice(0, 1)}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              problem.status === 'PUBLISHED' ? 'bg-green-500/20 text-green-400' :
                              problem.status === 'DRAFT' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {problem.status?.slice(0, 3)}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center text-xs text-frost-300">
                            {Number(problem.submissions) || 0}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination 
                  currentPage={problemPage} 
                  totalPages={totalProblemPages} 
                  onPageChange={setProblemPage} 
                />
              </GlassCard>

              <Pagination 
                currentPage={problemPage} 
                totalPages={totalProblemPages} 
                onPageChange={setProblemPage} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
