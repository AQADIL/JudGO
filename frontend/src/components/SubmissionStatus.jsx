import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

const statusConfig = {
  accepted: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
  'wrong-answer': { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
  'time-limit': { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
}

export function SubmissionStatus({ status, message, onClose }) {
  const config = statusConfig[status] || statusConfig.error
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className={`glass-strong fixed bottom-4 right-4 p-4 max-w-sm ${config.bg} border ${config.color}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
        <div className="flex-1">
          <div className="font-medium text-[13px] text-frost-50 capitalize">{status.replace('-', ' ')}</div>
          <div className="text-[12px] text-frost-200 mt-1">{message}</div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="h-4 w-4 text-frost-300" />
        </button>
      </div>
    </motion.div>
  )
}

export function SubmissionStatusContainer({ submissions = [] }) {
  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      <AnimatePresence>
        {submissions.map((sub) => (
          <SubmissionStatus
            key={sub.id}
            status={sub.status}
            message={sub.message}
            onClose={() => {}} // Handle close in parent
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
