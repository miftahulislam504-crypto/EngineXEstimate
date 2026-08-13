// lib/services/hub-import.service.ts
//
// Hub থেকে manually export করা JSON (downloadJSON বা copyToClipboard-এর
// মাধ্যমে পাওয়া) পার্স ও ভ্যালিডেট করার জন্য। যতক্ষণ না civilos_bridge
// লাইভ হচ্ছে, এটাই একমাত্র transfer path — তাই ভুল/অসম্পূর্ণ JSON হাতে
// পড়ার সম্ভাবনা বেশি, ভ্যালিডেশন তাই strict রাখা হয়েছে।

import {
  HubExportPayload,
  EstimatingRelevantPayload,
  HubImportResult,
} from '@/lib/types/hub-import.types'

const REQUIRED_BUILDING_FIELDS: (keyof NonNullable<HubExportPayload['buildingInfo']>)[] = [
  'buildingType',
  'usageType',
  'structureSystem',
  'numFloors',
  'basementCount',
  'floorHeight',
  'groundFloorHeight',
  'totalHeight',
  'roofType',
  'hasLift',
  'hasGenerator',
  'hasWaterTank',
  'hasParkingFloor',
]

const REQUIRED_BNBC_FIELDS: (keyof NonNullable<HubExportPayload['bnbcSettings']>)[] = [
  'occupancyType',
  'riskCategory',
  'seismicZone',
  'seismicZoneCoeff',
  'importanceFactor',
  'windZone',
  'basicWindSpeed',
  'liveLoadType',
  'liveLoadValue',
  'soilType',
  'spectralAcceleration',
  'responseModFactor',
  'structuralSystem',
  'seismicCs',
]

// projectSettings (Currency/VAT/Tax/Contingency) — NOT in the required
// list above. Older Hub exports (before project_settings/data existed)
// won't carry this field, and that must still import successfully —
// only a warning, never a blocking error, matching the same
// backward-compatibility reasoning EstimatingRelevantPayload's own
// comment gives for keeping projectSettings out of Required<>.
const REQUIRED_PROJECT_SETTINGS_FIELDS: (keyof NonNullable<HubExportPayload['projectSettings']>)[] = [
  'currency',
  'vatPercent',
  'taxPercent',
  'contingencyPercent',
  'overheadPercent',
  'profitPercent',
]

/**
 * Raw JSON string (ফাইল আপলোড বা paste থেকে) পার্স করে
 * EstimatingRelevantPayload-এ রূপান্তর করে, অথবা কেন ব্যর্থ হলো তার
 * তালিকা ফেরত দেয়।
 */
