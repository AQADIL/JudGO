import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import { BrandMark } from '../components/BrandMark'
import { GlassCard } from '../components/GlassCard'
import { firebaseSendPasswordReset, firebaseSignInEmail, firebaseSignInGoogle } from '../lib/firebase'
import { useAuthStore } from '../stores/authStore'

export function SignIn() {
  const navigate = useNavigate()
  const status = useAuthStore((s) => s.status)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'auth') {
      navigate('/', { replace: true })
    }
  }, [navigate, status])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      await firebaseSignInEmail(email, password)
      toast.success('Signed in successfully!')
      navigate('/', { replace: true })
    } catch (err) {
      const msg = err?.message || 'Sign in failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function onGoogle() {
    setError('')
    setInfo('')
    setLoading(true)
    try {
      await firebaseSignInGoogle()
      toast.success('Signed in with Google!')
      navigate('/', { replace: true })
    } catch (err) {
      const msg = err?.message || 'Google sign in failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function onForgotPassword() {
    const e = String(email || '').trim()
    if (!e) {
      toast.error('Enter your email first')
      return
    }
    setError('')
    setInfo('')
    setLoading(true)
    try {
      await firebaseSendPasswordReset(e)
      toast.success('Password reset email sent! Check your inbox and spam folder.')
    } catch (err) {
      const errorCode = err?.code || ''
      if (errorCode.includes('user-not-found') || errorCode.includes('auth/user-not-found')) {
        toast.error('No account found with this email address')
      } else {
        toast.error(err?.message || 'Failed to send reset email')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto py-6 px-4">
      <div className="max-w-md mx-auto space-y-6 pt-4">
          <div className="flex justify-center">
            <BrandMark />
          </div>

          <GlassCard>
            <div className="space-y-4">
              <div>
                <div className="font-pixel text-[10px] tracking-[0.16em] text-frost-200">AUTH</div>
                <h1 className="text-2xl font-semibold text-frost-50">Sign in</h1>
              </div>

              {error ? (
                <div className="glass px-3 py-2 rounded-lg text-sm text-red-200 border border-red-500/20">
                  {error}
                </div>
              ) : null}

              {info ? (
                <div className="glass px-3 py-2 rounded-lg text-sm text-green-200 border border-green-500/20">
                  {info}
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
                  Continue
                </motion.button>
              </form>

              <button
                type="button"
                disabled={loading}
                onClick={onForgotPassword}
                className="w-full text-xs text-frost-200 hover:text-frost-50 underline disabled:opacity-60"
              >
                Forgot password?
              </button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={onGoogle}
                disabled={loading}
                className="glass w-full px-4 py-3 rounded-xl2 text-sm text-frost-100 disabled:opacity-60"
              >
                Continue with Google
              </motion.button>

              <div className="text-sm text-frost-200">
                No account?{' '}
                <Link className="text-frost-50 underline" to="/signup">
                  Sign up
                </Link>
              </div>
            </div>
          </GlassCard>
        </div>
    </div>
  )
}
