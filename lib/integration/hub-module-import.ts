// lib/integration/hub-module-import.ts
//
// আগে এই ফাইলে শুধু prepareHubImport() ছিল (one-shot fetch, UI বাটনে
// ক্লিকে কল হতো)। ব্যবহারকারীর সিদ্ধান্ত অনুযায়ী পুরো ecosystem
// পুরোপুরি automatic হওয়া উচিত — কোনো app-এ ডেটা বদলালে অন্য app-এ
// active ভাবে (ক্লিক ছাড়া) প্রতিফলিত হবে। তাই এখন এই ফাইলে তিনটা স্তর:
//
//   1. buildQuantityTakeoffFromRecords() — pure ফাংশন, ModuleDataRecord
//      দুটো (architectural+structural) থেকে validated
//      QuantityTakeoffExport বানায়। কোনো Firestore call নেই এখানে —
//      one-shot ও live দুটো path-ই এই একই ফাংশন পুনর্ব্যবহার করে,
//      যাতে mapping/validation logic দুই জায়গায় duplicate না হয়।
//
//   2. prepareHubImport() — one-shot (getModuleData), UI-তে "এখনই
//      আবার চেষ্টা করুন" ধরনের manual refresh/retry বাটনের জন্য এখনো
//      রাখা হয়েছে (যেমন auto-sync ব্যর্থ হলে ব্যবহারকারী নিজে থেকে
//      retry করতে চাইতে পারেন) — কিন্তু এটা আর প্রধান পথ না।
//
//   3. subscribeToHubQuantityAutoSync() — প্রধান পথ। Architectural ও
//      Structural দুটো moduleData-ই subscribeToModuleData() দিয়ে
//      live শোনে। যখনই যেকোনো একটার version বদলায় (upstream app নতুন
//      করে publish করলে), pure builder চালিয়ে, validate সফল হলে
//      নিজেই saveQuantityTakeoff() + linkHubImportDependencies() কল
//      করে — কোনো বাটন বা page-level handleImportSuccess লাগে না।
//      QuantityImportPanel.tsx-এর "Hub থেকে auto-fetch" বাটন তাই এখন
//      অপ্রয়োজনীয়, সরিয়ে ফেলা হয়েছে (আলাদা diff-এ)।

import { getModuleData, subscribeToModuleData, linkOwnDependency } from '@/lib/integration/hub-sdk-client'
import { mapArchitecturalModuleDataToFloors } from '@/lib/integration/architectural-mapper'
import { mapStructuralModuleDataToFloors } from '@/lib/integration/structural-mapper'
import { parseQuantityTakeoffExport } from '@/lib/services/quantity-takeoff.service'
import { saveQuantityTakeoff, getActiveQuantityTakeoff } from '@/lib/firestore/quantity-takeoff.firestore'
import type { ArchitecturalModuleData, ModuleDataRecord, StructuralModuleData } from '@/lib/types/module-data.types'
import type { QuantityTakeoffExport } from '@/lib/types/quantity-takeoff.types'

export interface HubModuleImportPrepareResult {
  success: boolean
  parsed?: QuantityTakeoffExport
  architecturalAvailable: boolean
  structuralAvailable: boolean
  architecturalVersion?: number
  structuralVersion?: number
  errors: string[]
  warnings: string[]
}

/**
 * pure — কোনো Firestore call নেই, শুধু ইতিমধ্যে fetch করা দুটো
 * ModuleDataRecord (বা null) নিয়ে mapper+validate চালায়। one-shot ও
 * live subscription দুটো path-ই এটা কল করে (নিচে দেখুন) যাতে
 * "architectural আছে/নেই", "structural আছে/নেই", "মিলিয়ে validate
 * করা" — এই যুক্তি একটাই জায়গায় থাকে।
 */
function buildQuantityTakeoffFromRecords(
  projectId: string,
  archRecord: ModuleDataRecord | null,
  structRecord: ModuleDataRecord | null
): HubModuleImportPrepareResult {
  if (!archRecord) {
    return {
      success: false,
      architecturalAvailable: false,
      structuralAvailable: !!structRecord,
      errors: ['Hub-এ এখনো কোনো Architectural module data পাওয়া যায়নি — Architectural app থেকে এখনো কিছু publish হয়নি।'],
      warnings: [],
    }
  }
  if (!structRecord) {
    return {
      success: false,
      architecturalAvailable: true,
      structuralAvailable: false,
      architecturalVersion: archRecord.version,
      errors: ['Hub-এ এখনো কোনো Structural module data পাওয়া যায়নি — Quantity Takeoff-এর জন্য Architectural ও Structural দুটোরই ডেটা দরকার। Structural app থেকে model publish হলে স্বয়ংক্রিয়ভাবে আবার চেষ্টা হবে।'],
      warnings: [],
    }
  }

  const warnings: string[] = []
  const archMap = mapArchitecturalModuleDataToFloors(archRecord.data as ArchitecturalModuleData)
  const structMap = mapStructuralModuleDataToFloors(structRecord.data as StructuralModuleData)
  warnings.push(...archMap.warnings, ...structMap.warnings)

  if (archMap.floors.length === 0 || structMap.floors.length === 0) {
    return {
      success: false,
      architecturalAvailable: true,
      structuralAvailable: true,
      architecturalVersion: archRecord.version,
      structuralVersion: structRecord.version,
      errors: [
        archMap.floors.length === 0 ? 'Architectural module data থেকে কোনো valid floor পাওয়া যায়নি।' : '',
        structMap.floors.length === 0 ? 'Structural module data থেকে কোনো valid floor পাওয়া যায়নি।' : '',
      ].filter(Boolean),
      warnings,
    }
  }

  const candidate = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    projectId,
    sourceArchitecturalVersion: String(archRecord.version),
    sourceStructuralVersion: String(structRecord.version),
    architecturalFloors: archMap.floors,
    structuralFloors: structMap.floors,
  }

  const validation = parseQuantityTakeoffExport(JSON.stringify(candidate))

  return {
    success: validation.success,
    parsed: validation.payload,
    architecturalAvailable: true,
    structuralAvailable: true,
    architecturalVersion: archRecord.version,
    structuralVersion: structRecord.version,
    errors: validation.errors,
    warnings: [...warnings, ...validation.warnings],
  }
}

