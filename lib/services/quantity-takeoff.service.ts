// lib/services/quantity-takeoff.service.ts
//
// hub-import.service.ts-এর একই validation philosophy অনুসরণ করে —
// required field check, sanity warning (error না) অস্বাভাবিক মানের
// জন্য। কোড ডুপ্লিকেট না করে সরাসরি আলাদা রাখা হয়েছে কারণ
// QuantityTakeoffExport-এর শেপ HubExportPayload থেকে যথেষ্ট আলাদা
// (floor-ভিত্তিক array বনাম flat object) — এই মুহূর্তে abstraction
// বানানো premature হবে দুটো import-type দিয়ে।

import {
  QuantityTakeoffExport,
  ArchitecturalFloorQuantities,
  StructuralFloorQuantities,
  StructuralElementDimensions,
  QuantityLineItem,
  StoredQuantityTakeoff,
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
    const floorObj = floor as unknown as Record<string, unknown>
    const missing = REQUIRED_ARCH_FIELDS.filter(
      (f) => floorObj[f] === undefined || floorObj[f] === null
    )
    if (missing.length > 0) {
      errors.push(`architecturalFloors[${i}]-এ এই ফিল্ড অনুপস্থিত: ${missing.join(', ')}`)
    }
  })

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
