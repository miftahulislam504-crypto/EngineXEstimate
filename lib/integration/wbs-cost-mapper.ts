// lib/integration/wbs-cost-mapper.ts
//
// Phase 9 (ecosystem sync plan) — Estimate → Hub → PM Activity-wise
// Cost. hub-module-export.ts's file-top comment explains why
// activityWiseCost was left undefined: "Estimate app-এ কোনো
// activity/task concept নেই" (BOQ items aren't tasks). PM's WBS nodes
// (pushed via usePmOutboundSync.ts's wbsNodes field, see that file's
// header comment) are the closest thing to an activity structure this
// ecosystem has — so this mapper treats each WBS node as an
// "activity" and assigns cost to it by matching BOQ item names against
// WBS node names.
//
// ─── Why name-matching, and its real limits ────────────────────────
// BOQItem.floorId (Draw/Hub's floor ID) and WbsNode.id (PM's own
// Firestore doc ID) come from two independent ID spaces — there is no
// shared foreign key between a BOQ line item and a WBS node anywhere
// in this ecosystem today. Name matching (normalized, case/whitespace-
// insensitive substring match) is the only signal available without a
// dedicated manual-linking UI, which is out of scope here. This is a
// best-effort heuristic, not a guaranteed-correct link:
//   - A BOQ item whose name doesn't contain any WBS node's name maps
//     to no activity (excluded from activityWiseCost, counted in
//     unmatchedBoqItemCount instead) — cost is NOT silently dropped
//     from Hub, it simply isn't attributed to an activity.
//   - A BOQ item name matching multiple WBS node names picks the
//     LONGEST matching node name (more specific match wins — e.g.
//     "Ground Floor Slab" over "Ground Floor" if both exist as nodes).
//   - This does not attempt fuzzy/typo-tolerant matching. A WBS node
//     named "গ্রাউন্ড ফ্লোর" will not match a BOQ item named "Ground
//     Floor" — both apps would need to use the same language/spelling
//     for a given floor for this to link them.
// Callers surface matchRate/unmatchedBoqItemCount so the UI can show
// this isn't a fully-solved mapping (see prepareHubExport's use of
// this in hub-module-export.ts).

import type { BOQItem } from '@/lib/types/boq.types'
import type { RateAnalysisEntry } from '@/lib/types/rate-analysis.types'
import type { Material } from '@/lib/types/material.types'
import type { ResourceRate } from '@/lib/types/resource-rate.types'
import { calculateRateFromLoadedRates } from '@/lib/services/rate-analysis.service'

// Mirrors PM's src/lib/hub/usePmOutboundSync.ts wbsNodes export shape
// exactly (id/name/nodeType/parentId/path) — kept as a local type
// rather than importing cross-app, same convention every other mapper
// in this directory (architectural-mapper.ts, structural-mapper.ts)
// already follows for producer-side shapes.
export interface WbsNodeRow {
  id: string
  name: string
  nodeType: 'project' | 'building' | 'floor' | 'zone' | 'element' | 'custom'
  parentId: string | null
  path: string
}

export interface HubActivityCostEntry {
  id: string
  activityName: string
  wbsNodeId?: string
  totalCost: number
}

