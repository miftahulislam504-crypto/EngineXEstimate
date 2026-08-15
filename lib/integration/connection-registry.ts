// lib/integration/connection-registry.ts
//
// Module 15 — এই ফাইলটাই "data contract ঠিক করা প্রতিটা connection
// point-এ" sub-task-এর বাস্তবায়ন। মূল doc-এর data flow diagram-
// অনুযায়ী প্রতিটা arrow একটা ConnectionPoint entry।
//
// এটা একটা static registry (কোনো Firestore read লাগে না) — কারণ
// "কোন connection কী schema/path ব্যবহার করে" এটা কোডের অংশ, রানটাইম
// ডেটা না। সত্যিকারের রানটাইম status (sync log) আলাদা
// (lib/firestore/sync-log.firestore.ts)।
//
// ── 2026-07-17 আপডেট: Hub-এর প্রকৃত কোড (zip) পরীক্ষা করে সংশোধন ──
// Hub-এর নিজস্ব Phase 6 "Hub SDK" (lib/hub-sdk.ts) থাকায় এই registry
// এখন speculative path-এর বদলে verified, real path ব্যবহার করে:
//   - projects/{projectId}/versions/{moduleId}      (dependency.firestore.ts)
//   - projects/{projectId}/dependencies/{depId}      (dependency.firestore.ts)
//   - projects/{projectId}/approvals/{moduleId}      (approval.firestore.ts)
//   - projects/{projectId}/events/{eventId}          (event.firestore.ts, realtime)
// আগে ধরে নেওয়া 'civilos_bridge' collection Hub নিজেই deprecated
// ঘোষণা করেছে (firestore.rules-এর কমেন্ট, Phase 1-এ) — এখানে সেই
// রেফারেন্স বাদ দেওয়া হয়েছে।
//
// এছাড়া 'reports' একটা পৃথক deployed app না — এটা Hub-এর নিজস্ব
// Report Center (Phase 7, lib/types/report.types.ts)। contract.types.ts-এর
// SourceApp union-এ 'reports' থাকার কারণ শুধু এই: Hub ভবিষ্যতে যদি
// রিপোর্ট-জেনারেশন লজিক আলাদা সার্ভিসে সরায়, সেই সম্ভাবনার জন্য নাম
// সংরক্ষিত — বাস্তবে আজ কোনো "Reports app" আলাদাভাবে চলছে না, তাই এই
// registry-তে এর জন্য কোনো entry নেই।

import { ConnectionPoint } from '@/lib/types/integration-hub.types'

