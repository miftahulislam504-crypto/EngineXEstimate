// components/budget/BudgetPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus, CheckCircle2, ShieldAlert } from 'lucide-react'
import { BudgetEntry, BudgetApproval } from '@/lib/types/budget.types'
import {
  getBudget,
  addBudgetEntry,
  getLatestBudgetEntry,
  createBudgetApproval,
  getBudgetApprovalHistory,
} from '@/lib/firestore/budget.firestore'
import { validateBudgetEntry, compareBudget } from '@/lib/services/budget.service'
import { useAuthStore } from '@/store/useAuthStore'
import { canApproveFinancials } from '@/lib/types/auth.types'
import { useLang } from '@/components/providers/LanguageProvider'

interface BudgetPanelProps {
  projectId: string
}

export function BudgetPanel({ projectId }: BudgetPanelProps) {
  const { user, estimatingRole } = useAuthStore()
  const { t, lang } = useLang()
  const [entries, setEntries] = useState<BudgetEntry[]>([])
  const [approvals, setApprovals] = useState<BudgetApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)

  const isAdmin = canApproveFinancials(estimatingRole ?? 'member')
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US'

  useEffect(() => {
    refresh()
  }, [projectId])

  async function refresh() {
    setLoading(true)
    try {
      const [budget, approvalHistory] = await Promise.all([
        getBudget(projectId),
        getBudgetApprovalHistory(projectId),
      ])
      setEntries(budget?.entries ?? [])
      setApprovals(approvalHistory)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddEntry(input: { type: 'planned' | 'revised'; amount: number; reason?: string }) {
    await addBudgetEntry(projectId, { ...input, createdBy: user?.uid })
    setShowEntryForm(false)
    refresh()
  }

  async function handleApprove() {
    const latestEntry = getLatestBudgetEntry(entries)
    if (!latestEntry) return

    setApproving(true)
    setApprovalError(null)
    try {
      await createBudgetApproval(projectId, {
        approvedAmount: latestEntry.amount,
        basedOnEntryId: latestEntry.id,
        approvedBy: user?.uid,
      })
      refresh()
    } catch (err) {
      // এই error সাধারণত Firestore rules-এর isEstimatingAdmin() ব্যর্থ
      // হলে আসবে ("permission-denied") — যদিও UI-তে বাটন isAdmin
      // চেক করে লুকানো থাকে, কেউ যদি সরাসরি DevTools দিয়ে কল করার
      // চেষ্টা করে, rules-ই আসল বাধা দেবে।
      setApprovalError(t('approveFailed'))
    } finally {
      setApproving(false)
    }
  }

  const comparison = compareBudget(entries, approvals)
  const latestEntry = getLatestBudgetEntry(entries)

  if (loading) {
    return <p className="text-sm text-text-muted">{t('loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{t('budgetTitle')}</h2>
          <p className="text-sm text-text-muted mt-1">{t('budgetDescription')}</p>
        </div>
        <button className="btn-outline shrink-0" onClick={() => setShowEntryForm(true)}>
          <Plus size={16} />
          {t('newEntry')}
        </button>
      </div>

      {showEntryForm && (
        <BudgetEntryForm onCancel={() => setShowEntryForm(false)} onSubmit={handleAddEntry} />
      )}

      {/* Comparison summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">{t('plannedCostLabel')}</p>
          <p className="text-lg font-bold text-text-primary">
            {comparison.plannedAmount !== null ? `৳${comparison.plannedAmount.toLocaleString(locale)}` : '—'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">{t('approvedCostLabel')}</p>
          <p className="text-lg font-bold text-text-primary">
            {comparison.latestApprovedAmount !== null
              ? `৳${comparison.latestApprovedAmount.toLocaleString(locale)}`
              : '—'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">{t('differenceLabel')}</p>
          {comparison.differencePercent !== null ? (
            <p className={`text-lg font-bold ${comparison.isOverApproved ? 'text-red-600' : 'text-status-activeText'}`}>
              {comparison.differencePercent > 0 ? '+' : ''}
              {comparison.differencePercent.toFixed(1)}%
            </p>
          ) : (
            <p className="text-lg font-bold text-text-muted">—</p>
          )}
        </div>
      </div>

      {/* Approval action */}
      {latestEntry && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">
                {t('latestEntryLabel')}: ৳{latestEntry.amount.toLocaleString(locale)} ({latestEntry.type})
              </p>
              {latestEntry.reason && (
                <p className="text-xs text-text-muted mt-0.5">
                  {t('reasonLabel')}: {latestEntry.reason}
                </p>
              )}
            </div>
            {isAdmin ? (
              <button className="btn-primary shrink-0" onClick={handleApprove} disabled={approving}>
                <CheckCircle2 size={16} />
                {t('approveBtn')}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-text-muted shrink-0">
                <ShieldAlert size={14} />
                {t('adminRequiredToApprove')}
              </div>
            )}
          </div>
          {approvalError && <p className="text-xs text-red-600 mt-2">{approvalError}</p>}
        </div>
      )}

      {/* History */}
      {entries.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border">
            <p className="text-xs font-semibold text-text-secondary">{t('entryHistoryTitle')}</p>
          </div>
          <div className="divide-y divide-surface-border">
            {[...entries]
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((entry) => (
                <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-sm text-text-primary">
                      {entry.type === 'planned' ? t('plannedLabel') : t('revisedLabel')}: ৳
                      {entry.amount.toLocaleString(locale)}
                    </span>
                    {entry.reason && <p className="text-xs text-text-muted">{entry.reason}</p>}
                  </div>
                  <span className="text-xs text-text-muted">
                    {new Date(entry.createdAt).toLocaleDateString(locale)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {approvals.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border">
            <p className="text-xs font-semibold text-text-secondary">{t('approvalHistoryTitle')}</p>
          </div>
          <div className="divide-y divide-surface-border">
            {approvals.map((approval) => (
              <div key={approval.id} className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-text-primary">
                  ৳{approval.approvedAmount.toLocaleString(locale)} {t('approvedSuffix')}
                </span>
                <span className="text-xs text-text-muted">
                  {new Date(approval.approvedAt).toLocaleDateString(locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function BudgetEntryForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (input: { type: 'planned' | 'revised'; amount: number; reason?: string }) => void
}) {
  const { t } = useLang()
  const [type, setType] = useState<'planned' | 'revised'>('planned')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const parsedAmount = parseFloat(amount)
    const validation = validateBudgetEntry({ amount: parsedAmount, reason, type })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSubmit({ type, amount: parsedAmount, reason: reason.trim() || undefined })
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('entryTypeLabel')}</label>
          <select value={type} onChange={(e) => setType(e.target.value as 'planned' | 'revised')} className="input-field">
            <option value="planned">{t('plannedCostOption')}</option>
            <option value="revised">{t('revisedCostOption')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('amountLabel')}</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" />
        </div>
        {type === 'revised' && (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('reasonRequiredLabel')}</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              className="input-field"
            />
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button className="btn-ghost" onClick={onCancel}>{t('cancel')}</button>
        <button className="btn-primary" onClick={handleSubmit}>{t('add')}</button>
      </div>
    </div>
  )
}
