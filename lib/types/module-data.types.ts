// lib/types/module-data.types.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// MODULE DATA SYNC — real-time ecosystem data exchange
// ═══════════════════════════════════════════════════════════════════════════
// এই ফাইল Hub আর ecosystem app (EngineXDraw/Architectural, Structural,
// Estimating, Project Management) এর মধ্যে যে ডেটা যাওয়া-আসা করবে তার shape
// define করে। এখনো কোনো app আসলে এই shape পাঠায় না — এটা শুধু contract,
// যাতে app গুলো যখন wire হবে, নাম/shape নিয়ে অনুমান করতে না হয়। (ঠিক
// event.types.ts-এর ১৯টা future event vocabulary-র মতোই pattern।)
//
// DESIGN: module-level blob (granular field-per-document না)। কারণ:
//  - Hub-এর existing moduleMetadata pattern এর সাথেই মেলে, নতুন কিছু
//    আবিষ্কার করা হয়নি।
//  - একটা batch save সব field একসাথে আপডেট করে — atomic, out-of-sync
//    হওয়ার সুযোগ নেই।
//  - একটাই write path, একটাই listener — সরল।
//
// প্রতিটা field optional, কারণ producing app হয়তো একবারে সবটা পাঠাবে না —
// ধাপে ধাপে (partial save) পাঠাতে পারবে, `saveModuleData` merge:true দিয়ে
// write করে।
// ═══════════════════════════════════════════════════════════════════════════

import { ModuleId } from './dependency.types'
import { SourceApp } from './contract.types'

// ─── Architectural (EngineXDraw থেকে) ──────────────────────────────────────
export interface ArchitecturalModuleData {
  // Schedules / quantities
  floorAreas?: unknown
  roomSchedule?: unknown
  wallSchedule?: unknown
  doorSchedule?: unknown
  windowSchedule?: unknown
  finishSchedule?: unknown
  ceilingSchedule?: unknown
  stairSchedule?: unknown
  rampSchedule?: unknown
  roofSchedule?: unknown
  siteDevelopment?: unknown
  landscapeQuantities?: unknown

  // Drawing settings / geometry references
  architecturalDrawingSettings?: unknown
  grid?: unknown
  levels?: unknown
  columnLocations?: unknown
  wallLocations?: unknown
  slabBoundaries?: unknown
  openings?: unknown
  stairGeometry?: unknown
  roofGeometry?: unknown
  floorLoadsDeadLoadSource?: unknown
  shaftOpenings?: unknown

  // Aggregated quantities
  allArchitecturalQuantities?: unknown
  finishQuantities?: unknown
  doorWindowQuantities?: unknown
  areaStatements?: unknown
  roomData?: unknown

  // PM-facing summary fields
  workBreakdownByFloor?: unknown
  zoneInformation?: unknown
  drawingStatus?: unknown
  revisionStatus?: unknown
  constructionSequenceReference?: unknown
  floorWiseWorkBreakdown?: unknown
  roomList?: unknown
  spaceList?: unknown
  area?: unknown
  elevation?: unknown
  drawingRevision?: unknown
  milestonesArchitectural?: unknown
}

// ─── Structural (Structural app থেকে) ──────────────────────────────────────
export interface StructuralModuleData {
  concreteQuantities?: unknown
  reinforcementQuantities?: unknown
  formworkQuantities?: unknown
  excavationQuantities?: unknown
  backfillQuantities?: unknown
  foundationQuantities?: unknown
  beamColumnSlabQuantities?: unknown
  structuralSteelQuantities?: unknown
  shopDrawingRevision?: unknown
  wasteFactors?: unknown
  /** ২০২৬-০৮-২০ যোগ করা — future-ready placeholder। EngineX-Structural-এ
   * stair design module কাজ চলছে (waist slab + landing beam continuous
   * analysis, rcSlabFlexure.ts পুনর্ব্যবহার করে flexural design) কিন্তু
   * এই মুহূর্তে সেই app কোনো stair geometry/quantity Hub-এ publish করে
   * না। ধরে নেওয়া shape (Structural app যেদিন wire করবে):
   *   { floorId: string, waistSlabVolumeM3: number,
   *     stairReinforcementKg: number, numberOfFlights: number }[]
   * এই field যোগ হলে structural-mapper.ts-এর mapStructuralModuleDataToFloors()
   * শুধু এই একটা নতুন array read করলেই StructuralFloorQuantities.stairDimensions
   * populate হয়ে যাবে — Estimating-এর আর কিছু বদলাতে হবে না
   * (quantity-takeoff.types.ts-এর StairQuantities-এর নোট দ্রষ্টব্য)। */
  stairQuantities?: unknown

  bbs?: unknown
  materialSummary?: unknown
  structuralActivities?: unknown
  castingSequence?: unknown
  structuralMilestones?: unknown
  shopDrawingStatus?: unknown
  inspectionStages?: unknown
  materialDemand?: unknown
  foundationSequence?: unknown
  inspectionStatus?: unknown
  designRevision?: unknown
}

// ─── Estimate & BOQ (Estimating app থেকে) ──────────────────────────────────
export interface EstimatingModuleData {
  boq?: unknown
  activityWiseCost?: unknown
  materialRequirement?: unknown
  labourRequirement?: unknown
  equipmentRequirement?: unknown
  procurementList?: unknown
  budget?: unknown
  cashFlow?: unknown
  rateAnalysis?: unknown
  vendorInformation?: unknown

  finalBoq?: unknown
  approvedQuantities?: unknown
  materialDemand?: unknown
  labourDemand?: unknown
  equipmentDemand?: unknown
  procurementPlan?: unknown
  costBaseline?: unknown
  costForecast?: unknown
  paymentStatus?: unknown
}

// ─── Project Management ────────────────────────────────────────────────────
// লক্ষ্য করার বিষয়: PM-এর বেশিরভাগ ডেটা আসলে Architectural/Structural/
// Estimating থেকে read-only পাওয়া (Hub এদের নিজেদের moduleData থেকেই
// PM-কে দেখাবে) — এই ইন্টারফেসে শুধু PM-নিজস্ব নতুন ফিল্ড।
export interface ProjectMgmtModuleData {
  organizationStructure?: unknown
  resourceLibrary?: unknown
  costLibrary?: unknown
  calendar?: unknown
  workingHours?: unknown
  holidays?: unknown
}

// ─── Union / envelope ──────────────────────────────────────────────────────
export type ModuleDataPayload =
  | ArchitecturalModuleData
  | StructuralModuleData
  | EstimatingModuleData
  | ProjectMgmtModuleData

// `projects/{projectId}/moduleData/{moduleId}` — একটা document প্রতি module।
export interface ModuleDataRecord<T = Record<string, unknown>> {
  moduleId: ModuleId
  sourceApp: SourceApp
  data: T
  version: number       // dependency.firestore.ts এর versions/{moduleId} এর সাথে সবসময় sync
  updatedAt: string      // ISO
}
