// lib/services/quantity-takeoff.service.ts
//
// একই validation philosophy অনুসরণ করে যা hub-native-sync.ts/
// hub-import.firestore.ts এর buildingInfo/bnbcSettings sync-এ ব্যবহৃত
// হয় — required field check, sanity warning (error না) অস্বাভাবিক
// মানের জন্য। কোড ডুপ্লিকেট না করে সরাসরি আলাদা রাখা হয়েছে কারণ
// QuantityTakeoffExport-এর শেপ HubExportPayload থেকে যথেষ্ট আলাদা
// (floor-ভিত্তিক array বনাম flat object) — এই মুহূর্তে abstraction
// বানানো premature হবে দুটো import-type দিয়ে। এই ফাইল এখনো ম্যানুয়াল
// JSON import (QuantityImportPanel.tsx) সার্ভ করে, কারণ Structural
// quantity-এর producer-side (EngineX-Structural থেকে
// hub.saveModuleData('structural', ...)) এখনো তৈরি হয়নি —
// buildingInfo/bnbcSettings-এর মতো automatic হওয়ার আগে সেই producer-
// side লাগবে (connection-registry.ts-এর
// structural-to-estimating-quantity এন্ট্রি দ্রষ্টব্য)।

import {
  QuantityTakeoffExport,
  ArchitecturalFloorQuantities,
  StructuralFloorQuantities,
  StructuralElementDimensions,
  QuantityLineItem,
  StoredQuantityTakeoff,
  EarthworkQuantities,
  MasonryWallSegment,
  FinishingQuantities,
  StairQuantities,
} from '@/lib/types/quantity-takeoff.types'

export interface QuantityImportResult {
  success: boolean
  payload?: QuantityTakeoffExport
  errors: string[]
  warnings: string[]
}

const REQUIRED_ARCH_FIELDS: (keyof ArchitecturalFloorQuantities)[] = [
  'floorId',
  'floorLabel',
  'wallLengthFt',
  'wallAreaSqft',
  'floorAreaSqft',
  'ceilingAreaSqft',
  'paintAreaSqft',
  'doorQuantity',
  'windowQuantity',
]

// টপ-লেভেল ফিল্ড — এখন footings/columns/beams/slabs array, dimension
// নিজে না (সেটা আলাদাভাবে validateStructuralElements()-এ চেক হয়)
const REQUIRED_STRUCT_FIELDS: (keyof StructuralFloorQuantities)[] = [
  'floorId',
  'floorLabel',
  'footings',
  'columns',
  'beams',
  'slabs',
  'stairQuantity',
  'reinforcementQuantityKg',
]

const REQUIRED_ELEMENT_FIELDS: (keyof StructuralElementDimensions)[] = [
  'elementId',
  'lengthFt',
  'widthFt',
  'depthFt',
  'count',
]

const STRUCT_ELEMENT_ARRAY_KEYS: (keyof StructuralFloorQuantities)[] = [
  'footings',
  'columns',
  'beams',
  'slabs',
]

/**
 * একটা floor-এর footings/columns/beams/slabs array-গুলোর ভেতরের
 * প্রতিটা element dimension সম্পূর্ণ ও সংখ্যাসূচকভাবে বৈধ কিনা যাচাই
 * করে। footings-এর জন্য খালি array বৈধ (উপরের floor-এ কোনো footing
 * না থাকতে পারে), কিন্তু columns/beams/slabs খালি হলে সেটা সন্দেহজনক
 * — একটা floor-এ কোনো কলাম/বিম/স্ল্যাব না থাকা অস্বাভাবিক।
 */
