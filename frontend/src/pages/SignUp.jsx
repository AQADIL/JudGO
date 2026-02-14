import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import { BrandMark } from '../components/BrandMark'
import { GlassCard } from '../components/GlassCard'
import { firebaseSignUpEmail, firebaseSignInGoogle } from '../lib/firebase'
import { useAuthStore } from '../stores/authStore'

export function SignUp() {
  const navigate = useNavigate()
  const status = useAuthStore((s) => s.status)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'auth') {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, status])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await firebaseSignUpEmail(email, password)
      toast.success('Account created successfully!')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err?.message || 'Sign up failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function onGoogle() {
    setError('')
    setLoading(true)
    try {
      await firebaseSignInGoogle()
      toast.success('Signed in with Google!')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err?.message || 'Google sign up failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center">
      <div className="container-page py-10">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex justify-center">
            <BrandMark />
          </div>

          <GlassCard>
            <div className="space-y-4">
              <div>
                <div className="font-pixel text-[10px] tracking-[0.16em] text-frost-200">AUTH</div>
                <h1 className="text-2xl font-semibold text-frost-50">Sign up</h1>
              </div>

              {error ? (
                <div className="glass px-3 py-2 rounded-lg text-sm text-red-200 border border-red-500/20">
                  {error}
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="space-y-3">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="Email"
                  className="glass w-full px-4 py-3 rounded-xl2 text-sm text-frost-50 placeholder-frost-300 outline-none"
                />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Password"
                  className="glass w-full px-4 py-3 rounded-xl2 text-sm text-frost-50 placeholder-frost-300 outline-none"
                />

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                  className="glass-strong w-full px-4 py-3 rounded-xl2 text-sm text-frost-50 disabled:opacity-60"
                >
                  Create account
                </motion.button>
              </form>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={onGoogle}
                disabled={loading}
                className="glass w-full px-4 py-3 rounded-xl2 text-sm text-frost-100 disabled:opacity-60"
              >
                Continue with Google
              </motion.button>

              <div className="text-sm text-frost-200">
                Already have an account?{' '}
                <Link className="text-frost-50 underline" to="/signin">
                  Sign in
                </Link>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