export const CONNECTION_REGISTRY: ConnectionPoint[] = [
  {
    id: 'hub-to-estimating-building-bnbc',
    label: 'Hub → Estimating: Building Info + BNBC Settings (automatic)',
    direction: 'upstream',
    counterpartApp: 'CivilOS Hub',
    dataDescription: 'buildingInfo (BuildingExport) ও bnbcSettings (BNBCExport) — Module 2/4/7-এর হিসাবের ভিত্তি',
    firestorePath:
      'Hub সরাসরি: projects/{projectId}/building_information/data, projects/{projectId}/bnbc_settings/data, projects/{projectId}/project_settings/data (hub-native-sync.ts) → আমাদের নিজের versioned copy: projects/{projectId}/estimatingInput/root/hubImports/{importId} + activeImport (pointer)',
    isPathConfirmed: true, // Hub-এর প্রকৃত কোড থেকে verified (site-info.firestore.ts/building.firestore.ts/bnbc.firestore.ts/project-settings.firestore.ts) — EngineX-Structural ও EngineXProject-এর হুবহু একই verified path
    schemaVersion: '1.0',
    status: 'live', // hub-native-sync.ts সরাসরি Hub-এর document real-time subscribe করে, ম্যানুয়াল import আর নেই
    relatedModules: ['Module 2', 'Module 4', 'Module 7'],
    notes:
      'সংশোধনী ইতিহাস: আগে এই connection সম্পূর্ণ manual ছিল (Hub-এর lib/services/integration.service.ts-এর generateExportPayload() শুধু client-side JSON/clipboard বানাতো, কোনো Firestore write ছিল না — HubImportPanel.tsx এর মাধ্যমে ব্যবহারকারীকে paste/upload করতে হতো)। এখন hub-native-sync.ts Hub-এর real buildingInfo/bnbcSettings/projectSettings document সরাসরি শোনে ও স্বয়ংক্রিয়ভাবে EstimatingRelevantPayload assemble করে hub-import.firestore.ts-এর versioned audit-trail mechanism-এ পাঠায় — ব্যবহারকারীর কোনো action ছাড়াই। civilos_bridge collection Hub নিজেই deprecated ঘোষণা করেছে (firestore.rules-এর কমেন্ট, Phase 1-এ) — এখানে সেই রেফারেন্স নেই।',
  },
  {
    id: 'hub-sdk-version-dependency-estimating',
    label: 'Hub SDK: Estimating Module Version + Dependency Tracking',
    direction: 'upstream',
    counterpartApp: 'CivilOS Hub (Phase 6 SDK)',
    dataDescription:
      "Hub-এর version/dependency/approval system-এ 'estimating' একটা first-class ModuleId — Estimating নিজের version bump করে, buildingInfo/bnbcSettings-এর ওপর dependency link করে, ও নিজের approval status set করে",
    firestorePath: 'projects/{projectId}/versions/estimating, projects/{projectId}/dependencies/estimating__depends_on__*, projects/{projectId}/approvals/estimating',
    isPathConfirmed: true, // Hub-এর প্রকৃত কোড থেকে verified (lib/firestore/dependency.firestore.ts, approval.firestore.ts)
    schemaVersion: '1.0',
    status: 'live', // lib/integration/hub-sdk-client.ts এই path-এ সত্যিই read/write করে
    relatedModules: ['Module 2', 'Module 3', 'Module 4'],
    notes:
      'lib/integration/hub-sdk-client.ts (bumpOwnModuleVersion, linkOwnDependency, isOwnModuleUnlocked, setOwnApprovalStatus) — Hub-এর নিজস্ব ব্যবহৃত collection-গুলোতেই সরাসরি লেখে, কোনো নতুন collection বানায়নি।',
  },
  {
    id: 'hub-sdk-events-realtime',
    label: 'Hub SDK: Real-time Event Stream',
    direction: 'upstream',
    counterpartApp: 'CivilOS Hub (Phase 6 SDK)',
    dataDescription:
      'Hub ও অন্য সব app-এর real-time event (MODULE_VERSION_BUMPED, MODULE_APPROVED ইত্যাদি) — Estimating নিজের event-ও (QUANTITY_CALCULATED, BOQ_GENERATED, COST_CALCULATED) এখানে emit করে',
    firestorePath: 'projects/{projectId}/events/{eventId}',
    isPathConfirmed: true, // Hub-এর lib/firestore/event.firestore.ts থেকে verified
    schemaVersion: '1.0',
    status: 'live', // subscribeToEvents() সত্যিই onSnapshot দিয়ে শোনে; Estimating থেকে emitEvent() সত্যিই লেখে
    relatedModules: ['Module 2', 'Module 3', 'Module 4', 'Module 9'],
  },
  {
    id: 'structural-to-estimating-quantity',
    label: 'Structural → Estimating: Concrete & Rebar Quantity',
    direction: 'upstream',
    counterpartApp: 'CivilOS Structural',
    dataDescription: 'floor-ভিত্তিক footing/column/beam/slab dimension ও reinforcement quantity — Module 2 (Quantity Takeoff)-এর structural অংশ',
    firestorePath: 'projects/{projectId}/moduleData/structural (Hub-এর module-data-sync pattern, 2026-08-05 zip-এ যোগ হয়েছে)',
    isPathConfirmed: true, // Hub-এর lib/types/module-data.types.ts + lib/firestore/module-data-sync.firestore.ts থেকে verified — path ও shape (StructuralModuleData) দুটোই confirmed, যদিও shape-এর ভেতরের field গুলো এখনো unknown (নিচের নোট দেখুন)
    schemaVersion: '1.0',
    status: 'listening', // lib/integration/hub-sdk-client.ts-এর getModuleData()/structural-mapper.ts এই path শুনতে প্রস্তুত, কিন্তু EngineX-Structural আজ পর্যন্ত এখানে কিছু লেখে না (সেই App-এর src/lib/hub/-এ যা আছে সম্পূর্ণ ভিন্ন, deprecated hubSync/incoming-outgoing pattern, কোনো UI থেকে call হয় না — যাচাই করা হয়েছে, 2026-08-06)
    relatedModules: ['Module 2', 'Module 3', 'Module 7'],
    notes:
      'consumer-side সম্পূর্ণ (lib/integration/structural-mapper.ts + hub-module-import.ts)। producer-side বাকি: EngineX-Structural-এর নিজের কোডে hub.saveModuleData(projectId, \'structural\', \'structural\', {foundationQuantities, beamColumnSlabQuantities, reinforcementQuantities, ...}) কল বসাতে হবে — সেটা হলেই এই connection automatically live হয়ে যাবে, Estimating-এর দিকে আর কিছু বদলাতে হবে না। ততক্ষণ manual JSON import (QuantityImportPanel-এর ম্যানুয়াল অংশ) fallback হিসেবে থাকছে।',
  },
  {
    id: 'architectural-to-estimating-quantity',
    label: 'Architectural → Estimating: Wall/Floor/Ceiling/Paint Quantity',
    direction: 'upstream',
    counterpartApp: 'CivilOS Architectural (Design)',
    dataDescription: 'floor-ভিত্তিক wall length/area, floor area, ceiling area, paint area, door/window count — Module 2-এর architectural অংশ',
    firestorePath: 'projects/{projectId}/moduleData/architectural (Hub-এর module-data-sync pattern, 2026-08-05 zip-এ যোগ হয়েছে)',
    isPathConfirmed: true, // path ও shape (ArchitecturalModuleData) দুটোই Hub-এর zip থেকে verified
    schemaVersion: '1.0',
    status: 'live', // architectural-mapper.ts + hub-module-import.ts এই path শোনে, EngineXDraw এখন সরাসরি এখানে লেখে
    relatedModules: ['Module 2', 'Module 3'],
    notes:
      'সংশোধনী ইতিহাস: এই connection আগে "listening" ছিল কারণ EngineXDraw তখন পুরনো moduleMetadata/Storage-file pattern (heavy geometry, BuildingElementRef[]) ব্যবহার করতো, এই structured-field moduleData pattern-এ লেখেনি। EngineXDraw-এর Firebase free plan-এ Storage bucket তৈরি করা যায় না বলে সেই pattern বাস্তবে কখনো কাজ করতো না — এখন EngineXDraw-এর hub-write.ts (publishArchitecturalToHub()) schedule (roomSchedule/wallSchedule/doorSchedule/windowSchedule/floorAreas) ও পূর্ণ geometry দুটোই এই একই moduleData/architectural document-এ pure Firestore-এ লেখে, auto-synced (floor-level Firestore listener + debounce, useArchitecturalAutoSync.ts) — কোনো ম্যানুয়াল বাটন নেই।',
  },
  {
    id: 'estimating-to-budget-boq',
    label: 'Estimating → Budget: BOQ (with rates)',
    direction: 'downstream',
    counterpartApp: 'EngineX Quanta (নিজস্ব — Module 3 → Module 10 আন্তঃ-app না, আন্তঃ-Module)',
    dataDescription: 'BOQ items + Rate Analysis দিয়ে গণনাকৃত মোট cost — Module 10 (Budget)-এর planned amount নির্ধারণে ইনপুট',
    firestorePath: 'projects/{projectId}/estimatingInput/boqVersions/{versionId} + activeBOQVersion',
    isPathConfirmed: true, // এটা একই app-এর ভেতরে (Module 3 → Module 10), তাই "confirmed" — অন্য app-এর সাথে সমন্বয়ের দরকার নেই
    schemaVersion: '1.0',
    status: 'live', // ইতিমধ্যে কার্যকরী — BudgetPanel সরাসরি এই ডেটা পড়ে
    relatedModules: ['Module 3', 'Module 10'],
  },
  {
    id: 'estimating-to-pm-procurement',
    label: 'Budget → Project Management: Procurement Data',
    direction: 'downstream',
    counterpartApp: 'CivilOS Project Management',
    dataDescription: 'Procurement schedule ও material/reinforcement need — PM app-এর জন্য (এখনো তৈরি হয়নি)',
    firestorePath: '(ডেটা payload path প্রস্তাবিত, চূড়ান্ত হয়নি) — version tracking Hub SDK-এর confirmed path ব্যবহার করবে (\'projectmgmt\' Hub-এর ModuleId তালিকায় আছে)',
    isPathConfirmed: false,
    schemaVersion: 'proposed-draft',
    status: 'planned',
    relatedModules: ['Module 8'],
    notes: 'procurement.types.ts-এ ProcurementTimelineEntry টাইপ forward-declared আছে এই কারণেই — PM app-এর schedule/phase data লাগবে যেটা এখনো নেই।',
  },
  {
    id: 'pm-to-estimating-actual-cost',
    label: 'Project Management → Estimating: Actual Cost Update',
    direction: 'upstream',
    counterpartApp: 'CivilOS Project Management',
    dataDescription: 'প্রকৃত labour ও equipment rental খরচ (এই মুহূর্তে Module 11 শুধু material purchase থেকে actual cost গণনা করে, এই gap-টাই সেই কারণ)',
    firestorePath: '(ডেটা payload path প্রস্তাবিত, চূড়ান্ত হয়নি)',
    isPathConfirmed: false,
    schemaVersion: 'proposed-draft',
    status: 'planned',
    relatedModules: ['Module 11'],
    notes: 'CostTrackingPanel-এ actualCostLimitationNote হিসেবে এই সীমাবদ্ধতা ইতিমধ্যে UI-তে জানানো আছে।',
  },
]

export function getConnectionById(id: string): ConnectionPoint | undefined {
  return CONNECTION_REGISTRY.find((c) => c.id === id)
}

export function getConnectionsByStatus(status: ConnectionPoint['status']): ConnectionPoint[] {
  return CONNECTION_REGISTRY.filter((c) => c.status === status)
}
