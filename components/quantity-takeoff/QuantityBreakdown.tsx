// components/quantity-takeoff/QuantityBreakdown.tsx
'use client'

import { useState } from 'react'
import { Pencil, RotateCcw, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  StoredQuantityTakeoff,
  ArchitecturalFloorQuantities,
  StructuralFloorQuantities,
  StructuralElementDimensions,
  QuantityLineItem,
  effectiveArchitecturalQuantities,
  effectiveStructuralQuantities,
} from '@/lib/types/quantity-takeoff.types'
import {
  overrideArchitecturalFloor,
  overrideStructuralFloor,
  revertArchitecturalFloor,
  revertStructuralFloor,
} from '@/lib/firestore/quantity-takeoff.firestore'
import { summarizeFloorVolumes, calculateElementVolumeM3 } from '@/lib/services/quantity-takeoff.service'
import { useLang } from '@/components/providers/LanguageProvider'

interface QuantityBreakdownProps {
  projectId: string
  importId: string
  data: StoredQuantityTakeoff
  onDataChanged: () => void
}

export function QuantityBreakdown({ projectId, importId, data, onDataChanged }: QuantityBreakdownProps) {
  const { t } = useLang()

  return (
    <div className="space-y-6">
      <section>
        <h3 className="section-title mb-3">{t('architecturalQuantitiesTitle')}</h3>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                <th className="px-4 py-2.5">{t('floorCol')}</th>
                <th className="px-4 py-2.5">{t('wallLengthCol')}</th>
                <th className="px-4 py-2.5">{t('wallAreaCol')}</th>
                <th className="px-4 py-2.5">{t('floorAreaCol')}</th>
                <th className="px-4 py-2.5">{t('ceilingAreaCol')}</th>
                <th className="px-4 py-2.5">{t('paintAreaCol')}</th>
                <th className="px-4 py-2.5">{t('doorCol')}</th>
                <th className="px-4 py-2.5">{t('windowCol')}</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {data.architecturalFloors.map((item) => (
                <ArchitecturalFloorRow
                  key={item.raw.floorId}
                  projectId={projectId}
                  importId={importId}
                  item={item}
                  onChanged={onDataChanged}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">{t('structuralQuantitiesTitle')}</h3>
          <p className="text-xs text-text-muted">{t('expandRowHint')}</p>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                <th className="px-4 py-2.5"></th>
                <th className="px-4 py-2.5">{t('floorCol')}</th>
                <th className="px-4 py-2.5">{t('footingCol')}</th>
                <th className="px-4 py-2.5">{t('columnCol')}</th>
                <th className="px-4 py-2.5">{t('beamCol')}</th>
                <th className="px-4 py-2.5">{t('slabCol')}</th>
                <th className="px-4 py-2.5">{t('totalRccCol')}</th>
                <th className="px-4 py-2.5">{t('stairCol')}</th>
                <th className="px-4 py-2.5">{t('reinforcementCol')}</th>
              </tr>
            </thead>
            <tbody>
              {data.structuralFloors.map((item) => (
                <StructuralFloorSection
                  key={item.raw.floorId}
                  projectId={projectId}
                  importId={importId}
                  item={item}
                  onChanged={onDataChanged}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Architectural — আগের মতোই flat inline-edit, কারণ এখানে প্রতিটা
// floor-এর সব ফিল্ড single number, কোনো element-array নেই।
// ─────────────────────────────────────────────────────────────────

function ArchitecturalFloorRow({
  projectId,
  importId,
  item,
  onChanged,
}: {
  projectId: string
  importId: string
  item: QuantityLineItem<ArchitecturalFloorQuantities>
  onChanged: () => void
}) {
  const { t } = useLang()
  const [editing, setEditing] = useState(false)
  const effective = effectiveArchitecturalQuantities(item)
  const [draft, setDraft] = useState<ArchitecturalFloorQuantities>(effective)
  const [saving, setSaving] = useState(false)
  const [reverting, setReverting] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await overrideArchitecturalFloor(projectId, importId, item.raw.floorId, draft)
      setEditing(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function handleRevert() {
    setReverting(true)
    try {
      await revertArchitecturalFloor(projectId, importId, item.raw.floorId)
      onChanged()
    } finally {
      setReverting(false)
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-surface-border last:border-0 bg-brand-50/40">
        <td className="px-4 py-2 font-medium text-text-primary">{effective.floorLabel}</td>
        {(
          [
            'wallLengthFt',
            'wallAreaSqft',
            'floorAreaSqft',
            'ceilingAreaSqft',
            'paintAreaSqft',
            'doorQuantity',
            'windowQuantity',
          ] as const
        ).map((field) => (
          <td key={field} className="px-4 py-2">
            <input
              type="number"
              value={draft[field]}
              onChange={(e) => setDraft({ ...draft, [field]: parseFloat(e.target.value) || 0 })}
              className="input-field w-24 text-sm py-1"
            />
          </td>
        ))}
        <td className="px-4 py-2 whitespace-nowrap">
          <button className="btn-primary py-1 px-2 text-xs" onClick={handleSave} disabled={saving}>
            {t('save')}
          </button>
          <button className="btn-ghost py-1 px-2 text-xs" onClick={() => setEditing(false)}>
            {t('cancel')}
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-surface-border last:border-0 hover:bg-surface-hover">
      <td className="px-4 py-2.5 font-medium text-text-primary">
        {effective.floorLabel}
        {item.isOverridden && (
          <span className="ml-1.5 text-xs text-brand-600" title={t('manuallyEdited')}>
            ✎
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">{effective.wallLengthFt}</td>
      <td className="px-4 py-2.5">{effective.wallAreaSqft}</td>
      <td className="px-4 py-2.5">{effective.floorAreaSqft}</td>
      <td className="px-4 py-2.5">{effective.ceilingAreaSqft}</td>
      <td className="px-4 py-2.5">{effective.paintAreaSqft}</td>
      <td className="px-4 py-2.5">{effective.doorQuantity}</td>
      <td className="px-4 py-2.5">{effective.windowQuantity}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <button
          onClick={() => {
            setDraft(effective)
            setEditing(true)
          }}
          className="text-text-muted hover:text-brand-600 p-1"
          title={t('editThis')}
        >
          <Pencil size={14} />
        </button>
        {item.isOverridden && (
          <button
            onClick={handleRevert}
            disabled={reverting}
            className="text-text-muted hover:text-brand-600 p-1"
            title={t('revertToRaw')}
          >
            <RotateCcw size={14} />
          </button>
        )}
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────
// Structural — এখন element-array ভিত্তিক, তাই collapsed summary row
// (calculated volume সহ) + expand করলে element-level dimension table।
// ─────────────────────────────────────────────────────────────────

const ELEMENT_ARRAY_KEYS = ['footings', 'columns', 'beams', 'slabs'] as const
type ElementArrayKey = (typeof ELEMENT_ARRAY_KEYS)[number]

function StructuralFloorSection({
  projectId,
  importId,
  item,
  onChanged,
}: {
  projectId: string
  importId: string
  item: QuantityLineItem<StructuralFloorQuantities>
  onChanged: () => void
}) {
  const { t } = useLang()

  // module-level constant না, কারণ t() hook component-এর ভেতরেই কল
  // করতে হয় — ElementArrayEditor-কে prop হিসেবে পাস করা হয়
  const elementLabels: Record<ElementArrayKey, string> = {
    footings: t('elementLabel_footings'),
    columns: t('elementLabel_columns'),
    beams: t('elementLabel_beams'),
    slabs: t('elementLabel_slabs'),
  }

  const [expanded, setExpanded] = useState(false)
  const effective = effectiveStructuralQuantities(item)
  const volumes = summarizeFloorVolumes(effective)
  const [reverting, setReverting] = useState(false)

  async function handleRevert() {
    setReverting(true)
    try {
      await revertStructuralFloor(projectId, importId, item.raw.floorId)
      onChanged()
    } finally {
      setReverting(false)
    }
  }

  return (
    <>
      <tr className="border-b border-surface-border hover:bg-surface-hover cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="px-4 py-2.5 text-text-muted">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-4 py-2.5 font-medium text-text-primary">
          {effective.floorLabel}
          {item.isOverridden && (
            <span className="ml-1.5 text-xs text-brand-600" title={t('manuallyEdited')}>
              ✎
            </span>
          )}
        </td>
        <td className="px-4 py-2.5">{volumes.footingVolumeM3.toFixed(2)}</td>
        <td className="px-4 py-2.5">{volumes.columnVolumeM3.toFixed(2)}</td>
        <td className="px-4 py-2.5">{volumes.beamVolumeM3.toFixed(2)}</td>
        <td className="px-4 py-2.5">{volumes.slabVolumeM3.toFixed(2)}</td>
        <td className="px-4 py-2.5 font-semibold text-text-primary">
          {volumes.totalRccVolumeM3.toFixed(2)}
        </td>
        <td className="px-4 py-2.5">{effective.stairQuantity}</td>
        <td className="px-4 py-2.5">{effective.reinforcementQuantityKg}</td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} className="bg-surface px-4 py-4">
            <div className="space-y-4">
              {item.isOverridden && (
                <div className="flex justify-end">
                  <button
                    onClick={handleRevert}
                    disabled={reverting}
                    className="btn-ghost text-xs py-1 px-2"
                  >
                    <RotateCcw size={12} />
                    {t('revertAllToRaw')}
                  </button>
                </div>
              )}
              {ELEMENT_ARRAY_KEYS.map((key) => (
                <ElementArrayEditor
                  key={key}
                  arrayKey={key}
                  elementLabel={elementLabels[key]}
                  elements={effective[key]}
                  floor={effective}
                  projectId={projectId}
                  importId={importId}
                  onChanged={onChanged}
                />
              ))}

              <div className="pt-2 border-t border-surface-border text-xs text-text-muted">
                {t('stairReinforcementNote')}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * একটা element-type (যেমন সব column)-এর জন্য add/edit/delete করার
 * টেবিল। Firestore-এ পুরো floor object rewrite করেই সংরক্ষণ হয়
 * (quantity-takeoff.firestore.ts-এর overrideStructuralFloor একই
 * pattern অনুসরণ করে), তাই এখানে UI-লেভেলে draft state রেখে একবারে
 * পুরো array override হিসেবে পাঠানো হয়।
 */
function ElementArrayEditor({
  arrayKey,
  elementLabel,
  elements,
  floor,
  projectId,
  importId,
  onChanged,
}: {
  arrayKey: ElementArrayKey
  elementLabel: string
  elements: StructuralElementDimensions[]
  floor: StructuralFloorQuantities
  projectId: string
  importId: string
  onChanged: () => void
}) {
  const { t } = useLang()
  const [draftElements, setDraftElements] = useState<StructuralElementDimensions[] | null>(null)
  const [saving, setSaving] = useState(false)

  const isEditing = draftElements !== null
  const displayElements = draftElements ?? elements

  function startEditing() {
    setDraftElements(elements.map((el) => ({ ...el })))
  }

  function updateElement(index: number, field: keyof StructuralElementDimensions, value: string) {
    if (!draftElements) return
    const updated = [...draftElements]
    updated[index] = {
      ...updated[index],
      [field]: field === 'elementId' ? value : parseFloat(value) || 0,
    }
    setDraftElements(updated)
  }

  function addElement() {
    if (!draftElements) return
    setDraftElements([
      ...draftElements,
      { elementId: `${elementLabel[0]}${draftElements.length + 1}`, lengthFt: 0, widthFt: 0, depthFt: 0, count: 1 },
    ])
  }

  function removeElement(index: number) {
    if (!draftElements) return
    setDraftElements(draftElements.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!draftElements) return
    setSaving(true)
    try {
      await overrideStructuralFloor(projectId, importId, floor.floorId, {
        ...floor,
        [arrayKey]: draftElements,
      })
      setDraftElements(null)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {elementLabel} ({displayElements.length})
        </h4>
        {!isEditing ? (
          <button onClick={startEditing} className="text-xs text-brand-600 hover:underline">
            {t('editThis')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={addElement} className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
              <Plus size={12} /> {t('add')}
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1 px-2">
              {t('save')}
            </button>
            <button onClick={() => setDraftElements(null)} className="btn-ghost text-xs py-1 px-2">
              {t('cancel')}
            </button>
          </div>
        )}
      </div>

      {displayElements.length === 0 ? (
        <p className="text-xs text-text-muted italic">{t('noElementsInFloor', { element: elementLabel.toLowerCase() })}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted text-left">
              <th className="py-1 pr-3">{t('idCol')}</th>
              <th className="py-1 pr-3">{t('lengthFtCol')}</th>
              <th className="py-1 pr-3">{t('widthFtCol')}</th>
              <th className="py-1 pr-3">{t('depthFtCol')}</th>
              <th className="py-1 pr-3">{t('countCol')}</th>
              <th className="py-1 pr-3">{t('volumeM3Col')}</th>
              {isEditing && <th className="py-1"></th>}
            </tr>
          </thead>
          <tbody>
            {displayElements.map((el, i) => {
              const volumeM3 = calculateElementVolumeM3(el)
              return (
                <tr key={i} className="border-t border-surface-border">
                  {isEditing ? (
                    <>
                      <td className="py-1 pr-3">
                        <input
                          value={el.elementId}
                          onChange={(e) => updateElement(i, 'elementId', e.target.value)}
                          className="input-field w-16 py-0.5 px-1.5 text-xs"
                        />
                      </td>
                      {(['lengthFt', 'widthFt', 'depthFt', 'count'] as const).map((f) => (
                        <td key={f} className="py-1 pr-3">
                          <input
                            type="number"
                            value={el[f]}
                            onChange={(e) => updateElement(i, f, e.target.value)}
                            className="input-field w-16 py-0.5 px-1.5 text-xs"
                          />
                        </td>
                      ))}
                      <td className="py-1 pr-3 text-text-muted">{volumeM3.toFixed(3)}</td>
                      <td className="py-1">
                        <button onClick={() => removeElement(i)} className="text-text-muted hover:text-red-600">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-1 pr-3 text-text-primary">{el.elementId}</td>
                      <td className="py-1 pr-3">{el.lengthFt}</td>
                      <td className="py-1 pr-3">{el.widthFt}</td>
                      <td className="py-1 pr-3">{el.depthFt}</td>
                      <td className="py-1 pr-3">{el.count}</td>
                      <td className="py-1 pr-3 text-text-muted">{volumeM3.toFixed(3)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