function validateStructuralElements(
  floor: Record<string, unknown>,
  floorIndex: number,
  errors: string[],
  warnings: string[]
): void {
  for (const key of STRUCT_ELEMENT_ARRAY_KEYS) {
    const arr = floor[key]
    if (!Array.isArray(arr)) {
      // এটা REQUIRED_STRUCT_FIELDS চেকেই ধরা পড়বে (undefined হলে),
      // কিন্তু array না হয়ে অন্য কিছু (যেমন number) হলে এখানে আলাদা
      // করে ধরা দরকার
      errors.push(`structuralFloors[${floorIndex}].${key} একটা array হওয়া উচিত।`)
      continue
    }

    if (arr.length === 0 && key !== 'footings') {
      warnings.push(
        `structuralFloors[${floorIndex}].${key} খালি — এই floor-এ কোনো ${key} নেই এটা কি ঠিক?`
      )
    }

    arr.forEach((el: unknown, elIndex: number) => {
      const elObj = el as Record<string, unknown>
      const missing = REQUIRED_ELEMENT_FIELDS.filter(
        (f) => elObj[f] === undefined || elObj[f] === null
      )
      if (missing.length > 0) {
        errors.push(
          `structuralFloors[${floorIndex}].${key}[${elIndex}]-এ এই ফিল্ড অনুপস্থিত: ${missing.join(', ')}`
        )
        return
      }

      const dims = elObj as unknown as StructuralElementDimensions
      if (dims.lengthFt <= 0 || dims.widthFt <= 0 || dims.depthFt <= 0) {
        warnings.push(
          `structuralFloors[${floorIndex}].${key}[${elIndex}] (${dims.elementId})-এ কোনো dimension শূন্য বা কম — volume calculation ভুল হবে।`
        )
      }
      if (dims.count <= 0) {
        warnings.push(
          `structuralFloors[${floorIndex}].${key}[${elIndex}] (${dims.elementId})-এ count শূন্য বা কম — এই element BOQ-তে যোগ হবে না।`
        )
      }
    })
  }
}

export function parseQuantityTakeoffExport(rawJson: string): QuantityImportResult {
  const errors: string[] = []
  const warnings: string[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    return {
      success: false,
      errors: ['এই ফাইল/টেক্সট valid JSON না।'],
      warnings: [],
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { success: false, errors: ['JSON-টা object হওয়া দরকার।'], warnings: [] }
  }

  const payload = parsed as Partial<QuantityTakeoffExport>

  if (!payload.projectId) {
    errors.push('projectId অনুপস্থিত — এটা কি সঠিক export ফাইল?')
  }

  if (!Array.isArray(payload.architecturalFloors) || payload.architecturalFloors.length === 0) {
    errors.push(
      'architecturalFloors খালি বা অনুপস্থিত — Architectural app-এ কমপক্ষে একটা floor-এর ডেটা থাকা দরকার।'
    )
  }

  if (!Array.isArray(payload.structuralFloors) || payload.structuralFloors.length === 0) {
    errors.push(
      'structuralFloors খালি বা অনুপস্থিত — Structural app-এ কমপক্ষে একটা floor-এর ডেটা থাকা দরকার।'
    )
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings }
  }

  // প্রতিটা floor entry-তে required field আছে কিনা
  payload.architecturalFloors!.forEach((floor, i) => {
    const floorObj = floor as unknown as Record<string, unknown>
    const missing = REQUIRED_ARCH_FIELDS.filter(
      (f) => floorObj[f] === undefined || floorObj[f] === null
    )
    if (missing.length > 0) {
      errors.push(`architecturalFloors[${i}]-এ এই ফিল্ড অনুপস্থিত: ${missing.join(', ')}`)
    }
  })

  payload.structuralFloors!.forEach((floor, i) => {
    const floorObj = floor as unknown as Record<string, unknown>
    const missing = REQUIRED_STRUCT_FIELDS.filter(
      (f) => floorObj[f] === undefined || floorObj[f] === null
    )
    if (missing.length > 0) {
      errors.push(`structuralFloors[${i}]-এ এই ফিল্ড অনুপস্থিত: ${missing.join(', ')}`)
    }
  })

  if (errors.length > 0) {
    return { success: false, errors, warnings }
  }

  // এখন element-level dimension validation — REQUIRED_STRUCT_FIELDS
  // চেকের পরেই করা হচ্ছে, কারণ এটা ধরে নেয় footings/columns/beams/
  // slabs array হিসেবে অন্তত exist করে
  payload.structuralFloors!.forEach((floor, i) => {
    validateStructuralElements(floor as unknown as Record<string, unknown>, i, errors, warnings)
  })

  if (errors.length > 0) {
    return { success: false, errors, warnings }
  }

  // sanity checks — নেগেটিভ বা শূন্য quantity সাধারণত ভুল ইঙ্গিত করে,
  // কিন্তু hard error না কারণ কিছু ক্ষেত্রে বৈধ হতে পারে (যেমন
  // architecturalFloors-এ wallAreaSqft শূন্য)
  payload.architecturalFloors!.forEach((floor, i) => {
    const f = floor as unknown as ArchitecturalFloorQuantities
    if (f.wallAreaSqft <= 0) {
      warnings.push(`architecturalFloors[${i}] (${f.floorLabel})-এ wallAreaSqft শূন্য বা কম — যাচাই করুন।`)
    }
  })

  // floorId ডুপ্লিকেট চেক — একই floor দুইবার থাকলে পরে aggregate
  // করার সময় ভুল হিসাব হবে
  const archFloorIds = payload.architecturalFloors!.map((f) => (f as ArchitecturalFloorQuantities).floorId)
  const duplicateArchIds = archFloorIds.filter((id, i) => archFloorIds.indexOf(id) !== i)
  if (duplicateArchIds.length > 0) {
    errors.push(`architecturalFloors-এ ডুপ্লিকেট floorId পাওয়া গেছে: ${[...new Set(duplicateArchIds)].join(', ')}`)
  }

  const structFloorIds = payload.structuralFloors!.map((f) => (f as StructuralFloorQuantities).floorId)
  const duplicateStructIds = structFloorIds.filter((id, i) => structFloorIds.indexOf(id) !== i)
  if (duplicateStructIds.length > 0) {
    errors.push(`structuralFloors-এ ডুপ্লিকেট floorId পাওয়া গেছে: ${[...new Set(duplicateStructIds)].join(', ')}`)
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings }
  }

  const validated: QuantityTakeoffExport = {
    version: '1.0',
    exportedAt: payload.exportedAt ?? new Date().toISOString(),
    projectId: payload.projectId!,
    sourceArchitecturalVersion: payload.sourceArchitecturalVersion,
    sourceStructuralVersion: payload.sourceStructuralVersion,
    architecturalFloors: payload.architecturalFloors as ArchitecturalFloorQuantities[],
    structuralFloors: payload.structuralFloors as StructuralFloorQuantities[],
  }

  return { success: true, payload: validated, errors: [], warnings }
}

