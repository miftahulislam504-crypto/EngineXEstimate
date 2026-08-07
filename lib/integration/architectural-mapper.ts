// lib/integration/architectural-mapper.ts
//
// ইনপুট: ArchitecturalModuleData (lib/types/module-data.types.ts — Hub-এর
// 2026-08-05 zip থেকে verbatim কপি করা, MODULE_DATA_SYNC_NOTES.md
// দ্রষ্টব্য)। এই ইন্টারফেসের প্রতিটা schedule/quantity field আজ
// `unknown` টাইপে — কারণ Hub-এর নিজস্ব নোট অনুযায়ী "কোন app-এর ভেতরের
// actual data shape এখনো জানা নেই... যখন সেই app-এর কোড দেখা হবে, এই
// unknown গুলো আসল interface দিয়ে replace করা উচিত।"
//
// অর্থাৎ এই mapper **আজ কোনো real data দিয়ে test করা সম্ভব না** —
// EngineXDraw আজ পর্যন্ত `hub.saveModuleData()` কল করে না (Hub-এর
// নিজের নোট + আমাদের নিজস্ব যাচাই দুটোই একমত: EngineXDraw এখনো পুরনো
// moduleMetadata/Storage pattern-এই আছে)। তাই নিচের row-shape
// (RoomScheduleRow ইত্যাদি) একটা **সুনির্দিষ্ট অনুমান**, EngineXDraw-এর
// প্রকৃত schedule export কোডের ওপর ভিত্তি করে না — Architectural app-এর
// পক্ষ থেকে সত্যিকারের saveModuleData() কল আসার পর, এই ফাইলের
// normalize* ফাংশনগুলোই একমাত্র জায়গা যা বদলাতে হবে (নিচের bare-minimum
// pipeline অপরিবর্তিত থাকবে)।
//
// ধরে নেওয়া shape (নির্মাণ-চর্চার সাধারণ schedule টেবিল অনুযায়ী):
//   roomSchedule?:   { id, floorId, name, areaSqft }[]
//   wallSchedule?:   { id, floorId, lengthFt, heightFt }[]
//   doorSchedule?:   { id, floorId }[]   (শুধু count দরকার, তাই শুধু floorId)
//   windowSchedule?: { id, floorId }[]
//   floorAreas?:     { floorId, floorLabel }[]  (floor list, area না — শুধু কোন floor আছে জানার জন্য)
//
// ─── একক ───────────────────────────────────────────────────────────
// ধরে নেওয়া হয়েছে upstream থেকে এমনিতেই ফুট/বর্গফুটে আসবে (Hub-এর
// module-data.types.ts এককের ব্যাপারে কিছু বলে না, কিন্তু
// quantity-takeoff.types.ts-এর ArchitecturalFloorQuantities-ও ft-ভিত্তিক
// — দুটো app-ই বাংলাদেশ নির্মাণ চর্চা অনুসরণ করে বলে একই একক ধরে
// নেওয়া স্বাভাবিক)। যদি প্রকৃত producer মিটারে পাঠায়, এই ফাইলে
// SQM_TO_SQFT/M_TO_FT গুণক যোগ করতে হবে normalize ফাংশনে।

import type { ArchitecturalModuleData } from '@/lib/types/module-data.types'
import type { ArchitecturalFloorQuantities } from '@/lib/types/quantity-takeoff.types'

interface RoomScheduleRow {
  id?: string
  floorId?: string
  areaSqft?: number
}
interface WallScheduleRow {
  id?: string
  floorId?: string
  lengthFt?: number
  heightFt?: number
}
interface OpeningScheduleRow {
  id?: string
  floorId?: string
}
interface FloorAreaRow {
  floorId?: string
  floorLabel?: string
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}
function asNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}
function asStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

export interface ArchitecturalMapResult {
  floors: ArchitecturalFloorQuantities[]
  warnings: string[]
}

