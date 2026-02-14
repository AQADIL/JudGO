import { motion } from 'framer-motion'

export function ProgressBar({ progress = 0, className = '' }) {
  return (
    <div className={`w-full bg-white/5 rounded-full h-2 ${className}`}>
      <motion.div
        className="bg-accent-steel rounded-full h-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      />
    </div>
  )
}
