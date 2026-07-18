// lib/services/reports.service.ts
//
// Module 13 — dashboard.service.ts-এর মতোই এখানে কোনো নতুন business
// calculation নেই, শুধু existing Module (1-12)-এর data একত্র করে
// প্রতিটা report-এর জন্য একটা সাজানো "context" object তৈরি করা।
// PDF/Excel/Word builder-রা এই একই context ব্যবহার করবে — ফলে তিনটা
// format-এর মধ্যে data-fetch/aggregation duplicate হবে না, শুধু
// রেন্ডারিং আলাদা।

import { getActiveBOQVersion, getBOQVersionHistory } from '@/lib/firestore/boq.firestore'
import { getActiveQuantityTakeoff } from '@/lib/firestore/quantity-takeoff.firestore'
import { getRateAnalysis } from '@/lib/firestore/rate-analysis.firestore'
import { listMaterials } from '@/lib/firestore/material.firestore'
import { listResourceRates } from '@/lib/firestore/resource-rate.firestore'
import { getBBS } from '@/lib/firestore/reinforcement.firestore'
import { getTender, getLatestEngineerEstimate, getTenderFinalizationHistory } from '@/lib/firestore/tender.firestore'

import { BOQItem, BOQVersion } from '@/lib/types/boq.types'
import {
  StoredQuantityTakeoff,
  effectiveArchitecturalQuantities,
  effectiveStructuralQuantities,
} from '@/lib/types/quantity-takeoff.types'
import { Material } from '@/lib/types/material.types'
import { ResourceRate } from '@/lib/types/resource-rate.types'
import { BBSRow } from '@/lib/types/reinforcement.types'
import { EngineerEstimate, ContractorBid, TenderFinalization } from '@/lib/types/tender.types'

import { calculateProjectCostSummary, ProjectCostSummary } from '@/lib/services/dashboard.service'
import { calculateRateFromLoadedRates } from '@/lib/services/rate-analysis.service'
import { calculateBBSRows } from '@/lib/services/reinforcement.service'
import { summarizeFloorVolumes } from '@/lib/services/quantity-takeoff.service'
import { buildComparativeStatement, ComparativeStatementRow } from '@/lib/services/tender.service'

// ── BOQ Report ─────────────────────────────────────────────────────

export interface BOQReportContext {
  version: BOQVersion | null
  history: BOQVersion[]
}

export async function buildBOQReportContext(projectId: string): Promise<BOQReportContext> {
  const [version, history] = await Promise.all([
    getActiveBOQVersion(projectId),
    getBOQVersionHistory(projectId),
  ])
  return { version, history }
}

// ── Quantity Report ────────────────────────────────────────────────

export interface QuantityReportContext {
  takeoff: StoredQuantityTakeoff | null
}

export async function buildQuantityReportContext(projectId: string): Promise<QuantityReportContext> {
  const takeoff = await getActiveQuantityTakeoff(projectId)
  return { takeoff }
}

// ── Cost Report ────────────────────────────────────────────────────

export interface CostReportContext {
  boqItems: BOQItem[]
  summary: ProjectCostSummary | null
}

/**
 * dashboard.service.ts-এর calculateProjectCostSummary() পুনর্ব্যবহার
 * করে — Dashboard-এ যে হিসাব দেখানো হয়, এই report সেই একই সংখ্যা
 * ব্যবহার করে যাতে "Dashboard-এ এক নম্বর, রিপোর্টে আরেক নম্বর" এই
 * বৈসাদৃশ্য তৈরি না হয়।
 */
export async function buildCostReportContext(projectId: string): Promise<CostReportContext> {
  const [boqVersion, rateAnalysis, materials, labourRates, equipmentRates] = await Promise.all([
    getActiveBOQVersion(projectId),
    getRateAnalysis(projectId),
    listMaterials(),
    listResourceRates('labour'),
    listResourceRates('equipment'),
  ])

  const boqItems = boqVersion?.items ?? []
  if (boqItems.length === 0) {
    return { boqItems: [], summary: null }
  }

  const summary = calculateProjectCostSummary(
    boqItems,
    rateAnalysis?.entries ?? [],
    materials,
    labourRates,
    equipmentRates
  )
  return { boqItems, summary }
}

