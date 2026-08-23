// components/plumbing/PlumbingPanel.tsx
//
// Module 17 — Plumbing & Sanitary। components/electrical/ElectricalPanel.tsx-এর
// একই কাঠামো (Fixture ও Pipe Run — দুটো sub-section)।

'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import {
  PlumbingFixtureRow,
  PlumbingPipeRun,
  PlumbingFixtureCategory,
  PipeType,
  createPlumbingFixtureRow,
  createPlumbingPipeRun,
  validatePlumbingFixtureRow,
  validatePlumbingPipeRun,
} from '@/lib/types/plumbing.types'
import {
  getPlumbing,
  addPlumbingFixtureRow,
  updatePlumbingFixtureRow,
  deletePlumbingFixtureRow,
  addPlumbingPipeRun,
  updatePlumbingPipeRun,
  deletePlumbingPipeRun,
} from '@/lib/firestore/plumbing.firestore'
import { useLang } from '@/components/providers/LanguageProvider'

interface PlumbingPanelProps {
  projectId: string
}

export function PlumbingPanel({ projectId }: PlumbingPanelProps) {
  const { t } = useLang()
  const [fixtures, setFixtures] = useState<PlumbingFixtureRow[]>([])
  const [pipeRuns, setPipeRuns] = useState<PlumbingPipeRun[]>([])
  const [loading, setLoading] = useState(true)
  const [showFixtureForm, setShowFixtureForm] = useState(false)
  const [showPipeForm, setShowPipeForm] = useState(false)
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null)
  const [editingPipeId, setEditingPipeId] = useState<string | null>(null)

  const fixtureLabels: Record<PlumbingFixtureCategory, string> = {
    wc: t('plumbingFixture_wc'),
    basin: t('plumbingFixture_basin'),
    shower: t('plumbingFixture_shower'),
    floor_drain: t('plumbingFixture_floor_drain'),
    kitchen_sink: t('plumbingFixture_kitchen_sink'),
    bib_cock: t('plumbingFixture_bib_cock'),
    geyser_point: t('plumbingFixture_geyser_point'),
  }

  const pipeTypeLabels: Record<PipeType, string> = {
    water_supply: t('pipeType_water_supply'),
    drainage: t('pipeType_drainage'),
    soil_waste: t('pipeType_soil_waste'),
  }

  useEffect(() => {
    refresh()
  }, [projectId])

  async function refresh() {
    setLoading(true)
    try {
      const stored = await getPlumbing(projectId)
      setFixtures(stored?.fixtures ?? [])
      setPipeRuns(stored?.pipeRuns ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleAddFixture(row: PlumbingFixtureRow) {
    await addPlumbingFixtureRow(projectId, row)
    setShowFixtureForm(false)
    refresh()
  }

  async function handleUpdateFixture(row: PlumbingFixtureRow) {
    await updatePlumbingFixtureRow(projectId, row)
    setEditingFixtureId(null)
    refresh()
  }

  async function handleDeleteFixture(rowId: string) {
    await deletePlumbingFixtureRow(projectId, rowId)
    refresh()
  }

  async function handleAddPipe(row: PlumbingPipeRun) {
    await addPlumbingPipeRun(projectId, row)
    setShowPipeForm(false)
    refresh()
  }

  async function handleUpdatePipe(row: PlumbingPipeRun) {
    await updatePlumbingPipeRun(projectId, row)
    setEditingPipeId(null)
    refresh()
  }

  async function handleDeletePipe(rowId: string) {
    await deletePlumbingPipeRun(projectId, rowId)
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
        <h2 className="text-lg font-semibold text-text-primary">{t('plumbingTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('plumbingDescription')}</p>
      </div>

      {/* ── Fixtures ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t('plumbingFixturesSectionTitle')}</h3>
          <button className="btn-primary" onClick={() => setShowFixtureForm(true)}>
            <Plus size={16} />
            {t('addFixture')}
          </button>
        </div>

        {showFixtureForm && (
          <div className="card p-4">
            <PlumbingFixtureForm fixtureLabels={fixtureLabels} onCancel={() => setShowFixtureForm(false)} onSave={handleAddFixture} />
          </div>
        )}

        {fixtures.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-text-muted">{t('noPlumbingFixturesYet')}</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                  <th className="px-3 py-2.5">{t('categoryCol')}</th>
                  <th className="px-3 py-2.5">{t('floorCol')}</th>
                  <th className="px-3 py-2.5">{t('quantityCol')}</th>
                  <th className="px-3 py-2.5">{t('notesCol')}</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((row) =>
                  editingFixtureId === row.id ? (
                    <tr key={row.id}>
                      <td colSpan={5} className="p-3 bg-brand-50/40">
                        <PlumbingFixtureForm
                          initial={row}
                          fixtureLabels={fixtureLabels}
                          onCancel={() => setEditingFixtureId(null)}
                          onSave={handleUpdateFixture}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b border-surface-border last:border-0 hover:bg-surface-hover">
                      <td className="px-3 py-2.5 text-text-primary font-medium">{fixtureLabels[row.category]}</td>
                      <td className="px-3 py-2.5">{row.floorId ?? '—'}</td>
                      <td className="px-3 py-2.5">{row.quantity}</td>
                      <td className="px-3 py-2.5 text-text-muted">{row.notes ?? '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button onClick={() => setEditingFixtureId(row.id)} className="text-text-muted hover:text-brand-600 p-1">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDeleteFixture(row.id)} className="text-text-muted hover:text-red-600 p-1">
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

      {/* ── Pipe Runs ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t('plumbingPipeRunsSectionTitle')}</h3>
          <button className="btn-primary" onClick={() => setShowPipeForm(true)}>
            <Plus size={16} />
            {t('addPipeRun')}
          </button>
        </div>

        {showPipeForm && (
          <div className="card p-4">
            <PlumbingPipeForm pipeTypeLabels={pipeTypeLabels} onCancel={() => setShowPipeForm(false)} onSave={handleAddPipe} />
          </div>
        )}

        {pipeRuns.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-text-muted">{t('noPlumbingPipeRunsYet')}</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                  <th className="px-3 py-2.5">{t('pipeTypeCol')}</th>
                  <th className="px-3 py-2.5">{t('floorCol')}</th>
                  <th className="px-3 py-2.5">{t('diameterMmCol')}</th>
                  <th className="px-3 py-2.5">{t('lengthMCol')}</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {pipeRuns.map((row) =>
                  editingPipeId === row.id ? (
                    <tr key={row.id}>
                      <td colSpan={5} className="p-3 bg-brand-50/40">
                        <PlumbingPipeForm
                          initial={row}
                          pipeTypeLabels={pipeTypeLabels}
                          onCancel={() => setEditingPipeId(null)}
                          onSave={handleUpdatePipe}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b border-surface-border last:border-0 hover:bg-surface-hover">
                      <td className="px-3 py-2.5 text-text-primary font-medium">{pipeTypeLabels[row.pipeType]}</td>
                      <td className="px-3 py-2.5">{row.floorId ?? '—'}</td>
                      <td className="px-3 py-2.5">{row.diameterMm} mm</td>
                      <td className="px-3 py-2.5">{row.lengthM} m</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button onClick={() => setEditingPipeId(row.id)} className="text-text-muted hover:text-brand-600 p-1">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDeletePipe(row.id)} className="text-text-muted hover:text-red-600 p-1">
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

function PlumbingFixtureForm({
  initial,
  fixtureLabels,
  onCancel,
  onSave,
}: {
  initial?: PlumbingFixtureRow
  fixtureLabels: Record<PlumbingFixtureCategory, string>
  onCancel: () => void
  onSave: (row: PlumbingFixtureRow) => void
}) {
  const { t } = useLang()
  const [category, setCategory] = useState<PlumbingFixtureCategory>(initial?.category ?? 'wc')
  const [floorId, setFloorId] = useState(initial?.floorId ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity.toString() ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const rowData = {
      category,
      floorId: floorId.trim() || undefined,
      quantity: parseInt(quantity) || 0,
      notes: notes.trim() || undefined,
    }
    const validation = validatePlumbingFixtureRow({ id: initial?.id ?? '', ...rowData })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSave(initial ? { ...rowData, id: initial.id } : createPlumbingFixtureRow(rowData))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('categoryLabel')}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as PlumbingFixtureCategory)} className="input-field text-sm">
            {Object.entries(fixtureLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('floorIdOptionalLabel')}</label>
          <input value={floorId} onChange={(e) => setFloorId(e.target.value)} className="input-field text-sm" />
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

function PlumbingPipeForm({
  initial,
  pipeTypeLabels,
  onCancel,
  onSave,
}: {
  initial?: PlumbingPipeRun
  pipeTypeLabels: Record<PipeType, string>
  onCancel: () => void
  onSave: (row: PlumbingPipeRun) => void
}) {
  const { t } = useLang()
  const [pipeType, setPipeType] = useState<PipeType>(initial?.pipeType ?? 'water_supply')
  const [floorId, setFloorId] = useState(initial?.floorId ?? '')
  const [diameterMm, setDiameterMm] = useState(initial?.diameterMm.toString() ?? '')
  const [lengthM, setLengthM] = useState(initial?.lengthM.toString() ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const rowData = {
      pipeType,
      floorId: floorId.trim() || undefined,
      diameterMm: parseFloat(diameterMm) || 0,
      lengthM: parseFloat(lengthM) || 0,
      notes: notes.trim() || undefined,
    }
    const validation = validatePlumbingPipeRun({ id: initial?.id ?? '', ...rowData })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSave(initial ? { ...rowData, id: initial.id } : createPlumbingPipeRun(rowData))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('pipeTypeLabel')}</label>
          <select value={pipeType} onChange={(e) => setPipeType(e.target.value as PipeType)} className="input-field text-sm">
            {Object.entries(pipeTypeLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('floorIdOptionalLabel')}</label>
          <input value={floorId} onChange={(e) => setFloorId(e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('diameterMmLabel')}</label>
          <input type="number" value={diameterMm} onChange={(e) => setDiameterMm(e.target.value)} className="input-field text-sm" placeholder="যেমন: 25" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('lengthMLabel')}</label>
          <input type="number" value={lengthM} onChange={(e) => setLengthM(e.target.value)} className="input-field text-sm" />
        </div>
        <div className="col-span-2 md:col-span-4">
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
