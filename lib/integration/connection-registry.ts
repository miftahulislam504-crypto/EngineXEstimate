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
    label: 'Hub → Estimating: Building Info + BNBC Settings (manual export)',
    direction: 'upstream',
    counterpartApp: 'CivilOS Hub',
    dataDescription: 'buildingInfo (BuildingExport) ও bnbcSettings (BNBCExport) — Module 2/4/7-এর হিসাবের ভিত্তি',
    firestorePath: 'projects/{projectId}/estimatingInput/hubImports/{importId} (আমাদের নিজের versioned copy) + activeImport (pointer)',
    isPathConfirmed: true, // এটা আমাদেরই path — Hub-এর সাথে সমন্বয়ের দরকার নেই, শুধু Hub যেন এখানে লিখতে পারে (বা আমরা manual import করে এখানে সেভ করি)
    schemaVersion: '1.0',
    status: 'manual', // Hub এখনো এই path-এ সরাসরি লেখে না — HubExportPayload (Hub-এর lib/types/integration.types.ts) এখনো শুধু downloadJSON()/copyToClipboard() দিয়ে বের হয়
    relatedModules: ['Module 2', 'Module 4', 'Module 7'],
    notes:
      'Hub-এর zip পরীক্ষা করে verify করা (2026-07-17): lib/services/integration.service.ts-এ generateExportPayload() আছে কিন্তু কোনো Firestore write নেই, শুধু client-side JSON/clipboard। civilos_bridge collection Hub নিজেই deprecated ঘোষণা করেছে।',
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
    firestorePath: '(ডেটা payload path প্রস্তাবিত, চূড়ান্ত হয়নি) — তবে version/dependency/approval tracking-এর জন্য Hub SDK-এর confirmed path (projects/{projectId}/versions/structural ইত্যাদি) ব্যবহার হবে, যেহেতু \'structural\' ইতিমধ্যে Hub-এর ModuleId তালিকায় আছে',
    isPathConfirmed: false,
    schemaVersion: 'proposed-draft',
    status: 'planned', // Structural app নিজেই এখনো তৈরি হয়নি
    relatedModules: ['Module 2', 'Module 3', 'Module 7'],
    notes: 'বর্তমান fallback: manual JSON import (QuantityImportPanel), একই EstimatingRelevantPayload-শৈলীর ভ্যালিডেশন নিয়ে। Structural app চালু হলে Estimating নিজের linkOwnDependency() দিয়ে এই dependency link করবে।',
  },
  {
    id: 'architectural-to-estimating-quantity',
    label: 'Architectural → Estimating: Wall/Floor/Ceiling/Paint Quantity',
    direction: 'upstream',
    counterpartApp: 'CivilOS Architectural (Design)',
    dataDescription: 'floor-ভিত্তিক wall length/area, floor area, ceiling area, paint area, door/window count — Module 2-এর architectural অংশ',
    firestorePath: '(ডেটা payload path প্রস্তাবিত, চূড়ান্ত হয়নি) — version/dependency tracking Hub SDK-এর confirmed path ব্যবহার করবে (\'architectural\' Hub-এর ModuleId তালিকায় আছে)',
    isPathConfirmed: false,
    schemaVersion: 'proposed-draft',
    status: 'planned',
    relatedModules: ['Module 2', 'Module 3'],
    notes: 'বর্তমান fallback: manual JSON import (একই QuantityImportPanel, architecturalFloors অংশ)।',
  },
  {
    id: 'estimating-to-budget-boq',
    label: 'Estimating → Budget: BOQ (with rates)',
    direction: 'downstream',
    counterpartApp: 'CivilOS Estimating (নিজস্ব — Module 3 → Module 10 আন্তঃ-app না, আন্তঃ-Module)',
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
