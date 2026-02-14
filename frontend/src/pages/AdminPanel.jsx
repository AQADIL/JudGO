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
import { adminProblems, adminUsers, adminUserStats, createAdminProblem } from '../services/api'

const ITEMS_PER_PAGE = 10

export function AdminPanel() {
  const [users, setUsers] = useState([])
  const [userStats, setUserStats] = useState([])
  const [problems, setProblems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  
  const [activeTab, setActiveTab] = useState('overview')
  const [problemPage, setProblemPage] = useState(1)
  const [userPage, setUserPage] = useState(1)
  
  const [userSearch, setUserSearch] = useState('')
  const [problemSearch, setProblemSearch] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

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

  const [selectedUser, setSelectedUser] = useState(null)

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
    const totalSubmissions = problems.reduce((sum, p) => sum + (Number(p.submissions) || 0), 0)
    const admins = users.filter(u => u.role === 'ADMIN').length
    
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
      admins,
      problemsByDifficulty,
    }
  }, [users, problems])

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
      const statusMatch = statusFilter === 'ALL' || p.status === statusFilter
      return (titleMatch || idMatch) && difficultyMatch && statusMatch
    })
  }, [problems, problemSearch, difficultyFilter, statusFilter])

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
      toast.success('Problem created successfully!')
      
      setPId('')
      setPTitle('')
      setPStatement('')
      setPInputFormat('')
      setPOutputFormat('')
      setPDifficulty('EASY')
      setPStatus('DRAFT')
      setPTags('')
      setStarterGo('')
      setStarterPy('')
      setTestCases([{ input: '', output: '', isHidden: false }])
    } catch (e) {
      setError(e?.message || 'Failed to save problem')
      toast.error(e?.message || 'Failed to save problem')
    } finally {
      setSaving(false)
    }
  }

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-frost-200 text-sm">{title}</p>
          <p className="text-3xl font-bold text-frost-50 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-frost-300 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-frost-50" />
        </div>
      </div>
    </GlassCard>
  )

  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null
    
    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-lg glass disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                currentPage === page
                  ? 'bg-accent-steel text-frost-50'
                  : 'glass hover:bg-white/10'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg glass disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
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
      <header className="container-page pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BrandMark />
            <div className="h-6 w-px bg-white/20" />
            <h1 className="text-xl font-semibold text-frost-50">Admin Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-1 p-1 glass rounded-lg">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'problems', label: 'Problems', icon: FileText },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === id
                    ? 'bg-accent-steel/30 text-frost-50'
                    : 'text-frost-300 hover:text-frost-100'
                }`}
              >
                <Icon className="h-4 w-4" />
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Total Users"
                  value={stats.totalUsers}
                  icon={Users}
                  color="bg-blue-500/20"
                  subtitle={`${stats.admins} admins`}
                />
                <StatCard
                  title="Total Problems"
                  value={stats.totalProblems}
                  icon={FileText}
                  color="bg-purple-500/20"
                  subtitle={`${stats.publishedProblems} published`}
                />
                <StatCard
                  title="Total Submissions"
                  value={stats.totalSubmissions}
                  icon={Activity}
                  color="bg-green-500/20"
                />
                <StatCard
                  title="Draft Problems"
                  value={stats.draftProblems}
                  icon={Code2}
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
                            {Number(problem.submissions) || 0}
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
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-frost-50">User Management</h2>
                <div className="glass px-4 py-2 flex items-center gap-2">
                  <Search className="h-4 w-4 text-frost-300" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1) }}
                    className="bg-transparent outline-none text-frost-100 placeholder-frost-300 w-64"
                  />
                </div>
              </div>

              <GlassCard className="p-6">
                {error ? (
                  <div className="glass px-3 py-2 rounded-lg text-sm text-red-200 border border-red-500/20 mb-4">
                    {error}
                  </div>
                ) : null}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-3 text-sm font-medium text-frost-200">User</th>
                        <th className="text-left py-3 px-3 text-sm font-medium text-frost-200">Role</th>
                        <th className="text-center py-3 px-3 text-sm font-medium text-frost-200">Solved</th>
                        <th className="text-center py-3 px-3 text-sm font-medium text-frost-200">Submissions</th>
                        <th className="text-center py-3 px-3 text-sm font-medium text-frost-200">Success Rate</th>
                        <th className="text-left py-3 px-3 text-sm font-medium text-frost-200">Actions</th>
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
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-accent-steel/30 flex items-center justify-center text-sm font-medium">
                                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-frost-50 text-sm">
                                    {user.displayName || 'No name'}
                                  </div>
                                  <div className="text-xs text-frost-400">{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                user.role === 'ADMIN' 
                                  ? 'bg-purple-500/20 text-purple-400' 
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {user.role || 'USER'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-sm font-medium text-green-400">
                                {stats.solvedCount || 0}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-sm text-frost-100">
                              {stats.totalSubmissions || 0}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`text-sm font-medium ${
                                (stats.successRate || 0) >= 70 ? 'text-green-400' :
                                (stats.successRate || 0) >= 40 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {stats.successRate ? `${stats.successRate}%` : '0%'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <button
                                onClick={() => setSelectedUser({ ...user, stats })}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                              >
                                <Eye className="h-4 w-4 text-frost-300" />
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

                <div className="mt-4 text-sm text-frost-400">
                  Showing {paginatedUsers.length} of {filteredUsers.length} users
                </div>
              </GlassCard>

              {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 rounded-2xl"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-frost-50">User Statistics</h3>
                      <button
                        onClick={() => setSelectedUser(null)}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="space-y-6">
                      {/* User Header */}
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-accent-steel/30 flex items-center justify-center text-2xl font-medium">
                          {(selectedUser.displayName || selectedUser.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-frost-50">{selectedUser.displayName || 'No name'}</p>
                          <p className="text-sm text-frost-300">{selectedUser.email}</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                            selectedUser.role === 'ADMIN' 
                              ? 'bg-purple-500/20 text-purple-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {selectedUser.role || 'USER'}
                          </span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="glass p-4 rounded-xl2 text-center">
                          <p className="text-xs text-frost-400">Total Submissions</p>
                          <p className="text-2xl font-bold text-frost-50">{selectedUser.stats?.totalSubmissions || 0}</p>
                        </div>
                        <div className="glass p-4 rounded-xl2 text-center">
                          <p className="text-xs text-frost-400">Solved</p>
                          <p className="text-2xl font-bold text-green-400">{selectedUser.stats?.solvedCount || 0}</p>
                        </div>
                        <div className="glass p-4 rounded-xl2 text-center">
                          <p className="text-xs text-frost-400">Passed</p>
                          <p className="text-2xl font-bold text-blue-400">{selectedUser.stats?.passedCount || 0}</p>
                        </div>
                        <div className="glass p-4 rounded-xl2 text-center">
                          <p className="text-xs text-frost-400">Success Rate</p>
                          <p className={`text-2xl font-bold ${
                            (selectedUser.stats?.successRate || 0) >= 70 ? 'text-green-400' :
                            (selectedUser.stats?.successRate || 0) >= 40 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {selectedUser.stats?.successRate ? `${selectedUser.stats.successRate}%` : '0%'}
                          </p>
                        </div>
                      </div>

                      {/* Languages */}
                      {selectedUser.stats?.submissionsByLanguage && Object.keys(selectedUser.stats.submissionsByLanguage).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-frost-200 mb-3">Submissions by Language</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(selectedUser.stats.submissionsByLanguage).map(([lang, count]) => (
                              <span key={lang} className="px-3 py-1 rounded-lg glass text-sm text-frost-100">
                                {lang}: <span className="font-medium">{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Solved Problems Table */}
                      {selectedUser.stats?.solvedProblems && selectedUser.stats.solvedProblems.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-frost-200 mb-3">
                            Solved Problems ({selectedUser.stats.solvedProblems.length})
                          </h4>
                          <div className="glass rounded-xl2 overflow-hidden">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-white/10">
                                  <th className="text-left py-2 px-3 text-xs font-medium text-frost-300">Problem</th>
                                  <th className="text-center py-2 px-3 text-xs font-medium text-frost-300">Difficulty</th>
                                  <th className="text-center py-2 px-3 text-xs font-medium text-frost-300">Attempts</th>
                                  <th className="text-right py-2 px-3 text-xs font-medium text-frost-300">Solved At</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedUser.stats.solvedProblems.map((prob, idx) => (
                                  <tr key={idx} className="border-b border-white/5 last:border-0">
                                    <td className="py-2 px-3 text-sm text-frost-100">{prob.problemId}</td>
                                    <td className="py-2 px-3 text-center">
                                      <span className={`text-xs ${difficultyColors[prob.difficulty] || 'text-frost-300'}`}>
                                        {prob.difficulty || 'UNKNOWN'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-center text-sm text-frost-100">
                                      {prob.attemptsToSolve}
                                    </td>
                                    <td className="py-2 px-3 text-right text-xs text-frost-400">
                                      {prob.solvedAt ? new Date(prob.solvedAt).toLocaleDateString() : 'N/A'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Footer Info */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                        <div>
                          <p className="text-xs text-frost-400">User ID</p>
                          <p className="text-sm text-frost-200 font-mono">{selectedUser.id?.slice(0, 16)}...</p>
                        </div>
                        <div>
                          <p className="text-xs text-frost-400">Joined</p>
                          <p className="text-sm text-frost-200">
                            {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
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
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-frost-50">Problem Management</h2>
                <div className="flex items-center gap-3">
                  <div className="glass px-4 py-2 flex items-center gap-2">
                    <Search className="h-4 w-4 text-frost-300" />
                    <input
                      type="text"
                      placeholder="Search problems..."
                      value={problemSearch}
                      onChange={(e) => { setProblemSearch(e.target.value); setProblemPage(1) }}
                      className="bg-transparent outline-none text-frost-100 placeholder-frost-300 w-48"
                    />
                  </div>
                  <select
                    value={difficultyFilter}
                    onChange={(e) => { setDifficultyFilter(e.target.value); setProblemPage(1) }}
                    className="glass px-3 py-2 rounded-lg text-frost-100 bg-transparent"
                  >
                    <option value="ALL">All Difficulties</option>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setProblemPage(1) }}
                    className="glass px-3 py-2 rounded-lg text-frost-100 bg-transparent"
                  >
                    <option value="ALL">All Status</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setAddOpen(true)}
                    className="glass-strong px-4 py-2 rounded-lg text-frost-50 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Problem
                  </motion.button>
                </div>
              </div>

              <AnimatePresence>
                {addOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <GlassCard className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-frost-50">Add New Problem</h3>
                        <button
                          onClick={() => setAddOpen(false)}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          ✕
                        </button>
                      </div>
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
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setAddOpen(false)}
                            className="glass px-4 py-3 rounded-lg text-frost-50 flex-1"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={onSaveProblem}
                            className="glass-strong px-4 py-3 rounded-lg text-frost-50 flex-1 disabled:opacity-50"
                          >
                            {saving ? 'Saving…' : 'Save Problem'}
                          </button>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>

              <GlassCard className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-3 text-sm font-medium text-frost-200">Problem</th>
                        <th className="text-left py-3 px-3 text-sm font-medium text-frost-200">Difficulty</th>
                        <th className="text-left py-3 px-3 text-sm font-medium text-frost-200">Status</th>
                        <th className="text-left py-3 px-3 text-sm font-medium text-frost-200">Submissions</th>
                        <th className="text-left py-3 px-3 text-sm font-medium text-frost-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProblems.map((problem, index) => (
                        <motion.tr
                          key={problem.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="font-medium text-frost-50 text-sm">{problem.title}</div>
                            <div className="text-xs text-frost-400">{problem.id}</div>
                            {problem.tags?.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {problem.tags.slice(0, 3).map((tag, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-frost-300">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`text-sm font-medium ${difficultyColors[problem.difficulty] || 'text-frost-200'}`}>
                              {problem.difficulty}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              problem.status === 'PUBLISHED' ? 'bg-green-500/20 text-green-400' :
                              problem.status === 'DRAFT' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {problem.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-sm text-frost-100">
                            {Number(problem.submissions) || 0}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toast.success('Edit feature coming soon!')}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                              >
                                <Eye className="h-4 w-4 text-frost-300" />
                              </button>
                              <button
                                onClick={() => toast.success(`Problem ${problem.id} marked for deletion`)}
                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4 text-red-400" />
                              </button>
                            </div>
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

                <div className="mt-4 text-sm text-frost-400">
                  Showing {paginatedProblems.length} of {filteredProblems.length} problems
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
