// lib/integration/hub-native-sync.ts
//
// Hub → Estimating: Building Info + BNBC Settings + Project Settings
// (automatic, real-time — manual JSON paste/upload সম্পূর্ণ প্রতিস্থাপিত)
// ------------------------------------------------------------------
// ⚠️ সংশোধনী ইতিহাস: আগে এই connection সম্পূর্ণ manual ছিল — Hub থেকে
// JSON export করে (downloadJSON()/copyToClipboard(), Hub-এর
// lib/services/integration.service.ts) ব্যবহারকারীকে এই App-এ এসে
// paste/upload করতে হতো (HubImportPanel.tsx, এখন মুছে ফেলা হয়েছে)।
// hub-import.service.ts-এর parseHubExport() সেই raw JSON validate
// করতো। সমস্যা ছিল: Hub-এর কোনো ফাইলেই আসলে Firestore-এ export write
// করার mechanism ছিল না — download/clipboard-only, তাই ব্যবহারকারীকে
// প্রতিবার data বদলালে ম্যানুয়ালি আবার export+import করতে হতো।
//
// এই ফাইল সেই manual ধাপ বাদ দিয়ে Hub-এর প্রকৃত Firestore document
// (site-info.firestore.ts/building.firestore.ts/bnbc.firestore.ts/
// project-settings.firestore.ts এ verified — EngineX-Structural ও
// EngineXProject-এর হুবহু একই verified path, ওই দুই App-এর
// hub-native-paths.ts/hub-module-shapes.ts দ্রষ্টব্য) সরাসরি real-time
// শোনে। Hub-এ কেউ Building Info বা BNBC Settings ফর্ম সেভ করলে, এই App
// স্বয়ংক্রিয়ভাবে নতুন EstimatingRelevantPayload assemble করে
// saveHubImport()-এ পাঠায় — hub-import.firestore.ts-এর versioned
// audit-trail mechanism অক্ষত থাকছে (কোন estimate কোন building-data
// snapshot থেকে বানানো হয়েছিল তা এখনো ট্র্যাক করা যাবে), শুধু ইনপুট
// উৎস এখন Hub-এর real document, ব্যবহারকারীর copy-paste না।
//
// buildingInfo ও bnbcSettings দুটোই না থাকলে (Hub-এ এখনো ফর্ম পূরণ
// হয়নি) — এটা এই App-এর জন্য "এখনো কিছু sync করার নেই" অবস্থা, error
// না। projectSettings ঐচ্ছিক (EstimatingRelevantPayload-এর টাইপে
// Required-এর বাইরে) — Hub-এর project_settings/data এখনো ফাঁকা থাকলেও
// buildingInfo/bnbcSettings sync হওয়া উচিত।

import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { saveHubImport } from '@/lib/firestore/hub-import.firestore'
import { appendSyncLogEntry } from '@/lib/firestore/sync-log.firestore'
import {
  EstimatingRelevantPayload,
  BuildingExport,
  BNBCExport,
  ProjectSettingsExport,
} from '@/lib/types/hub-import.types'

const CONNECTION_ID = 'hub-to-estimating-building-bnbc'

// Hub-এর real Firestore path (site-info.firestore.ts/building.firestore.ts/
// bnbc.firestore.ts/project-settings.firestore.ts এ verified) — dedicated
// export/envelope document না, Hub-এর UI ফর্ম যেখানে সরাসরি সেভ করে
// সেই একই document।
const hubPaths = {
  buildingInfo: (projectId: string) => doc(db, 'projects', projectId, 'building_information', 'data'),
  bnbcSettings: (projectId: string) => doc(db, 'projects', projectId, 'bnbc_settings', 'data'),
  projectSettings: (projectId: string) => doc(db, 'projects', projectId, 'project_settings', 'data'),
  // projects/{projectId} নিজেই — projectCode/projectName এখান থেকে
  // (Hub-এর প্রতিটা project document-এর নিজস্ব top-level field,
  // building_information/bnbc_settings-এর ভেতরে না)।
  project: (projectId: string) => doc(db, 'projects', projectId),
}

/**
 * Hub এর optional field না-থাকলে `null` লেখে (Firestore-এ `undefined`
 * সরাসরি লেখা যায় না), কিন্তু এই App-এর টাইপ `field?: T` (`T | undefined`)
 * ধরে নেয় — shallow normalize (EngineX-Structural-এর
 * useHubModuleSubscriptions.ts-এর একই fix, একই কারণ)।
 */
function stripNullToUndefined<T>(data: Record<string, unknown>): T {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data)) {
    result[key] = val === null ? undefined : val
  }
  return result as T
}

/**
 * Cs = Ss × I / R — Hub এই মান পাঠায় না (BNBCSettings টাইপে নেই), কিন্তু
 * এই App-এর পুরনো BNBCExport টাইপে ছিল (কখনো downstream ব্যবহার হয়নি,
 * hub-import.types.ts-এর file comment দ্রষ্টব্য) — সরাসরি বাদ না দিয়ে
 * derive করে রাখা হলো future-proofing হিসেবে, সূত্রটা BNBC 2020-এর
 * standard seismic-coefficient formula, deterministic।
 */
function deriveSeismicCs(spectralAcceleration: number, importanceFactor: number, responseModFactor: number): number {
  if (responseModFactor === 0) return 0 // divide-by-zero guard — R=0 কখনো বৈধ না, কিন্তু partial/malformed data থেকে crash এড়াতে
  return (spectralAcceleration * importanceFactor) / responseModFactor
}

interface AssembledState {
  buildingInfo: Record<string, unknown> | null
  bnbcSettings: Record<string, unknown> | null
  projectSettings: Record<string, unknown> | null
  projectCode: string | null
  projectName: string | null
}