/**
 * one-shot fetch (getModuleData) — manual "আবার চেষ্টা করুন" বাটনের
 * জন্য এখনো রাখা হয়েছে। save/link caller নিজে করবে (prepare/push
 * আলাদা রাখার একই পুরনো নীতি, retry-flow-এ যেহেতু ব্যবহারকারী আগে
 * preview/error দেখতে চাইতে পারেন)।
 */
export async function prepareHubImport(projectId: string): Promise<HubModuleImportPrepareResult> {
  const [archRecord, structRecord] = await Promise.all([getModuleData(projectId, 'architectural'), getModuleData(projectId, 'structural')])
  return buildQuantityTakeoffFromRecords(projectId, archRecord, structRecord)
}

/**
 * save সফল হওয়ার পর dependency link করে (Hub-এর dependency graph-এ)
 * — best-effort, ব্যর্থ হলেও quantity import ইতিমধ্যে সফলভাবে
 * সংরক্ষিত থাকে বলে throw করা হয় না।
 */
export async function linkHubImportDependencies(projectId: string, architecturalVersion: number, structuralVersion: number): Promise<void> {
  try {
    await linkOwnDependency(projectId, 'architectural', architecturalVersion, 'Architectural module data থেকে Quantity Takeoff স্বয়ংক্রিয়ভাবে আমদানি করা হয়েছে')
  } catch {
    /* non-critical */
  }
  try {
    await linkOwnDependency(projectId, 'structural', structuralVersion, 'Structural module data থেকে Quantity Takeoff স্বয়ংক্রিয়ভাবে আমদানি করা হয়েছে')
  } catch {
    /* non-critical */
  }
}

export type AutoSyncStatus =
  | { state: 'waiting'; result: HubModuleImportPrepareResult } // upstream কিছু এখনো নেই — এটা error না, স্বাভাবিক অপেক্ষা
  | { state: 'error'; result: HubModuleImportPrepareResult } // upstream ডেটা আছে কিন্তু validate ব্যর্থ (mapper warning/error)
  | { state: 'synced'; result: HubModuleImportPrepareResult; savedImportId: string }

/**
 * প্রধান auto-sync পথ। Architectural ও Structural দুটো moduleData-ই
 * subscribeToModuleData() দিয়ে live শোনে (onSnapshot-ভিত্তিক,
 * hub-sdk-client.ts)। যেকোনো একটা বদলালে (upstream app নতুন publish
 * করলে) দুটোর সাম্প্রতিকতম snapshot দিয়ে আবার build+validate করে, সফল
 * হলে নিজেই save+link করে — কোনো বাটন লাগে না।
 *
 * সতর্কতা যা ইচ্ছাকৃতভাবে রাখা হয়েছে:
 *   - একই version দুইবার save না করার জন্য lastSavedVersions ট্র্যাক
 *     করা হয় (নাহলে দুটো listener প্রায় একই সময়ে ফায়ার করলে duplicate
 *     save হতে পারত — Architectural আপডেট হলে structural listener-ও
 *     re-fire করে কারণ builder দুটো record-ই আবার লাগে)। ⚠️ এই guard
 *     শুধু in-memory হলে page/tab reload-এ হারিয়ে যেত (browser
 *     refresh করলেই একই version আবার নতুন duplicate importId নিয়ে
 *     save হয়ে যেত) — তাই মাউন্ট হওয়ার সময় getActiveQuantityTakeoff()
 *     দিয়ে Firestore থেকে সর্বশেষ saved version পড়ে guard
 *     initialize করা হয়, listener attach করার *আগে* (নাহলে
 *     initialization শেষ হওয়ার আগেই listener fire করে race তৈরি হতে
 *     পারত)।
 *   - onStatusChange callback synchronous state update-এর জন্য (React
 *     hook wrapper এটা useState-এ বসাবে) — এই ফাংশন নিজে কোনো UI জানে
 *     না, শুধু status রিপোর্ট করে।
 *   - save ব্যর্থ হলে (নেটওয়ার্ক ইত্যাদি) পরের upstream পরিবর্তনেই
 *     আবার চেষ্টা হবে (retry loop-এর দরকার নেই, listener নিজেই
 *     effectively retry mechanism, যেহেতু version না বদলালে আবার সেভ
 *     করার চেষ্টাও হবে না কিন্তু বদলালে অবশ্যই হবে)।
 *
 * unsubscribe সিঙ্ক্রোনাসভাবে caller-কে ফেরত দিতে হয় (React
 * useEffect cleanup সবসময় sync ফাংশন আশা করে), কিন্তু ভেতরের
 * initialization async — তাই unsubscribe একটা flag সেট করে রাখে,
 * initialization শেষ হওয়ার পর সেই flag চেক করে listener attach করা
 * এড়িয়ে যায় (component দ্রুত mount+unmount হলে, যেমন React strict
 * mode-এ, initialization চলাকালীন unmount হয়ে গেলে যাতে পরে অকারণে
 * listener বসে না যায়)।
 *
 * @returns unsubscribe — caller (React hook) cleanup-এ কল করবে।
 */
