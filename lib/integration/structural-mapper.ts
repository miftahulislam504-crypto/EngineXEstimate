// lib/integration/structural-mapper.ts
//
// ইনপুট: StructuralModuleData (lib/types/module-data.types.ts)। ঠিক
// architectural-mapper.ts-এর মতোই — প্রতিটা field আজ `unknown`, কারণ
// EngineX-Structural আজ পর্যন্ত `hub.saveModuleData()` কল করে না (এই
// App-এর src/lib/hub/-এ যা আছে তা সম্পূর্ণ ভিন্ন, deprecated
// hubSync/incoming-outgoing pattern — কোনো UI থেকে call হয় না, যাচাই
// করা হয়েছে)। এই mapper-ও তাই আজ কোনো real data দিয়ে exercise হয় না।
//
// ধরে নেওয়া shape — এখানে গুরুত্বপূর্ণ একটা ভিন্নতা
// architectural-mapper.ts থেকে: Hub-এর নতুন moduleData pattern
// "structured field data" বহন করে, raw geometry না (module-data.types.ts-এর
// নিজস্ব design note: "STRUCTURED FIELD data (BOQ, schedules,
// quantities...)")। তাই এখানে ধরে নেওয়া হয়েছে Structural app নিজেই
// element geometry (footing width/length/thickness ইত্যাদি, যেগুলো
// element.ts-এ mm এককে) থেকে ফুটে-রূপান্তরিত, group-করা quantities
// বানিয়ে পাঠাবে — raw mm/m geometry এখানে আসবে না, unit-conversion এই
// mapper-এর দায়িত্ব না (আগের ভার্সনে ছিল, এই নতুন pattern-এ producer
// app নিজেই সেই কাজ করে পাঠাবে)।
//
//   foundationQuantities?:     { floorId, footings: StructuralElementDimensions[] }[]
//   beamColumnSlabQuantities?: { floorId, columns: [...], beams: [...], slabs: [...] }[]
//   reinforcementQuantities?:  { floorId, totalKg: number }[]
//
// এই তিনটা আলাদা field আলাদা schedule হিসেবে ধরা হয়েছে (Hub-এর তালিকায়
// এরা পৃথক আইটেম হিসেবেই আছে — "Foundation Quantities",
// "Beam/Column/Slab Quantities", "Reinforcement Quantities" আলাদা লাইন)।
// stairQuantity-এর মতো ছোট, কম-গুরুত্বপূর্ণ ফিল্ডের জন্য কোনো নির্দিষ্ট
// module-data field ধরা হয়নি (0 ডিফল্ট, override দিয়ে ব্যবহারকারী
// বসাতে পারবেন — যেমন আগের ভার্সনেও ছিল)।

import type { StructuralModuleData } from '@/lib/types/module-data.types'
import type {
  StructuralElementDimensions,
  StructuralFloorQuantities,
  EarthworkQuantities,
  StairQuantities,
} from '@/lib/types/quantity-takeoff.types'

