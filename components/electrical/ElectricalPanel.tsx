// components/electrical/ElectricalPanel.tsx
//
// Module 16 — Electrical। electrical.types.ts-এর file-header দ্রষ্টব্য
// কেন এই module সম্পূর্ণ manual-entry (কোনো upstream auto-source
// নেই)। components/reinforcement/BBSTable.tsx-এর একই layout প্যাটার্ন
// অনুসরণ করা হয়েছে (list + add/edit form + delete), শুধু দুটো
// sub-section (Points, Cable Runs) একসাথে — কারণ দুটোর একক ভিন্ন
// (point-count vs running-meter), একটা টেবিলে জোর করে মেলানো হলে
// column-set অর্থহীন হতো।

'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import {
  ElectricalPointRow,
  ElectricalCableRun,
  ElectricalItemCategory,
  ELECTRICAL_CATEGORY_UNIT,
  createElectricalPointRow,
  createElectricalCableRun,
  validateElectricalPointRow,
  validateElectricalCableRun,
} from '@/lib/types/electrical.types'
import {
  getElectrical,
  addElectricalPointRow,
  updateElectricalPointRow,
  deleteElectricalPointRow,
  addElectricalCableRun,
  updateElectricalCableRun,
  deleteElectricalCableRun,
} from '@/lib/firestore/electrical.firestore'
import { useLang } from '@/components/providers/LanguageProvider'

interface ElectricalPanelProps {
  projectId: string
}

