import { create } from 'zustand'

import { createMatch, joinMatch as apiJoinMatch, submitCode as apiSubmitCode } from '../services/api'
import { useAuthStore } from './authStore'

export const useGameStore = create((set, get) => ({
  currentUser: null,
  activeMatch: null,
  isMobile: false,
  _mobileListenerReady: false,

  syncCurrentUser: () => {
    const profile = useAuthStore.getState().profile
    set({ currentUser: profile || null })
  },

  initMobileListener: () => {
    if (get()._mobileListenerReady) return
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e) => set({ isMobile: !!e.matches })

    set({ isMobile: !!mq.matches, _mobileListenerReady: true })

    if (mq.addEventListener) mq.addEventListener('change', handler)
    else mq.addListener(handler)
  },

  createBotMatch: async () => {
    const profile = useAuthStore.getState().profile
    const player1 = profile?.displayName || profile?.email || 'player1'
    const m = await createMatch({ type: 'BOT', player1 })
    set({ activeMatch: m })
    return m
  },

  joinMatch: async (code) => {
    const matchId = (code || '').trim()
    if (!matchId) throw new Error('match id is required')

    const profile = useAuthStore.getState().profile
    const player2 = profile?.displayName || profile?.email || 'player2'

    const m = await apiJoinMatch(matchId, { player2 })
    set({ activeMatch: m })
    return m
  },

  submitCode: async (source) => {
    const m = get().activeMatch
    if (!m?.id) throw new Error('no active match')

    const profile = useAuthStore.getState().profile
    const player = profile?.displayName || profile?.email || 'player1'

    return apiSubmitCode(m.id, { player, code: source })
  },

  updateBotProgress: async () => {
    return
  },
}))