function isReady(state: AssembledState): state is AssembledState & {
  buildingInfo: Record<string, unknown>
  bnbcSettings: Record<string, unknown>
} {
  return state.buildingInfo !== null && state.bnbcSettings !== null
}

function assemblePayload(projectId: string, state: AssembledState & { buildingInfo: Record<string, unknown>; bnbcSettings: Record<string, unknown> }): EstimatingRelevantPayload {
  const buildingInfo = stripNullToUndefined<BuildingExport>(state.buildingInfo)
  const bnbcRaw = stripNullToUndefined<BNBCExport>(state.bnbcSettings)

  const payload: EstimatingRelevantPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    projectId,
    projectCode: state.projectCode ?? projectId,
    projectName: state.projectName ?? '',
    buildingInfo,
    bnbcSettings: bnbcRaw,
  }

  if (state.projectSettings) {
    payload.projectSettings = stripNullToUndefined<ProjectSettingsExport>(state.projectSettings)
  }

  return payload
}

export type AutoSyncStatus = 'syncing' | 'synced' | 'error' | 'no_data'

export interface HubNativeSyncCallbacks {
  onStatusChange: (status: AutoSyncStatus, detail?: string) => void
}

/**
 * Hub-এর buildingInfo/bnbcSettings/projectSettings document-এ real-time
 * subscribe করে, পরিবর্তন এলেই (debounce করে, কারণ একই মুহূর্তে একাধিক
 * document আলাদাভাবে বদলাতে পারে — যেমন কেউ Hub-এ Building Info সেভ
 * করার পরপরই BNBC Settings-ও আপডেট করলেন) নতুন EstimatingRelevantPayload
 * assemble করে saveHubImport()-এ পাঠায়।
 *
 * প্রতিটা সফল sync ও প্রতিটা ব্যর্থতা sync log-এ যায় (listenToActiveHubImport
 * এর একই silent-failure-এড়ানোর নীতি)। Returns unsubscribe — caller-কে
 * component unmount-এ অবশ্যই কল করতে হবে।
 */
export function subscribeToHubNativeSync(projectId: string, callbacks: HubNativeSyncCallbacks): Unsubscribe {
  const state: AssembledState = {
    buildingInfo: null,
    bnbcSettings: null,
    projectSettings: null,
    projectCode: null,
    projectName: null,
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const DEBOUNCE_MS = 2000

  const scheduleSync = () => {
    if (!isReady(state)) {
      callbacks.onStatusChange('no_data')
      return
    }
    callbacks.onStatusChange('syncing')
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      try {
        const payload = assemblePayload(projectId, state as AssembledState & { buildingInfo: Record<string, unknown>; bnbcSettings: Record<string, unknown> })
        await saveHubImport(projectId, payload)
        callbacks.onStatusChange('synced')
        await appendSyncLogEntry(
          projectId,
          CONNECTION_ID,
          'success',
          'Building/BNBC data স্বয়ংক্রিয়ভাবে Hub থেকে sync হয়েছে।',
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'অজানা ত্রুটি'
        callbacks.onStatusChange('error', message)
        await appendSyncLogEntry(projectId, CONNECTION_ID, 'failure', 'Hub থেকে auto-sync ব্যর্থ হয়েছে।', message)
      }
    }, DEBOUNCE_MS)
  }

  const unsubProject = onSnapshot(
    hubPaths.project(projectId),
    (snap) => {
      const data = snap.exists() ? snap.data() : null
      state.projectCode = (data?.projectCode as string) ?? null
      state.projectName = (data?.projectName as string) ?? null
      // project document শুধু metadata (code/name) — এককভাবে sync
      // ট্রিগার করা হয় না, buildingInfo/bnbcSettings আসার অপেক্ষায়
      // থাকে (নিচের দুই listener-এই scheduleSync() কল হয়)।
    },
    () => {
      /* non-critical — projectCode/projectName না পেলেও projectId নিজেই fallback হিসেবে assemblePayload() এ ব্যবহৃত হয় */
    },
  )

  const unsubBuilding = onSnapshot(
    hubPaths.buildingInfo(projectId),
    (snap) => {
      state.buildingInfo = snap.exists() ? snap.data() : null
      scheduleSync()
    },
    async (error) => {
      callbacks.onStatusChange('error', error.message)
      await appendSyncLogEntry(projectId, CONNECTION_ID, 'failure', 'buildingInfo listener ব্যর্থ হয়েছে।', error.message)
    },
  )

  const unsubBnbc = onSnapshot(
    hubPaths.bnbcSettings(projectId),
    (snap) => {
      state.bnbcSettings = snap.exists() ? snap.data() : null
      scheduleSync()
    },
    async (error) => {
      callbacks.onStatusChange('error', error.message)
      await appendSyncLogEntry(projectId, CONNECTION_ID, 'failure', 'bnbcSettings listener ব্যর্থ হয়েছে।', error.message)
    },
  )

  const unsubSettings = onSnapshot(
    hubPaths.projectSettings(projectId),
    (snap) => {
      state.projectSettings = snap.exists() ? snap.data() : null
      // projectSettings ঐচ্ছিক — একা এর পরিবর্তনেও sync ট্রিগার করা
      // উচিত যদি buildingInfo/bnbcSettings ইতিমধ্যে ready থাকে (যেমন
      // কেউ শুধু Currency/VAT বদলালেন, Building Info অক্ষত)।
      scheduleSync()
    },
    () => {
      /* non-critical — projectSettings সম্পূর্ণ ঐচ্ছিক */
    },
  )

  return () => {
    unsubProject()
    unsubBuilding()
    unsubBnbc()
    unsubSettings()
    if (debounceTimer) clearTimeout(debounceTimer)
  }
}
