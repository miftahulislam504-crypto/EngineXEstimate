// components/cost-tracking/CostTrackingPanel.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, TrendingDown, TrendingUp, Info } from 'lucide-react'
import { BudgetEntry, BudgetApproval } from '@/lib/types/budget.types'
import { PurchaseRecord } from '@/lib/types/vendor.types'
import { getBudget, getBudgetApprovalHistory } from '@/lib/firestore/budget.firestore'
import { getVendorData } from '@/lib/firestore/vendor.firestore'
import { calculateCostTrackingSummary } from '@/lib/services/cost-tracking.service'
import { useLang } from '@/components/providers/LanguageProvider'

interface CostTrackingPanelProps {
  projectId: string
}

export function CostTrackingPanel({ projectId }: CostTrackingPanelProps) {
  const { t, lang } = useLang()
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>([])
  const [approvals, setApprovals] = useState<BudgetApproval[]>([])
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [loading, setLoading] = useState(true)

  const locale = lang === 'bn' ? 'bn-BD' : 'en-US'

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [budget, approvalHistory, vendorData] = await Promise.all([
          getBudget(projectId),
          getBudgetApprovalHistory(projectId),
          getVendorData(projectId),
        ])
        setBudgetEntries(budget?.entries ?? [])
        setApprovals(approvalHistory)
        setPurchases(vendorData?.purchases ?? [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  const summary = useMemo(
    () => calculateCostTrackingSummary(budgetEntries, approvals, purchases),
    [budgetEntries, approvals, purchases]
  )

  if (loading) {
    return <p className="text-sm text-text-muted">{t('loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('costTrackingTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('costTrackingDescription')}</p>
      </div>

      <div className="rounded-lg border border-status-holdBorder bg-status-holdBg p-3 flex gap-2">
        <Info size={16} className="text-status-holdText shrink-0 mt-0.5" />
        <p className="text-xs text-status-holdText">{t('actualCostLimitationNote')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label={t('plannedCostLabel')} value={summary.plannedAmount} locale={locale} />
        <SummaryCard label={t('approvedCostLabel')} value={summary.approvedAmount} locale={locale} />
        <SummaryCard label={t('actualCostMaterialLabel')} value={summary.actualMaterialCost} locale={locale} highlight />
        <SummaryCard
          label={t('remainingBudgetLabel')}
          value={summary.remainingBudget}
          locale={locale}
          danger={summary.isOverBudget}
        />
      </div>

      {summary.isOverBudget && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            {t('overBudgetWarning')}
            {Math.abs(summary.remainingBudget ?? 0).toLocaleString(locale)}
          </p>
        </div>
      )}

      {summary.approvedAmount !== null && summary.actualMaterialCost > 0 && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-text-secondary mb-2">{t('spendingProgressTitle')}</p>
          <div className="h-3 bg-surface-hover rounded-full overflow-hidden">
            <div
              className={`h-full ${summary.isOverBudget ? 'bg-red-500' : 'bg-brand-600'}`}
              style={{
                width: `${Math.min((summary.actualMaterialCost / summary.approvedAmount) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              {summary.isOverBudget ? (
                <TrendingUp size={12} className="text-red-600" />
              ) : (
                <TrendingDown size={12} className="text-status-activeText" />
              )}
              {((summary.actualMaterialCost / summary.approvedAmount) * 100).toFixed(1)}
              {t('spentSuffix')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  locale,
  highlight,
  danger,
}: {
  label: string
  value: number | null
  locale: string
  highlight?: boolean
  danger?: boolean
}) {
  return (
    <div className={`card p-4 ${highlight ? 'border-brand-200 bg-brand-50/40' : ''}`}>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p
        className={`text-lg font-bold ${
          danger ? 'text-red-600' : highlight ? 'text-brand-700' : 'text-text-primary'
        }`}
      >
        {value !== null ? `৳${value.toLocaleString(locale, { maximumFractionDigits: 0 })}` : '—'}
      </p>
    </div>
  )
}
