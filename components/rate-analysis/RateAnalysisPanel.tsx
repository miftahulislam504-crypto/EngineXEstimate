// components/rate-analysis/RateAnalysisPanel.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Calculator } from 'lucide-react'
import { BOQItem } from '@/lib/types/boq.types'
import {
  RateAnalysisEntry,
  MaterialConsumption,
  LabourConsumption,
  EquipmentConsumption,
} from '@/lib/types/rate-analysis.types'
import { getRateAnalysis, upsertRateAnalysisEntry } from '@/lib/firestore/rate-analysis.firestore'
import {
  calculateRateFromLoadedRates,
  createRateAnalysisEntry,
  validateRateAnalysisEntry,
} from '@/lib/services/rate-analysis.service'
import { listMaterials } from '@/lib/firestore/material.firestore'
import { listResourceRates } from '@/lib/firestore/resource-rate.firestore'
import { Material } from '@/lib/types/material.types'
import { ResourceRate } from '@/lib/types/resource-rate.types'
import { useLang } from '@/components/providers/LanguageProvider'

interface RateAnalysisPanelProps {
  projectId: string
  boqItems: BOQItem[]
}

export function RateAnalysisPanel({ projectId, boqItems }: RateAnalysisPanelProps) {
  const { t } = useLang()
  const [entries, setEntries] = useState<RateAnalysisEntry[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [labourRates, setLabourRates] = useState<ResourceRate[]>([])
  const [equipmentRates, setEquipmentRates] = useState<ResourceRate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBoqItemId, setSelectedBoqItemId] = useState<string>('')

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
        setEntries(analysis?.entries ?? [])
        setMaterials(matList)
        setLabourRates(labourList)
        setEquipmentRates(equipList)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [projectId])

  function handleAddEntry() {
    const boqItem = boqItems.find((i) => i.id === selectedBoqItemId)
    if (!boqItem) return
    if (entries.some((e) => e.boqItemId === boqItem.id)) return

    const newEntry = createRateAnalysisEntry({
      boqItemId: boqItem.id,
      boqItemName: boqItem.itemName,
      overheadPercent: 10,
      profitPercent: 10,
    })
    setEntries([...entries, newEntry])
    setSelectedBoqItemId('')
  }

  async function handleEntryUpdated(updated: RateAnalysisEntry) {
    setEntries(entries.map((e) => (e.id === updated.id ? updated : e)))
    await upsertRateAnalysisEntry(projectId, updated)
  }

  const availableBoqItems = boqItems.filter((item) => !entries.some((e) => e.boqItemId === item.id))

  if (loading) {
    return <p className="text-sm text-text-muted">{t('loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('rateAnalysisTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('rateAnalysisDescription')}</p>
      </div>

      {availableBoqItems.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedBoqItemId}
            onChange={(e) => setSelectedBoqItemId(e.target.value)}
            className="input-field flex-1"
          >
            <option value="">{t('selectBoqItem')}</option>
            {availableBoqItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemName}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={handleAddEntry} disabled={!selectedBoqItemId}>
            <Plus size={16} />
            {t('addRateAnalysis')}
          </button>
        </div>
      )}

      {boqItems.length === 0 && (
        <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-lg px-3 py-2">
          {t('generateBoqFirst')}
        </p>
      )}

      {entries.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-text-muted">{t('noRateAnalysisEntries')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <RateAnalysisEntryCard
              key={entry.id}
              entry={entry}
              materials={materials}
              labourRates={labourRates}
              equipmentRates={equipmentRates}
              onUpdated={handleEntryUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function RateAnalysisEntryCard({
  entry,
  materials,
  labourRates,
  equipmentRates,
  onUpdated,
}: {
  entry: RateAnalysisEntry
  materials: Material[]
  labourRates: ResourceRate[]
  equipmentRates: ResourceRate[]
  onUpdated: (entry: RateAnalysisEntry) => void
}) {
  const { t } = useLang()
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const { breakdown, warnings } = useMemo(
    () => calculateRateFromLoadedRates(entry, materials, labourRates, equipmentRates),
    [entry, materials, labourRates, equipmentRates]
  )

  function addMaterial(materialId: string) {
    const material = materials.find((m) => m.id === materialId)
    if (!material) return
    const consumption: MaterialConsumption = { materialId, materialName: material.name, quantityPerUnit: 0 }
    onUpdated({ ...entry, materials: [...entry.materials, consumption] })
  }

  function updateMaterialQty(index: number, qty: number) {
    const updated = [...entry.materials]
    updated[index] = { ...updated[index], quantityPerUnit: qty }
    onUpdated({ ...entry, materials: updated })
  }

  function removeMaterial(index: number) {
    onUpdated({ ...entry, materials: entry.materials.filter((_, i) => i !== index) })
  }

  function addLabour(resourceRateId: string) {
    const resource = labourRates.find((r) => r.id === resourceRateId)
    if (!resource) return
    const consumption: LabourConsumption = { resourceRateId, resourceName: resource.name, quantityPerUnit: 0 }
    onUpdated({ ...entry, labour: [...entry.labour, consumption] })
  }

  function updateLabourQty(index: number, qty: number) {
    const updated = [...entry.labour]
    updated[index] = { ...updated[index], quantityPerUnit: qty }
    onUpdated({ ...entry, labour: updated })
  }

  function removeLabour(index: number) {
    onUpdated({ ...entry, labour: entry.labour.filter((_, i) => i !== index) })
  }

  function addEquipment(resourceRateId: string) {
    const resource = equipmentRates.find((r) => r.id === resourceRateId)
    if (!resource) return
    const consumption: EquipmentConsumption = { resourceRateId, resourceName: resource.name, quantityPerUnit: 0 }
    onUpdated({ ...entry, equipment: [...entry.equipment, consumption] })
  }

  function updateEquipmentQty(index: number, qty: number) {
    const updated = [...entry.equipment]
    updated[index] = { ...updated[index], quantityPerUnit: qty }
    onUpdated({ ...entry, equipment: updated })
  }

  function removeEquipment(index: number) {
    onUpdated({ ...entry, equipment: entry.equipment.filter((_, i) => i !== index) })
  }

  function updatePercent(field: 'overheadPercent' | 'profitPercent', value: number) {
    const updated = { ...entry, [field]: value }
    const validation = validateRateAnalysisEntry(updated)
    setValidationErrors(validation.errors)
    onUpdated(updated)
  }

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">{entry.boqItemName}</h3>

      <ConsumptionSection
        title={t('materialLabel')}
        items={entry.materials.map((m) => ({ id: m.materialId, name: m.materialName, qty: m.quantityPerUnit }))}
        options={materials.map((m) => ({ id: m.id, label: `${m.name} (৳${m.currentRate}/${m.unit})` }))}
        onAdd={addMaterial}
        onUpdateQty={updateMaterialQty}
        onRemove={removeMaterial}
      />

      <ConsumptionSection
        title={t('labourLabel')}
        items={entry.labour.map((l) => ({ id: l.resourceRateId, name: l.resourceName, qty: l.quantityPerUnit }))}
        options={labourRates.map((r) => ({ id: r.id, label: `${r.name} (৳${r.currentRate}/${r.unit})` }))}
        onAdd={addLabour}
        onUpdateQty={updateLabourQty}
        onRemove={removeLabour}
      />

      <ConsumptionSection
        title={t('equipmentLabel')}
        items={entry.equipment.map((e) => ({ id: e.resourceRateId, name: e.resourceName, qty: e.quantityPerUnit }))}
        options={equipmentRates.map((r) => ({ id: r.id, label: `${r.name} (৳${r.currentRate}/${r.unit})` }))}
        onAdd={addEquipment}
        onUpdateQty={updateEquipmentQty}
        onRemove={removeEquipment}
      />

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-surface-border">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('overheadPercentLabel')}</label>
          <input
            type="number"
            value={entry.overheadPercent}
            onChange={(e) => updatePercent('overheadPercent', parseFloat(e.target.value) || 0)}
            className="input-field text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('profitPercentLabel')}</label>
          <input
            type="number"
            value={entry.profitPercent}
            onChange={(e) => updatePercent('profitPercent', parseFloat(e.target.value) || 0)}
            className="input-field text-sm"
          />
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
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

      <div className="bg-surface rounded-lg p-4 space-y-1.5">
        <div className="flex justify-between text-sm text-text-secondary">
          <span>{t('materialCostLabel')}</span>
          <span>৳{breakdown.materialCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-text-secondary">
          <span>{t('labourCostLabel')}</span>
          <span>৳{breakdown.labourCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-text-secondary">
          <span>{t('equipmentCostLabel')}</span>
          <span>৳{breakdown.equipmentCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-text-secondary border-t border-surface-border pt-1.5">
          <span>{t('subtotalLabel')}</span>
          <span>৳{breakdown.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-text-secondary">
          <span>{t('overheadLabel')} ({entry.overheadPercent}%)</span>
          <span>৳{breakdown.overheadAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-text-secondary">
          <span>{t('profitLabel')} ({entry.profitPercent}%)</span>
          <span>৳{breakdown.profitAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-text-primary border-t border-surface-border pt-1.5 mt-1.5">
          <span className="flex items-center gap-1.5">
            <Calculator size={16} /> {t('finalRateLabel')}
          </span>
          <span>৳{breakdown.finalRate.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function ConsumptionSection({
  title,
  items,
  options,
  onAdd,
  onUpdateQty,
  onRemove,
}: {
  title: string
  items: { id: string; name: string; qty: number }[]
  options: { id: string; label: string }[]
  onAdd: (id: string) => void
  onUpdateQty: (index: number, qty: number) => void
  onRemove: (index: number) => void
}) {
  const { t } = useLang()
  const [selected, setSelected] = useState('')
  const availableOptions = options.filter((o) => !items.some((i) => i.id === o.id))

  return (
    <div>
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">{title}</h4>
      {items.length > 0 && (
        <table className="w-full text-xs mb-2">
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-b border-surface-border last:border-0">
                <td className="py-1.5 pr-2 text-text-primary">{item.name}</td>
                <td className="py-1.5 pr-2 w-24">
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => onUpdateQty(i, parseFloat(e.target.value) || 0)}
                    className="input-field w-full py-0.5 px-1.5 text-xs"
                    placeholder={t('qtyPerUnitPlaceholder')}
                  />
                </td>
                <td className="py-1.5 w-8">
                  <button onClick={() => onRemove(i)} className="text-text-muted hover:text-red-600">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {availableOptions.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="input-field text-xs py-1 flex-1"
          >
            <option value="">{t('addEllipsis')}</option>
            {availableOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (selected) {
                onAdd(selected)
                setSelected('')
              }
            }}
            disabled={!selected}
            className="btn-outline text-xs py-1 px-2"
          >
            <Plus size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
