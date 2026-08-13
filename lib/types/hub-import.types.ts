// lib/types/hub-import.types.ts
//
// এই ফাইলের প্রতিটা interface CivilOS Hub-এর
// lib/types/integration.types.ts থেকে হুবহু মিলিয়ে রাখা হয়েছে।
// Hub-এর schema বদলালে এই ফাইলও বদলাতে হবে — দুই জায়গায় শেপ আলাদা
// হয়ে গেলে import silently ভুল data দেবে, কোনো error ছাড়াই।
//
// Estimating app শুধু buildingInfo আর bnbcSettings ব্যবহার করে
// (TARGET_APPS['estimating'].needs অনুযায়ী)। siteInfo টাইপ সামঞ্জস্যের
// জন্য রাখা হলো, কিন্তু আমরা এটা read করি না।

export interface HubExportPayload {
  version: '1.0'
  exportedAt: string // ISO date
  projectId: string
  projectCode: string
  projectName: string

  siteInfo?: SiteInfoExport
  bnbcSettings?: BNBCExport
  buildingInfo?: BuildingExport
  projectSettings?: ProjectSettingsExport
}

export interface SiteInfoExport {
  address: string
  district: string
  upazila: string
  latitude?: number
  longitude?: number
  plotArea?: number
  plotAreaUnit?: string
  plotAreaSqm?: number
  roadWidth?: number
  soilType: string
  groundLevel?: number
  floodLevel?: number
  groundwaterDepth?: number
}

export interface BNBCExport {
  occupancyType: string
  riskCategory: string
  seismicZone: string
  seismicZoneCoeff: number // Z
  importanceFactor: number // I
  windZone: string
  basicWindSpeed: number // km/h
  liveLoadType: string
  liveLoadValue: number // kN/m² — Module 2/7-এর লোড-ভিত্তিক হিসাবে লাগবে
  soilType: string
  spectralAcceleration: number // Ss
  responseModFactor: number // R
  structuralSystem: string
  seismicCs: number // Cs = Ss×I/R
}

export interface BuildingExport {
  buildingType: string
  usageType: string
  structureSystem: string
  numFloors: number
  basementCount: number
  floorHeight: number
  groundFloorHeight: number
  totalHeight: number
  roofType: string
  buildingLength?: number
  buildingWidth?: number
  totalFloorArea?: number
  hasLift: boolean
  hasGenerator: boolean
  hasWaterTank: boolean
  hasParkingFloor: boolean
}

// Ported from Hub's lib/types/project-settings.types.ts (ProjectSettings)
// — trimmed to the fields that file's own comment identifies as
// Estimating's: "currency, taxVat, contingencyOverhead". designCode/
// unitSystem (shared with Structural/Architectural) and Structural's
// concreteGrade/reinforcementGrade/structuralSteelGrade are NOT
// included — Estimating has no current use for them (same "only carry
// what you read" reasoning the BuildingExport/BNBCExport subset above
// already follows).
export interface ProjectSettingsExport {
  currency: string
  vatPercent: number
  taxPercent: number
  contingencyPercent: number
  overheadPercent: number
  profitPercent: number
}

// ─── Estimating app-এর নিজস্ব দরকারি সাবসেট ─────────────────────────
// buildExportPayload() থেকে siteInfo বাদ দিয়ে শুধু আমাদের অংশ বের করার
// জন্য এই হেল্পার টাইপ। এটা ব্যবহার করলে বাকি কোডে সবখানে "as
// BuildingExport | undefined" চেক লিখতে হবে না।
//
// projectSettings ইচ্ছাকৃতভাবে Required-এর বাইরে (শুধু Pick, buildingInfo/
// bnbcSettings-এর মতো নয়) — Hub-এর project_settings/data document
// migration-এর আগে তৈরি হওয়া পুরনো export JSON-এ এই field থাকবে না,
// আর সেই পুরনো JSON import করাও বৈধ থাকা উচিত (শুধু Currency/VAT/
// Contingency ফাঁকা থাকবে, বাকি সব আগের মতোই কাজ করবে)।
export type EstimatingRelevantPayload = Required<
  Pick<HubExportPayload, 'buildingInfo' | 'bnbcSettings'>
> &
  Pick<HubExportPayload, 'version' | 'exportedAt' | 'projectId' | 'projectCode' | 'projectName' | 'projectSettings'>

// ─── Import validation ফলাফল ─────────────────────────────────────────
export interface HubImportResult {
  success: boolean
  payload?: EstimatingRelevantPayload
  errors: string[]
  warnings: string[]
}