/**
 * যাচাই হওয়া export-কে StoredQuantityTakeoff-এ রূপান্তর করে —
 * প্রতিটা floor entry raw হিসেবে wrap করা হয়, override ছাড়া
 * (প্রথমবার import-এ কোনো override থাকে না)।
 */
export function toStoredQuantityTakeoff(payload: QuantityTakeoffExport): StoredQuantityTakeoff {
  return {
    projectId: payload.projectId,
    importedAt: Date.now(),
    architecturalFloors: payload.architecturalFloors.map(
      (raw): QuantityLineItem<ArchitecturalFloorQuantities> => ({ raw, isOverridden: false })
    ),
    structuralFloors: payload.structuralFloors.map(
      (raw): QuantityLineItem<StructuralFloorQuantities> => ({ raw, isOverridden: false })
    ),
    // hub-module-import.ts-এর duplicate-save guard এই দুটো ফিল্ড
    // persist করা আছে ধরে নিয়েই কাজ করে (StoredQuantityTakeoff-এর
    // নিজস্ব কমেন্ট দ্রষ্টব্য) — আগে এই ফাংশন এই ফিল্ড দুটো drop করে
    // ফেলত, যার ফলে guard কখনো সঠিকভাবে কাজ করত না।
    sourceArchitecturalVersion: payload.sourceArchitecturalVersion,
    sourceStructuralVersion: payload.sourceStructuralVersion,
  }
}

// ═══════════════════════════════════════════════════════════════
// Volume calculation — Module 3 (BOQ Generator)-এর মূল ভিত্তি
// ═══════════════════════════════════════════════════════════════
//
// Structural app raw dimension (length/width/depth, ft-এ) পাঠাবে —
// volume calculate করা Estimating app-এর দায়িত্ব (ব্যবহারকারীর
// নিশ্চিতকরণ অনুযায়ী)। এখানে সেই calculation, সাথে ft³ → m³ রূপান্তর
// (BOQ সাধারণত m³-এ হয়, original doc-এর BOQ table-এও m³ ব্যবহৃত)।

export const CUBIC_FT_TO_CUBIC_M = 0.0283168

/**
 * একটা একক element-type-এর dimension থেকে মোট volume (m³) বের করে।
 * count দিয়ে গুণ করা হয় কারণ একই dimension-এর একাধিক element থাকতে
 * পারে (যেমন 4টা একই সাইজের কর্নার কলাম)।
 */
export function calculateElementVolumeM3(element: StructuralElementDimensions): number {
  const volumeFt3 = element.lengthFt * element.widthFt * element.depthFt * element.count
  return volumeFt3 * CUBIC_FT_TO_CUBIC_M
}

/**
 * একটা element-array (যেমন সব column) এর মোট volume (m³) — একাধিক
 * ভিন্ন dimension-এর element থাকলে সবগুলোর যোগফল।
 */