export function parseHubExport(rawJson: string): HubImportResult {
  const errors: string[] = []
  const warnings: string[] = []

  // ধাপ ১ — এটা আদৌ valid JSON কিনা
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    return {
      success: false,
      errors: ['এই ফাইল/টেক্সট valid JSON না। Hub থেকে আবার export করে দেখুন।'],
      warnings: [],
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      success: false,
      errors: ['JSON-টা object হওয়া দরকার। এটা Hub-এর সঠিক export ফাইল কিনা যাচাই করুন।'],
      warnings: [],
    }
  }

  const payload = parsed as Partial<HubExportPayload>

  // ধাপ ২ — এটা আসলেই Hub-এর export কিনা (version/projectId থাকা উচিত)
  if (payload.version !== '1.0') {
    warnings.push(
      `version ফিল্ড "${payload.version ?? 'নেই'}" — এই code "1.0" এর জন্য বানানো, Hub আপডেট হয়ে থাকলে শেপ মিলতে নাও পারে।`
    )
  }
  if (!payload.projectId || !payload.projectCode || !payload.projectName) {
    errors.push('projectId, projectCode, বা projectName অনুপস্থিত — এটা কি সত্যিই Hub-এর export ফাইল?')
  }

  // ধাপ ৩ — আমাদের যা লাগবে সেই দুইটা অংশ আছে কিনা
  if (!payload.buildingInfo) {
    errors.push(
      'buildingInfo নেই এই export-এ। Hub-এ Building Information ফর্ম পূরণ করে আবার export করতে হবে।'
    )
  }
  if (!payload.bnbcSettings) {
    errors.push(
      'bnbcSettings নেই এই export-এ। Hub-এ BNBC Settings ফর্ম পূরণ করে আবার export করতে হবে।'
    )
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings }
  }

  // ধাপ ৪ — প্রতিটা required field সত্যিই আছে কিনা (আংশিক ফর্ম-পূরণ ধরার জন্য)
  const building = payload.buildingInfo as unknown as Record<string, unknown>
  const missingBuildingFields = REQUIRED_BUILDING_FIELDS.filter(
    (field) => building[field] === undefined || building[field] === null
  )
  if (missingBuildingFields.length > 0) {
    errors.push(
      `buildingInfo-তে এই ফিল্ডগুলো অনুপস্থিত: ${missingBuildingFields.join(', ')} — Hub-এ Building Information ফর্মটা সম্পূর্ণ পূরণ হয়নি।`
    )
  }

  const bnbc = payload.bnbcSettings as unknown as Record<string, unknown>
  const missingBnbcFields = REQUIRED_BNBC_FIELDS.filter(
    (field) => bnbc[field] === undefined || bnbc[field] === null
  )
  if (missingBnbcFields.length > 0) {
    errors.push(
      `bnbcSettings-এ এই ফিল্ডগুলো অনুপস্থিত: ${missingBnbcFields.join(', ')} — Hub-এ BNBC Settings ফর্মটা সম্পূর্ণ পূরণ হয়নি।`
    )
  }

  // projectSettings — soft-optional (see REQUIRED_PROJECT_SETTINGS_FIELDS
  // comment above). Missing entirely -> one warning, not an error.
  // Present but partially filled -> also a warning, since Currency/VAT/
  // Contingency existing-but-incomplete more likely means Hub's
  // Project Settings form was only half filled in, worth flagging.
  if (!payload.projectSettings) {
    warnings.push(
      'projectSettings (Currency/VAT/Tax/Contingency) এই export-এ নেই — Hub-এর Project Settings ফর্ম এখনো পূরণ হয়নি অথবা পুরনো Hub ভার্সনের export। BOQ-তে এই মুহূর্তে ম্যানুয়াল ডিফল্ট (BDT, 15% VAT) ব্যবহার হবে।'
    )
  } else {
    const projectSettings = payload.projectSettings as unknown as Record<string, unknown>
    const missingProjectSettingsFields = REQUIRED_PROJECT_SETTINGS_FIELDS.filter(
      (field) => projectSettings[field] === undefined || projectSettings[field] === null
    )
    if (missingProjectSettingsFields.length > 0) {
      warnings.push(
        `projectSettings-এ এই ফিল্ডগুলো অনুপস্থিত: ${missingProjectSettingsFields.join(', ')} — Hub-এ Project Settings ফর্মটা সম্পূর্ণ পূরণ হয়নি।`
      )
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings }
  }

  // ধাপ ৫ — sanity check: সংখ্যাসূচক ফিল্ড আসলেই সংখ্যা কিনা, আর যুক্তিসঙ্গত রেঞ্জে আছে কিনা
  if (typeof building.numFloors === 'number' && building.numFloors <= 0) {
    warnings.push(`numFloors = ${building.numFloors} — এটা কি ঠিক আছে? সাধারণত ১ বা তার বেশি হওয়া উচিত।`)
  }
  if (typeof bnbc.liveLoadValue === 'number' && bnbc.liveLoadValue <= 0) {
    warnings.push(`liveLoadValue = ${bnbc.liveLoadValue} kN/m² — এটা সন্দেহজনকভাবে কম বা শূন্য।`)
  }

  // এতক্ষণে আমরা নিশ্চিত যে সব required field আছে
  const validated: EstimatingRelevantPayload = {
    version: '1.0',
    exportedAt: payload.exportedAt ?? new Date().toISOString(),
    projectId: payload.projectId!,
    projectCode: payload.projectCode!,
    projectName: payload.projectName!,
    buildingInfo: payload.buildingInfo as EstimatingRelevantPayload['buildingInfo'],
    bnbcSettings: payload.bnbcSettings as EstimatingRelevantPayload['bnbcSettings'],
  }

  return { success: true, payload: validated, errors: [], warnings }
}
