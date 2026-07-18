// lib/integration/hub-sdk-client.ts
//
// Module 15 — Hub-এর `lib/hub-sdk.ts` (Phase 6)-এর Estimating-দিকের
// প্রতিরূপ। Hub-এর zip (2026-07-17) পরীক্ষা করে এই ফাইলগুলো verify
// করা হয়েছে:
//   - lib/firestore/dependency.firestore.ts  (versions, dependencies)
//   - lib/firestore/approval.firestore.ts    (approvals)
//   - lib/firestore/event.firestore.ts       (events, realtime)
//
// এই ফাইল Hub-এর নিজের কোড-ই re-implement করছে, কপি-পেস্ট না — কারণ
// Hub-এর কিছু ফাংশন (setApprovalStatus মানুষ-অ্যাকশন, downgradeToOutdatedIfApproved
// ইত্যাদি) মূলত Hub-এর নিজস্ব admin/UI workflow-এর অংশ, Estimating-এর
// দরকার শুধু consumer-side read + নিজের version bump/dependency link/
// event emit করার ability। তাই এখানে শুধু Estimating-এর সত্যিকারের
// দরকারি সাবসেট রাখা হয়েছে (versions/dependencies/events পূর্ণ,
// approvals শুধু read + নিজের status set)।
//
// ⚠️ path-গুলো Hub-এর কোডের সাথে অক্ষরে-অক্ষরে মেলানো (verified, অনুমান
// না): projects/{projectId}/versions/{moduleId},
// projects/{projectId}/dependencies/{dependencyId},
// projects/{projectId}/approvals/{moduleId},
// projects/{projectId}/events/{eventId}। এই একই project-এ Hub ও
// Estimating দুটোই লিখবে/পড়বে (একই Firebase project, lib/firebase.ts
// দ্রষ্টব্য) — তাই path না মিললে সরাসরি silent data-loss হতো।

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ModuleId, ModuleVersionRecord, ModuleDependency, getDependencyStatus } from '@/lib/types/dependency.types'
import { ApprovalRecord, ApprovalActor, SYSTEM_ACTOR } from '@/lib/types/approval.types'
import { ContractStatus } from '@/lib/types/contract.types'
import { HubEvent, HubEventType } from '@/lib/types/event.types'

const OUR_APP: 'estimating' = 'estimating'

function toISO(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString()
  return new Date().toISOString()
}

// ─── Versions (projects/{projectId}/versions/{moduleId}) ──────────────────

const versionRef = (projectId: string, moduleId: ModuleId) =>
  doc(db, 'projects', projectId, 'versions', moduleId)

export async function getModuleVersion(projectId: string, moduleId: ModuleId): Promise<ModuleVersionRecord | null> {
  const snap = await getDoc(versionRef(projectId, moduleId))
  if (!snap.exists()) return null
  const d = snap.data()
  return { moduleId, currentVersion: d.currentVersion ?? 1, updatedAt: toISO(d.updatedAt) }
}

export async function getAllModuleVersions(projectId: string): Promise<ModuleVersionRecord[]> {
  const snaps = await getDocs(collection(db, 'projects', projectId, 'versions'))
  return snaps.docs.map((s: QueryDocumentSnapshot) => {
    const d = s.data()
    return { moduleId: s.id as ModuleId, currentVersion: d.currentVersion ?? 1, updatedAt: toISO(d.updatedAt) }
  })
}

/**
 * Estimating নিজে যখন কিছু বদলায় (নতুন BOQ generate, Rate Analysis
 * আপডেট), নিজের ('estimating') version bump করে — Hub-এর
 * bumpModuleVersion()-এর মতো, +MODULE_VERSION_BUMPED event emit
 * করাসহ। Hub-এর approval-cascade অংশ (downgradeToOutdatedIfApproved)
 * এখানে ইচ্ছাকৃতভাবে বাদ — সেটা Hub-সাইড admin workflow, Estimating
 * নিজে সেই সিদ্ধান্ত নেবে না।
 */