// ── Material Report ────────────────────────────────────────────────

export interface MaterialReportContext {
  materials: Material[]
}

/**
 * Material Database organization-wide (project-scoped না), তাই এই
 * report-এর জন্য projectId লাগে না — শুধু deactivate করা material
 * বাদ দিয়ে বর্তমানে-সক্রিয় তালিকা।
 */
export async function buildMaterialReportContext(): Promise<MaterialReportContext> {
  const materials = await listMaterials()
  return { materials: materials.filter((m) => m.isActive) }
}

// ── BBS Report ──────────────────────────────────────────────────────

export interface BBSReportContext {
  rows: BBSRow[]
  totalWeightKg: number
  warnings: string[]
}

export async function buildBBSReportContext(projectId: string): Promise<BBSReportContext> {
  const stored = await getBBS(projectId)
  const rows = stored?.rows ?? []
  const { calculated, warnings } = calculateBBSRows(rows)
  const totalWeightKg = calculated.reduce((sum, r) => sum + r.totalWeightKg, 0)
  return { rows, totalWeightKg, warnings }
}

// ── Tender Report ──────────────────────────────────────────────────

export interface TenderReportContext {
  engineerEstimate: EngineerEstimate | null
  bids: ContractorBid[]
  comparativeStatement: ComparativeStatementRow[]
  finalization: TenderFinalization | null
}

export async function buildTenderReportContext(projectId: string): Promise<TenderReportContext> {
  const [tender, finalizations] = await Promise.all([
    getTender(projectId),
    getTenderFinalizationHistory(projectId),
  ])
  const engineerEstimate = getLatestEngineerEstimate(tender?.engineerEstimates ?? [])
  const bids = tender?.contractorBids ?? []
  const comparativeStatement = buildComparativeStatement(engineerEstimate, bids)
  const finalization = finalizations.length > 0 ? finalizations[0] : null
  return { engineerEstimate, bids, comparativeStatement, finalization }
}

// ── Availability check (রিপোর্ট বাটন disable করার জন্য) ────────────

export interface ReportsAvailability {
  boq: boolean
  quantity: boolean
  cost: boolean
  material: boolean
  bbs: boolean
  tender: boolean
}

/**
 * প্রতিটা report generate করার আগে ডেটা আদৌ আছে কিনা যাচাই —
 * silently খালি PDF বানানোর বদলে বাটন-ই disabled রাখা হবে, ঠিক
 * Dashboard-এর itemsWithoutRateAnalysis-এর একই "silent-omission
 * এড়ানো" নীতি অনুসরণ করে।
 */
export async function checkReportsAvailability(projectId: string): Promise<ReportsAvailability> {
  const [boqVersion, takeoff, rateAnalysis, materials, bbs, tender] = await Promise.all([
    getActiveBOQVersion(projectId),
    getActiveQuantityTakeoff(projectId),
    getRateAnalysis(projectId),
    listMaterials(),
    getBBS(projectId),
    getTender(projectId),
  ])

  return {
    boq: !!boqVersion && boqVersion.items.length > 0,
    quantity: !!takeoff && (takeoff.architecturalFloors.length > 0 || takeoff.structuralFloors.length > 0),
    cost: !!boqVersion && boqVersion.items.length > 0 && !!rateAnalysis && rateAnalysis.entries.length > 0,
    material: materials.filter((m) => m.isActive).length > 0,
    bbs: !!bbs && bbs.rows.length > 0,
    tender: !!tender && (tender.engineerEstimates.length > 0 || tender.contractorBids.length > 0),
  }
}

// re-export যাতে PDF builder-রা effective quantity/volume হিসাব করতে
// আলাদা import path মনে রাখতে না হয়
export { effectiveArchitecturalQuantities, effectiveStructuralQuantities, summarizeFloorVolumes }
