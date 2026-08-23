// lib/firestore/plumbing.firestore.ts
//
// পাথ: projects/{projectId}/estimatingInput/plumbing
//
// electrical.firestore.ts-এর একই single-document pattern।

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PlumbingFixtureRow, PlumbingPipeRun, StoredPlumbing } from '@/lib/types/plumbing.types'

const PARENT_COLLECTION = 'estimatingInput'
const DOC_ID = 'plumbing'

export async function getPlumbing(projectId: string): Promise<StoredPlumbing | null> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as StoredPlumbing
}

async function savePlumbing(projectId: string, fixtures: PlumbingFixtureRow[], pipeRuns: PlumbingPipeRun[]): Promise<void> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  await setDoc(ref, {
    projectId,
    updatedAt: Date.now(),
    fixtures,
    pipeRuns,
  } satisfies StoredPlumbing)
}

// ── Fixture rows ────────────────────────────────────────────────────

export async function addPlumbingFixtureRow(projectId: string, row: PlumbingFixtureRow): Promise<void> {
  const current = await getPlumbing(projectId)
  const updatedFixtures = [...(current?.fixtures ?? []), row]
  await savePlumbing(projectId, updatedFixtures, current?.pipeRuns ?? [])
}

export async function updatePlumbingFixtureRow(projectId: string, updatedRow: PlumbingFixtureRow): Promise<void> {
  const current = await getPlumbing(projectId)
  if (!current) return
  const updatedFixtures = current.fixtures.map((r) => (r.id === updatedRow.id ? updatedRow : r))
  await savePlumbing(projectId, updatedFixtures, current.pipeRuns)
}

export async function deletePlumbingFixtureRow(projectId: string, rowId: string): Promise<void> {
  const current = await getPlumbing(projectId)
  if (!current) return
  const updatedFixtures = current.fixtures.filter((r) => r.id !== rowId)
  await savePlumbing(projectId, updatedFixtures, current.pipeRuns)
}

// ── Pipe runs ───────────────────────────────────────────────────────

export async function addPlumbingPipeRun(projectId: string, row: PlumbingPipeRun): Promise<void> {
  const current = await getPlumbing(projectId)
  const updatedRuns = [...(current?.pipeRuns ?? []), row]
  await savePlumbing(projectId, current?.fixtures ?? [], updatedRuns)
}

export async function updatePlumbingPipeRun(projectId: string, updatedRow: PlumbingPipeRun): Promise<void> {
  const current = await getPlumbing(projectId)
  if (!current) return
  const updatedRuns = current.pipeRuns.map((r) => (r.id === updatedRow.id ? updatedRow : r))
  await savePlumbing(projectId, current.fixtures, updatedRuns)
}

export async function deletePlumbingPipeRun(projectId: string, rowId: string): Promise<void> {
  const current = await getPlumbing(projectId)
  if (!current) return
  const updatedRuns = current.pipeRuns.filter((r) => r.id !== rowId)
  await savePlumbing(projectId, current.fixtures, updatedRuns)
}
