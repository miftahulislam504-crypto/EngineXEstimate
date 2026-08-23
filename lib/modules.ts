// lib/modules.ts
//
// Estimating workspace sidebar-এর নেভিগেশন তালিকা। এখানে module
// path/label/icon একবার সংজ্ঞায়িত করা হলো যাতে
// app/project/[projectId]/layout.tsx শুধু এই list map করে —
// route folder (app/project/[projectId]/{path}/page.tsx) আর
// sidebarLabelKey (lib/i18n.ts-এর nav* key) দুটোই এখানে মিলিয়ে
// রাখা হয়েছে যাতে নতুন module যোগ করলে একটাই জায়গা বদলাতে হয়।
//
// resourceRates (Module 4-এর ট্যাব) আর hub-import (Module 14, dashboard/
// integration-এ embedded) আলাদা sidebar entry না — তাদের নিজের
// route folder নেই, তাই এই list-এ নেই।

import {
  LayoutDashboard,
  Ruler,
  FileSpreadsheet,
  Calculator,
  Package,
  Truck,
  ClipboardList,
  Layers,
  Wallet,
  Gavel,
  TrendingUp,
  FileText,
  Plug,
  Zap,
  Droplets,
  type LucideIcon,
} from 'lucide-react'
import { Lang } from '@/lib/i18n'

export type SidebarLabelKey =
  | 'navDashboard'
  | 'navQuantityTakeoff'
  | 'navBoq'
  | 'navRateAnalysis'
  | 'navMaterials'
  | 'navVendors'
  | 'navProcurement'
  | 'navReinforcement'
  | 'navElectrical' // ２０২৬-０৮-２０ যোগ, Module 16 (audit gap #1)
  | 'navPlumbing' // ２０২৬-０৮-２০ যোগ, Module 17 (audit gap #1)
  | 'navBudget'
  | 'navTender'
  | 'navCostTracking'
  | 'navReports'
  | 'navIntegration'

export interface EstimatingModule {
  // app/project/[projectId]/{path}/page.tsx
  path: string
  // lib/i18n.ts-এর translations[lang][key]
  sidebarLabelKey: SidebarLabelKey
  icon: LucideIcon
  moduleNumber: number
}

export const ESTIMATING_MODULES: EstimatingModule[] = [
  { path: 'dashboard', sidebarLabelKey: 'navDashboard', icon: LayoutDashboard, moduleNumber: 1 },
  { path: 'quantity-takeoff', sidebarLabelKey: 'navQuantityTakeoff', icon: Ruler, moduleNumber: 2 },
  { path: 'boq', sidebarLabelKey: 'navBoq', icon: FileSpreadsheet, moduleNumber: 3 },
  { path: 'rate-analysis', sidebarLabelKey: 'navRateAnalysis', icon: Calculator, moduleNumber: 4 },
  { path: 'materials', sidebarLabelKey: 'navMaterials', icon: Package, moduleNumber: 5 },
  { path: 'vendor', sidebarLabelKey: 'navVendors', icon: Truck, moduleNumber: 9 },
  { path: 'procurement', sidebarLabelKey: 'navProcurement', icon: ClipboardList, moduleNumber: 8 },
  { path: 'reinforcement', sidebarLabelKey: 'navReinforcement', icon: Layers, moduleNumber: 7 },
  // ２０২৬-０৮-２０ যোগ — Electrical/Plumbing, reinforcement-এর ঠিক পরে
  // sidebar position, কারণ conceptually এটাও "detailed trade-level
  // input" module (BBS-এর মতোই manual entry, BOQ-তে auto-export)।
  { path: 'electrical', sidebarLabelKey: 'navElectrical', icon: Zap, moduleNumber: 16 },
  { path: 'plumbing', sidebarLabelKey: 'navPlumbing', icon: Droplets, moduleNumber: 17 },
  { path: 'budget', sidebarLabelKey: 'navBudget', icon: Wallet, moduleNumber: 10 },
  { path: 'tender', sidebarLabelKey: 'navTender', icon: Gavel, moduleNumber: 12 },
  { path: 'cost-tracking', sidebarLabelKey: 'navCostTracking', icon: TrendingUp, moduleNumber: 11 },
  { path: 'reports', sidebarLabelKey: 'navReports', icon: FileText, moduleNumber: 13 },
  { path: 'integration', sidebarLabelKey: 'navIntegration', icon: Plug, moduleNumber: 15 },
]

// layout.tsx-এর t(mod.sidebarLabelKey) call-টা Lang-agnostic থাকার
// জন্য এই helper — সরাসরি ব্যবহার না হলেও type-safety-এর জন্য রাখা
export type { Lang }
