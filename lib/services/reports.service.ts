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
import { getActiveHubImport, StoredHubImport } from '@/lib/firestore/hub-import.firestore'

import { BOQItem, BOQVersion, BOQUnit } from '@/lib/types/boq.types'
import {
  StoredQuantityTakeoff,
  effectiveArchitecturalQuantities,
  effectiveStructuralQuantities,
} from '@/lib/types/quantity-takeoff.types'
import { Material } from '@/lib/types/material.types'
import { ResourceRate } from '@/lib/types/resource-rate.types'
import { BBSRow } from '@/lib/types/reinforcement.types'
import { EngineerEstimate, ContractorBid, TenderFinalization } from '@/lib/types/tender.types'
import { RateAnalysisCostBreakdown } from '@/lib/types/rate-analysis.types'

import {
  calculateProjectCostSummary,
  ProjectCostSummary,
  summarizeCostByTrade,
  summarizeCostByFloor,
  calculateCostPerArea,
  TradeCostSlice,
  FloorCostSlice,
  CostPerAreaSummary,
} from '@/lib/services/dashboard.service'
import { calculateRateFromLoadedRates } from '@/lib/services/rate-analysis.service'
import { calculateBBSRows } from '@/lib/services/reinforcement.service'
import { summarizeFloorVolumes } from '@/lib/services/quantity-takeoff.service'
import { buildComparativeStatement, ComparativeStatementRow } from '@/lib/services/tender.service'

// ── Estimate Basis (নতুন, ２০২৬-０８-２０, audit gap: "কোনো narrative
// Estimate Basis পৃষ্ঠা নেই কোনো রিপোর্টে") ─────────────────────────
//
// Cover Sheet/Project Info/Measurement Rules/Schedule of Rates/Rate
// source/Assumptions — এই সবকিছুর ডেটা ইতিমধ্যেই সিস্টেমে ছড়িয়ে
// আছে (Hub থেকে sync হওয়া buildingInfo/bnbcSettings/projectSettings,
// আর Material/Rate library-এর source metadata), শুধু কোনো একটা
// একত্রিত narrative section হিসেবে কখনো প্রদর্শিত হয়নি। এই context
// সেই সব একত্র করে — কোনো নতুন hisab নেই, শুধু বিদ্যমান ডেটার
// presentational aggregation (এই ফাইলের বাকি সব builder-এর একই
// নীতি, ফাইলের শীর্ষ কমেন্ট দ্রষ্টব্য)।

export interface EstimateBasisContext {
  hubImport: StoredHubImport | null // buildingInfo/bnbcSettings/projectSettings — না থাকলে (Hub sync এখনো হয়নি) Project Info/BNBC section খালি থাকবে
  materialCount: number
  activeMaterialCount: number
  labourRateCount: number
  equipmentRateCount: number
  boqItemCount: number
}

/**
 * hub-native-sync.ts স্বয়ংক্রিয়ভাবে Hub থেকে buildingInfo/bnbcSettings
 * sync করে (connection-registry.ts দ্রষ্টব্য) — সেই ডেটাই এখানে
 * পুনর্ব্যবহার করা হচ্ছে, নতুন কোনো Hub read/API call নেই।
 */
export async function buildEstimateBasisContext(projectId: string): Promise<EstimateBasisContext> {
  const [hubImport, materials, labourRates, equipmentRates, boqVersion] = await Promise.all([
    getActiveHubImport(projectId),
    listMaterials(),
    listResourceRates('labour'),
    listResourceRates('equipment'),
    getActiveBOQVersion(projectId),
  ])

  return {
    hubImport,
    materialCount: materials.length,
    activeMaterialCount: materials.filter((m) => m.isActive).length,
    labourRateCount: labourRates.filter((r) => r.isActive).length,
    equipmentRateCount: equipmentRates.filter((r) => r.isActive).length,
    boqItemCount: boqVersion?.items.length ?? 0,
  }
}

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
  // ২০২৬-০৮-২০ যোগ — Trade-wise/Floor-wise breakdown ও Cost/sqft
  // (audit gap #4), dashboard.service.ts-এর ProjectDashboard.tsx-এর
  // সাথে সামঞ্জস্যপূর্ণ রাখতে একই ফাংশন এখানেও পুনর্ব্যবহার করা
  // হয়েছে, যাতে "Dashboard-এ এক নম্বর, PDF রিপোর্টে আরেক নম্বর" এই
  // বৈসাদৃশ্য এখানেও এড়ানো যায় (ঠিক উপরের comment-এর summary-র
  // মতোই নীতি)।
  tradeCosts: TradeCostSlice[]
  floorCosts: FloorCostSlice[]
  costPerArea: CostPerAreaSummary | undefined
}

