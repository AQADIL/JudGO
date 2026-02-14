import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

import { ConfirmModal } from '../components/ConfirmModal'
import bg from '../assets/jujutsukaisen.jpg'
import bgmSrc from '../assets/judas.mp3'

export function ArenaSelect() {
  const nav = useNavigate()

  const bgmRef = useRef(null)
  const audioCtxRef = useRef(null)

  const [returnOpen, setReturnOpen] = useState(false)
  const [returnCode, setReturnCode] = useState('')

  const startBgm = useMemo(() => {
    return async () => {
      if (!bgmRef.current) return
      try {
        await bgmRef.current.play()
      } catch {
        // autoplay may be blocked until first user interaction
      }
    }
  }, [])

  const playSelectSfx = useMemo(() => {
    return () => {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return

      if (!audioCtxRef.current) audioCtxRef.current = new Ctx()
      const ctx = audioCtxRef.current

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 620
      gain.gain.value = 0.03

      osc.connect(gain)
      gain.connect(ctx.destination)

      const now = ctx.currentTime
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)

      osc.start(now)
      osc.stop(now + 0.065)
    }
  }, [])

  useEffect(() => {
    const a = new Audio(bgmSrc)
    a.loop = true
    a.volume = 0.03
    bgmRef.current = a

    startBgm()

    const unlock = () => {
      startBgm()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }

    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    window.addEventListener('touchstart', unlock)

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
      try {
        a.pause()
        a.currentTime = 0
      } catch {
        // ignore
      }
    }
  }, [startBgm])

  const onPick = async (path) => {
    playSelectSfx()
    if (bgmRef.current) {
      try {
        await bgmRef.current.play()
      } catch {
        // ignore
      }
    }
    if (path === '/arena/rooms') {
      const last = String(localStorage.getItem('lastRoomCode') || '').trim().toUpperCase()
      if (last) {
        setReturnCode(last)
        setReturnOpen(true)
        return
      }
    }
    setTimeout(() => nav(path), 90)
  }

  return (
    <div className="min-h-[100dvh]">
      <div className="container-page py-10">
        <div className="glass rounded-xl2 overflow-hidden border border-white/10">
          <div className="relative h-[70dvh] min-h-[460px]">
            <img
              src={bg}
              alt="Arena"
              className="absolute inset-0 h-full w-full object-cover opacity-75"
              draggable={false}
            />

            <div className="absolute inset-0 bg-ink-950/45" />

            <div className="absolute inset-0">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(120deg, rgba(59,130,246,0.55) 0%, rgba(59,130,246,0.28) 38%, rgba(239,68,68,0.28) 62%, rgba(239,68,68,0.55) 100%)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(120deg,  rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.00) 48%, rgba(255,255,255,0.10) 52%, rgba(255,255,255,0.00) 100%)',
                }}
              />
            </div>

            <div className="relative z-10 h-full grid grid-cols-1 md:grid-cols-2">
              <button type="button" onClick={() => onPick('/arena/bot')} className="group relative text-left">
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="h-full flex items-end p-8 md:p-10"
                >
                  <div className="space-y-3">
                    <div className="text-frost-200 text-xs">BOT</div>
                    <div className="text-3xl md:text-4xl text-frost-50 leading-tight">
                      Solo Battle
                    </div>
                    <div className="text-frost-100 text-sm max-w-sm">
                      Fast duel against an AI opponent.
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'radial-gradient(800px 500px at 35% 65%, rgba(59,130,246,0.28), transparent 55%)' }} />
                </motion.div>
              </button>

              <button type="button" onClick={() => onPick('/arena/rooms')} className="group relative text-left">
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="h-full flex items-end p-8 md:p-10"
                >
                  <div className="space-y-3 md:text-right md:ml-auto">
                    <div className="text-frost-200 text-xs">ROOMS / FRIENDS</div>
                    <div className="text-3xl md:text-4xl text-frost-50 leading-tight">
                      Multiplayer
                    </div>
                    <div className="text-frost-100 text-sm max-w-sm md:ml-auto">
                      Create or join rooms. Up to 4 players.
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'radial-gradient(800px 500px at 65% 65%, rgba(239,68,68,0.28), transparent 55%)' }} />
                </motion.div>
              </button>
            </div>

            <div className="absolute left-6 top-6 right-6 z-10 flex items-center justify-between">
              <div className="text-frost-50 text-sm">Arena</div>
              <div className="text-frost-200 text-xs">choose a side</div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={returnOpen}
        title={returnCode ? `Return to room ${returnCode}?` : 'Return to room?'}
        message="You have an active room."
        confirmText="Return"
        cancelText="No"
        onConfirm={() => {
          const c = String(returnCode || '').trim().toUpperCase()
          setReturnOpen(false)
          setReturnCode('')
          setTimeout(() => nav(`/arena/room/${c}`), 90)
        }}
        onCancel={() => {
          setReturnOpen(false)
          setReturnCode('')
          setTimeout(() => nav('/arena/rooms'), 90)
        }}
      />
    </div>
  )
}
