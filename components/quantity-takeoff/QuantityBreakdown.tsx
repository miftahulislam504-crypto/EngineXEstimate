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
  EarthworkQuantities,
  StairQuantities,
  MasonryWallSegment,
  FinishingQuantities,
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">{t('architecturalQuantitiesTitle')}</h3>
          <p className="text-xs text-text-muted">{t('expandRowHint')}</p>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                <th className="px-4 py-2.5"></th>
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
  const [expanded, setExpanded] = useState(false)
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
        <td className="px-4 py-2"></td>
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
    <>
      <tr className="border-b border-surface-border last:border-0 hover:bg-surface-hover cursor-pointer" onClick={() => setExpanded(!expanded)}>
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
        <td className="px-4 py-2.5">{effective.wallLengthFt}</td>
        <td className="px-4 py-2.5">{effective.wallAreaSqft}</td>
        <td className="px-4 py-2.5">{effective.floorAreaSqft}</td>
        <td className="px-4 py-2.5">{effective.ceilingAreaSqft}</td>
        <td className="px-4 py-2.5">{effective.paintAreaSqft}</td>
        <td className="px-4 py-2.5">{effective.doorQuantity}</td>
        <td className="px-4 py-2.5">{effective.windowQuantity}</td>
        <td className="px-4 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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

      {expanded && (
        <tr>
          <td colSpan={9} className="bg-surface px-4 py-4">
            <div className="space-y-4">
              <MasonryEditor floor={effective} projectId={projectId} importId={importId} onChanged={onChanged} />
              <FinishingEditor floor={effective} projectId={projectId} importId={importId} onChanged={onChanged} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────
// Masonry — নতুন (২০২৬-০৮-২০, audit gap #2)। MasonryWallSegment[]
// (wallType/thickness-সহ) ElementArrayEditor-এর একই "array of rows,
// add/remove" প্যাটার্ন অনুসরণ করে, কিন্তু wallType-এর জন্য select
// dropdown।
// ─────────────────────────────────────────────────────────────────

function MasonryEditor({
  floor,
  projectId,
  importId,
  onChanged,
}: {
  floor: ArchitecturalFloorQuantities
  projectId: string
  importId: string
  onChanged: () => void
}) {
  const { t } = useLang()
  const [draftWalls, setDraftWalls] = useState<MasonryWallSegment[] | null>(null)
  const [saving, setSaving] = useState(false)

  const isEditing = draftWalls !== null
  const walls = draftWalls ?? floor.masonryWalls ?? []

  function startEditing() {
    setDraftWalls((floor.masonryWalls ?? []).map((w) => ({ ...w })))
  }

  function updateWall(index: number, field: keyof MasonryWallSegment, value: string) {
    if (!draftWalls) return
    const updated = [...draftWalls]
    updated[index] = {
      ...updated[index],
      [field]: field === 'wallType' ? (value as MasonryWallSegment['wallType']) : parseFloat(value) || 0,
    }
    setDraftWalls(updated)
  }

  function addWall() {
    if (!draftWalls) return
    setDraftWalls([...draftWalls, { wallType: 'external', lengthFt: 0, heightFt: 0, thicknessIn: 5, openingDeductionSqft: 0 }])
  }

  function removeWall(index: number) {
    if (!draftWalls) return
    setDraftWalls(draftWalls.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!draftWalls) return
    setSaving(true)
    try {
      await overrideArchitecturalFloor(projectId, importId, floor.floorId, { ...floor, masonryWalls: draftWalls })
      setDraftWalls(null)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const wallTypeLabels: Record<MasonryWallSegment['wallType'], string> = {
    external: t('wallTypeExternal'),
    internal: t('wallTypeInternal'),
    parapet: t('wallTypeParapet'),
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {t('masonrySectionTitle')} ({walls.length})
        </h4>
        {!isEditing ? (
          <button onClick={startEditing} className="text-xs text-brand-600 hover:underline">
            {t('editThis')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={addWall} className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
              <Plus size={12} /> {t('addWallSegment')}
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1 px-2">
              {t('save')}
            </button>
            <button onClick={() => setDraftWalls(null)} className="btn-ghost text-xs py-1 px-2">
              {t('cancel')}
            </button>
          </div>
        )}
      </div>

      {walls.length === 0 ? (
        <p className="text-xs text-text-muted italic">{t('masonryNotSet')}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted text-left">
              <th className="py-1 pr-3">{t('wallTypeCol')}</th>
              <th className="py-1 pr-3">{t('lengthFtCol')}</th>
              <th className="py-1 pr-3">{t('heightFtCol')}</th>
              <th className="py-1 pr-3">{t('thicknessInCol')}</th>
              <th className="py-1 pr-3">{t('openingDeductionCol')}</th>
              {isEditing && <th className="py-1"></th>}
            </tr>
          </thead>
          <tbody>
            {walls.map((w, i) => (
              <tr key={i} className="border-t border-surface-border">
                {isEditing ? (
                  <>
                    <td className="py-1 pr-3">
                      <select
                        value={w.wallType}
                        onChange={(e) => updateWall(i, 'wallType', e.target.value)}
                        className="input-field w-24 py-0.5 px-1.5 text-xs"
                      >
                        <option value="external">{wallTypeLabels.external}</option>
                        <option value="internal">{wallTypeLabels.internal}</option>
                        <option value="parapet">{wallTypeLabels.parapet}</option>
                      </select>
                    </td>
                    {(['lengthFt', 'heightFt', 'thicknessIn', 'openingDeductionSqft'] as const).map((f) => (
                      <td key={f} className="py-1 pr-3">
                        <input
                          type="number"
                          value={w[f]}
                          onChange={(e) => updateWall(i, f, e.target.value)}
                          className="input-field w-16 py-0.5 px-1.5 text-xs"
                        />
                      </td>
                    ))}
                    <td className="py-1">
                      <button onClick={() => removeWall(i)} className="text-text-muted hover:text-red-600">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-1 pr-3 text-text-primary">{wallTypeLabels[w.wallType]}</td>
                    <td className="py-1 pr-3">{w.lengthFt}</td>
                    <td className="py-1 pr-3">{w.heightFt}</td>
                    <td className="py-1 pr-3">{w.thicknessIn}</td>
                    <td className="py-1 pr-3">{w.openingDeductionSqft}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Finishing — নতুন (২০২৬-০৮-২০, audit gap #2)। EarthworkEditor-এর
// একই "single-row, all-fields" প্যাটার্ন (Masonry-র মতো array না,
// প্রতিটা floor-এ একটাই FinishingQuantities entry)।
// ─────────────────────────────────────────────────────────────────

const EMPTY_FINISHING: FinishingQuantities = {
  internalPlasterAreaSqft: 0,
  externalPlasterAreaSqft: 0,
  tilesAreaSqft: 0,
  paintAreaSqft: 0,
  ceilingAreaSqft: 0,
  waterproofingAreaSqft: 0,
}

function FinishingEditor({
  floor,
  projectId,
  importId,
  onChanged,
}: {
  floor: ArchitecturalFloorQuantities
  projectId: string
  importId: string
  onChanged: () => void
}) {
  const { t } = useLang()
  const [draft, setDraft] = useState<FinishingQuantities | null>(null)
  const [saving, setSaving] = useState(false)

  const isEditing = draft !== null
  const current = draft ?? floor.finishing

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    try {
      await overrideArchitecturalFloor(projectId, importId, floor.floorId, { ...floor, finishing: draft })
      setDraft(null)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {t('finishingSectionTitle')}
        </h4>
        {!isEditing ? (
          <button
            onClick={() => setDraft(floor.finishing ?? EMPTY_FINISHING)}
            className="text-xs text-brand-600 hover:underline"
          >
            {floor.finishing ? t('editThis') : t('setFinishing')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1 px-2">
              {t('save')}
            </button>
            <button onClick={() => setDraft(null)} className="btn-ghost text-xs py-1 px-2">
              {t('cancel')}
            </button>
          </div>
        )}
      </div>

      {!current ? (
        <p className="text-xs text-text-muted italic">{t('finishingNotSet')}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted text-left">
              <th className="py-1 pr-3">{t('internalPlasterCol')}</th>
              <th className="py-1 pr-3">{t('externalPlasterCol')}</th>
              <th className="py-1 pr-3">{t('tilesAreaCol')}</th>
              <th className="py-1 pr-3">{t('finishPaintAreaCol')}</th>
              <th className="py-1 pr-3">{t('finishCeilingAreaCol')}</th>
              <th className="py-1 pr-3">{t('waterproofingAreaCol')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {(
                [
                  ['internalPlasterAreaSqft', current.internalPlasterAreaSqft],
                  ['externalPlasterAreaSqft', current.externalPlasterAreaSqft],
                  ['tilesAreaSqft', current.tilesAreaSqft],
                  ['paintAreaSqft', current.paintAreaSqft],
                  ['ceilingAreaSqft', current.ceilingAreaSqft],
                  ['waterproofingAreaSqft', current.waterproofingAreaSqft],
                ] as const
              ).map(([field, value]) => (
                <td key={field} className="py-1 pr-3">
                  {isEditing ? (
                    <input
                      type="number"
                      value={value}
                      onChange={(e) =>
                        setDraft({ ...(draft ?? EMPTY_FINISHING), [field]: parseFloat(e.target.value) || 0 })
                      }
                      className="input-field w-16 py-0.5 px-1.5 text-xs"
                    />
                  ) : (
                    value
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
    </div>
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

              <EarthworkEditor floor={effective} projectId={projectId} importId={importId} onChanged={onChanged} />
              <StairDimensionsEditor floor={effective} projectId={projectId} importId={importId} onChanged={onChanged} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────
// Earthwork — নতুন (২০২৬-০৮-২০, audit gap #2)। EarthworkQuantities
// optional, তাই না থাকলে "সেট করুন" empty-state দেখানো হয়, ঠিক
// ElementArrayEditor-এর "কোনো element নেই" প্যাটার্নের অনুরূপ।
// ─────────────────────────────────────────────────────────────────

const EMPTY_EARTHWORK: EarthworkQuantities = {
  excavationAreaSqft: 0,
  excavationDepthFt: 0,
  backfillPercentOfExcavation: 65,
  disposalPercentOfExcavation: 35,
}

function EarthworkEditor({
  floor,
  projectId,
  importId,
  onChanged,
}: {
  floor: StructuralFloorQuantities
  projectId: string
  importId: string
  onChanged: () => void
}) {
  const { t } = useLang()
  const [draft, setDraft] = useState<EarthworkQuantities | null>(null)
  const [saving, setSaving] = useState(false)

  const isEditing = draft !== null
  const current = draft ?? floor.earthwork

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    try {
      await overrideStructuralFloor(projectId, importId, floor.floorId, { ...floor, earthwork: draft })
      setDraft(null)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {t('earthworkSectionTitle')}
        </h4>
        {!isEditing ? (
          <button
            onClick={() => setDraft(floor.earthwork ?? EMPTY_EARTHWORK)}
            className="text-xs text-brand-600 hover:underline"
          >
            {t('editThis')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1 px-2">
              {t('save')}
            </button>
            <button onClick={() => setDraft(null)} className="btn-ghost text-xs py-1 px-2">
              {t('cancel')}
            </button>
          </div>
        )}
      </div>

      {!current ? (
        <p className="text-xs text-text-muted italic">{t('earthworkNotSet')}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted text-left">
              <th className="py-1 pr-3">{t('excavationAreaCol')}</th>
              <th className="py-1 pr-3">{t('excavationDepthCol')}</th>
              <th className="py-1 pr-3">{t('backfillPercentCol')}</th>
              <th className="py-1 pr-3">{t('disposalPercentCol')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {(
                [
                  ['excavationAreaSqft', current.excavationAreaSqft],
                  ['excavationDepthFt', current.excavationDepthFt],
                  ['backfillPercentOfExcavation', current.backfillPercentOfExcavation],
                  ['disposalPercentOfExcavation', current.disposalPercentOfExcavation],
                ] as const
              ).map(([field, value]) => (
                <td key={field} className="py-1 pr-3">
                  {isEditing ? (
                    <input
                      type="number"
                      value={value}
                      onChange={(e) =>
                        setDraft({ ...(draft ?? EMPTY_EARTHWORK), [field]: parseFloat(e.target.value) || 0 })
                      }
                      className="input-field w-20 py-0.5 px-1.5 text-xs"
                    />
                  ) : (
                    value
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Stair Dimensions — নতুন (২০২৬-০৮-২০, audit gap #3)। এই মুহূর্তে
// Structural app থেকে stairQuantities কখনো আসে না (structural-mapper.ts
// দ্রষ্টব্য), তাই এই editor-ই একমাত্র উপায় stairDimensions পূরণ
// করার — Structural app wire হলে এটা raw হিসেবে auto-populate হবে
// এবং এই editor override হিসেবে কাজ করবে (বাকি সব ElementArrayEditor-এর
// মতোই)।
// ─────────────────────────────────────────────────────────────────

const EMPTY_STAIR: StairQuantities = {
  waistSlabVolumeM3: 0,
  stairReinforcementKg: 0,
  numberOfFlights: 1,
}

function StairDimensionsEditor({
  floor,
  projectId,
  importId,
  onChanged,
}: {
  floor: StructuralFloorQuantities
  projectId: string
  importId: string
  onChanged: () => void
}) {
  const { t } = useLang()
  const [draft, setDraft] = useState<StairQuantities | null>(null)
  const [saving, setSaving] = useState(false)

  const isEditing = draft !== null
  const current = draft ?? floor.stairDimensions

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    try {
      await overrideStructuralFloor(projectId, importId, floor.floorId, { ...floor, stairDimensions: draft })
      setDraft(null)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {t('stairDimensionsSectionTitle')}
        </h4>
        {!isEditing ? (
          <button
            onClick={() => setDraft(floor.stairDimensions ?? EMPTY_STAIR)}
            className="text-xs text-brand-600 hover:underline"
          >
            {floor.stairDimensions ? t('editThis') : t('setStairDimensions')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1 px-2">
              {t('save')}
            </button>
            <button onClick={() => setDraft(null)} className="btn-ghost text-xs py-1 px-2">
              {t('cancel')}
            </button>
          </div>
        )}
      </div>

      {!current ? (
        <p className="text-xs text-text-muted italic">{t('stairDimensionsNotSet')}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted text-left">
              <th className="py-1 pr-3">{t('waistSlabVolumeCol')}</th>
              <th className="py-1 pr-3">{t('stairReinforcementKgCol')}</th>
              <th className="py-1 pr-3">{t('numberOfFlightsCol')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {(
                [
                  ['waistSlabVolumeM3', current.waistSlabVolumeM3],
                  ['stairReinforcementKg', current.stairReinforcementKg],
                  ['numberOfFlights', current.numberOfFlights],
                ] as const
              ).map(([field, value]) => (
                <td key={field} className="py-1 pr-3">
                  {isEditing ? (
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setDraft({ ...(draft ?? EMPTY_STAIR), [field]: parseFloat(e.target.value) || 0 })}
                      className="input-field w-20 py-0.5 px-1.5 text-xs"
                    />
                  ) : (
                    value
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
    </div>
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