export function calculateTotalVolumeM3(elements: StructuralElementDimensions[]): number {
  return elements.reduce((sum, el) => sum + calculateElementVolumeM3(el), 0)
}

export interface FloorVolumeSummary {
  floorId: string
  floorLabel: string
  footingVolumeM3: number
  columnVolumeM3: number
  beamVolumeM3: number
  slabVolumeM3: number
  totalRccVolumeM3: number // footing + column + beam + slab — original doc-এর BOQ table-এ "RCC" একটাই আইটেম, উপাদান-ভিত্তিক আলাদা না
}

/**
 * একটা floor-এর সব structural element-এর volume summary — BOQ
 * Generator (Module 3) সরাসরি এই ফাংশনের আউটপুট ব্যবহার করবে RCC
 * আইটেম বানাতে।
 */
export function summarizeFloorVolumes(floor: StructuralFloorQuantities): FloorVolumeSummary {
  const footingVolumeM3 = calculateTotalVolumeM3(floor.footings)
  const columnVolumeM3 = calculateTotalVolumeM3(floor.columns)
  const beamVolumeM3 = calculateTotalVolumeM3(floor.beams)
  const slabVolumeM3 = calculateTotalVolumeM3(floor.slabs)

  return {
    floorId: floor.floorId,
    floorLabel: floor.floorLabel,
    footingVolumeM3,
    columnVolumeM3,
    beamVolumeM3,
    slabVolumeM3,
    totalRccVolumeM3: footingVolumeM3 + columnVolumeM3 + beamVolumeM3 + slabVolumeM3,
  }
}

// ═══════════════════════════════════════════════════════════════
// ২০২৬-০৮-২০ সম্প্রসারণ — Earthwork/Masonry/Finishing/Stair volume
// (CivilOS-Report-Audit.md gap #2 ও #3-এর সমাধান)
// ═══════════════════════════════════════════════════════════════
//
// এই ফাংশনগুলো সবসময় "থাকলে হিসাব করো, না থাকলে শূন্য/undefined
// রিটার্ন করো" প্যাটার্ন মেনে চলে — কারণ EarthworkQuantities/
// masonryWalls/finishing/stairDimensions সবই optional (উপরের
// types-এর নোট দ্রষ্টব্য: পুরনো export বা এখনো Structural থেকে না
// আসা field-এর জন্য এই auto-calc silently skip হবে, crash না করে)।

export const SQFT_TO_SQM = 0.092903
export const SQIN_TO_SQFT = 1 / 144 // ইঞ্চি-thickness × sqft area থেকে ft³ বের করতে ব্যবহৃত হয় না সরাসরি — নিচের brick volume হিসাবে thicknessIn/12 ব্যবহার করা হয়েছে, এই কনস্ট্যান্ট রাখা হলো ভবিষ্যতের sqin হিসাবের জন্য

export interface EarthworkVolumeSummary {
  excavationVolumeM3: number
  backfillVolumeM3: number
  disposalVolumeM3: number
}

/**
 * excavation volume = area × depth (ft³ → m³)। backfill ও disposal
 * volume সেই মোট excavation-এর percentage হিসেবে (EarthworkQuantities
 * নিজেই সেই percentage বহন করে, কারণ এটা মাটির ধরন/ফাউন্ডেশন ডিজাইন
 * অনুযায়ী প্রজেক্ট-ভেদে পাল্টায়, একটা fixed constant না)।
 */
export function calculateEarthworkVolumes(earthwork: EarthworkQuantities): EarthworkVolumeSummary {
  const excavationVolumeFt3 = earthwork.excavationAreaSqft * earthwork.excavationDepthFt
  const excavationVolumeM3 = excavationVolumeFt3 * CUBIC_FT_TO_CUBIC_M
  const backfillVolumeM3 = excavationVolumeM3 * (earthwork.backfillPercentOfExcavation / 100)
  const disposalVolumeM3 = excavationVolumeM3 * (earthwork.disposalPercentOfExcavation / 100)
  return { excavationVolumeM3, backfillVolumeM3, disposalVolumeM3 }
}

/**
 * একটা wall segment-এর brick masonry volume (m³) — gross wall area
 * (length × height) থেকে opening deduction বাদ দিয়ে, thickness
 * (ইঞ্চি → ফুট রূপান্তর করে) দিয়ে গুণ করে volume।
 */
