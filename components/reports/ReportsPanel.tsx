// components/reports/ReportsPanel.tsx
//
// Module 13 — এক-ক্লিক export। এই প্রথম ধাপে শুধু PDF (৬টা report +
// ১টা Master/Full Project Report); Excel/Word পরের ধাপে এই একই
// বাটন-গ্রিডে যোগ হবে (প্রতিটা report row-এ format-selector বসিয়ে,
// নতুন component না বানিয়ে)।
//
// প্রতিটা report generate করার আগে checkReportsAvailability() দিয়ে
// ডেটা আছে কিনা যাচাই করা হয় — Dashboard-এর itemsWithoutRateAnalysis-এর
// একই "silent-omission এড়ানো" নীতি এখানেও: ডেটা না থাকলে বাটন
// disabled + কারণ দেখানো হয়, চুপচাপ খালি PDF বানানো হয় না। Master
// Report-এর জন্য এই নীতি একটু ভিন্ন: "কমপক্ষে ১টা section-এ ডেটা
// থাকলেই" বাটন enable হয় (সব section লাগবে না) — কারণ Master Report
// নিজেই খালি section বাদ দিয়ে শুধু available section নিয়ে বানায়
// (master-report.pdf.ts দ্রষ্টব্য), তাই "সব লাগবে" শর্ত দিলে আসলে
// যা কাজ করে তার চেয়ে বেশি কড়া হয়ে যেত।

'use client'

import { useState, useEffect } from 'react'
import { FileText, FileStack, Download, Loader2, AlertCircle, Info } from 'lucide-react'
import { useLang } from '@/components/providers/LanguageProvider'
import {
  checkReportsAvailability,
  ReportsAvailability,
  buildEstimateBasisContext,
  buildBOQReportContext,
  buildQuantityReportContext,
  buildCostReportContext,
  buildMaterialReportContext,
  buildBBSReportContext,
  buildTenderReportContext,
  buildCalculationSheetReportContext,
} from '@/lib/services/reports.service'
import { downloadEstimateBasisPdf } from '@/lib/pdf/estimate-basis.pdf'
import { downloadBOQReportPdf } from '@/lib/pdf/boq-report.pdf'
import { downloadQuantityReportPdf } from '@/lib/pdf/quantity-report.pdf'
import { downloadCostReportPdf } from '@/lib/pdf/cost-report.pdf'
import { downloadMaterialReportPdf } from '@/lib/pdf/material-report.pdf'
import { downloadBBSReportPdf } from '@/lib/pdf/bbs-report.pdf'
import { downloadTenderReportPdf } from '@/lib/pdf/tender-report.pdf'
import { downloadCalculationSheetPdf } from '@/lib/pdf/calculation-sheet.pdf'
import { downloadMasterReportPdf } from '@/lib/pdf/master-report.pdf'
import { ReportKind } from '@/lib/types/reports.types'
import type { TranslationKey } from '@/lib/i18n'

interface ReportsPanelProps {
  projectId: string
  projectName: string
  projectCode?: string
  // MICON-স্টাইল drawing title-block-এর ধারণা থেকে cover page-এ যোগ
  // হওয়া দুটো ঐচ্ছিক ফিল্ড — Project রেকর্ড থেকে (Hub import payload-এ
  // এগুলো নেই)। না থাকলে cover page-এ শুধু সেই row বাদ পড়ে, কোনো
  // ভাঙা লেআউট হয় না।
  clientName?: string
  location?: string
}

const REPORT_LABEL_KEYS: Record<ReportKind, TranslationKey> = {
  estimateBasis: 'estimateBasisReportLabel',
  boq: 'boqReportLabel',
  quantity: 'quantityReportLabel',
  cost: 'costReportLabel',
  material: 'materialReportLabel',
  bbs: 'bbsReportLabel',
  tender: 'tenderReportLabel',
  calculationSheet: 'calculationSheetReportLabel',
  master: 'masterReportLabel',
}

const REPORT_UNAVAILABLE_KEYS: Record<ReportKind, TranslationKey> = {
  estimateBasis: 'reportUnavailableEstimateBasis',
  boq: 'reportUnavailableBoq',
  quantity: 'reportUnavailableQuantity',
  cost: 'reportUnavailableCost',
  material: 'reportUnavailableMaterial',
  bbs: 'reportUnavailableBbs',
  tender: 'reportUnavailableTender',
  calculationSheet: 'reportUnavailableCalculationSheet',
  master: 'reportUnavailableMaster',
}

const REPORT_KINDS: Exclude<ReportKind, 'master'>[] = [
  'estimateBasis',
  'boq',
  'quantity',
  'cost',
  'material',
  'bbs',
  'tender',
  'calculationSheet',
]

export function ReportsPanel({ projectId, projectName, projectCode, clientName, location }: ReportsPanelProps) {
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
      const meta = { projectName, projectCode, clientName, location, generatedAt: Date.now() }
      switch (kind) {
        case 'estimateBasis': {
          const context = await buildEstimateBasisContext(projectId)
          downloadEstimateBasisPdf(context, meta)
          break
        }
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
        case 'calculationSheet': {
          const context = await buildCalculationSheetReportContext(projectId)
          downloadCalculationSheetPdf(context, meta)
          break
        }
        case 'master': {
          // প্রতিটা section-এর context আলাদাভাবে fetch — একটা section
          // fetch fail করলেও (যেমন কোনো project-এ tender ডেটা নেই)
          // Promise.all reject হয়ে পুরো Master Report আটকে যাবে না,
          // কারণ প্রতিটা build*ReportContext() নিজেই "নেই" অবস্থা
          // handle করে খালি/ডিফল্ট context রিটার্ন করে (throw করে না)।
          const [estimateBasis, boq, quantity, cost, material, bbs, tender, calculationSheet] = await Promise.all([
            buildEstimateBasisContext(projectId),
            buildBOQReportContext(projectId),
            buildQuantityReportContext(projectId),
            buildCostReportContext(projectId),
            buildMaterialReportContext(),
            buildBBSReportContext(projectId),
            buildTenderReportContext(projectId),
            buildCalculationSheetReportContext(projectId),
          ])
          const currentAvailability = availability ?? (await checkReportsAvailability(projectId))
          downloadMasterReportPdf(
            { availability: currentAvailability, estimateBasis, boq, quantity, cost, material, bbs, tender, calculationSheet },
            meta
          )
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

  const isMasterAvailable = availability ? Object.values(availability).some(Boolean) : false
  const isMasterGenerating = generating === 'master'

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

      {/* Master Report — গ্রিডের বাইরে, উপরে; সবচেয়ে বেশি ব্যবহৃত
          হবে বলে ধরে নিয়ে আলাদা highlighted card, brand-color বর্ডার
          দিয়ে বাকি ৬টা থেকে আলাদা করা */}
      <div className="card p-4 border-brand-200 bg-brand-50/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileStack size={20} className="text-brand-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{t('masterReportLabel')}</p>
            <p className="text-xs text-text-muted mt-0.5">{t('masterReportDescription')}</p>
            {!isMasterAvailable && (
              <p className="text-xs text-text-muted mt-1">{t(REPORT_UNAVAILABLE_KEYS.master)}</p>
            )}
          </div>
        </div>
        <button
          className="btn-primary text-xs py-1.5 px-3 shrink-0"
          disabled={!isMasterAvailable || isMasterGenerating}
          onClick={() => handleGenerate('master')}
        >
          {isMasterGenerating ? (
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