export function ElectricalPanel({ projectId }: ElectricalPanelProps) {
  const { t } = useLang()
  const [points, setPoints] = useState<ElectricalPointRow[]>([])
  const [cableRuns, setCableRuns] = useState<ElectricalCableRun[]>([])
  const [loading, setLoading] = useState(true)
  const [showPointForm, setShowPointForm] = useState(false)
  const [showCableForm, setShowCableForm] = useState(false)
  const [editingPointId, setEditingPointId] = useState<string | null>(null)
  const [editingCableId, setEditingCableId] = useState<string | null>(null)

  const categoryLabels: Record<ElectricalItemCategory, string> = {
    lighting_point: t('electricalCategory_lighting_point'),
    socket_point: t('electricalCategory_socket_point'),
    switch_point: t('electricalCategory_switch_point'),
    fan_point: t('electricalCategory_fan_point'),
    db_unit: t('electricalCategory_db_unit'),
    earthing_point: t('electricalCategory_earthing_point'),
    exhaust_fan_point: t('electricalCategory_exhaust_fan_point'),
    ac_point: t('electricalCategory_ac_point'),
  }

  useEffect(() => {
    refresh()
  }, [projectId])

  async function refresh() {
    setLoading(true)
    try {
      const stored = await getElectrical(projectId)
      setPoints(stored?.points ?? [])
      setCableRuns(stored?.cableRuns ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleAddPoint(row: ElectricalPointRow) {
    await addElectricalPointRow(projectId, row)
    setShowPointForm(false)
    refresh()
  }

  async function handleUpdatePoint(row: ElectricalPointRow) {
    await updateElectricalPointRow(projectId, row)
    setEditingPointId(null)
    refresh()
  }

  async function handleDeletePoint(rowId: string) {
    await deleteElectricalPointRow(projectId, rowId)
    refresh()
  }

  async function handleAddCable(row: ElectricalCableRun) {
    await addElectricalCableRun(projectId, row)
    setShowCableForm(false)
    refresh()
  }

  async function handleUpdateCable(row: ElectricalCableRun) {
    await updateElectricalCableRun(projectId, row)
    setEditingCableId(null)
    refresh()
  }

  async function handleDeleteCable(rowId: string) {
    await deleteElectricalCableRun(projectId, rowId)
    refresh()
  }

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-text-muted">{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('electricalTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('electricalDescription')}</p>
      </div>

      {/* ── Points ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t('electricalPointsSectionTitle')}</h3>
          <button className="btn-primary" onClick={() => setShowPointForm(true)}>
            <Plus size={16} />
            {t('addPoint')}
          </button>
        </div>

        {showPointForm && (
          <div className="card p-4">
            <ElectricalPointForm categoryLabels={categoryLabels} onCancel={() => setShowPointForm(false)} onSave={handleAddPoint} />
          </div>
        )}

        {points.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-text-muted">{t('noElectricalPointsYet')}</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                  <th className="px-3 py-2.5">{t('categoryCol')}</th>
                  <th className="px-3 py-2.5">{t('floorCol')}</th>
                  <th className="px-3 py-2.5">{t('quantityCol')}</th>
                  <th className="px-3 py-2.5">{t('unitCol')}</th>
                  <th className="px-3 py-2.5">{t('notesCol')}</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {points.map((row) =>
                  editingPointId === row.id ? (
                    <tr key={row.id}>
                      <td colSpan={6} className="p-3 bg-brand-50/40">
                        <ElectricalPointForm
                          initial={row}
                          categoryLabels={categoryLabels}
                          onCancel={() => setEditingPointId(null)}
                          onSave={handleUpdatePoint}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b border-surface-border last:border-0 hover:bg-surface-hover">
                      <td className="px-3 py-2.5 text-text-primary font-medium">{categoryLabels[row.category]}</td>
                      <td className="px-3 py-2.5">{row.floorId ?? '—'}</td>
                      <td className="px-3 py-2.5">{row.quantity}</td>
                      <td className="px-3 py-2.5 text-text-muted">{ELECTRICAL_CATEGORY_UNIT[row.category]}</td>
                      <td className="px-3 py-2.5 text-text-muted">{row.notes ?? '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button onClick={() => setEditingPointId(row.id)} className="text-text-muted hover:text-brand-600 p-1">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDeletePoint(row.id)} className="text-text-muted hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Cable Runs ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t('electricalCableRunsSectionTitle')}</h3>
          <button className="btn-primary" onClick={() => setShowCableForm(true)}>
            <Plus size={16} />
            {t('addCableRun')}
          </button>
        </div>

        {showCableForm && (
          <div className="card p-4">
            <ElectricalCableForm onCancel={() => setShowCableForm(false)} onSave={handleAddCable} />
          </div>
        )}

        {cableRuns.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-text-muted">{t('noElectricalCableRunsYet')}</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                  <th className="px-3 py-2.5">{t('descriptionCol')}</th>
                  <th className="px-3 py-2.5">{t('floorCol')}</th>
                  <th className="px-3 py-2.5">{t('cableSizeCol')}</th>
                  <th className="px-3 py-2.5">{t('lengthMCol')}</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {cableRuns.map((row) =>
                  editingCableId === row.id ? (
                    <tr key={row.id}>
                      <td colSpan={5} className="p-3 bg-brand-50/40">
                        <ElectricalCableForm initial={row} onCancel={() => setEditingCableId(null)} onSave={handleUpdateCable} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b border-surface-border last:border-0 hover:bg-surface-hover">
                      <td className="px-3 py-2.5 text-text-primary font-medium">{row.description}</td>
                      <td className="px-3 py-2.5">{row.floorId ?? '—'}</td>
                      <td className="px-3 py-2.5">{row.cableSizeSqmm} sqmm</td>
                      <td className="px-3 py-2.5">{row.lengthM} m</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button onClick={() => setEditingCableId(row.id)} className="text-text-muted hover:text-brand-600 p-1">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDeleteCable(row.id)} className="text-text-muted hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function ElectricalPointForm({
  initial,
  categoryLabels,
  onCancel,
  onSave,
}: {
  initial?: ElectricalPointRow
  categoryLabels: Record<ElectricalItemCategory, string>
  onCancel: () => void
  onSave: (row: ElectricalPointRow) => void
}) {
  const { t } = useLang()
  const [category, setCategory] = useState<ElectricalItemCategory>(initial?.category ?? 'lighting_point')
  const [floorId, setFloorId] = useState(initial?.floorId ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity.toString() ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const parsed = { quantity: parseInt(quantity) || 0 }
    const rowData = {
      category,
      floorId: floorId.trim() || undefined,
      quantity: parsed.quantity,
      notes: notes.trim() || undefined,
    }
    const validation = validateElectricalPointRow({ id: initial?.id ?? '', ...rowData })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSave(initial ? { ...rowData, id: initial.id } : createElectricalPointRow(rowData))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('categoryLabel')}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as ElectricalItemCategory)} className="input-field text-sm">
            {Object.entries(categoryLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('floorIdOptionalLabel')}</label>
          <input value={floorId} onChange={(e) => setFloorId(e.target.value)} className="input-field text-sm" placeholder="যেমন: ground" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('quantityLabel')}</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('notesOptionalLabel')}</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field text-sm" />
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

function ElectricalCableForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: ElectricalCableRun
  onCancel: () => void
  onSave: (row: ElectricalCableRun) => void
}) {
  const { t } = useLang()
  const [description, setDescription] = useState(initial?.description ?? '')
  const [floorId, setFloorId] = useState(initial?.floorId ?? '')
  const [cableSizeSqmm, setCableSizeSqmm] = useState(initial?.cableSizeSqmm.toString() ?? '')
  const [lengthM, setLengthM] = useState(initial?.lengthM.toString() ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const rowData = {
      description: description.trim(),
      floorId: floorId.trim() || undefined,
      cableSizeSqmm: parseFloat(cableSizeSqmm) || 0,
      lengthM: parseFloat(lengthM) || 0,
      notes: notes.trim() || undefined,
    }
    const validation = validateElectricalCableRun({ id: initial?.id ?? '', ...rowData })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSave(initial ? { ...rowData, id: initial.id } : createElectricalCableRun(rowData))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('descriptionLabel')}</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field text-sm"
            placeholder="যেমন: Main Feeder — Meter to Main DB"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('floorIdOptionalLabel')}</label>
          <input value={floorId} onChange={(e) => setFloorId(e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('cableSizeLabel')}</label>
          <input type="number" value={cableSizeSqmm} onChange={(e) => setCableSizeSqmm(e.target.value)} className="input-field text-sm" placeholder="যেমন: 4" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('lengthMLabel')}</label>
          <input type="number" value={lengthM} onChange={(e) => setLengthM(e.target.value)} className="input-field text-sm" />
        </div>
        <div className="col-span-2 md:col-span-3">
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('notesOptionalLabel')}</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field text-sm" />
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
