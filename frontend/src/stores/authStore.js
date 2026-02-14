import { create } from 'zustand'
import { onAuthStateChanged } from 'firebase/auth'

import { auth, firebaseLogout } from '../lib/firebase'
import { profileInit } from '../services/api'

export const useAuthStore = create((set, get) => ({
  status: 'idle',
  user: null,
  idToken: null,
  profile: null,
  error: null,

  hydrateFromFirebase: () => {
    if (get().status === 'hydrating') return
    set({ status: 'hydrating', error: null })

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        set({ status: 'anon', user: null, idToken: null, profile: null, error: null })
        return
      }

      try {
        const idToken = await user.getIdToken()
        const resp = await profileInit()
        set({ status: 'auth', user, idToken, profile: resp?.user || null, error: null })
      } catch (e) {
        set({ status: 'auth', user, idToken: null, profile: null, error: e?.message || 'auth error' })
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
    set({ status: 'anon', user: null, idToken: null, profile: null })
  },
}))
