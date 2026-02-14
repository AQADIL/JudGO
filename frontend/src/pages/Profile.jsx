import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { GlassCard } from '../components/GlassCard'
import { BrandMark } from '../components/BrandMark'
import { useAuthStore } from '../stores/authStore'
import { me, updateProfile } from '../services/api'

export function Profile() {
  const logout = useAuthStore((s) => s.logout)
  const storeProfile = useAuthStore((s) => s.profile)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState(storeProfile)
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const p = await me()
        if (!cancelled) {
          setProfile(p)
          setDisplayName(p?.displayName || '')
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e?.message || 'Failed to load profile')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const canSave = useMemo(() => {
    const dn = String(displayName || '').trim()
    if (!dn) return false
    if (dn === String(profile?.displayName || '').trim()) return false
    if (dn.length > 32) return false
    return true
  }, [displayName, profile?.displayName])

  async function onSave() {
    const dn = String(displayName || '').trim()
    if (!dn) {
      toast.error('Nickname is required')
      return
    }
    if (dn.length > 32) {
      toast.error('Nickname is too long (max 32)')
      return
    }

    setSaving(true)
    try {
      const updated = await updateProfile({ displayName: dn })
      setProfile(updated)
      toast.success('Profile updated')
    } catch (e) {
      toast.error(e?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  async function onLogout() {
    try {
      await logout()
      toast.success('Logged out')
    } catch (e) {
      toast.error(e?.message || 'Logout failed')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen overflow-y-auto py-6 px-4">
        <div className="max-w-xl mx-auto space-y-6 pt-4">
          <div className="flex justify-center">
            <BrandMark />
          </div>
          <GlassCard>
            <div className="text-frost-50 text-sm">Loading profile...</div>
          </GlassCard>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-y-auto py-6 px-4">
      <div className="max-w-xl mx-auto space-y-6 pt-4">
        <div className="flex justify-center">
          <BrandMark />
        </div>

        <GlassCard>
          <div className="space-y-4">
            <div>
              <div className="font-pixel text-[10px] tracking-[0.16em] text-frost-200">PROFILE</div>
              <h1 className="text-2xl font-semibold text-frost-50">Account</h1>
            </div>

            <div className="grid gap-3">
              <div>
                <div className="text-xs text-frost-300">Email</div>
                <div className="text-sm text-frost-50 break-all">{profile?.email || '-'}</div>
              </div>

              <div>
                <div className="text-xs text-frost-300">Role</div>
                <div className="text-sm text-frost-50">{profile?.role || '-'}</div>
              </div>

              <div>
                <div className="text-xs text-frost-300">Nickname</div>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  type="text"
                  placeholder="Your nickname"
                  className="glass w-full px-4 py-3 rounded-xl2 text-sm text-frost-50 placeholder-frost-300 outline-none"
                />
                <div className="mt-1 text-[10px] text-frost-400">Max 32 characters</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={saving || !canSave}
                onClick={onSave}
                className="glass-strong w-full px-4 py-3 rounded-xl2 text-sm text-frost-50 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="w-full px-4 py-3 rounded-xl2 text-sm font-medium border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