/**
 * dashboard.service.ts-এর calculateProjectCostSummary() পুনর্ব্যবহার
 * করে — Dashboard-এ যে হিসাব দেখানো হয়, এই report সেই একই সংখ্যা
 * ব্যবহার করে যাতে "Dashboard-এ এক নম্বর, রিপোর্টে আরেক নম্বর" এই
 * বৈসাদৃশ্য তৈরি না হয়।
 */
export async function buildCostReportContext(projectId: string): Promise<CostReportContext> {
  const [boqVersion, rateAnalysis, materials, labourRates, equipmentRates, takeoff] = await Promise.all([
    getActiveBOQVersion(projectId),
    getRateAnalysis(projectId),
    listMaterials(),
    listResourceRates('labour'),
    listResourceRates('equipment'),
    getActiveQuantityTakeoff(projectId), // ２０２৬-০৮-২০ যোগ — Cost per sqft/sqm-এর জন্য floor area দরকার
  ])

  const boqItems = boqVersion?.items ?? []
  if (boqItems.length === 0) {
    return { boqItems: [], summary: null, tradeCosts: [], floorCosts: [], costPerArea: undefined }
  }

  const entries = rateAnalysis?.entries ?? []
  const summary = calculateProjectCostSummary(boqItems, entries, materials, labourRates, equipmentRates)
  const tradeCosts = summarizeCostByTrade(boqItems, entries, materials, labourRates, equipmentRates)
  const floorCosts = summarizeCostByFloor(boqItems, entries, materials, labourRates, equipmentRates)

  const totalFloorAreaSqft = (takeoff?.architecturalFloors ?? []).reduce(
    (sum, item) => sum + effectiveArchitecturalQuantities(item).floorAreaSqft,
    0
  )
  const costPerArea = calculateCostPerArea(summary.totalProjectCost, totalFloorAreaSqft)

  return { boqItems, summary, tradeCosts, floorCosts, costPerArea }
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

// ── Detailed Calculation Sheet (Rate Analysis itemwise breakdown) ──

export interface CalculationSheetLineItem {
  name: string
  unit: string
  quantityPerUnit: number
  rate: number // live currentRate, calculateRateFromLoadedRates()-এর সাথে সামঞ্জস্যপূর্ণ
  lineCost: number // rate × quantityPerUnit
}

export interface CalculationSheetItem {
  boqItemId: string
  boqItemName: string
  unit: BOQUnit
  quantity: number // BOQ-তে এই item-এর মোট quantity
  materials: CalculationSheetLineItem[]
  labour: CalculationSheetLineItem[]
  equipment: CalculationSheetLineItem[]
  overheadPercent: number
  profitPercent: number
  breakdown: RateAnalysisCostBreakdown
  itemTotal: number // finalRate × quantity — পুরো item-এর জন্য মোট খরচ
  warnings: string[]
}

export interface CalculationSheetReportContext {
  items: CalculationSheetItem[]
  itemsWithoutRateAnalysis: string[] // BOQ-তে আছে কিন্তু কোনো Rate Analysis entry নেই
}

/**
 * প্রতিটা BOQ item-কে তার RateAnalysisEntry-র সাথে জোড়া লাগিয়ে,
 * প্রতিটা material/labour/equipment লাইনের live rate resolve করে
 * (Material/ResourceRate list থেকে name+unit+currentRate), এবং
 * calculateRateFromLoadedRates() দিয়ে ঠিক সেই একই breakdown হিসাব
 * করে যা RateAnalysisPanel UI ও Cost Report ব্যবহার করে — যাতে এই
 * sheet-এর সংখ্যা প্রজেক্টের বাকি সব জায়গার সাথে মিলে যায়।
 */
export async function buildCalculationSheetReportContext(projectId: string): Promise<CalculationSheetReportContext> {
  const [boqVersion, rateAnalysis, materials, labourRates, equipmentRates] = await Promise.all([
    getActiveBOQVersion(projectId),
    getRateAnalysis(projectId),
    listMaterials(),
    listResourceRates('labour'),
    listResourceRates('equipment'),
  ])

  const boqItems = boqVersion?.items ?? []
  const entries = rateAnalysis?.entries ?? []

  const items: CalculationSheetItem[] = []
  const itemsWithoutRateAnalysis: string[] = []

  for (const boqItem of boqItems) {
    const entry = entries.find((e) => e.boqItemId === boqItem.id)
    if (!entry) {
      itemsWithoutRateAnalysis.push(boqItem.itemName)
      continue
    }

    const { breakdown, warnings } = calculateRateFromLoadedRates(entry, materials, labourRates, equipmentRates)

    const resolveLine = (
      consumption: { materialId?: string; resourceRateId?: string; materialName?: string; resourceName?: string; quantityPerUnit: number },
      pool: { id: string; name: string; unit: string; currentRate: number }[]
    ): CalculationSheetLineItem => {
      const refId = consumption.materialId ?? consumption.resourceRateId ?? ''
      const found = pool.find((p) => p.id === refId)
      const name = consumption.materialName ?? consumption.resourceName ?? found?.name ?? 'Unknown'
      const rate = found?.currentRate ?? 0
      return {
        name,
        unit: found?.unit ?? '',
        quantityPerUnit: consumption.quantityPerUnit,
        rate,
        lineCost: rate * consumption.quantityPerUnit,
      }
    }

    items.push({
      boqItemId: boqItem.id,
      boqItemName: boqItem.itemName,
      unit: boqItem.unit,
      quantity: boqItem.quantity,
      materials: entry.materials.map((m) => resolveLine(m, materials)),
      labour: entry.labour.map((l) => resolveLine(l, labourRates)),
      equipment: entry.equipment.map((e) => resolveLine(e, equipmentRates)),
      overheadPercent: entry.overheadPercent,
      profitPercent: entry.profitPercent,
      breakdown,
      itemTotal: breakdown.finalRate * boqItem.quantity,
      warnings,
    })
  }

  return { items, itemsWithoutRateAnalysis }
}

// ── Availability check (রিপোর্ট বাটন disable করার জন্য) ────────────

export interface ReportsAvailability {
  estimateBasis: boolean
  boq: boolean
  quantity: boolean
  cost: boolean
  material: boolean
  bbs: boolean
  tender: boolean
  calculationSheet: boolean
}

/**
 * প্রতিটা report generate করার আগে ডেটা আদৌ আছে কিনা যাচাই —
 * silently খালি PDF বানানোর বদলে বাটন-ই disabled রাখা হবে, ঠিক
 * Dashboard-এর itemsWithoutRateAnalysis-এর একই "silent-omission
 * এড়ানো" নীতি অনুসরণ করে।
 */
export async function checkReportsAvailability(projectId: string): Promise<ReportsAvailability> {
  const [boqVersion, takeoff, rateAnalysis, materials, bbs, tender, hubImport] = await Promise.all([
    getActiveBOQVersion(projectId),
    getActiveQuantityTakeoff(projectId),
    getRateAnalysis(projectId),
    listMaterials(),
    getBBS(projectId),
    getTender(projectId),
    getActiveHubImport(projectId), // ２０２৬-０８-２０ যোগ — Estimate Basis section-এর জন্য
  ])

  return {
    // hubImport না থাকলেও materialCount > 0 থাকলে Estimate Basis
    // এখনো অর্থবহ (অন্তত Rate Source section দেখানোর মতো ডেটা আছে)
    // — তাই দুটোর যেকোনো একটা থাকলেই section দেখানো হয়, শূন্য
    // প্রজেক্টে "সব ফাঁকা" পাতা এড়াতে।
    estimateBasis: !!hubImport || materials.filter((m) => m.isActive).length > 0,
    boq: !!boqVersion && boqVersion.items.length > 0,
    quantity: !!takeoff && (takeoff.architecturalFloors.length > 0 || takeoff.structuralFloors.length > 0),
    cost: !!boqVersion && boqVersion.items.length > 0 && !!rateAnalysis && rateAnalysis.entries.length > 0,
    material: materials.filter((m) => m.isActive).length > 0,
    bbs: !!bbs && bbs.rows.length > 0,
    tender: !!tender && (tender.engineerEstimates.length > 0 || tender.contractorBids.length > 0),
    calculationSheet: !!boqVersion && boqVersion.items.length > 0 && !!rateAnalysis && rateAnalysis.entries.length > 0,
  }
}

// re-export যাতে PDF builder-রা effective quantity/volume হিসাব করতে
// আলাদা import path মনে রাখতে না হয়
export { effectiveArchitecturalQuantities, effectiveStructuralQuantities, summarizeFloorVolumes }