/**
 * ArchitecturalModuleData.data-কে floor-ভিত্তিক
 * ArchitecturalFloorQuantities[]-এ রূপান্তর করে। কোনো schedule field
 * অনুপস্থিত/খালি থাকলে সেই অংশ শূন্য ধরে হিসাব চালিয়ে যায় (crash না
 * করে), কিন্তু warning যোগ করে — যেহেতু producer এখনো নেই, প্রায়
 * নিশ্চিতভাবেই সব field আজ খালি থাকবে, এবং সেটাই এই ফাংশনের প্রত্যাশিত,
 * স্বাভাবিক আজকের ফলাফল।
 */
export function mapArchitecturalModuleDataToFloors(data: ArchitecturalModuleData): ArchitecturalMapResult {
  const warnings: string[] = []

  const floorAreaRows = asArray(data.floorAreas) as FloorAreaRow[]
  const roomRows = asArray(data.roomSchedule) as RoomScheduleRow[]
  const wallRows = asArray(data.wallSchedule) as WallScheduleRow[]
  const doorRows = asArray(data.doorSchedule) as OpeningScheduleRow[]
  const windowRows = asArray(data.windowSchedule) as OpeningScheduleRow[]

  if (floorAreaRows.length === 0) {
    warnings.push('Architectural module data-তে floorAreas পাওয়া যায়নি — কোনো floor চিহ্নিত করা যায়নি।')
    return { floors: [], warnings }
  }

  const floors: ArchitecturalFloorQuantities[] = floorAreaRows
    .map((f) => {
      const floorId = asStr(f.floorId)
      if (!floorId) {
        warnings.push('floorAreas-এর একটা এন্ট্রিতে floorId নেই — সেই floor বাদ দেওয়া হয়েছে।')
        return null
      }
      const floorLabel = asStr(f.floorLabel) ?? floorId

      const roomsHere = roomRows.filter((r) => r.floorId === floorId)
      const wallsHere = wallRows.filter((w) => w.floorId === floorId)
      const doorsHere = doorRows.filter((d) => d.floorId === floorId)
      const windowsHere = windowRows.filter((w) => w.floorId === floorId)

      const floorAreaSqft = roomsHere.reduce((sum, r) => sum + (asNum(r.areaSqft) ?? 0), 0)
      const wallLengthFt = wallsHere.reduce((sum, w) => sum + (asNum(w.lengthFt) ?? 0), 0)
      const wallAreaSqft = wallsHere.reduce((sum, w) => sum + (asNum(w.lengthFt) ?? 0) * (asNum(w.heightFt) ?? 0), 0)

      if (roomsHere.length === 0) warnings.push(`Floor "${floorLabel}"-এ roomSchedule entry পাওয়া যায়নি — floorAreaSqft শূন্য।`)
      if (wallsHere.length === 0) warnings.push(`Floor "${floorLabel}"-এ wallSchedule entry পাওয়া যায়নি — wallLengthFt/wallAreaSqft শূন্য।`)

      // ceilingAreaSqft/paintAreaSqft-এর জন্য ArchitecturalModuleData-তে
      // কোনো সরাসরি field নেই (finishSchedule/ceilingSchedule আছে কিন্তু
      // shape এখনো অজানা) — তাই room area থেকে heuristic derive করা
      // হচ্ছে, quantity-takeoff.types.ts-এর override path দিয়ে
      // ব্যবহারকারী পরে নির্দিষ্ট করে দিতে পারবেন।
      const ceilingAreaSqft = floorAreaSqft
      const paintAreaSqft = wallAreaSqft + ceilingAreaSqft

      const result: ArchitecturalFloorQuantities = {
        floorId,
        floorLabel,
        wallLengthFt,
        wallAreaSqft,
        floorAreaSqft,
        ceilingAreaSqft,
        paintAreaSqft,
        doorQuantity: doorsHere.length,
        windowQuantity: windowsHere.length,
      }
      return result
    })
    .filter((f): f is ArchitecturalFloorQuantities => f !== null)

  return { floors, warnings }
}