export interface WbsCostMapResult {
  entries: HubActivityCostEntry[]
  matchRate: number // 0..1 — কতগুলো BOQ item কোনো না কোনো WBS নোডে ম্যাচ হয়েছে
  unmatchedBoqItemCount: number
  warnings: string[]
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** BOQ item name-এর মধ্যে কোন WBS node name সবচেয়ে specific
 * (দীর্ঘতম) match হিসেবে পাওয়া যায়, সেটা বেছে নেয়। কোনো match না
 * পেলে null। */
function findBestMatchingNode(boqItemName: string, wbsNodes: WbsNodeRow[]): WbsNodeRow | null {
  const normalizedItemName = normalize(boqItemName)
  let best: WbsNodeRow | null = null
  let bestLength = 0

  for (const node of wbsNodes) {
    const normalizedNodeName = normalize(node.name)
    if (normalizedNodeName.length === 0) continue
    if (normalizedItemName.includes(normalizedNodeName) && normalizedNodeName.length > bestLength) {
      best = node
      bestLength = normalizedNodeName.length
    }
  }

  return best
}

/**
 * BOQ items + rate analysis (per-item finalRate) + PM-এর WBS নোড
 * — এই তিনটা মিলিয়ে প্রতিটা WBS নোডের জন্য মোট cost বের করে।
 * pure ফাংশন, কোনো Firestore call নেই — hub-module-export.ts এর
 * prepareHubExport() ইতিমধ্যে fetch করা ডেটা পাস করবে।
 */
export function buildActivityWiseCost(
  boqItems: BOQItem[],
  rateAnalysisEntries: RateAnalysisEntry[],
  materials: Material[],
  labourRates: ResourceRate[],
  equipmentRates: ResourceRate[],
  wbsNodes: WbsNodeRow[],
): WbsCostMapResult {
  const warnings: string[] = []

  if (wbsNodes.length === 0) {
    return {
      entries: [],
      matchRate: 0,
      unmatchedBoqItemCount: boqItems.length,
      warnings: ['PM app থেকে এখনো কোনো WBS নোড পাওয়া যায়নি — activityWiseCost খালি রাখা হয়েছে। PM app-এ WBS তৈরি হলে পরের export-এ এটা পূরণ হবে।'],
    }
  }

  const rateByBoqItemId = new Map<string, RateAnalysisEntry>()
  for (const entry of rateAnalysisEntries) {
    rateByBoqItemId.set(entry.boqItemId, entry)
  }

  // WBS node id -> সেই নোডে ম্যাচ হওয়া সব BOQ item-এর মোট cost
  const costByNodeId = new Map<string, number>()
  let unmatchedCount = 0
  let unratedCount = 0

  for (const item of boqItems) {
    const rateEntry = rateByBoqItemId.get(item.id)
    if (!rateEntry) {
      // Rate Analysis এখনো নেই এই item-এর জন্য — cost 0 ধরে বাদ, কিন্তু
      // matching-এর হিসাবে এটা "unmatched" না (WBS match আলাদা প্রশ্ন
      // rate থাকা/না-থাকা থেকে), তাই আলাদা কাউন্টার।
      unratedCount++
      continue
    }

    const matchedNode = findBestMatchingNode(item.itemName, wbsNodes)
    if (!matchedNode) {
      unmatchedCount++
      continue
    }

    const { breakdown } = calculateRateFromLoadedRates(rateEntry, materials, labourRates, equipmentRates)
    const itemTotalCost = breakdown.finalRate * item.quantity

    costByNodeId.set(matchedNode.id, (costByNodeId.get(matchedNode.id) ?? 0) + itemTotalCost)
  }

  const entries: HubActivityCostEntry[] = wbsNodes
    .filter((node) => costByNodeId.has(node.id))
    .map((node) => ({
      id: node.id,
      activityName: node.name,
      wbsNodeId: node.id,
      totalCost: costByNodeId.get(node.id) ?? 0,
    }))

  const matchableCount = boqItems.length - unratedCount
  const matchedCount = matchableCount - unmatchedCount
  const matchRate = matchableCount > 0 ? matchedCount / matchableCount : 0

  if (unmatchedCount > 0) {
    warnings.push(`${unmatchedCount}টা BOQ item কোনো WBS নোডের নামের সাথে মেলেনি — সেগুলোর cost activityWiseCost-এ যোগ হয়নি (BOQ/Budget-এর মোট cost-এ ঠিকই আছে, শুধু activity-ভিত্তিক ভাগে নেই)। PM app-এ BOQ item-এর নামের সাথে মেলে এমন WBS নোড থাকলে matching বাড়বে।`)
  }
  if (unratedCount > 0) {
    warnings.push(`${unratedCount}টা BOQ item-এর এখনো Rate Analysis নেই — সেগুলো activityWiseCost হিসাবে ধরা হয়নি।`)
  }

  return { entries, matchRate, unmatchedBoqItemCount: unmatchedCount, warnings }
}
