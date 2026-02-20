import { useEffect, useState } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'

import { motion } from 'framer-motion'
import { Background3D } from './components/Background3D'
import { BrandMark } from './components/BrandMark'
import { RequireAdmin, RequireAuth } from './components/RequireAuth'
import { AdminPanel } from './pages/AdminPanel'
import { ArenaBot } from './pages/ArenaBot'
import { ArenaRooms } from './pages/ArenaRooms'
import { ArenaSelect } from './pages/ArenaSelect'
import { Dashboard } from './pages/Dashboard'
import { DuelArena } from './pages/DuelArena'
import { NotFound } from './pages/NotFound'
import { RoomLobby } from './pages/RoomLobby'
import { RoomPreJoin } from './pages/RoomPreJoin'
import { RoomGame } from './pages/RoomGame'
import { SignIn } from './pages/SignIn'
import { SignUp } from './pages/SignUp'
import { Profile } from './pages/Profile'
import { useAuthStore } from './stores/authStore'
import { useGameStore } from './stores/gameStore'

function Navigation() {
  const location = useLocation()

  const status = useAuthStore((s) => s.status)
  const rulesAccepted = useAuthStore((s) => s.rulesAccepted)
  const profile = useAuthStore((s) => s.profile)

  const accepted = status === 'auth' && rulesAccepted

  const hasAuth = status === 'auth'

  const isAdmin = String(profile?.role || '').toUpperCase() === 'ADMIN'

  const navItems = accepted
    ? [
        { path: '/', label: 'Home' },
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/arena', label: 'Arena' },
        ...(isAdmin ? [{ path: '/admin', label: 'Admin' }] : []),
        { path: '/profile', label: 'Profile' },
      ]
    : hasAuth
      ? [
          { path: '/', label: 'Home' },
          { path: '/profile', label: 'Profile' },
        ]
      : [{ path: '/', label: 'Home' }]

  return (
    <nav className="glass sticky top-0 z-40 backdrop-blur-xl border-b border-white/10">
      <div className="container-page py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <BrandMark />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path

              return (
                <Link key={item.path} to={item.path}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-accent-steel/20 text-accent-steel border border-accent-steel/30'
                        : 'text-frost-200 hover:text-frost-50 hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </motion.div>
                </Link>
              )
            })}

            {status !== 'auth' ? (
              <Link to="/signin">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="ml-2 px-4 py-2 rounded-lg text-sm font-medium text-frost-200 hover:text-frost-50 hover:bg-white/5 transition-all"
                >
                  Sign in
                </motion.div>
              </Link>
            ) : null}
          </div>

          <div className="md:hidden">
            <select
              value={location.pathname}
              onChange={(e) => window.location.href = e.target.value}
              className="glass px-3 py-2 rounded-lg text-sm bg-transparent text-frost-100"
            >
              {navItems.map((item) => (
                <option key={item.path} value={item.path} className="bg-ink-900">
                  {item.label}
                </option>
              ))}
              {status !== 'auth' && (
                <option value="/signin" className="bg-ink-900">
                  Sign in
                </option>
              )}
            </select>
          </div>
        </div>
      </div>
    </nav>
  )
}

