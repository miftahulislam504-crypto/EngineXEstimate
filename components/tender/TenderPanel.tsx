// components/tender/TenderPanel.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Award, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { EngineerEstimate, ContractorBid, TenderFinalization } from '@/lib/types/tender.types'
import {
  getTender,
  addEngineerEstimate,
  addContractorBid,
  getLatestEngineerEstimate,
  createTenderFinalization,
  getTenderFinalizationHistory,
} from '@/lib/firestore/tender.firestore'
import {
  buildComparativeStatement,
  validateEngineerEstimate,
  validateContractorBid,
  validateFinalization,
} from '@/lib/services/tender.service'
import { useAuthStore } from '@/store/useAuthStore'
import { canApproveFinancials } from '@/lib/types/auth.types'
import { useLang } from '@/components/providers/LanguageProvider'

interface TenderPanelProps {
  projectId: string
}

export function TenderPanel({ projectId }: TenderPanelProps) {
  const { user, estimatingRole } = useAuthStore()
  const { t, lang } = useLang()
  const [engineerEstimates, setEngineerEstimates] = useState<EngineerEstimate[]>([])
  const [bids, setBids] = useState<ContractorBid[]>([])
  const [finalizations, setFinalizations] = useState<TenderFinalization[]>([])
  const [loading, setLoading] = useState(true)
  const [showEstimateForm, setShowEstimateForm] = useState(false)
  const [showBidForm, setShowBidForm] = useState(false)
  const [selectedBidForFinalize, setSelectedBidForFinalize] = useState<string | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)

  const isAdmin = canApproveFinancials(estimatingRole ?? 'member')
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US'

  useEffect(() => {
    refresh()
  }, [projectId])

  async function refresh() {
    setLoading(true)
    try {
      const [tender, finalizationHistory] = await Promise.all([
        getTender(projectId),
        getTenderFinalizationHistory(projectId),
      ])
      setEngineerEstimates(tender?.engineerEstimates ?? [])
      setBids(tender?.contractorBids ?? [])
      setFinalizations(finalizationHistory)
    } finally {
      setLoading(false)
    }
  }

  const latestEstimate = useMemo(() => getLatestEngineerEstimate(engineerEstimates), [engineerEstimates])
  const comparativeStatement = useMemo(
    () => buildComparativeStatement(latestEstimate, bids),
    [latestEstimate, bids]
  )
  const isFinalized = finalizations.length > 0

  async function handleAddEstimate(totalAmount: number, notes?: string) {
    await addEngineerEstimate(projectId, { totalAmount, notes, createdBy: user?.uid })
    setShowEstimateForm(false)
    refresh()
  }

  async function handleAddBid(input: { contractorName: string; bidAmount: number; contactInfo?: string; notes?: string }) {
    await addContractorBid(projectId, input)
    setShowBidForm(false)
    refresh()
  }

  async function handleFinalize() {
    if (!selectedBidForFinalize) return
    const bid = bids.find((b) => b.id === selectedBidForFinalize)
    if (!bid) return

    const validation = validateFinalization({ selectedBidId: bid.id, finalizedAmount: bid.bidAmount })
    if (!validation.valid) {
      setFinalizeError(validation.errors[0])
      return
    }

    setFinalizing(true)
    setFinalizeError(null)
    try {
      await createTenderFinalization(projectId, {
        selectedBidId: bid.id,
        finalizedAmount: bid.bidAmount,
        finalizedBy: user?.uid,
      })
      setSelectedBidForFinalize(null)
      refresh()
    } catch {
      // rules-এর isEstimatingAdmin() ব্যর্থ হলে এই error আসবে
      setFinalizeError(t('finalizeFailed'))
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-text-muted">{t('loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('tenderTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('tenderDescription')}</p>
      </div>

      {isFinalized && (
        <div className="rounded-lg border border-status-doneBorder bg-status-doneBg p-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-status-doneText" />
          <p className="text-sm text-status-doneText">
            {t('tenderFinalizedMsg')}
            {finalizations[0].finalizedAmount.toLocaleString(locale)}
          </p>
        </div>
      )}

      {/* Engineer Estimate */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-text-primary">{t('engineerEstimateTitle')}</h3>
          <button className="btn-outline text-xs py-1 px-2" onClick={() => setShowEstimateForm(true)}>
            <Plus size={14} />
            {t('newEstimate')}
          </button>
        </div>
        {latestEstimate ? (
          <p className="text-lg font-bold text-text-primary">
            ৳{latestEstimate.totalAmount.toLocaleString(locale)}
          </p>
        ) : (
          <p className="text-sm text-text-muted">{t('noEngineerEstimate')}</p>
        )}
        {showEstimateForm && (
          <EngineerEstimateForm
            onCancel={() => setShowEstimateForm(false)}
            onSubmit={handleAddEstimate}
          />
        )}
      </div>

      {/* Contractor Bids */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-text-primary">{t('contractorBidsTitle')}</h3>
          <button className="btn-outline text-xs py-1 px-2" onClick={() => setShowBidForm(true)}>
            <Plus size={14} />
            {t('newBid')}
          </button>
        </div>
        {showBidForm && <ContractorBidForm onCancel={() => setShowBidForm(false)} onSubmit={handleAddBid} />}
      </div>

      {/* Comparative Statement */}
      {comparativeStatement.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-4 py-2.5 border-b border-surface-border">
            <p className="text-xs font-semibold text-text-secondary">{t('comparativeStatementTitle')}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                <th className="px-4 py-2.5"></th>
                <th className="px-4 py-2.5">{t('contractorCol')}</th>
                <th className="px-4 py-2.5">{t('bidAmountCol')}</th>
                <th className="px-4 py-2.5">{t('differenceFromEstimateCol')}</th>
                {!isFinalized && isAdmin && <th className="px-4 py-2.5">{t('selectionCol')}</th>}
              </tr>
            </thead>
            <tbody>
              {comparativeStatement.map((row) => (
                <tr key={row.bidId} className="border-b border-surface-border last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-2.5">
                    {row.isLowestBid && (
                      <span title={t('lowestBidTitle')} className="inline-flex">
                        <Award size={14} className="text-brand-600" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary font-medium">{row.contractorName}</td>
                  <td className="px-4 py-2.5">৳{row.bidAmount.toLocaleString(locale)}</td>
                  <td className={`px-4 py-2.5 ${row.differenceFromEngineerEstimate > 0 ? 'text-red-600' : 'text-status-activeText'}`}>
                    {row.differenceFromEngineerEstimate > 0 ? '+' : ''}
                    {row.differencePercent.toFixed(1)}%
                  </td>
                  {!isFinalized && isAdmin && (
                    <td className="px-4 py-2.5">
                      <input
                        type="radio"
                        name="finalize-selection"
                        checked={selectedBidForFinalize === row.bidId}
                        onChange={() => setSelectedBidForFinalize(row.bidId)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {!isFinalized && (
            <div className="p-4 border-t border-surface-border">
              {isAdmin ? (
                <>
                  <button
                    className="btn-primary"
                    onClick={handleFinalize}
                    disabled={!selectedBidForFinalize || finalizing}
                  >
                    <CheckCircle2 size={16} />
                    {t('finalizeSelectedBid')}
                  </button>
                  {finalizeError && <p className="text-xs text-red-600 mt-2">{finalizeError}</p>}
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <ShieldAlert size={14} />
                  {t('adminRequiredToFinalize')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function EngineerEstimateForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (amount: number, notes?: string) => void
}) {
  const { t } = useLang()
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const parsed = parseFloat(amount)
    const validation = validateEngineerEstimate({ totalAmount: parsed })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSubmit(parsed, notes.trim() || undefined)
  }

  return (
    <div className="mt-3 space-y-2 border-t border-surface-border pt-3">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={t('totalAmountPlaceholder')}
        className="input-field text-sm"
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('notesOptional')}
        className="input-field text-sm"
      />
      {errors.length > 0 && <p className="text-xs text-red-600">{errors[0]}</p>}
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost text-xs py-1 px-2" onClick={onCancel}>{t('cancel')}</button>
        <button className="btn-primary text-xs py-1 px-2" onClick={handleSubmit}>{t('add')}</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function ContractorBidForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (input: { contractorName: string; bidAmount: number; contactInfo?: string; notes?: string }) => void
}) {
  const { t } = useLang()
  const [contractorName, setContractorName] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const parsed = parseFloat(bidAmount)
    const validation = validateContractorBid({ contractorName, bidAmount: parsed })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSubmit({
      contractorName: contractorName.trim(),
      bidAmount: parsed,
      contactInfo: contactInfo.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="mt-3 space-y-2 border-t border-surface-border pt-3">
      <input
        value={contractorName}
        onChange={(e) => setContractorName(e.target.value)}
        placeholder={t('contractorNamePlaceholder')}
        className="input-field text-sm"
      />
      <input
        type="number"
        value={bidAmount}
        onChange={(e) => setBidAmount(e.target.value)}
        placeholder={t('bidAmountPlaceholder')}
        className="input-field text-sm"
      />
      <input
        value={contactInfo}
        onChange={(e) => setContactInfo(e.target.value)}
        placeholder={t('contactOptionalPlaceholder')}
        className="input-field text-sm"
      />
      {errors.length > 0 && <p className="text-xs text-red-600">{errors[0]}</p>}
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost text-xs py-1 px-2" onClick={onCancel}>{t('cancel')}</button>
        <button className="btn-primary text-xs py-1 px-2" onClick={handleSubmit}>{t('add')}</button>
      </div>
    </div>
  )
}
