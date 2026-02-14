import { motion } from 'framer-motion'

export function SkeletonLoader({ className = '', lines = 1 }) {
  const skeletonVariants = {
    shimmer: {
      backgroundPosition: ['-200% 0', '200% 0'],
      transition: { repeat: Infinity, duration: 1.5, ease: 'linear' },
    },
  }

  if (lines === 1) {
    return (
      <div className={`bg-white/5 rounded-lg ${className}`}>
        <motion.div
          className="h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]"
          variants={skeletonVariants}
          animate="shimmer"
        />
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          className="h-4 bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%] rounded"
          variants={skeletonVariants}
          animate="shimmer"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  )
}
