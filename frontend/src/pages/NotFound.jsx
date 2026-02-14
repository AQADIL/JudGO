import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import { GlassCard } from '../components/GlassCard'

export function NotFound() {
  return (
    <div className="min-h-[100dvh]">
      <main className="container-page py-16">
        <GlassCard className="mx-auto max-w-xl">
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <div className="text-frost-200 text-sm">404</div>
              <h1 className="text-2xl text-frost-50">Page not found</h1>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mx-auto h-28 w-28 rounded-xl2 border border-white/10 bg-white/5"
              style={{
                transform: 'rotate(-8deg)',
                filter: 'drop-shadow(0 18px 35px rgba(0,0,0,0.35))',
              }}
            />

            <div className="text-frost-200 text-sm">
              The route you opened does not exist.
            </div>

            <div className="flex items-center justify-center gap-3">
              <Link to="/" className="glass px-4 py-2 rounded-lg text-sm text-frost-50">
                Go Home
              </Link>
              <Link to="/dashboard" className="glass px-4 py-2 rounded-lg text-sm text-frost-50">
                Dashboard
              </Link>
            </div>
          </div>
        </GlassCard>
      </main>
    </div>
  )
}
