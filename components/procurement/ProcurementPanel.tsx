// components/procurement/ProcurementPanel.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, AlertCircle, Package, ShoppingCart } from 'lucide-react'
import { BOQItem } from '@/lib/types/boq.types'
import { BBSRow } from '@/lib/types/reinforcement.types'
import { RateAnalysisEntry } from '@/lib/types/rate-analysis.types'
import { Material } from '@/lib/types/material.types'
import { getRateAnalysis } from '@/lib/firestore/rate-analysis.firestore'
import { listMaterials } from '@/lib/firestore/material.firestore'
import { getBBS } from '@/lib/firestore/reinforcement.firestore'
import {
  calculateMaterialProcurementNeeds,
  findBoqItemsWithoutRateAnalysis,
  calculateReinforcementProcurementNeeds,
} from '@/lib/services/procurement.service'
import {
  getProcurementSchedule,
  addProcurementScheduleEntry,
  updateProcurementScheduleStatus,
  deleteProcurementScheduleEntry,
} from '@/lib/firestore/procurement.firestore'
import { ProcurementScheduleEntry } from '@/lib/types/procurement.types'
import { useLang } from '@/components/providers/LanguageProvider'

interface ProcurementPanelProps {
  projectId: string
  boqItems: BOQItem[]
}

export function ProcurementPanel({ projectId, boqItems }: ProcurementPanelProps) {
  const { t } = useLang()

  // module-level constant না — STATUS_LABELS আগে top-level ছিল,
  // t() hook ব্যবহারের জন্য component-এর ভেতরে সরানো হয়েছে
  const statusLabels: Record<ProcurementScheduleEntry['status'], string> = {
    pending: t('procurementStatus_pending'),
    ordered: t('procurementStatus_ordered'),
    received: t('procurementStatus_received'),
  }

  const [rateAnalysisEntries, setRateAnalysisEntries] = useState<RateAnalysisEntry[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [bbsRows, setBbsRows] = useState<BBSRow[]>([])
  const [scheduleEntries, setScheduleEntries] = useState<ProcurementScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showScheduleForm, setShowScheduleForm] = useState(false)

  useEffect(() => {
    refresh()
  }, [projectId])

  async function refresh() {
    setLoading(true)
    try {
      const [analysis, matList, bbs, schedule] = await Promise.all([
        getRateAnalysis(projectId),
        listMaterials(),
        getBBS(projectId),
        getProcurementSchedule(projectId),
      ])
      setRateAnalysisEntries(analysis?.entries ?? [])
      setMaterials(matList)
      setBbsRows(bbs?.rows ?? [])
      setScheduleEntries(schedule?.entries ?? [])
    } finally {
      setLoading(false)
    }
  }

  const materialNeeds = useMemo(
    () => calculateMaterialProcurementNeeds(boqItems, rateAnalysisEntries, materials),
    [boqItems, rateAnalysisEntries, materials]
  )
  const missingRateAnalysis = useMemo(
    () => findBoqItemsWithoutRateAnalysis(boqItems, rateAnalysisEntries),
    [boqItems, rateAnalysisEntries]
  )
  const reinforcementNeeds = useMemo(() => calculateReinforcementProcurementNeeds(bbsRows), [bbsRows])

  async function handleAddSchedule(input: { materialId: string; materialName: string; targetQuantity: number; notes?: string }) {
    await addProcurementScheduleEntry(projectId, input)
    setShowScheduleForm(false)
    refresh()
  }

  async function handleStatusChange(entryId: string, status: ProcurementScheduleEntry['status']) {
    await updateProcurementScheduleStatus(projectId, entryId, status)
    refresh()
  }

  async function handleDeleteSchedule(entryId: string) {
    await deleteProcurementScheduleEntry(projectId, entryId)
    refresh()
  }

  if (loading) {
    return <p className="text-sm text-text-muted">{t('loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('procurementTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('procurementDescription')}</p>
      </div>

      {missingRateAnalysis.length > 0 && (
        <div className="rounded-lg border border-status-holdBorder bg-status-holdBg p-3 flex gap-2">
          <AlertCircle size={16} className="text-status-holdText shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-status-holdText">{t('missingRateAnalysisWarning')}</p>
            <p className="text-xs text-status-holdText mt-0.5">{missingRateAnalysis.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Material Needs */}
      <div className="card p-5">
        <h3 className="section-title mb-3">
          <Package size={16} /> {t('materialNeedTitle')}
        </h3>
        {materialNeeds.length === 0 ? (
          <p className="text-sm text-text-muted">{t('materialNeedEmpty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                <th className="py-2">{t('materialLabel')}</th>
                <th className="py-2">{t('totalNeeded')}</th>
              </tr>
            </thead>
            <tbody>
              {materialNeeds.map((need) => (
                <tr key={need.materialId} className="border-b border-surface-border last:border-0">
                  <td className="py-2 text-text-primary">{need.materialName}</td>
                  <td className="py-2 font-medium">
                    {need.totalQuantityNeeded.toFixed(2)} {need.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reinforcement Needs */}
      {reinforcementNeeds.length > 0 && (
        <div className="card p-5">
          <h3 className="section-title mb-3">
            <Package size={16} /> {t('reinforcementNeedTitle')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {reinforcementNeeds.map((need) => (
              <span key={need.diameterMm} className="text-xs text-text-secondary bg-surface-hover px-2.5 py-1 rounded-lg">
                {need.diameterMm}mm: {need.totalWeightKg.toFixed(2)} kg
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manual Schedule */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">
            <ShoppingCart size={16} /> {t('procurementScheduleTitle')}
          </h3>
          <button className="btn-outline text-xs py-1 px-2" onClick={() => setShowScheduleForm(true)}>
            <Plus size={14} />
            {t('newEntry')}
          </button>
        </div>

        {showScheduleForm && (
          <ScheduleEntryForm
            materialNeeds={materialNeeds}
            onCancel={() => setShowScheduleForm(false)}
            onSubmit={handleAddSchedule}
          />
        )}

        {scheduleEntries.length === 0 ? (
          <p className="text-sm text-text-muted mt-2">{t('noScheduleEntries')}</p>
        ) : (
          <div className="divide-y divide-surface-border mt-2">
            {scheduleEntries.map((entry) => (
              <div key={entry.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-primary">
                    {entry.materialName} — {entry.targetQuantity}
                  </p>
                  {entry.notes && <p className="text-xs text-text-muted">{entry.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={entry.status}
                    onChange={(e) => handleStatusChange(entry.id, e.target.value as ProcurementScheduleEntry['status'])}
                    className="input-field text-xs py-1"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <button onClick={() => handleDeleteSchedule(entry.id)} className="text-text-muted hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function ScheduleEntryForm({
  materialNeeds,
  onCancel,
  onSubmit,
}: {
  materialNeeds: { materialId: string; materialName: string }[]
  onCancel: () => void
  onSubmit: (input: { materialId: string; materialName: string; targetQuantity: number; notes?: string }) => void
}) {
  const { t } = useLang()
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [targetQuantity, setTargetQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    const material = materialNeeds.find((m) => m.materialId === selectedMaterialId)
    const parsedQty = parseFloat(targetQuantity)
    if (!material) {
      setError(t('selectMaterial'))
      return
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError(t('validQuantityRequired'))
      return
    }
    onSubmit({
      materialId: material.materialId,
      materialName: material.materialName,
      targetQuantity: parsedQty,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="space-y-2 border-t border-surface-border pt-3 mb-3">
      <select
        value={selectedMaterialId}
        onChange={(e) => setSelectedMaterialId(e.target.value)}
        className="input-field text-sm"
      >
        <option value="">{t('selectMaterialEllipsis')}</option>
        {materialNeeds.map((m) => (
          <option key={m.materialId} value={m.materialId}>{m.materialName}</option>
        ))}
      </select>
      <input
        type="number"
        value={targetQuantity}
        onChange={(e) => setTargetQuantity(e.target.value)}
        placeholder={t('targetQuantityPlaceholder')}
        className="input-field text-sm"
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('notesOptional')}
        className="input-field text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost text-xs py-1 px-2" onClick={onCancel}>{t('cancel')}</button>
        <button className="btn-primary text-xs py-1 px-2" onClick={handleSubmit}>{t('add')}</button>
      </div>
    </div>
  )
}
