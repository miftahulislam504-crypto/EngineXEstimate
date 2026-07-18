// lib/types/dependency.types.ts
//
// ⚠️ Hub-এর lib/types/dependency.types.ts-এর হুবহু কপি (contract.types.ts-এর
// উপরের নোট দেখুন — একই কারণে verbatim কপি করা হয়েছে)।

// এখন পর্যন্ত যে module গুলোর ভার্সন ট্র্যাক করা হয় (Hub-এর নিজের ৩টা +
// ইকোসিস্টেম app গুলো, 'estimating' সহ)।
export type ModuleId =
  | 'siteInfo'
  | 'bnbcSettings'
  | 'buildingInfo'
  | 'architectural'
  | 'structural'
  | 'estimating'
  | 'projectmgmt'

export const MODULE_LABELS: Record<ModuleId, string> = {
  siteInfo: 'সাইট ইনফরমেশন',
  bnbcSettings: 'BNBC সেটিংস',
  buildingInfo: 'ভবনের তথ্য',
  architectural: 'Architectural',
  structural: 'Structural',
  estimating: 'Estimating',
  projectmgmt: 'Project Management',
}

// `projects/{projectId}/versions/{moduleId}` — একটা doc প্রতি module।
export interface ModuleVersionRecord {
  moduleId: ModuleId
  currentVersion: number
  updatedAt: string // ISO
}

// `projects/{projectId}/dependencies/{dependencyId}`
export interface ModuleDependency {
  id: string
  projectId: string
  dependentModule: ModuleId
  upstreamModule: ModuleId
  upstreamVersionAtLink: number
  reason: string
  createdAt: string
}

export type DependencyStatus = 'CURRENT' | 'OUTDATED'

export function getDependencyStatus(
  dependency: ModuleDependency,
  upstreamCurrentVersion: number
): DependencyStatus {
  return upstreamCurrentVersion > dependency.upstreamVersionAtLink ? 'OUTDATED' : 'CURRENT'
}
