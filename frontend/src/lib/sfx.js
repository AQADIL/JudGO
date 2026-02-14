const clamp01 = (v) => Math.max(0, Math.min(1, v))

const audioCache = new Map()

function getAudio(src) {
  if (!src) return null
  const key = String(src)
  if (audioCache.has(key)) return audioCache.get(key)
  const a = new Audio(key)
  a.preload = 'auto'
  audioCache.set(key, a)
  return a
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  const idx = Math.floor(Math.random() * arr.length)
  return arr[idx]
}

export function playSfxOneOf(sources, { volume = 0.75 } = {}) {
  const src = pickRandom(sources)
  if (!src) return
  try {
    const a = getAudio(src)
    if (!a) return
    a.pause()
    a.currentTime = 0
    a.volume = clamp01(volume)
    // ignore promise rejections (autoplay restrictions)
    const p = a.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch {
  }
}