export function calculateWallVolumeM3(wall: MasonryWallSegment): number {
  const grossAreaSqft = wall.lengthFt * wall.heightFt
  const netAreaSqft = Math.max(0, grossAreaSqft - wall.openingDeductionSqft)
  const thicknessFt = wall.thicknessIn / 12
  const volumeFt3 = netAreaSqft * thicknessFt
  return volumeFt3 * CUBIC_FT_TO_CUBIC_M
}

export interface MasonryVolumeSummary {
  externalWallVolumeM3: number
  internalWallVolumeM3: number
  parapetWallVolumeM3: number
  totalMasonryVolumeM3: number
}

/**
 * একটা floor-এর সব wall segment-কে wallType অনুযায়ী গ্রুপ করে volume
 * summary — BOQ-তে "Brick Work (External)"/"Brick Work (Internal)"/
 * "Brick Work (Parapet)" আলাদা লাইন-আইটেম হিসেবে দেখানোর জন্য (দেশীয়
 * BOQ practice-এ প্রচলিত grouping, যেহেতু rate ভিন্ন হতে পারে)।
 */
export function summarizeMasonryVolumes(walls: MasonryWallSegment[]): MasonryVolumeSummary {
  let externalWallVolumeM3 = 0
  let internalWallVolumeM3 = 0
  let parapetWallVolumeM3 = 0

  for (const wall of walls) {
    const volumeM3 = calculateWallVolumeM3(wall)
    if (wall.wallType === 'external') externalWallVolumeM3 += volumeM3
    else if (wall.wallType === 'internal') internalWallVolumeM3 += volumeM3
    else parapetWallVolumeM3 += volumeM3
  }

  return {
    externalWallVolumeM3,
    internalWallVolumeM3,
    parapetWallVolumeM3,
    totalMasonryVolumeM3: externalWallVolumeM3 + internalWallVolumeM3 + parapetWallVolumeM3,
  }
}

/**
 * Finishing area-কে sqft থেকে sqm-এ রূপান্তর করে দেয় (BOQ-তে
 * Plaster/Tiles/Paint/Ceiling সাধারণত m²-এ পরিমাপ হয়, RCC-এর মতোই
 * m³ প্যাটার্ন অনুসরণ করে ধারাবাহিকতা রাখা হয়েছে)। কোনো নতুন হিসাব
 * নেই এখানে, শুধু একক রূপান্তর — তাই এটা BOQ service নিজেই সরাসরি
 * করতে পারত, কিন্তু আলাদা named function রাখা হলো যাতে unit-conversion
 * লজিক একটাই জায়গায় থাকে (calculateElementVolumeM3-এর মতো একই নীতি)।
 */
export interface FinishingAreaSummarySqm {
  internalPlasterAreaSqm: number
  externalPlasterAreaSqm: number
  tilesAreaSqm: number
  paintAreaSqm: number
  ceilingAreaSqm: number
  waterproofingAreaSqm: number
}

export function convertFinishingToSqm(finishing: FinishingQuantities): FinishingAreaSummarySqm {
  return {
    internalPlasterAreaSqm: finishing.internalPlasterAreaSqft * SQFT_TO_SQM,
    externalPlasterAreaSqm: finishing.externalPlasterAreaSqft * SQFT_TO_SQM,
    tilesAreaSqm: finishing.tilesAreaSqft * SQFT_TO_SQM,
    paintAreaSqm: finishing.paintAreaSqft * SQFT_TO_SQM,
    ceilingAreaSqm: finishing.ceilingAreaSqft * SQFT_TO_SQM,
    waterproofingAreaSqm: finishing.waterproofingAreaSqft * SQFT_TO_SQM,
  }
}

/**
 * Stair concrete volume — StairQuantities.waistSlabVolumeM3 সরাসরি
 * m³-এ আসে (Structural app থেকে wire হলে সেই app-ই ft→m রূপান্তর
 * করে পাঠাবে, structural-mapper.ts-এর নীতি অনুযায়ী), তাই এখানে আলাদা
 * কোনো রূপান্তর নেই — শুধু undefined-safe accessor, BOQ service-এ
 * সরাসরি `floor.stairDimensions?.waistSlabVolumeM3 ?? 0` লেখার বদলে
 * একটা named function থাকলে ভবিষ্যতে হিসাব জটিল হলে (যেমন waist
 * slab vs landing আলাদা করতে হলে) একটাই জায়গায় বদলানো যাবে।
 */
export function getStairVolumeM3(stair: StairQuantities | undefined): number {
  return stair?.waistSlabVolumeM3 ?? 0
}
