// components/materials/MaterialDatabase.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, History } from 'lucide-react'
import {
  listMaterials,
  createMaterial,
  updateMaterialRate,
} from '@/lib/firestore/material.firestore'
import { validateMaterialInput, validateRateChange } from '@/lib/services/material.service'
import { Material, MaterialCategory, MaterialUnit } from '@/lib/types/material.types'
import { PriceHistoryPanel } from '@/components/materials/PriceHistoryPanel'
import { useLang } from '@/components/providers/LanguageProvider'

export function MaterialDatabase() {
  const { t } = useLang()
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | 'all'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRateFor, setEditingRateFor] = useState<string | null>(null)
  const [historyFor, setHistoryFor] = useState<Material | null>(null)

  // key-based label mapping — MaterialCategory/MaterialUnit enum
  // value থেকে অনূদিত display string বানানোর জন্য, t() ফাংশন
  // ব্যবহার করে dynamic ভাষায়
  const categoryLabels: Record<MaterialCategory, string> = {
    cement: t('materialCategory_cement'),
    sand: t('materialCategory_sand'),
    stone: t('materialCategory_stone'),
    rebar: t('materialCategory_rebar'),
    brick: t('materialCategory_brick'),
    tiles: t('materialCategory_tiles'),
    paint: t('materialCategory_paint'),
    other: t('materialCategory_other'),
  }

  const unitLabels: Record<MaterialUnit, string> = {
    bag: t('materialUnit_bag'),
    cft: t('materialUnit_cft'),
    kg: t('materialUnit_kg'),
    ton: t('materialUnit_ton'),
    piece: t('materialUnit_piece'),
    sqft: t('materialUnit_sqft'),
    liter: t('materialUnit_liter'),
    sqm: t('materialUnit_sqm'),
  }

  useEffect(() => {
    refreshMaterials()
  }, [])

  async function refreshMaterials() {
    setLoading(true)
    try {
      const all = await listMaterials()
      setMaterials(all)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return materials.filter((m) => {
      const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter
      const matchesSearch =
        searchQuery.trim() === '' ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.brand ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [materials, searchQuery, categoryFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">{t('materialDatabaseTitle')}</h2>
        <button className="btn-primary" onClick={() => setShowAddForm(true)}>
          <Plus size={16} />
          {t('newMaterial')}
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchByNameOrBrand')}
            className="input-field pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as MaterialCategory | 'all')}
          className="input-field w-40"
        >
          <option value="all">{t('allCategories')}</option>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddMaterialForm
          categoryLabels={categoryLabels}
          unitLabels={unitLabels}
          onCancel={() => setShowAddForm(false)}
          onCreated={() => {
            setShowAddForm(false)
            refreshMaterials()
          }}
        />
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-text-muted">{t('loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-text-muted">
            {materials.length === 0 ? t('noMaterialsYet') : t('noMaterialsMatchFilter')}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-surface-border overflow-hidden">
          {filtered.map((material) => (
            <MaterialRow
              key={material.id}
              material={material}
              categoryLabels={categoryLabels}
              unitLabels={unitLabels}
              isEditingRate={editingRateFor === material.id}
              onStartEditRate={() => setEditingRateFor(material.id)}
              onCancelEditRate={() => setEditingRateFor(null)}
              onRateUpdated={() => {
                setEditingRateFor(null)
                refreshMaterials()
              }}
              onShowHistory={() => setHistoryFor(material)}
            />
          ))}
        </div>
      )}

      {historyFor && (
        <PriceHistoryPanel
          materialId={historyFor.id}
          materialName={historyFor.name}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function MaterialRow({
  material,
  categoryLabels,
  unitLabels,
  isEditingRate,
  onStartEditRate,
  onCancelEditRate,
  onRateUpdated,
  onShowHistory,
}: {
  material: Material
  categoryLabels: Record<MaterialCategory, string>
  unitLabels: Record<MaterialUnit, string>
  isEditingRate: boolean
  onStartEditRate: () => void
  onCancelEditRate: () => void
  onRateUpdated: () => void
  onShowHistory: () => void
}) {
  const { t, lang } = useLang()
  const [newRate, setNewRate] = useState(material.currentRate.toString())
  const [warning, setWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSaveRate() {
    const parsed = parseFloat(newRate)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('invalidPositiveNumber'))
      return
    }

    const { warning: rateWarning } = validateRateChange(material.currentRate, parsed)
    if (rateWarning && !warning) {
      // প্রথমবার warning দেখাও, দ্বিতীয়বার confirm হিসেবে ধরে নাও
      setWarning(rateWarning)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateMaterialRate(material.id, parsed)
      onRateUpdated()
    } catch {
      setError(t('rateUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const locale = lang === 'bn' ? 'bn-BD' : 'en-US'

  return (
    <div className="table-row flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">{material.name}</p>
        <p className="text-xs text-text-muted">
          {categoryLabels[material.category]}
          {material.brand ? ` · ${material.brand}` : ''} · {unitLabels[material.unit]}
        </p>
      </div>

      {isEditingRate ? (
        <div className="flex flex-col gap-1.5 sm:items-end">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newRate}
              onChange={(e) => {
                setNewRate(e.target.value)
                setWarning(null)
                setError(null)
              }}
              className="input-field w-28 text-sm"
              autoFocus
            />
            <button className="btn-primary" onClick={handleSaveRate} disabled={saving}>
              {warning ? t('confirm') : t('save')}
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                onCancelEditRate()
                setNewRate(material.currentRate.toString())
                setWarning(null)
                setError(null)
              }}
            >
              {t('cancel')}
            </button>
          </div>
          {warning && <p className="text-xs text-status-holdText max-w-xs text-right">{warning}</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center gap-1 sm:justify-end">
          <button
            onClick={onStartEditRate}
            className="text-left sm:text-right hover:bg-surface-hover rounded-lg px-2 py-1 -mx-2 transition-colors"
          >
            <p className="text-sm font-semibold text-text-primary">
              ৳{material.currentRate.toLocaleString(locale)}
              <span className="text-xs font-normal text-text-muted"> /{unitLabels[material.unit]}</span>
            </p>
            <p className="text-xs text-text-muted">
              {t('updatedOn')}
              {new Date(material.lastUpdatedAt).toLocaleDateString(locale)}
            </p>
          </button>
          <button
            onClick={onShowHistory}
            title={t('viewPriceHistory')}
            className="text-text-muted hover:text-brand-600 p-1.5 rounded-lg hover:bg-surface-hover"
          >
            <History size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function AddMaterialForm({
  categoryLabels,
  unitLabels,
  onCancel,
  onCreated,
}: {
  categoryLabels: Record<MaterialCategory, string>
  unitLabels: Record<MaterialUnit, string>
  onCancel: () => void
  onCreated: () => void
}) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<MaterialCategory>('cement')
  const [unit, setUnit] = useState<MaterialUnit>('bag')
  const [brand, setBrand] = useState('')
  const [rate, setRate] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    const parsedRate = parseFloat(rate)
    const validation = validateMaterialInput({ name, currentRate: parsedRate, unit })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    setSaving(true)
    try {
      await createMaterial({
        name: name.trim(),
        category,
        unit,
        brand: brand.trim() || undefined,
        currentRate: parsedRate,
      })
      onCreated()
    } catch {
      setErrors([t('materialSaveFailed')])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">{t('addNewMaterial')}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="যেমন: OPC Cement (Fresh)"
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('category')}</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as MaterialCategory)}
            className="input-field"
          >
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('unit')}</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as MaterialUnit)}
            className="input-field"
          >
            {Object.entries(unitLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('brandOptional')}</label>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} className="input-field" />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('currentRateLabel')}</label>
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="input-field"
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
        <button className="btn-ghost" onClick={onCancel}>
          {t('cancel')}
        </button>
        <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
          {t('saveEntry')}
        </button>
      </div>
    </div>
  )
}