export async function bumpOwnModuleVersion(projectId: string): Promise<number> {
  const ref = versionRef(projectId, OUR_APP)
  const snap = await getDoc(ref)
  const nextVersion = snap.exists() ? (snap.data().currentVersion ?? 1) + 1 : 1

  await setDoc(ref, { moduleId: OUR_APP, currentVersion: nextVersion, updatedAt: serverTimestamp() })

  try {
    await emitEvent(projectId, 'MODULE_VERSION_BUMPED', { moduleId: OUR_APP, newVersion: nextVersion })
  } catch {
    /* non-critical, Hub-এর কনভেনশন অনুযায়ী */
  }

  return nextVersion
}

// ─── Dependencies (projects/{projectId}/dependencies/{dependencyId}) ──────

/**
 * Estimating নিজেকে buildingInfo/bnbcSettings (বা ভবিষ্যতে structural/
 * architectural)-এর ওপর নির্ভরশীল হিসেবে link করে। deterministic id
 * (Hub-এর কনভেনশন) — একই pair পুনরায় link করলে overwrite হয়, ডুপ্লিকেট
 * তৈরি হয় না।
 */
export async function linkOwnDependency(
  projectId: string,
  upstreamModule: ModuleId,
  upstreamVersionAtLink: number,
  reason: string
): Promise<ModuleDependency> {
  const id = `${OUR_APP}__depends_on__${upstreamModule}`
  const ref = doc(db, 'projects', projectId, 'dependencies', id)

  await setDoc(ref, {
    projectId,
    dependentModule: OUR_APP,
    upstreamModule,
    upstreamVersionAtLink,
    reason,
    createdAt: serverTimestamp(),
  })

  try {
    await emitEvent(projectId, 'MODULE_DEPENDENCY_LINKED', { dependentModule: OUR_APP, upstreamModule, upstreamVersionAtLink })
  } catch {
    /* non-critical */
  }

  return {
    id,
    projectId,
    dependentModule: OUR_APP,
    upstreamModule,
    upstreamVersionAtLink,
    reason,
    createdAt: new Date().toISOString(),
  }
}

export async function getProjectDependencies(projectId: string): Promise<ModuleDependency[]> {
  const snaps = await getDocs(collection(db, 'projects', projectId, 'dependencies'))
  return snaps.docs.map((s: QueryDocumentSnapshot) => {
    const d = s.data()
    return {
      id: s.id,
      projectId: d.projectId,
      dependentModule: d.dependentModule as ModuleId,
      upstreamModule: d.upstreamModule as ModuleId,
      upstreamVersionAtLink: d.upstreamVersionAtLink ?? 1,
      reason: d.reason ?? '',
      createdAt: toISO(d.createdAt),
    }
  })
}

export interface OwnUnlockStatus {
  unlocked: boolean
  blockedBy: ModuleId[]
}

/**
 * Estimating নিজে (dependentModule === 'estimating') যে upstream
 * module-এর ওপর নির্ভরশীল, তাদের সবার approval status 'APPROVED'
 * কিনা চেক করে। Hub-এর isModuleUnlocked()-এর same logic, শুধু
 * dependentModule fix করে 'estimating' রাখা হয়েছে।
 */
export async function isOwnModuleUnlocked(projectId: string): Promise<OwnUnlockStatus> {
  const deps = (await getProjectDependencies(projectId)).filter((d) => d.dependentModule === OUR_APP)
  if (deps.length === 0) return { unlocked: true, blockedBy: [] }

  const blockedBy: ModuleId[] = []
  for (const dep of deps) {
    const approval = await getApprovalStatus(projectId, dep.upstreamModule)
    if (!approval || approval.status !== 'APPROVED') blockedBy.push(dep.upstreamModule)
  }
  return { unlocked: blockedBy.length === 0, blockedBy }
}

// ─── Approvals (projects/{projectId}/approvals/{moduleId}) — read-only ────
// Estimating নিজের approval status set করতে পারে (নিচে), কিন্তু অন্য
// module-এর approval override করার এখতিয়ার নেই — সেটা Hub-সাইড
// human/admin workflow।

const approvalRef = (projectId: string, moduleId: ModuleId) =>
  doc(db, 'projects', projectId, 'approvals', moduleId)