export function subscribeToHubQuantityAutoSync(projectId: string, onStatusChange: (status: AutoSyncStatus) => void): () => void {
  let latestArch: ModuleDataRecord | null = null
  let latestStruct: ModuleDataRecord | null = null
  let lastSavedArchVersion: number | undefined
  let lastSavedStructVersion: number | undefined
  let processing = false
  let cancelled = false
  let unsubArch: (() => void) | null = null
  let unsubStruct: (() => void) | null = null

  async function tryProcess() {
    if (processing) return // একই মুহূর্তে দুটো listener ফায়ার করলে দ্বিতীয়টাকে প্রথমটা শেষ হওয়া পর্যন্ত আটকানো — race এড়াতে
    processing = true
    try {
      const result = buildQuantityTakeoffFromRecords(projectId, latestArch, latestStruct)

      if (!result.success) {
        const isWaiting = !result.architecturalAvailable || !result.structuralAvailable
        onStatusChange({ state: isWaiting ? 'waiting' : 'error', result })
        return
      }

      const alreadySaved = result.architecturalVersion === lastSavedArchVersion && result.structuralVersion === lastSavedStructVersion
      if (alreadySaved) {
        onStatusChange({ state: 'synced', result, savedImportId: '' }) // ইতিমধ্যে সেভ করা এই version-এর জন্য — নতুন করে কিছু করার নেই, শুধু বর্তমান অবস্থা জানানো
        return
      }

      const stored = await saveQuantityTakeoff(result.parsed!)
      lastSavedArchVersion = result.architecturalVersion
      lastSavedStructVersion = result.structuralVersion

      if (result.architecturalVersion !== undefined && result.structuralVersion !== undefined) {
        await linkHubImportDependencies(projectId, result.architecturalVersion, result.structuralVersion)
      }

      onStatusChange({ state: 'synced', result, savedImportId: stored.importId })
    } catch (e) {
      onStatusChange({
        state: 'error',
        result: {
          success: false,
          architecturalAvailable: !!latestArch,
          structuralAvailable: !!latestStruct,
          errors: [e instanceof Error ? e.message : 'Hub auto-sync ব্যর্থ হয়েছে — অজানা ত্রুটি।'],
          warnings: [],
        },
      })
    } finally {
      processing = false
    }
  }

  // Firestore থেকে সর্বশেষ saved version পড়ে guard initialize —
  // listener attach করার আগে সম্পূর্ণ হওয়া আবশ্যক (উপরের নোট দেখুন)
  async function init() {
    try {
      const active = await getActiveQuantityTakeoff(projectId)
      if (active) {
        lastSavedArchVersion = active.sourceArchitecturalVersion !== undefined ? Number(active.sourceArchitecturalVersion) : undefined
        lastSavedStructVersion = active.sourceStructuralVersion !== undefined ? Number(active.sourceStructuralVersion) : undefined
      }
    } catch {
      // পড়তে ব্যর্থ হলে undefined-ই থেকে যাবে — worst case প্রথম
      // change-এ একটা অতিরিক্ত (কিন্তু ক্ষতিকর নয়) duplicate save হবে,
      // guard সম্পূর্ণ বন্ধ হয়ে যাওয়ার চেয়ে এটা নিরাপদ
    }

    if (cancelled) return // init চলাকালীন unsubscribe কল হয়ে গেলে আর listener বসানো হবে না

    unsubArch = subscribeToModuleData(projectId, 'architectural', (record) => {
      latestArch = record
      void tryProcess()
    })
    unsubStruct = subscribeToModuleData(projectId, 'structural', (record) => {
      latestStruct = record
      void tryProcess()
    })
  }

  void init()

  return () => {
    cancelled = true
    unsubArch?.()
    unsubStruct?.()
  }
}
