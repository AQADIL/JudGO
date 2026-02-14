import { create } from 'zustand'
import { onAuthStateChanged } from 'firebase/auth'

import { auth, firebaseLogout } from '../lib/firebase'
import { profileInit } from '../services/api'

function rulesKey(uid) {
  const u = String(uid || '').trim()
  if (!u) return ''
  return `judgo_rules_accepted_${u}`
}

export const useAuthStore = create((set, get) => ({
  status: 'idle',
  user: null,
  idToken: null,
  profile: null,
  error: null,
  rulesAccepted: false,

  hydrateFromFirebase: () => {
    if (get().status === 'hydrating') return
    set({ status: 'hydrating', error: null })

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        set({ status: 'anon', user: null, idToken: null, profile: null, error: null, rulesAccepted: false })
        return
      }

      try {
        const idToken = await user.getIdToken()
        const resp = await profileInit()
        let accepted = false
        const k = rulesKey(user.uid)
        if (k) {
          accepted = localStorage.getItem(k) === '1'
        }
        set({ status: 'auth', user, idToken, profile: resp?.user || null, error: null, rulesAccepted: accepted })
      } catch (e) {
        let accepted = false
        const k = rulesKey(user.uid)
        if (k) {
          accepted = localStorage.getItem(k) === '1'
        }
        set({ status: 'auth', user, idToken: null, profile: null, error: e?.message || 'auth error', rulesAccepted: accepted })
      }
    })
  },

  refreshToken: async () => {
    const user = auth.currentUser
    if (!user) return null
    const idToken = await user.getIdToken(true)
    set({ idToken })
    return idToken
  },

  logout: async () => {
    await firebaseLogout()
    set({ status: 'anon', user: null, idToken: null, profile: null, rulesAccepted: false })
  },

  acceptRules: () => {
    const user = get().user
    const k = rulesKey(user?.uid)
    if (k) {
      localStorage.setItem(k, '1')
    }
    set({ rulesAccepted: true })
  },
}))