interface DimensionRow {
  elementId?: string
  lengthFt?: number
  widthFt?: number
  depthFt?: number
  count?: number
}
interface FoundationRow {
  floorId?: string
  footings?: DimensionRow[]
  // ২০২৬-০৮-২০ — Earthwork BOQ auto-generate করতে দরকার (audit gap #2)।
  // foundationQuantities-এর সাথেই রাখা হলো কারণ excavation সবসময়
  // foundation/footing-এর ওপর ভিত্তি করেই হয় — একই producer app,
  // একই floor entry-তে ধরা যুক্তিসঙ্গত (আলাদা module-data field না
  // বাড়িয়ে)।
  excavationAreaSqft?: number
  excavationDepthFt?: number
  backfillPercentOfExcavation?: number
  disposalPercentOfExcavation?: number
}
interface BeamColumnSlabRow {
  floorId?: string
  columns?: DimensionRow[]
  beams?: DimensionRow[]
  slabs?: DimensionRow[]
  // ২০২৬-০৮-২০ — কোন floor "roof floor" (RoofFlags দ্রষ্টব্য,
  // quantity-takeoff.types.ts)। beamColumnSlabQuantities-এর সাথেই
  // রাখা হলো কারণ এটা slabs array-এর একটা metadata, আলাদা কিছু না।
  isRoofFloor?: boolean
}
interface ReinforcementRow {
  floorId?: string
  totalKg?: number
}
// ২০২৬-০৮-২০ — future-ready placeholder (module-data.types.ts-এর
// StructuralModuleData.stairQuantities নোট দ্রষ্টব্য)। EngineX-Structural
// আজ পর্যন্ত এই shape পাঠায় না — Structural app যেদিন wire করবে
// (hub.saveModuleData-এ stairQuantities যোগ করবে), এই mapper সেটা
// স্বয়ংক্রিয়ভাবে StructuralFloorQuantities.stairDimensions-এ বসিয়ে
// দেবে, Estimating-এর আর কোনো কোড বদলাতে হবে না।
interface StairRow {
  floorId?: string
  waistSlabVolumeM3?: number
  stairReinforcementKg?: number
  numberOfFlights?: number
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}
function asNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function normalizeDimensions(rows: DimensionRow[] | undefined, floorLabel: string, kind: string, warnings: string[]): StructuralElementDimensions[] {
  if (!rows || rows.length === 0) return []
  return rows
    .map((r, i) => {
      const lengthFt = asNum(r.lengthFt)
      const widthFt = asNum(r.widthFt)
      const depthFt = asNum(r.depthFt)
      if (lengthFt === undefined || widthFt === undefined || depthFt === undefined) {
        warnings.push(`Floor "${floorLabel}"-এর একটা ${kind} entry-তে dimension অসম্পূর্ণ — বাদ দেওয়া হয়েছে।`)
        return null
      }
      const dim: StructuralElementDimensions = {
        elementId: r.elementId ?? `${kind}-${i + 1}`,
        lengthFt,
        widthFt,
        depthFt,
        count: asNum(r.count) ?? 1,
      }
      return dim
    })
    .filter((d): d is StructuralElementDimensions => d !== null)
}

export interface StructuralMapResult {
  floors: StructuralFloorQuantities[]
  warnings: string[]
}

/**
 * StructuralModuleData.data-কে floor-ভিত্তিক StructuralFloorQuantities[]-এ
 * রূপান্তর করে। floor-এর তালিকা foundationQuantities/
 * beamColumnSlabQuantities/reinforcementQuantities — তিনটা array-এর
 * union floorId থেকে বানানো হয় (কোনো একটা field-এ একটা floor না থাকলেও
 * বাকি দুটোতে থাকতে পারে বলে)।
 */
/**
 * FoundationRow-এর excavation field থেকে EarthworkQuantities বানায়
 * — চারটা field-ই থাকলে তবেই একটা বৈধ EarthworkQuantities হয়
 * (আংশিক ডেটা দিয়ে ভুল volume হিসাব করার চেয়ে undefined রাখা
 * নিরাপদ, BOQ service সেই floor-এর Earthwork auto-item স্কিপ করবে)।
 */
function normalizeEarthwork(row: FoundationRow | undefined, floorLabel: string, warnings: string[]): EarthworkQuantities | undefined {
  if (!row) return undefined
  const excavationAreaSqft = asNum(row.excavationAreaSqft)
  const excavationDepthFt = asNum(row.excavationDepthFt)
  const backfillPercentOfExcavation = asNum(row.backfillPercentOfExcavation)
  const disposalPercentOfExcavation = asNum(row.disposalPercentOfExcavation)

  if (
    excavationAreaSqft === undefined ||
    excavationDepthFt === undefined ||
    backfillPercentOfExcavation === undefined ||
    disposalPercentOfExcavation === undefined
  ) {
    // এই floor-এ excavation field একেবারেই না থাকা স্বাভাবিক (উপরের
    // floor-এ সাধারণত excavation নেই) — তাই শুধু আংশিকভাবে দেওয়া
    // থাকলেই warning দেওয়া হচ্ছে, সম্পূর্ণ অনুপস্থিত থাকলে না
    const anyProvided = [excavationAreaSqft, excavationDepthFt, backfillPercentOfExcavation, disposalPercentOfExcavation].some((v) => v !== undefined)
    if (anyProvided) {
      warnings.push(`Floor "${floorLabel}"-এর excavation ডেটা অসম্পূর্ণ — Earthwork auto-calc স্কিপ করা হয়েছে।`)
    }
    return undefined
  }

  return { excavationAreaSqft, excavationDepthFt, backfillPercentOfExcavation, disposalPercentOfExcavation }
}

