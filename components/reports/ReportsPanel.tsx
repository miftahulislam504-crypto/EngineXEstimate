// components/reports/ReportsPanel.tsx
//
// Module 13 — এক-ক্লিক export। এই প্রথম ধাপে শুধু PDF (৬টা report);
// Excel/Word পরের ধাপে এই একই বাটন-গ্রিডে যোগ হবে (প্রতিটা report
// row-এ format-selector বসিয়ে, নতুন component না বানিয়ে)।
//
// প্রতিটা report generate করার আগে checkReportsAvailability() দিয়ে
// ডেটা আছে কিনা যাচাই করা হয় — Dashboard-এর itemsWithoutRateAnalysis-এর
// একই "silent-omission এড়ানো" নীতি এখানেও: ডেটা না থাকলে বাটন
// disabled + কারণ দেখানো হয়, চুপচাপ খালি PDF বানানো হয় না।

'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Loader2, AlertCircle, Info } from 'lucide-react'
import { useLang } from '@/components/providers/LanguageProvider'
import {
  checkReportsAvailability,
  ReportsAvailability,
  buildBOQReportContext,
  buildQuantityReportContext,
  buildCostReportContext,
  buildMaterialReportContext,
  buildBBSReportContext,
  buildTenderReportContext,
} from '@/lib/services/reports.service'
import { downloadBOQReportPdf } from '@/lib/pdf/boq-report.pdf'
import { downloadQuantityReportPdf } from '@/lib/pdf/quantity-report.pdf'
import { downloadCostReportPdf } from '@/lib/pdf/cost-report.pdf'
import { downloadMaterialReportPdf } from '@/lib/pdf/material-report.pdf'
import { downloadBBSReportPdf } from '@/lib/pdf/bbs-report.pdf'
import { downloadTenderReportPdf } from '@/lib/pdf/tender-report.pdf'
import { ReportKind } from '@/lib/types/reports.types'
import type { TranslationKey } from '@/lib/i18n'

interface ReportsPanelProps {
  projectId: string
  projectName: string
  projectCode?: string
}

const REPORT_LABEL_KEYS: Record<ReportKind, TranslationKey> = {
  boq: 'boqReportLabel',
  quantity: 'quantityReportLabel',
  cost: 'costReportLabel',
  material: 'materialReportLabel',
  bbs: 'bbsReportLabel',
  tender: 'tenderReportLabel',
}

const REPORT_UNAVAILABLE_KEYS: Record<ReportKind, TranslationKey> = {
  boq: 'reportUnavailableBoq',
  quantity: 'reportUnavailableQuantity',
  cost: 'reportUnavailableCost',
  material: 'reportUnavailableMaterial',
  bbs: 'reportUnavailableBbs',
  tender: 'reportUnavailableTender',
}

const REPORT_KINDS: ReportKind[] = ['boq', 'quantity', 'cost', 'material', 'bbs', 'tender']

export function ReportsPanel({ projectId, projectName, projectCode }: ReportsPanelProps) {
  const { t } = useLang()
  const [availability, setAvailability] = useState<ReportsAvailability | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<ReportKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [projectId])

  async function refresh() {
    setLoading(true)
    try {
      const result = await checkReportsAvailability(projectId)
      setAvailability(result)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate(kind: ReportKind) {
    setGenerating(kind)
    setError(null)
    try {
      const meta = { projectName, projectCode, generatedAt: Date.now() }
      switch (kind) {
        case 'boq': {
          const context = await buildBOQReportContext(projectId)
          downloadBOQReportPdf(context, meta)
          break
        }
        case 'quantity': {
          const context = await buildQuantityReportContext(projectId)
          downloadQuantityReportPdf(context, meta)
          break
        }
        case 'cost': {
          const context = await buildCostReportContext(projectId)
          downloadCostReportPdf(context, meta)
          break
        }
        case 'material': {
          const context = await buildMaterialReportContext()
          downloadMaterialReportPdf(context, meta)
          break
        }
        case 'bbs': {
          const context = await buildBBSReportContext(projectId)
          downloadBBSReportPdf(context, meta)
          break
        }
        case 'tender': {
          const context = await buildTenderReportContext(projectId)
          downloadTenderReportPdf(context, meta)
          break
        }
      }
    } catch {
      setError(t('reportGenerationFailed'))
    } finally {
      setGenerating(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-text-muted">{t('loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('reportsTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('reportsDescription')}</p>
      </div>

      <div className="rounded-lg border border-status-holdBorder bg-status-holdBg p-3 flex items-start gap-2">
        <Info size={16} className="text-status-holdText mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-xs text-status-holdText">{t('reportsPdfOnlyNote')}</p>
          <p className="text-xs text-status-holdText">{t('reportsBengaliPdfLimitationNote')}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REPORT_KINDS.map((kind) => {
          const isAvailable = availability?.[kind] ?? false
          const isGenerating = generating === kind

          return (
            <div key={kind} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText size={18} className="text-brand-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{t(REPORT_LABEL_KEYS[kind])}</p>
                  {!isAvailable && (
                    <p className="text-xs text-text-muted mt-0.5">{t(REPORT_UNAVAILABLE_KEYS[kind])}</p>
                  )}
                </div>
              </div>
              <button
                className="btn-outline text-xs py-1.5 px-3 shrink-0"
                disabled={!isAvailable || isGenerating}
                onClick={() => handleGenerate(kind)}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t('generatingReport')}
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    {t('downloadBtn')}
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
