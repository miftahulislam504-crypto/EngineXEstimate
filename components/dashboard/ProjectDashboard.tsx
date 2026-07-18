// components/dashboard/ProjectDashboard.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Wallet, Package, Users, Wrench, TrendingUp, PieChart, AlertCircle, type LucideIcon } from 'lucide-react'
import { BOQItem } from '@/lib/types/boq.types'
import { getRateAnalysis } from '@/lib/firestore/rate-analysis.firestore'
import { listMaterials } from '@/lib/firestore/material.firestore'
import { listResourceRates } from '@/lib/firestore/resource-rate.firestore'
import { Material } from '@/lib/types/material.types'
import { ResourceRate } from '@/lib/types/resource-rate.types'
import { RateAnalysisEntry } from '@/lib/types/rate-analysis.types'
import { calculateProjectCostSummary, toCostBreakdownChartData } from '@/lib/services/dashboard.service'
import { useLang } from '@/components/providers/LanguageProvider'

interface ProjectDashboardProps {
  projectId: string
  projectName: string
  boqItems: BOQItem[]
}

const CHART_COLORS: Record<string, string> = {
  Material: '#2563eb',
  Labour: '#16a34a',
  Equipment: '#d97706',
  Overhead: '#9333ea',
  Profit: '#0891b2',
}

export function ProjectDashboard({ projectId, projectName, boqItems }: ProjectDashboardProps) {
  const { t, lang } = useLang()
  const [rateAnalysisEntries, setRateAnalysisEntries] = useState<RateAnalysisEntry[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [labourRates, setLabourRates] = useState<ResourceRate[]>([])
  const [equipmentRates, setEquipmentRates] = useState<ResourceRate[]>([])
  const [loading, setLoading] = useState(true)

  const locale = lang === 'bn' ? 'bn-BD' : 'en-US'

  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      try {
        const [analysis, matList, labourList, equipList] = await Promise.all([
          getRateAnalysis(projectId),
          listMaterials(),
          listResourceRates('labour'),
          listResourceRates('equipment'),
        ])
        setRateAnalysisEntries(analysis?.entries ?? [])
        setMaterials(matList)
        setLabourRates(labourList)
        setEquipmentRates(equipList)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [projectId])

  const summary = useMemo(
    () => calculateProjectCostSummary(boqItems, rateAnalysisEntries, materials, labourRates, equipmentRates),
    [boqItems, rateAnalysisEntries, materials, labourRates, equipmentRates]
  )

  const chartData = useMemo(() => toCostBreakdownChartData(summary), [summary])
  const chartTotal = chartData.reduce((sum, slice) => sum + slice.value, 0)

  if (loading) {
    return <p className="text-sm text-text-muted">{t('loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('dashboardTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{projectName}</p>
      </div>

      {summary.itemsWithoutRateAnalysis.length > 0 && (
        <div className="rounded-lg border border-status-holdBorder bg-status-holdBg p-3 flex gap-2">
          <AlertCircle size={16} className="text-status-holdText shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-status-holdText">{t('missingRateAnalysisDashboardWarning')}</p>
            <p className="text-xs text-status-holdText mt-0.5">
              {summary.itemsWithoutRateAnalysis.join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Cost summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={Wallet} label={t('totalProjectCostLabel')} value={summary.totalProjectCost} locale={locale} highlight />
        <SummaryCard icon={Package} label={t('materialCostDashLabel')} value={summary.totalMaterialCost} locale={locale} />
        <SummaryCard icon={Users} label={t('labourCostDashLabel')} value={summary.totalLabourCost} locale={locale} />
        <SummaryCard icon={Wrench} label={t('equipmentCostDashLabel')} value={summary.totalEquipmentCost} locale={locale} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard icon={TrendingUp} label={t('overheadCostDashLabel')} value={summary.totalOverheadAmount} locale={locale} />
        <SummaryCard icon={TrendingUp} label={t('profitMarginDashLabel')} value={summary.totalProfitAmount} locale={locale} />
      </div>

      {/* Cost Breakdown Chart */}
      <div className="card p-5">
        <h3 className="section-title mb-4">
          <PieChart size={16} /> {t('costBreakdownTitle')}
        </h3>
        {chartData.length === 0 ? (
          <p className="text-sm text-text-muted">{t('noCostDataYet')}</p>
        ) : (
          <div className="space-y-2">
            {/* একটা সরল horizontal stacked bar — কোনো external chart
                library ছাড়াই। ভবিষ্যতে recharts/chart.js দিয়ে richer
                visualization বসানো যাবে, কিন্তু এই মুহূর্তে data-টা
                সঠিকভাবে দেখানোই মূল লক্ষ্য। */}
            <div className="flex h-6 rounded-lg overflow-hidden">
              {chartData.map((slice) => (
                <div
                  key={slice.label}
                  style={{
                    width: `${(slice.value / chartTotal) * 100}%`,
                    backgroundColor: CHART_COLORS[slice.label] ?? '#94a3b8',
                  }}
                  title={`${slice.label}: ৳${slice.value.toFixed(2)}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {chartData.map((slice) => (
                <div key={slice.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[slice.label] ?? '#94a3b8' }}
                  />
                  {slice.label}: ৳{slice.value.toLocaleString(locale, { maximumFractionDigits: 0 })} (
                  {((slice.value / chartTotal) * 100).toFixed(1)}%)
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* যা এখনো সম্ভব না — honest placeholder। নোট: Module 10/11
          বানানোর আগে এখানে Budget vs Actual Cost-ও ছিল, কিন্তু সেটা
          এখন BudgetPanel/CostTrackingPanel-এ সমাধান হয়ে গেছে বলে
          এই placeholder থেকে সরানো হয়েছে (i18n retrofit করার সময়
          এই stale তথ্য ধরা পড়েছিল)। */}
      <div className="card p-5 bg-surface">
        <h3 className="text-sm font-semibold text-text-secondary mb-2">{t('notYetAvailableTitle')}</h3>
        <ul className="text-xs text-text-muted space-y-1.5 list-disc list-inside">
          <li>{t('projectProgressNotAvailable')}</li>
        </ul>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  locale,
  highlight,
}: {
  icon: LucideIcon
  label: string
  value: number
  locale: string
  highlight?: boolean
}) {
  return (
    <div className={`card p-4 ${highlight ? 'border-brand-200 bg-brand-50/40' : ''}`}>
      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
        <Icon size={14} />
        {label}
      </div>
      <p className={`text-lg font-bold ${highlight ? 'text-brand-700' : 'text-text-primary'}`}>
        ৳{value.toLocaleString(locale, { maximumFractionDigits: 0 })}
      </p>
    </div>
  )
}
