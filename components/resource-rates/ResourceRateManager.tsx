// components/resource-rates/ResourceRateManager.tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import {
  listResourceRates,
  createResourceRate,
  updateResourceRate,
} from '@/lib/firestore/resource-rate.firestore'
import {
  ResourceRate,
  ResourceRateType,
  LabourCategory,
  EquipmentCategory,
  ResourceRateUnit,
} from '@/lib/types/resource-rate.types'
import { validateRateChange } from '@/lib/services/material.service' // rate-change sanity check material-এর সাথে শেয়ার্ড
import { useLang } from '@/components/providers/LanguageProvider'

/**
 * MaterialDatabase.tsx-এর একই list/edit-inline প্যাটার্ন, কিন্তু
 * সরলীকৃত (কোনো search/history panel নেই এই মুহূর্তে — Labour/
 * Equipment-এর সংখ্যা সাধারণত material-এর চেয়ে অনেক কম, তাই এই
 * অতিরিক্ত UI প্রয়োজন মনে হয়নি)।
 *
 * নোট: category/unit label mapping আগে resource-rate.types.ts-এ
 * hardcoded Record হিসেবে ছিল (LABOUR_CATEGORY_LABELS ইত্যাদি) —
 * i18n retrofit করার সময় সেগুলো এখানে component-এর ভেতরে সরানো
 * হয়েছে, কারণ t() hook টাইপ ফাইলে ব্যবহার করা যায় না (hook শুধু
 * component/hook-এর ভেতরে কল করা যায়)। resource-rate.types.ts-এর
 * পুরনো constant এখন আর ব্যবহৃত হচ্ছে না।
 */
export function ResourceRateManager() {
  const { t } = useLang()
  const [activeTab, setActiveTab] = useState<ResourceRateType>('labour')
  const [rates, setRates] = useState<ResourceRate[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const labourCategoryLabels: Record<LabourCategory, string> = {
    mason: t('labourCategory_mason'),
    helper: t('labourCategory_helper'),
    carpenter: t('labourCategory_carpenter'),
    bar_bender: t('labourCategory_bar_bender'),
    other: t('labourCategory_other'),
  }

  const equipmentCategoryLabels: Record<EquipmentCategory, string> = {
    mixer: t('equipmentCategory_mixer'),
    vibrator: t('equipmentCategory_vibrator'),
    excavator: t('equipmentCategory_excavator'),
    other: t('equipmentCategory_other'),
  }

  const unitLabels: Record<ResourceRateUnit, string> = {
    day: t('perDay'),
    hour: t('perHour'),
  }

  useEffect(() => {
    refresh()
  }, [activeTab])

  async function refresh() {
    setLoading(true)
    try {
      const all = await listResourceRates(activeTab)
      setRates(all)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">{t('labourEquipmentRateTitle')}</h2>
        <button className="btn-primary" onClick={() => setShowAddForm(true)}>
          <Plus size={16} />
          {t('addNew')}
        </button>
      </div>

      <div className="flex gap-1 border-b border-surface-border">
        <button
          onClick={() => setActiveTab('labour')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'labour' ? 'border-brand-600 text-brand-700' : 'border-transparent text-text-muted'
          }`}
        >
          {t('labourTab')}
        </button>
        <button
          onClick={() => setActiveTab('equipment')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'equipment' ? 'border-brand-600 text-brand-700' : 'border-transparent text-text-muted'
          }`}
        >
          {t('equipmentTab')}
        </button>
      </div>

      {showAddForm && (
        <AddResourceRateForm
          type={activeTab}
          categoryLabels={activeTab === 'labour' ? labourCategoryLabels : equipmentCategoryLabels}
          onCancel={() => setShowAddForm(false)}
          onCreated={() => {
            setShowAddForm(false)
            refresh()
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-text-muted">{t('loading')}</p>
      ) : rates.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-text-muted">
            {t('noRateYet', { type: activeTab === 'labour' ? t('labourTab') : t('equipmentTab') })}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-surface-border overflow-hidden">
          {rates.map((rate) => (
            <ResourceRateRow
              key={rate.id}
              rate={rate}
              categoryLabel={
                rate.type === 'labour'
                  ? labourCategoryLabels[rate.category as LabourCategory]
                  : equipmentCategoryLabels[rate.category as EquipmentCategory]
              }
              unitLabel={unitLabels[rate.unit]}
              isEditing={editingId === rate.id}
              onStartEdit={() => setEditingId(rate.id)}
              onCancelEdit={() => setEditingId(null)}
              onUpdated={() => {
                setEditingId(null)
                refresh()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function ResourceRateRow({
  rate,
  categoryLabel,
  unitLabel,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onUpdated,
}: {
  rate: ResourceRate
  categoryLabel: string
  unitLabel: string
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onUpdated: () => void
}) {
  const { t, lang } = useLang()
  const [newRate, setNewRate] = useState(rate.currentRate.toString())
  const [warning, setWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const parsed = parseFloat(newRate)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('invalidPositiveNumber'))
      return
    }

    const { warning: rateWarning } = validateRateChange(rate.currentRate, parsed)
    if (rateWarning && !warning) {
      setWarning(rateWarning)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateResourceRate(rate.id, parsed)
      onUpdated()
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
        <p className="text-sm font-medium text-text-primary">{rate.name}</p>
        <p className="text-xs text-text-muted">{categoryLabel}</p>
      </div>

      {isEditing ? (
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
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {warning ? t('confirm') : t('save')}
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                onCancelEdit()
                setNewRate(rate.currentRate.toString())
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
        <button
          onClick={onStartEdit}
          className="text-left sm:text-right hover:bg-surface-hover rounded-lg px-2 py-1 -mx-2 transition-colors"
        >
          <p className="text-sm font-semibold text-text-primary">
            ৳{rate.currentRate.toLocaleString(locale)}
            <span className="text-xs font-normal text-text-muted"> /{unitLabel}</span>
          </p>
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function AddResourceRateForm({
  type,
  categoryLabels,
  onCancel,
  onCreated,
}: {
  type: ResourceRateType
  categoryLabels: Record<string, string>
  onCancel: () => void
  onCreated: () => void
}) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>(Object.keys(categoryLabels)[0])
  const [unit, setUnit] = useState<ResourceRateUnit>('day')
  const [rate, setRate] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    const parsedRate = parseFloat(rate)
    const validationErrors: string[] = []
    if (!name.trim()) validationErrors.push(t('nameRequired'))
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) validationErrors.push(t('validRateRequired'))

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setSaving(true)
    try {
      await createResourceRate({
        type,
        category: category as LabourCategory | EquipmentCategory,
        name: name.trim(),
        unit,
        currentRate: parsedRate,
      })
      onCreated()
    } catch {
      setErrors([t('resourceRateSaveFailed')])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">
        {t('addNewLabourOrEquipment', { type: type === 'labour' ? t('labourTab') : t('equipmentTab') })}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'labour' ? 'যেমন: Mason (Skilled)' : 'যেমন: Concrete Mixer (10/7 cft)'}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('category')}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
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
            onChange={(e) => setUnit(e.target.value as ResourceRateUnit)}
            className="input-field"
          >
            <option value="day">{t('perDay')}</option>
            <option value="hour">{t('perHour')}</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('rateLabel')}</label>
          <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="input-field" />
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