export async function getApprovalStatus(projectId: string, moduleId: ModuleId): Promise<ApprovalRecord | null> {
  const snap = await getDoc(approvalRef(projectId, moduleId))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    moduleId,
    status: d.status as ContractStatus,
    approvedVersion: d.approvedVersion ?? 1,
    actedBy: d.actedBy as ApprovalActor,
    actedAt: toISO(d.actedAt),
    note: d.note as string | undefined,
  }
}

export async function getAllApprovalStatuses(
  projectId: string,
  moduleIds: ModuleId[]
): Promise<Record<string, ApprovalRecord | null>> {
  const entries = await Promise.all(moduleIds.map(async (id) => [id, await getApprovalStatus(projectId, id)] as const))
  return Object.fromEntries(entries)
}

/**
 * Estimating নিজের (OUR_APP) status set করে — যেমন BOQ generate হওয়ার
 * পর 'READY_FOR_REVIEW'। actedBy না দিলে SYSTEM_ACTOR (Hub-এর
 * কনভেনশন — dependency cascade-এর মতো non-human trigger বোঝাতে)।
 */
export async function setOwnApprovalStatus(
  projectId: string,
  status: ContractStatus,
  approvedVersion: number,
  actedBy: ApprovalActor = SYSTEM_ACTOR,
  note?: string
): Promise<void> {
  await setDoc(approvalRef(projectId, OUR_APP), {
    moduleId: OUR_APP,
    status,
    approvedVersion,
    actedBy,
    actedAt: serverTimestamp(),
    ...(note ? { note } : {}),
  })

  try {
    await emitEvent(projectId, 'MODULE_STATUS_CHANGED', { moduleId: OUR_APP, status, approvedVersion })
  } catch {
    /* non-critical */
  }
}

// ─── Events (projects/{projectId}/events/{eventId}) ───────────────────────

function toEvent(id: string, d: Record<string, unknown>): HubEvent {
  return {
    id,
    projectId: d.projectId as string,
    type: d.type as HubEventType,
    sourceApp: d.sourceApp as HubEvent['sourceApp'],
    payload: d.payload as Record<string, unknown> | undefined,
    createdAt: toISO(d.createdAt),
  }
}

/**
 * Estimating সবসময় sourceApp='estimating' হিসেবে emit করে — অন্য
 * app-এর নামে event পাঠানোর দরকার/এখতিয়ার নেই।
 */
export async function emitEvent(
  projectId: string,
  type: HubEventType,
  payload?: Record<string, unknown>
): Promise<void> {
  await addDoc(collection(db, 'projects', projectId, 'events'), {
    projectId,
    type,
    sourceApp: OUR_APP,
    payload: payload ?? {},
    createdAt: serverTimestamp(),
  })
}

export async function getProjectEvents(projectId: string, max: number = 20): Promise<HubEvent[]> {
  const q = query(collection(db, 'projects', projectId, 'events'), orderBy('createdAt', 'desc'), limit(max))
  const snaps = await getDocs(q)
  return snaps.docs.map((s: QueryDocumentSnapshot) => toEvent(s.id, s.data()))
}

/**
 * সব app (Hub নিজে, Structural, Architectural, ভবিষ্যতে PM) থেকে
 * আসা event রিয়েল-টাইমে শোনে — Hub-এর subscribeToEvents()-এর হুবহু
 * একই query shape, তাই দুই App-ই একই collection-এ একই order/limit
 * নিয়ে শুনছে, কোনো path/shape mismatch নেই।
 */
export function subscribeToEvents(projectId: string, onUpdate: (events: HubEvent[]) => void, max: number = 20): Unsubscribe {
  const q = query(collection(db, 'projects', projectId, 'events'), orderBy('createdAt', 'desc'), limit(max))
  return onSnapshot(
    q,
    (snap: QuerySnapshot) => onUpdate(snap.docs.map((s: QueryDocumentSnapshot) => toEvent(s.id, s.data()))),
    () => onUpdate([]) // permission/network error — Hub-এর কনভেনশন: খালি দেখায়, ভাঙে না
  )
}
