import { motion } from 'framer-motion'

export function GlassCard({ className = '', children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      whileHover={{ y: -6 }}
      className={`glass relative rounded-xl2 p-5 sm:p-6 transition-colors ${className}`}
      style={{ willChange: 'transform' }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-xl2"
        initial={{ opacity: 0.65 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  )
}
