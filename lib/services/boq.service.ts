// lib/services/boq.service.ts
//
// Module 2 (Quantity Takeoff)-এর structural ও architectural volume
// থেকে BOQ item auto-generate করে।
//
// ── ২০২৬-০৮-২০ সম্প্রসারণ (CivilOS-Report-Audit.md gap #2) ─────────
// আগে এখানে শুধু RCC auto-generate হতো, কারণ Module 2-এর schema
// Earthwork/Masonry/Finishing/Stair-এর জন্য যথেষ্ট তথ্য দিত না।
// quantity-takeoff.types.ts-এ EarthworkQuantities/MasonryWallSegment/
// FinishingQuantities/StairQuantities যোগ হওয়ায় এখন এই চারটা ট্রেডও
// auto-generate হয় — কিন্তু এই field গুলো সবই optional (mapper-এ
// upstream data না থাকলে undefined), তাই প্রতিটা generator ফাংশন
// undefined-safe (data না থাকলে সেই floor-এর জন্য চুপচাপ item তৈরি
// করে না, RCC-এর `if (volume <= 0) continue` একই নীতি অনুসরণ করে)।
//
// PCC (Plain Cement Concrete, RCC থেকে ভিন্ন — সাধারণত footing-এর
// নিচে levelling layer) এখনো auto-generate হয় না — Module 2-এর
// schema-তে PCC thickness/area আলাদা করে নেই (EarthworkQuantities-এ
// শুধু excavation আছে, PCC না)। এটা এখনো addCustomBOQItem()-এর
// আওতায়।
//
// ── ２０２৬-０৮-２০ সম্প্রসারণ ２ (audit gap #1) ─────────────────────
// generateElectricalBOQItems()/generatePlumbingBOQItems() —
// StoredQuantityTakeoff-এর বাইরে, আলাদা Firestore document
// (StoredElectrical/StoredPlumbing) থেকে BOQ item তৈরি করে। এই
// দুটো generateBOQFromQuantityTakeoff()-এর ভেতরে ডাকা হয় না (আলাদা
// data source, আলাদা fetch), caller (BOQGenerator.tsx) তিনটা
// generator-এর আউটপুট একসাথে merge করে।

import {
  StoredQuantityTakeoff,
  effectiveStructuralQuantities,
  effectiveArchitecturalQuantities,
} from '@/lib/types/quantity-takeoff.types'
import {
  summarizeFloorVolumes,
  calculateEarthworkVolumes,
  summarizeMasonryVolumes,
  convertFinishingToSqm,
  getStairVolumeM3,
} from '@/lib/services/quantity-takeoff.service'
import { BOQItem } from '@/lib/types/boq.types'
import { StoredElectrical, ElectricalItemCategory, ELECTRICAL_CATEGORY_UNIT } from '@/lib/types/electrical.types'
import { StoredPlumbing, PlumbingFixtureCategory } from '@/lib/types/plumbing.types'

