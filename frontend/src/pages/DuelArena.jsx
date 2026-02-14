import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Code2, MessageCircle, FileText, Send } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { MonacoEditor } from '../components/MonacoEditor'
import { ProgressBar } from '../components/ProgressBar'
import { SubmissionStatusContainer } from '../components/SubmissionStatus'
import { SkeletonLoader } from '../components/SkeletonLoader'
import { createSubmission, getProblem } from '../services/api'

export function DuelArena() {
  const [activeTab, setActiveTab] = useState('code')
  const [code, setCode] = useState('# Write your solution here\n\nprint("Hello, World!")')
  const [submissions, setSubmissions] = useState([])
  const [problem, setProblem] = useState(null)
  const [language, setLanguage] = useState('py')
  const [submitting, setSubmitting] = useState(false)
  const [problemId, setProblemId] = useState('easy-3-single-number')

  // Load problem on mount
  useEffect(() => {
    if (!problemId) return
    getProblem(problemId).then(p => setProblem(p)).catch(() => setProblem(null))
  }, [problemId])

  const tabs = [
    { id: 'problem', label: 'Problem', icon: FileText },
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'status', label: 'Status', icon: MessageCircle },
  ]

  const handleSubmit = async () => {
    if (!problemId || !code.trim()) return
    setSubmitting(true)
    try {
      const result = await createSubmission({ problemId, language, code })
      const newSubmission = {
        id: Date.now(),
        status: result.passed ? 'accepted' : 'wrong-answer',
        message: result.passed 
          ? `Accepted! ${result.passedCount}/${result.totalCount} tests passed`
          : `Wrong answer: ${result.passedCount}/${result.totalCount} tests passed`,
        details: result.results,
      }
      setSubmissions(prev => [...prev, newSubmission])
      setTimeout(() => {
        setSubmissions(prev => prev.filter(s => s.id !== newSubmission.id))
      }, 6000)
    } catch (e) {
      const newSubmission = {
        id: Date.now(),
        status: 'error',
        message: e?.message || 'Submission failed',
      }
      setSubmissions(prev => [...prev, newSubmission])
      setTimeout(() => {
        setSubmissions(prev => prev.filter(s => s.id !== newSubmission.id))
      }, 4000)
    } finally {
      setSubmitting(false)
    }
  }

  const ProblemPanel = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-frost-50 mb-2">{problem?.title || 'Two Sum'}</h2>
        <div className="flex gap-2 mb-4">
          <span className="px-2 py-1 bg-accent-steel/20 text-accent-steel text-xs rounded">{problem?.difficulty || 'Easy'}</span>
          <span className="px-2 py-1 bg-accent-lilac/20 text-accent-lilac text-xs rounded">{problem?.tags?.[0] || 'Array'}</span>
        </div>
      </div>

      <div className="space-y-4 text-frost-100">
        <div>
          <h3 className="font-semibold text-frost-50 mb-2">Problem Description</h3>
          <p className="text-sm leading-relaxed">{problem?.statement || 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.'}</p>
        </div>

        {problem?.inputFormat ? (
          <div>
            <h3 className="font-semibold text-frost-50 mb-2">Input Format</h3>
            <p className="text-sm leading-relaxed">{problem.inputFormat}</p>
          </div>
        ) : null}

        {problem?.outputFormat ? (
          <div>
            <h3 className="font-semibold text-frost-50 mb-2">Output Format</h3>
            <p className="text-sm leading-relaxed">{problem.outputFormat}</p>
          </div>
        ) : null}

        <div>
          <h3 className="font-semibold text-frost-50 mb-2">Examples</h3>
          <div className="space-y-2 text-sm">
            {(problem?.testCases || []).filter(tc => !tc.isHidden).slice(0, 2).map((tc, idx) => (
              <div key={idx} className="bg-white/5 p-3 rounded-lg">
                <div><strong>Input:</strong> <pre className="inline bg-white/10 px-1 rounded">{tc.input}</pre></div>
                <div><strong>Output:</strong> <pre className="inline bg-white/10 px-1 rounded">{tc.output}</pre></div>
              </div>
            ))}
            {!problem?.testCases?.length ? (
              <div className="bg-white/5 p-3 rounded-lg">
                <div><strong>Input:</strong> nums = [2,7,11,15], target = 9</div>
                <div><strong>Output:</strong> [0,1]</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )

  const CodePanel = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            className="glass px-3 py-2 text-sm text-frost-50 bg-transparent rounded"
          >
            <option value="py" className="bg-ink-900">Python 3</option>
            <option value="go" className="bg-ink-900">Go</option>
          </select>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={submitting}
          className="glass px-4 py-2 text-sm text-frost-50 flex items-center gap-2 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Running...' : 'Submit'}
        </motion.button>
      </div>
      <div className="h-[55dvh] md:h-96 rounded-lg overflow-hidden border border-white/10">
        <MonacoEditor
          value={code}
          onChange={setCode}
          language={language === 'go' ? 'go' : 'python'}
        />
      </div>
    </div>
  )

  const StatusPanel = () => (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-frost-50 mb-4">Opponent Progress</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-frost-100">Player 2</span>
              <span className="text-frost-200">45%</span>
            </div>
            <ProgressBar progress={45} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-frost-100">You</span>
              <span className="text-frost-200">0%</span>
            </div>
            <ProgressBar progress={0} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-frost-50 mb-4">Recent Activity</h3>
        <div className="space-y-2">
          <SkeletonLoader lines={3} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <SubmissionStatusContainer submissions={submissions} />

      <div className="lg:hidden">
        <div className="flex border-b border-white/10 bg-ink-900/50 backdrop-blur-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 p-4 text-center transition-colors ${
                  activeTab === tab.id ? 'border-b-2 border-accent-steel text-accent-steel' : 'text-frost-200'
                }`}
              >
                <Icon className="h-5 w-5 mx-auto mb-1" />
                <div className="text-xs">{tab.label}</div>
              </button>
            )
          })}
        </div>
        <div className="p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'problem' && <ProblemPanel />}
              {activeTab === 'code' && <CodePanel />}
              {activeTab === 'status' && <StatusPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="hidden lg:block container-page py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-6 h-[calc(100vh-8rem)]">
          <GlassCard className="overflow-y-auto">
            <ProblemPanel />
          </GlassCard>

          <GlassCard>
            <CodePanel />
          </GlassCard>

          <GlassCard className="overflow-y-auto">
            <StatusPanel />
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