/**
 * future-ready — StairRow থেকে StairQuantities। EngineX-Structural
 * আজ পর্যন্ত এই ডেটা পাঠায় না (উপরের StairRow কমেন্ট দ্রষ্টব্য),
 * তাই stairRows সবসময় খালি array হবে এবং এই ফাংশন সবসময় undefined
 * রিটার্ন করবে — কিন্তু Structural app wire হলে অতিরিক্ত কিছু না
 * বদলেই এটা কাজ শুরু করবে।
 */
function normalizeStair(row: StairRow | undefined, floorLabel: string, warnings: string[]): StairQuantities | undefined {
  if (!row) return undefined
  const waistSlabVolumeM3 = asNum(row.waistSlabVolumeM3)
  const stairReinforcementKg = asNum(row.stairReinforcementKg)
  const numberOfFlights = asNum(row.numberOfFlights)

  if (waistSlabVolumeM3 === undefined) {
    warnings.push(`Floor "${floorLabel}"-এর stairQuantities entry-তে waistSlabVolumeM3 নেই — Stair auto-calc স্কিপ করা হয়েছে।`)
    return undefined
  }

  return {
    waistSlabVolumeM3,
    stairReinforcementKg: stairReinforcementKg ?? 0,
    numberOfFlights: numberOfFlights ?? 1,
  }
}

export function mapStructuralModuleDataToFloors(data: StructuralModuleData): StructuralMapResult {
  const warnings: string[] = []

  const foundationRows = asArray(data.foundationQuantities) as FoundationRow[]
  const beamColumnSlabRows = asArray(data.beamColumnSlabQuantities) as BeamColumnSlabRow[]
  const reinforcementRows = asArray(data.reinforcementQuantities) as ReinforcementRow[]
  const stairRows = asArray(data.stairQuantities) as StairRow[] // future-ready, EngineX-Structural wire হওয়ার আগে সবসময় খালি

  const floorIds = new Set<string>()
  for (const r of foundationRows) if (r.floorId) floorIds.add(r.floorId)
  for (const r of beamColumnSlabRows) if (r.floorId) floorIds.add(r.floorId)
  for (const r of reinforcementRows) if (r.floorId) floorIds.add(r.floorId)
  for (const r of stairRows) if (r.floorId) floorIds.add(r.floorId)

  if (floorIds.size === 0) {
    warnings.push('Structural module data-তে কোনো floorId পাওয়া যায়নি (foundationQuantities/beamColumnSlabQuantities/reinforcementQuantities সবই খালি বা অনুপস্থিত)।')
    return { floors: [], warnings }
  }

  const floors: StructuralFloorQuantities[] = Array.from(floorIds).map((floorId) => {
    const floorLabel = floorId // module-data shape-এ floor label আলাদা নেই এই মুহূর্তে — Architectural-এর floorAreas.floorLabel-এর মতো কিছু এখানে নেই
    const foundation = foundationRows.find((r) => r.floorId === floorId)
    const bcs = beamColumnSlabRows.find((r) => r.floorId === floorId)
    const reinf = reinforcementRows.find((r) => r.floorId === floorId)
    const stair = stairRows.find((r) => r.floorId === floorId)

    if (!foundation) warnings.push(`Floor "${floorLabel}"-এ foundationQuantities পাওয়া যায়নি — footings খালি।`)
    if (!bcs) warnings.push(`Floor "${floorLabel}"-এ beamColumnSlabQuantities পাওয়া যায়নি — columns/beams/slabs খালি।`)
    if (!reinf) warnings.push(`Floor "${floorLabel}"-এ reinforcementQuantities পাওয়া যায়নি — reinforcementQuantityKg শূন্য।`)

    return {
      floorId,
      floorLabel,
      footings: normalizeDimensions(foundation?.footings, floorLabel, 'footing', warnings),
      columns: normalizeDimensions(bcs?.columns, floorLabel, 'column', warnings),
      beams: normalizeDimensions(bcs?.beams, floorLabel, 'beam', warnings),
      slabs: normalizeDimensions(bcs?.slabs, floorLabel, 'slab', warnings),
      stairQuantity: 0, // module-data shape-এ stair count নেই — override দিয়ে ব্যবহারকারী বসাতে পারবেন
      reinforcementQuantityKg: asNum(reinf?.totalKg) ?? 0,
      earthwork: normalizeEarthwork(foundation, floorLabel, warnings),
      stairDimensions: normalizeStair(stair, floorLabel, warnings), // আজ সবসময় undefined, future-ready
      roof: bcs?.isRoofFloor ? { isRoofFloor: true } : undefined,
    }
  })

  return { floors, warnings }
}
