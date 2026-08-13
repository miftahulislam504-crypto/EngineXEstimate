// lib/integration/architectural-mapper.ts
//
// ইনপুট: ArchitecturalModuleData (lib/types/module-data.types.ts — Hub-এর
// zip থেকে verbatim কপি করা)।
//
// EngineXDraw এখন hub.saveOwnModuleData() দিয়ে সত্যিকারের schedule ডেটা
// পাঠায় (apps/web/src/lib/hub/hub-schedule-export.ts, buildScheduleExport())
// — নিচের RoomScheduleRow/WallScheduleRow/FloorAreaRow shape সেই ফাইলের
// field-নাম ও একক (মিটার) থেকে সরাসরি verify করে বসানো, আর কোনো অনুমান
// না। Draw-এর ভবিষ্যৎ কোনো পরিবর্তনে এই field-নাম বদলালে (rename/একক
// পরিবর্তন), শুধু এই ফাইলের normalize* ফাংশন ও নিচের row-shape আপডেট
// করলেই হবে — bare-minimum pipeline অপরিবর্তিত থাকবে।
//
// door/windowSchedule-এ শুধু floorId/id লাগে (শুধু count দরকার) — Draw
// এই দুটোকে wallId/tag/width/height/sillHeight সহ পাঠায়, কিন্তু এই
// mapper সেই বাড়তি field ব্যবহার করে না, তাই OpeningScheduleRow-তে
// শুধু ব্যবহৃত অংশটুকু রাখা হয়েছে।

import type { ArchitecturalModuleData } from '@/lib/types/module-data.types'
import type { ArchitecturalFloorQuantities } from '@/lib/types/quantity-takeoff.types'

// ─── প্রকৃত producer shape (EngineXDraw এর apps/web/src/lib/hub/
// hub-schedule-export.ts, buildScheduleExport() — field-নাম ও একক এই
// সংযুক্ত জিপ থেকে সরাসরি verify করা, অনুমান না) ───────────────────
//
// Draw মিটারে পাঠায় (areaSqm/lengthM/height — height ইতিমধ্যেই মিটার,
// আলাদা "heightM" নাম নেই), এই ফাইলের ব্যবহারকারী-মুখী আউটপুট
// (ArchitecturalFloorQuantities) ft-ভিত্তিক (Bangladesh construction
// practice অনুযায়ী quantity-takeoff.types.ts জুড়েই) — তাই normalize
// ফাংশনেই conversion হয়, ব্যবহারকারীর কাছে raw মিটার পৌঁছায় না।
const SQM_TO_SQFT = 10.7639
const M_TO_FT = 3.28084

interface RoomScheduleRow {
  id?: string
  floorId?: string
  areaSqm?: number
}
interface WallScheduleRow {
  id?: string
  floorId?: string
  lengthM?: number
  height?: number
}
interface OpeningScheduleRow {
  id?: string
  floorId?: string
}
interface FloorAreaRow {
  floorId?: string
  floorName?: string
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
 * করে), কিন্তু warning যোগ করে।
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
      const floorLabel = asStr(f.floorName) ?? floorId

      const roomsHere = roomRows.filter((r) => r.floorId === floorId)
      const wallsHere = wallRows.filter((w) => w.floorId === floorId)
      const doorsHere = doorRows.filter((d) => d.floorId === floorId)
      const windowsHere = windowRows.filter((w) => w.floorId === floorId)

      const floorAreaSqft = roomsHere.reduce((sum, r) => sum + (asNum(r.areaSqm) ?? 0) * SQM_TO_SQFT, 0)
      const wallLengthFt = wallsHere.reduce((sum, w) => sum + (asNum(w.lengthM) ?? 0) * M_TO_FT, 0)
      const wallAreaSqft = wallsHere.reduce(
        (sum, w) => sum + (asNum(w.lengthM) ?? 0) * (asNum(w.height) ?? 0) * SQM_TO_SQFT,
        0,
      )

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