function HomePage() {
  const status = useAuthStore((s) => s.status)
  const rulesAccepted = useAuthStore((s) => s.rulesAccepted)
  const acceptRules = useAuthStore((s) => s.acceptRules)
  const profile = useAuthStore((s) => s.profile)

  const accepted = status === 'auth' && rulesAccepted
  const [rulesOpen, setRulesOpen] = useState(false)

  const isAdmin = String(profile?.role || '').toUpperCase() === 'ADMIN'

  return (
    <div className="min-h-screen">
      <main className="container-page py-16">
        <div className="text-center space-y-8">
          <div>
            <h1 className="text-4xl md:text-6xl font-semibold text-frost-50 mb-4">
              JudGO
            </h1>
            <p className="text-xl text-frost-200 max-w-2xl mx-auto">Competitive programming platform</p>
          </div>

          {status === 'auth' && !accepted ? (
            <div className="max-w-3xl mx-auto glass p-6 rounded-xl2 border border-white/10 text-left">
              <div className="text-frost-50 font-semibold">Cheating is not allowed.</div>
              <div className="mt-2 text-frost-200 text-sm">
                Any attempt to copy solutions, use unfair automation, or share answers during live games may result in a ban.
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={acceptRules}
                  className="glass-strong px-4 py-2 rounded-lg text-sm text-frost-50"
                >
                  I understand and agree
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setRulesOpen((v) => !v)}
                  className="glass px-4 py-2 rounded-lg text-sm text-frost-50"
                >
                  {rulesOpen ? 'Hide rules' : 'Show rules'}
                </motion.button>
              </div>

              {rulesOpen ? (
                <div className="mt-4 text-frost-200 text-sm text-left space-y-2">
                  <div>1) No copy-paste from external sources during games.</div>
                  <div>2) No sharing solutions or testcases with other players.</div>
                  <div>3) No bypassing time limits or manipulating requests.</div>
                  <div>4) Be respectful: no harassment, no abuse.</div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="max-w-5xl mx-auto w-full">
            <div className="grid gap-4 md:grid-cols-2">
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Link
                  to={accepted ? '/arena' : '#'}
                  className="block"
                  onClick={(e) => {
                    if (!accepted) e.preventDefault()
                  }}
                >
                  <div className={`glass rounded-xl2 border border-white/10 overflow-hidden p-6 text-left ${accepted ? '' : 'opacity-55'}`}>
                    <div className="text-frost-200 text-xs tracking-widest">PLAY</div>
                    <div className="mt-2 text-2xl font-semibold text-frost-50">Arena</div>
                    <div className="mt-2 text-sm text-frost-200">Solo bot battles and multiplayer rooms.</div>
                    {!accepted ? <div className="mt-3 text-xs text-frost-300">Accept rules to unlock</div> : null}
                  </div>
                </Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Link
                  to={accepted ? '/dashboard' : '#'}
                  className="block"
                  onClick={(e) => {
                    if (!accepted) e.preventDefault()
                  }}
                >
                  <div className={`glass rounded-xl2 border border-white/10 overflow-hidden p-6 text-left ${accepted ? '' : 'opacity-55'}`}>
                    <div className="text-frost-200 text-xs tracking-widest">TRACK</div>
                    <div className="mt-2 text-2xl font-semibold text-frost-50">Dashboard</div>
                    <div className="mt-2 text-sm text-frost-200">Your stats, solved count, and activity.</div>
                    {!accepted ? <div className="mt-3 text-xs text-frost-300">Accept rules to unlock</div> : null}
                  </div>
                </Link>
              </motion.div>
            </div>

            <div className={`mt-4 grid gap-4 ${isAdmin ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
              {status === 'auth' ? (
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Link to="/profile" className="block">
                    <div className="glass rounded-xl2 border border-white/10 overflow-hidden p-6 text-left">
                      <div className="text-frost-200 text-xs tracking-widest">ACCOUNT</div>
                      <div className="mt-2 text-xl font-semibold text-frost-50">Profile</div>
                      <div className="mt-2 text-sm text-frost-200">Nickname, role, and logout.</div>
                    </div>
                  </Link>
                </motion.div>
              ) : null}

              {isAdmin ? (
                <motion.div whileHover={{ scale: accepted ? 1.01 : 1.0 }} whileTap={{ scale: accepted ? 0.99 : 1.0 }}>
                  <Link
                    to={accepted ? '/admin' : '#'}
                    className="block"
                    onClick={(e) => {
                      if (!accepted) e.preventDefault()
                    }}
                  >
                    <div className={`glass rounded-xl2 border border-white/10 overflow-hidden p-6 text-left ${accepted ? '' : 'opacity-55'}`}>
                      <div className="text-frost-200 text-xs tracking-widest">CONTROL</div>
                      <div className="mt-2 text-xl font-semibold text-frost-50">Admin Panel</div>
                      <div className="mt-2 text-sm text-frost-200">Problems and user management.</div>
                      {!accepted ? <div className="mt-3 text-xs text-frost-300">Accept rules to unlock</div> : null}
                    </div>
                  </Link>
                </motion.div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function App() {
  const hydrateFromFirebase = useAuthStore((s) => s.hydrateFromFirebase)
  const profile = useAuthStore((s) => s.profile)

  const initMobileListener = useGameStore((s) => s.initMobileListener)
  const syncCurrentUser = useGameStore((s) => s.syncCurrentUser)

  useEffect(() => {
    hydrateFromFirebase()
  }, [hydrateFromFirebase])

  useEffect(() => {
    initMobileListener()
  }, [initMobileListener])

  useEffect(() => {
    syncCurrentUser()
  }, [profile, syncCurrentUser])

  return (
    <div className="min-h-screen">
      <Background3D />
      <div className="noise-overlay" />
      <Navigation />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />

        <Route
          path="/arena"
          element={
            <RequireAuth>
              <ArenaSelect />
            </RequireAuth>
          }
        />
        <Route
          path="/arena/bot"
          element={
            <RequireAuth>
              <ArenaBot />
            </RequireAuth>
          }
        />
        <Route
          path="/arena/rooms"
          element={
            <RequireAuth>
              <ArenaRooms />
            </RequireAuth>
          }
        />
        <Route
          path="/arena/room/:code"
          element={
            <RequireAuth>
              <RoomLobby />
            </RequireAuth>
          }
        />
        <Route
          path="/room/:code"
          element={
            <RequireAuth>
              <RoomPreJoin />
            </RequireAuth>
          }
        />
        <Route
          path="/arena/game/:gameId"
          element={
            <RequireAuth>
              <RoomGame />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/match"
          element={
            <RequireAuth>
              <DuelArena />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPanel />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

export default App