function generateItemId(): string {
  return `boqitem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * একটা StoredQuantityTakeoff থেকে RCC BOQ item তৈরি করে — প্রতিটা
 * floor-এর জন্য আলাদা item, যাতে পরে floor-ভিত্তিক cost breakdown
 * (Dashboard, Module 1-এ) সম্ভব হয়। একটা প্রজেক্ট-ব্যাপী single
 * "RCC" item-এ সব floor একত্র করলে সেই granularity হারিয়ে যেত।
 *
 * roof floor হলে label "RCC (Roof)" হয় (audit gap: "Roof Concrete
 * আলাদা category নেই" — এখানে volume এখনো slabs-এর সাথেই যোগ থাকে,
 * শুধু BOQ-তে আলাদাভাবে চেনা যায়, ডবল-কাউন্ট হয় না)। Stair volume
 * (থাকলে) এই একই RCC লাইনে যোগ হয় না — আলাদা "RCC (Stair)" আইটেম
 * নিচে generateStairBOQItems()-এ, কারণ স্টেয়ারের rate সাধারণত
 * floor-slab RCC থেকে ভিন্ন হয় (জটিল formwork)।
 */
export function generateBOQFromQuantityTakeoff(quantityTakeoff: StoredQuantityTakeoff): BOQItem[] {
  const items: BOQItem[] = []

  for (const floorItem of quantityTakeoff.structuralFloors) {
    const effective = effectiveStructuralQuantities(floorItem)
    const volumes = summarizeFloorVolumes(effective)

    if (volumes.totalRccVolumeM3 > 0) {
      const isRoof = effective.roof?.isRoofFloor === true
      items.push({
        id: generateItemId(),
        itemName: `RCC (Footing, Column, Beam, ${isRoof ? 'Roof Slab' : 'Slab'}) — ${effective.floorLabel}`,
        unit: 'm3',
        quantity: round2(volumes.totalRccVolumeM3), // ২ দশমিক পর্যন্ত, বাস্তব নির্মাণ হিসাবে যথেষ্ট নির্ভুল
        floorId: effective.floorId,
        source: 'auto_rcc',
        notes: `Footing ${volumes.footingVolumeM3.toFixed(2)} + Column ${volumes.columnVolumeM3.toFixed(2)} + Beam ${volumes.beamVolumeM3.toFixed(2)} + Slab ${volumes.slabVolumeM3.toFixed(2)} m³`,
      })
    }

    items.push(...generateEarthworkBOQItems(effective, floorItem.raw.floorId))
    items.push(...generateStairBOQItems(effective))
  }

  for (const floorItem of quantityTakeoff.architecturalFloors) {
    const effective = effectiveArchitecturalQuantities(floorItem)
    items.push(...generateMasonryBOQItems(effective))
    items.push(...generateFinishingBOQItems(effective))
    items.push(...generateDoorWindowBOQItems(effective))
  }

  return items
}

/**
 * Earthwork — audit gap #2 ("Earthwork ... manual")। EarthworkQuantities
 * না থাকলে (mapper undefined রেখেছে) কোনো item তৈরি হয় না। Excavation/
 * Backfill/Disposal তিনটা আলাদা BOQ লাইন (দেশীয় BOQ practice-এ
 * প্রচলিত grouping, rate ভিন্ন — backfill শ্রম-নির্ভর, disposal
 * পরিবহন-নির্ভর)।
 */
function generateEarthworkBOQItems(
  floor: ReturnType<typeof effectiveStructuralQuantities>,
  floorId: string
): BOQItem[] {
  if (!floor.earthwork) return []
  const vol = calculateEarthworkVolumes(floor.earthwork)
  const items: BOQItem[] = []

  if (vol.excavationVolumeM3 > 0) {
    items.push({
      id: generateItemId(),
      itemName: `Earthwork — Excavation — ${floor.floorLabel}`,
      unit: 'm3',
      quantity: round2(vol.excavationVolumeM3),
      floorId,
      source: 'auto_earthwork',
      notes: `Area ${floor.earthwork.excavationAreaSqft} sqft × Depth ${floor.earthwork.excavationDepthFt} ft`,
    })
  }
  if (vol.backfillVolumeM3 > 0) {
    items.push({
      id: generateItemId(),
      itemName: `Earthwork — Backfilling — ${floor.floorLabel}`,
      unit: 'm3',
      quantity: round2(vol.backfillVolumeM3),
      floorId,
      source: 'auto_earthwork',
      notes: `${floor.earthwork.backfillPercentOfExcavation}% of excavation volume`,
    })
  }
  if (vol.disposalVolumeM3 > 0) {
    items.push({
      id: generateItemId(),
      itemName: `Earthwork — Surplus Disposal — ${floor.floorLabel}`,
      unit: 'm3',
      quantity: round2(vol.disposalVolumeM3),
      floorId,
      source: 'auto_earthwork',
      notes: `${floor.earthwork.disposalPercentOfExcavation}% of excavation volume`,
    })
  }
  return items
}

/**
 * Masonry — audit gap #2। wallType অনুযায়ী আলাদা BOQ লাইন
 * (External/Internal/Parapet Brick Work) — summarizeMasonryVolumes()
 * এই গ্রুপিং করে দেয়।
 */
function generateMasonryBOQItems(floor: ReturnType<typeof effectiveArchitecturalQuantities>): BOQItem[] {
  if (!floor.masonryWalls || floor.masonryWalls.length === 0) return []
  const vol = summarizeMasonryVolumes(floor.masonryWalls)
  const items: BOQItem[] = []

  const pushIfPositive = (label: string, quantity: number) => {
    if (quantity <= 0) return
    items.push({
      id: generateItemId(),
      itemName: `Brick Work (${label}) — ${floor.floorLabel}`,
      unit: 'm3',
      quantity: round2(quantity),
      floorId: floor.floorId,
      source: 'auto_masonry',
    })
  }

  pushIfPositive('External', vol.externalWallVolumeM3)
  pushIfPositive('Internal', vol.internalWallVolumeM3)
  pushIfPositive('Parapet', vol.parapetWallVolumeM3)
  return items
}

/**
 * Finishing — audit gap #2। Plaster (internal/external আলাদা),
 * Tiles, Paint, Ceiling, Waterproofing — প্রতিটা আলাদা BOQ লাইন, m²
 * এককে (দেশীয় BOQ practice)।
 */
function generateFinishingBOQItems(floor: ReturnType<typeof effectiveArchitecturalQuantities>): BOQItem[] {
  if (!floor.finishing) return []
  const sqm = convertFinishingToSqm(floor.finishing)
  const items: BOQItem[] = []

  const pushIfPositive = (label: string, quantity: number) => {
    if (quantity <= 0) return
    items.push({
      id: generateItemId(),
      itemName: `${label} — ${floor.floorLabel}`,
      unit: 'm2',
      quantity: round2(quantity),
      floorId: floor.floorId,
      source: 'auto_finishing',
    })
  }

  pushIfPositive('Plaster (Internal)', sqm.internalPlasterAreaSqm)
  pushIfPositive('Plaster (External)', sqm.externalPlasterAreaSqm)
  pushIfPositive('Tiles', sqm.tilesAreaSqm)
  pushIfPositive('Paint', sqm.paintAreaSqm)
  pushIfPositive('Ceiling Finish', sqm.ceilingAreaSqm)
  pushIfPositive('Waterproofing', sqm.waterproofingAreaSqm)
  return items
}

/**
 * Doors & Windows — audit gap #4 ("Doors & Windows Quantity —
 * manual")। architectural-mapper.ts ইতিমধ্যেই doorSchedule/
 * windowSchedule থেকে doorQuantity/windowQuantity গণনা করে
 * (mapStructuralModuleDataToFloors-এর সাথে সমান্তরাল
 * mapArchitecturalModuleDataToFloors ফাংশনে), কিন্তু আগে এই সংখ্যা
 * BOQ-তে কখনো ব্যবহৃত হতো না — শুধু QuantityBreakdown UI-তে
 * প্রদর্শিত হতো। এখন প্রতিটা floor-এ door/window count থাকলে একটা
 * করে "nos" ইউনিটের BOQ লাইন-আইটেম তৈরি হয় (rate পরে Rate
 * Analysis/Material Database-এ 'door'/'window' category-এর অধীনে
 * বসানো যাবে — material.types.ts-এর MaterialCategory-তে এই দুই
 * category নতুন যোগ করা হয়েছে)।
 */
function generateDoorWindowBOQItems(floor: ReturnType<typeof effectiveArchitecturalQuantities>): BOQItem[] {
  const items: BOQItem[] = []

  if (floor.doorQuantity > 0) {
    items.push({
      id: generateItemId(),
      itemName: `Doors — ${floor.floorLabel}`,
      unit: 'nos',
      quantity: floor.doorQuantity,
      floorId: floor.floorId,
      source: 'auto_doors_windows',
    })
  }
  if (floor.windowQuantity > 0) {
    items.push({
      id: generateItemId(),
      itemName: `Windows — ${floor.floorLabel}`,
      unit: 'nos',
      quantity: floor.windowQuantity,
      floorId: floor.floorId,
      source: 'auto_doors_windows',
    })
  }

  return items
}

/**
 * Stair — audit gap #3। stairDimensions এখন পর্যন্ত সবসময়
 * undefined (Structural app wire না হওয়া পর্যন্ত, structural-mapper.ts
 * দ্রষ্টব্য) — কিন্তু ব্যবহারকারী manual override দিয়ে
 * stairDimensions বসালে এই ফাংশন সাথে সাথেই কাজ করবে, BOQ service-এ
 * আর কিছু বদলাতে হবে না।
 */
function generateStairBOQItems(floor: ReturnType<typeof effectiveStructuralQuantities>): BOQItem[] {
  const volumeM3 = getStairVolumeM3(floor.stairDimensions)
  if (volumeM3 <= 0) return []

  const items: BOQItem[] = [
    {
      id: generateItemId(),
      itemName: `RCC (Stair — Waist Slab & Landing) — ${floor.floorLabel}`,
      unit: 'm3',
      quantity: round2(volumeM3),
      floorId: floor.floorId,
      source: 'auto_stair',
      notes: floor.stairDimensions ? `${floor.stairDimensions.numberOfFlights} flight(s)` : undefined,
    },
  ]

  const reinforcementKg = floor.stairDimensions?.stairReinforcementKg ?? 0
  if (reinforcementKg > 0) {
    items.push({
      id: generateItemId(),
      itemName: `Reinforcement (Stair) — ${floor.floorLabel}`,
      unit: 'kg',
      quantity: round2(reinforcementKg),
      floorId: floor.floorId,
      source: 'auto_stair',
    })
  }

  return items
}

// ═══════════════════════════════════════════════════════════════
// ２０２৬-０৮-２０ যোগ — Electrical ও Plumbing & Sanitary BOQ generator
// (audit gap #1: "Electrical/Plumbing — সবগুলো — কোনো কোড নেই")
// ═══════════════════════════════════════════════════════════════
//
// এই দুটো generateBOQFromQuantityTakeoff()-এর মতো StoredQuantityTakeoff
// থেকে আসে না — Electrical/Plumbing সম্পূর্ণ আলাদা Firestore document
// (electrical.firestore.ts/plumbing.firestore.ts, manual-entry
// module, upstream auto-source নেই বলে electrical.types.ts-এর
// file-header কমেন্ট দ্রষ্টব্য)। তাই আলাদা ফাংশন, caller
// (BOQGenerator.tsx) উভয় generator-এর আউটপুট একসাথে merge করবে।

const ELECTRICAL_CATEGORY_LABEL: Record<ElectricalItemCategory, string> = {
  lighting_point: 'Lighting Point',
  socket_point: 'Socket Point',
  switch_point: 'Switch Point',
  fan_point: 'Fan Point',
  db_unit: 'Distribution Board (DB)',
  earthing_point: 'Earthing Point',
  exhaust_fan_point: 'Exhaust Fan Point',
  ac_point: 'AC Point',
}

/**
 * StoredElectrical.points — একই floor+category-র একাধিক row থাকতে
 * পারে (ব্যবহারকারী আলাদা সময়ে যোগ করেছেন এমন), তাই BOQ-তে পাঠানোর
 * আগে floor+category জোড়া অনুযায়ী group করে quantity যোগ করা হয় —
 * নাহলে BOQ-তে একই লাইন-আইটেম একাধিকবার আলাদা সারিতে দেখাত।
 */
export function generateElectricalBOQItems(electrical: StoredElectrical | null): BOQItem[] {
  if (!electrical) return []
  const items: BOQItem[] = []

  const grouped = new Map<string, { floorId?: string; category: ElectricalItemCategory; quantity: number }>()
  for (const point of electrical.points) {
    if (point.quantity <= 0) continue
    const key = `${point.floorId ?? 'none'}::${point.category}`
    const existing = grouped.get(key)
    if (existing) {
      existing.quantity += point.quantity
    } else {
      grouped.set(key, { floorId: point.floorId, category: point.category, quantity: point.quantity })
    }
  }

  for (const { floorId, category, quantity } of grouped.values()) {
    items.push({
      id: generateItemId(),
      itemName: `${ELECTRICAL_CATEGORY_LABEL[category]}${floorId ? ` — ${floorId}` : ''}`,
      unit: ELECTRICAL_CATEGORY_UNIT[category],
      quantity: round2(quantity),
      floorId,
      source: 'auto_electrical',
    })
  }

  for (const run of electrical.cableRuns) {
    if (run.lengthM <= 0) continue
    items.push({
      id: generateItemId(),
      itemName: `Cable — ${run.description} (${run.cableSizeSqmm} sqmm)`,
      unit: 'm',
      quantity: round2(run.lengthM),
      floorId: run.floorId,
      source: 'auto_electrical',
      notes: run.notes,
    })
  }

  return items
}

const PLUMBING_FIXTURE_LABEL: Record<PlumbingFixtureCategory, string> = {
  wc: 'Water Closet (WC)',
  basin: 'Wash Basin',
  shower: 'Shower',
  floor_drain: 'Floor Drain',
  kitchen_sink: 'Kitchen Sink',
  bib_cock: 'Bib Cock (Tap)',
  geyser_point: 'Geyser Point',
}

const PIPE_TYPE_LABEL: Record<string, string> = {
  water_supply: 'Water Supply Pipe',
  drainage: 'Drainage Pipe',
  soil_waste: 'Soil & Waste Pipe',
}

/**
 * generateElectricalBOQItems()-এর একই floor+category গ্রুপিং নীতি,
 * fixture-এর জন্য।
 */
export function generatePlumbingBOQItems(plumbing: StoredPlumbing | null): BOQItem[] {
  if (!plumbing) return []
  const items: BOQItem[] = []

  const grouped = new Map<string, { floorId?: string; category: PlumbingFixtureCategory; quantity: number }>()
  for (const fixture of plumbing.fixtures) {
    if (fixture.quantity <= 0) continue
    const key = `${fixture.floorId ?? 'none'}::${fixture.category}`
    const existing = grouped.get(key)
    if (existing) {
      existing.quantity += fixture.quantity
    } else {
      grouped.set(key, { floorId: fixture.floorId, category: fixture.category, quantity: fixture.quantity })
    }
  }

  for (const { floorId, category, quantity } of grouped.values()) {
    items.push({
      id: generateItemId(),
      itemName: `${PLUMBING_FIXTURE_LABEL[category]}${floorId ? ` — ${floorId}` : ''}`,
      unit: 'nos',
      quantity: round2(quantity),
      floorId,
      source: 'auto_plumbing',
    })
  }

  for (const pipe of plumbing.pipeRuns) {
    if (pipe.lengthM <= 0) continue
    items.push({
      id: generateItemId(),
      itemName: `${PIPE_TYPE_LABEL[pipe.pipeType]} — ${pipe.diameterMm}mm`,
      unit: 'm',
      quantity: round2(pipe.lengthM),
      floorId: pipe.floorId,
      source: 'auto_plumbing',
      notes: pipe.notes,
    })
  }

  return items
}


export function createCustomBOQItem(input: {
  itemName: string
  unit: BOQItem['unit']
  quantity: number
  notes?: string
}): BOQItem {
  return {
    id: generateItemId(),
    itemName: input.itemName,
    unit: input.unit,
    quantity: input.quantity,
    source: 'manual',
    notes: input.notes,
  }
}

export interface BOQValidationResult {
  valid: boolean
  errors: string[]
}

export function validateBOQItem(input: { itemName: string; quantity: number }): BOQValidationResult {
  const errors: string[] = []
  if (!input.itemName || input.itemName.trim().length === 0) {
    errors.push('Item-এর নাম খালি রাখা যাবে না।')
  }
  if (input.quantity <= 0) {
    errors.push(`Quantity অবশ্যই শূন্যের বেশি হতে হবে (দেওয়া হয়েছে: ${input.quantity})।`)
  }
  return { valid: errors.length === 0, errors }
}

/**
 * পুরো BOQ-এর মোট quantity unit অনুযায়ী গ্রুপ করে যোগফল দেয় —
 * Module 1 (Dashboard)-এর Cost Breakdown Chart-এ কাজে লাগবে যখন
 * সেটা বানানো হবে।
 */
export function summarizeBOQByUnit(items: BOQItem[]): Record<string, number> {
  const summary: Record<string, number> = {}
  for (const item of items) {
    summary[item.unit] = (summary[item.unit] ?? 0) + item.quantity
  }
  return summary
}
