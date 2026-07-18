// components/reinforcement/BBSTable.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { BBSRow, BarShape, StructuralMember } from '@/lib/types/reinforcement.types'
import { getBBS, saveBBSRows } from '@/lib/firestore/reinforcement.firestore'
import {
  calculateBBSRows,
  summarizeBBSTotalWeight,
  summarizeBBSByDiameter,
  validateBBSRow,
  createBBSRow,
} from '@/lib/services/reinforcement.service'
import { useLang } from '@/components/providers/LanguageProvider'

interface BBSTableProps {
  projectId: string
}

export function BBSTable({ projectId }: BBSTableProps) {
  const { t } = useLang()

  // module-level constant না — MEMBER_LABELS/SHAPE_LABELS আগে
  // top-level ছিল, t() hook ব্যবহারের জন্য component-এর ভেতরে
  // সরানো হয়েছে
  const memberLabels: Record<StructuralMember, string> = {
    footing: t('member_footing'),
    column: t('member_column'),
    beam: t('member_beam'),
    slab: t('member_slab'),
    stair: t('member_stair'),
  }

  const shapeLabels: Record<BarShape, string> = {
    straight: t('shape_straight'),
    l_hook: t('shape_l_hook'),
    u_hook: t('shape_u_hook'),
    stirrup: t('shape_stirrup'),
    cranked: t('shape_cranked'),
  }

  const [rows, setRows] = useState<BBSRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    getBBS(projectId).then((stored) => {
      setRows(stored?.rows ?? [])
      setLoading(false)
    })
  }, [projectId])

  const { calculated, warnings } = useMemo(() => calculateBBSRows(rows), [rows])
  const totalWeight = useMemo(() => summarizeBBSTotalWeight(calculated), [calculated])
  const byDiameter = useMemo(() => summarizeBBSByDiameter(calculated), [calculated])

  async function persistRows(updatedRows: BBSRow[]) {
    setRows(updatedRows)
    await saveBBSRows(projectId, updatedRows)
  }

  async function handleAddRow(newRow: BBSRow) {
    await persistRows([...rows, newRow])
    setShowAddForm(false)
  }

  async function handleUpdateRow(updatedRow: BBSRow) {
    await persistRows(rows.map((r) => (r.id === updatedRow.id ? updatedRow : r)))
    setEditingId(null)
  }

  async function handleDeleteRow(rowId: string) {
    await persistRows(rows.filter((r) => r.id !== rowId))
  }

  if (loading) {
    return <p className="text-sm text-text-muted">{t('loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{t('bbsTitle')}</h2>
          <p className="text-sm text-text-muted mt-1">{t('bbsDescription')}</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowAddForm(true)}>
          <Plus size={16} />
          {t('newBar')}
        </button>
      </div>

      {showAddForm && (
        <BBSRowForm
          memberLabels={memberLabels}
          shapeLabels={shapeLabels}
          onCancel={() => setShowAddForm(false)}
          onSave={handleAddRow}
        />
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-status-holdBorder bg-status-holdBg p-3">
          <ul className="text-xs text-status-holdText list-disc list-inside space-y-0.5">
            {warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {calculated.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-text-muted">{t('noBbsRows')}</p>
        </div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                  <th className="px-3 py-2.5">{t('barMarkCol')}</th>
                  <th className="px-3 py-2.5">{t('memberCol')}</th>
                  <th className="px-3 py-2.5">{t('diaCol')}</th>
                  <th className="px-3 py-2.5">{t('shapeCol')}</th>
                  <th className="px-3 py-2.5">{t('cuttingLCol')}</th>
                  <th className="px-3 py-2.5">{t('nosCol')}</th>
                  <th className="px-3 py-2.5">{t('totalLCol')}</th>
                  <th className="px-3 py-2.5">{t('unitWtCol')}</th>
                  <th className="px-3 py-2.5">{t('totalWtCol')}</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {calculated.map((row) =>
                  editingId === row.id ? (
                    <tr key={row.id}>
                      <td colSpan={10} className="p-3 bg-brand-50/40">
                        <BBSRowForm
                          initial={row}
                          memberLabels={memberLabels}
                          shapeLabels={shapeLabels}
                          onCancel={() => setEditingId(null)}
                          onSave={handleUpdateRow}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b border-surface-border last:border-0 hover:bg-surface-hover">
                      <td className="px-3 py-2.5 text-text-primary font-medium">{row.barMark}</td>
                      <td className="px-3 py-2.5">{memberLabels[row.member]}</td>
                      <td className="px-3 py-2.5">{row.diameterMm}</td>
                      <td className="px-3 py-2.5">{shapeLabels[row.shape]}</td>
                      <td className="px-3 py-2.5">{row.cuttingLengthM}</td>
                      <td className="px-3 py-2.5">{row.numberOfBars}</td>
                      <td className="px-3 py-2.5">{row.totalLengthM.toFixed(2)}</td>
                      <td className="px-3 py-2.5">{row.effectiveUnitWeightKgPerM.toFixed(3)}</td>
                      <td className="px-3 py-2.5 font-medium">{row.totalWeightKg.toFixed(2)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button
                          onClick={() => setEditingId(row.id)}
                          className="text-text-muted hover:text-brand-600 p-1"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="text-text-muted hover:text-red-600 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-text-primary">{t('totalRebarWeight')}</p>
              <p className="text-lg font-bold text-text-primary">{totalWeight.toFixed(2)} kg</p>
            </div>
            <p className="text-xs font-medium text-text-secondary mb-1.5">{t('diameterBreakdown')}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byDiameter).map(([dia, weight]) => (
                <span key={dia} className="text-xs text-text-secondary bg-surface-hover px-2 py-1 rounded-lg">
                  {dia}mm: {weight.toFixed(2)} kg
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function BBSRowForm({
  initial,
  memberLabels,
  shapeLabels,
  onCancel,
  onSave,
}: {
  initial?: BBSRow
  memberLabels: Record<StructuralMember, string>
  shapeLabels: Record<BarShape, string>
  onCancel: () => void
  onSave: (row: BBSRow) => void
}) {
  const { t } = useLang()
  const [barMark, setBarMark] = useState(initial?.barMark ?? '')
  const [member, setMember] = useState<StructuralMember>(initial?.member ?? 'column')
  const [diameterMm, setDiameterMm] = useState(initial?.diameterMm.toString() ?? '')
  const [shape, setShape] = useState<BarShape>(initial?.shape ?? 'straight')
  const [cuttingLengthM, setCuttingLengthM] = useState(initial?.cuttingLengthM.toString() ?? '')
  const [numberOfBars, setNumberOfBars] = useState(initial?.numberOfBars.toString() ?? '')
  const [lapLengthM, setLapLengthM] = useState(initial?.lapLengthM.toString() ?? '0')
  const [numberOfLaps, setNumberOfLaps] = useState(initial?.numberOfLaps.toString() ?? '0')
  const [wastagePercent, setWastagePercent] = useState(initial?.wastagePercent.toString() ?? '3')
  const [unitWeightOverride, setUnitWeightOverride] = useState(initial?.unitWeightKgPerM?.toString() ?? '')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const parsed = {
      barMark: barMark.trim(),
      diameterMm: parseFloat(diameterMm) || 0,
      cuttingLengthM: parseFloat(cuttingLengthM) || 0,
      numberOfBars: parseInt(numberOfBars) || 0,
      wastagePercent: parseFloat(wastagePercent) || 0,
    }
    const validation = validateBBSRow(parsed)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    const rowData = {
      barMark: parsed.barMark,
      member,
      diameterMm: parsed.diameterMm,
      shape,
      cuttingLengthM: parsed.cuttingLengthM,
      numberOfBars: parsed.numberOfBars,
      lapLengthM: parseFloat(lapLengthM) || 0,
      numberOfLaps: parseInt(numberOfLaps) || 0,
      wastagePercent: parsed.wastagePercent,
      ...(unitWeightOverride ? { unitWeightKgPerM: parseFloat(unitWeightOverride) } : {}),
    }

    onSave(initial ? { ...rowData, id: initial.id } : createBBSRow(rowData))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('barMarkLabel')}</label>
          <input value={barMark} onChange={(e) => setBarMark(e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('memberLabel')}</label>
          <select value={member} onChange={(e) => setMember(e.target.value as StructuralMember)} className="input-field text-sm">
            {Object.entries(memberLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('diameterMmLabel')}</label>
          <input type="number" value={diameterMm} onChange={(e) => setDiameterMm(e.target.value)} className="input-field text-sm" placeholder="যেমন: 16" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('shapeLabel')}</label>
          <select value={shape} onChange={(e) => setShape(e.target.value as BarShape)} className="input-field text-sm">
            {Object.entries(shapeLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('cuttingLengthLabel')}</label>
          <input type="number" value={cuttingLengthM} onChange={(e) => setCuttingLengthM(e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('numberOfBarsLabel')}</label>
          <input type="number" value={numberOfBars} onChange={(e) => setNumberOfBars(e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('lapLengthLabel')}</label>
          <input type="number" value={lapLengthM} onChange={(e) => setLapLengthM(e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('numberOfLapsLabel')}</label>
          <input type="number" value={numberOfLaps} onChange={(e) => setNumberOfLaps(e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('wastagePercentLabel')}</label>
          <input type="number" value={wastagePercent} onChange={(e) => setWastagePercent(e.target.value)} className="input-field text-sm" />
        </div>
        <div className="col-span-3">
          <label className="block text-xs font-medium text-text-secondary mb-1">
            {t('unitWeightOverrideLabel')}
          </label>
          <input
            type="number"
            value={unitWeightOverride}
            onChange={(e) => setUnitWeightOverride(e.target.value)}
            className="input-field text-sm"
            placeholder="যেমন 16mm-এর জন্য 1.578"
          />
        </div>
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
        <button className="btn-primary" onClick={handleSubmit}>{t('saveEntry')}</button>
      </div>
    </div>
  )
}
