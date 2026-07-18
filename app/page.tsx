'use client'

import { useState, useEffect } from 'react'
import { HubImportPanel } from '@/components/hub-import/HubImportPanel'
import { SignInForm } from '@/components/auth/SignInForm'
import {
  saveHubImport,
  getHubImportHistory,
  StoredHubImport,
} from '@/lib/firestore/hub-import.firestore'
import { EstimatingRelevantPayload } from '@/lib/types/hub-import.types'
import { useAuthStore } from '@/store/useAuthStore'
import { useLang } from '@/components/providers/LanguageProvider'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'
import { MaterialDatabase } from '@/components/materials/MaterialDatabase'
import { VendorPanel } from '@/components/vendor/VendorPanel'
import { QuantityImportPanel } from '@/components/quantity-takeoff/QuantityImportPanel'
import { QuantityBreakdown } from '@/components/quantity-takeoff/QuantityBreakdown'
import {
  saveQuantityTakeoff,
  getActiveQuantityTakeoff,
} from '@/lib/firestore/quantity-takeoff.firestore'
import { QuantityTakeoffExport, StoredQuantityTakeoff } from '@/lib/types/quantity-takeoff.types'
import { BOQGenerator } from '@/components/boq/BOQGenerator'
import { getActiveBOQVersion } from '@/lib/firestore/boq.firestore'
import { BOQItem } from '@/lib/types/boq.types'
import { ResourceRateManager } from '@/components/resource-rates/ResourceRateManager'
import { RateAnalysisPanel } from '@/components/rate-analysis/RateAnalysisPanel'
import { ProcurementPanel } from '@/components/procurement/ProcurementPanel'
import { BBSTable } from '@/components/reinforcement/BBSTable'
import { ProjectDashboard } from '@/components/dashboard/ProjectDashboard'
import { CostTrackingPanel } from '@/components/cost-tracking/CostTrackingPanel'
import { BudgetPanel } from '@/components/budget/BudgetPanel'
import { TenderPanel } from '@/components/tender/TenderPanel'
import { ReportsPanel } from '@/components/reports/ReportsPanel'
import { IntegrationHubPanel } from '@/components/integration/IntegrationHubPanel'
import { Loader2 } from 'lucide-react'

// এই পেজটা Phase 0-এর স্মোক টেস্ট হিসেবে রাখা হয়েছে — Module 1
// (Dashboard) তৈরি হলে এটাই আসল হোমপেজ হবে না, তখন এই import ফ্লো
// একটা নির্দিষ্ট Module/route-এ সরে যাবে (সম্ভবত প্রজেক্ট
// setup/onboarding-এর অংশ হিসেবে), আর auth flow আলাদা /login পেজে
// সরে যাবে Hub-এর প্যাটার্ন অনুসরণ করে।

export default function Home() {
  const { user, estimatingRole, initialized, initialize, signOut } = useAuthStore()
  const { t } = useLang()

  const [imported, setImported] = useState<EstimatingRelevantPayload | null>(null)
  const [savedVersion, setSavedVersion] = useState<StoredHubImport | null>(null)
  const [history, setHistory] = useState<StoredHubImport[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Module 2 — Quantity Takeoff state
  const [quantityImportId, setQuantityImportId] = useState<string | null>(null)
  const [quantityData, setQuantityData] = useState<StoredQuantityTakeoff | null>(null)
  const [quantityProjectId, setQuantityProjectId] = useState<string | null>(null)
  const [quantitySaving, setQuantitySaving] = useState(false)
  const [quantitySaveError, setQuantitySaveError] = useState<string | null>(null)

  // Module 3 — BOQ Generator state
  const [boqItems, setBoqItems] = useState<BOQItem[]>([])

  useEffect(() => {
    const unsub = initialize()
    return unsub
  }, [initialize])

  // যদি এই ব্রাউজারে আগে থেকেই Hub import করা প্রজেক্ট থাকে, সেই
  // প্রজেক্টের active quantity takeoff ও active BOQ version (যদি
  // থাকে) লোড করার চেষ্টা — যাতে পেজ রিফ্রেশ করলে Module 2/3-র ডেটা
  // হারিয়ে না যায়।
  useEffect(() => {
    if (imported?.projectId) {
      getActiveQuantityTakeoff(imported.projectId).then((active) => {
        if (active) {
          setQuantityData(active)
          setQuantityImportId(active.importId)
          setQuantityProjectId(imported.projectId)
        }
      })
      getActiveBOQVersion(imported.projectId).then((version) => {
        if (version) setBoqItems(version.items)
      })
    }
  }, [imported?.projectId])

  async function handleImportSuccess(payload: EstimatingRelevantPayload) {
    setImported(payload)
    setSaving(true)
    setSaveError(null)
    try {
      const stored = await saveHubImport(payload.projectId, payload)
      setSavedVersion(stored)
      const pastImports = await getHubImportHistory(payload.projectId)
      setHistory(pastImports)
    } catch (err) {
      setSaveError(t('hubImportSaveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleQuantityImportSuccess(payload: QuantityTakeoffExport) {
    setQuantitySaving(true)
    setQuantitySaveError(null)
    try {
      const stored = await saveQuantityTakeoff(payload)
      setQuantityData(stored)
      setQuantityImportId(stored.importId)
      setQuantityProjectId(payload.projectId)
    } catch {
      setQuantitySaveError(t('quantityTakeoffSaveError'))
    } finally {
      setQuantitySaving(false)
    }
  }

  async function refreshQuantityData() {
    if (!quantityProjectId) return
    const active = await getActiveQuantityTakeoff(quantityProjectId)
    if (active) setQuantityData(active)
  }

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-surface px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="text-center flex-1">
              <h1 className="text-2xl font-bold text-text-primary">{t('appName')}</h1>
              <p className="mt-1 text-sm text-text-muted">{t('authSmokeTestSubtitle')}</p>
            </div>
            <LanguageSwitcher />
          </div>
          <SignInForm />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t('appName')}</h1>
            <p className="mt-1 text-sm text-text-muted">
              {t('signedIn')} — {user.email} · {t('role')}: {estimatingRole ?? t('unknownRole')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button className="btn-ghost" onClick={() => signOut()}>
              {t('signOut')}
            </button>
          </div>
        </div>

        {/* Module 1 — Dashboard (এখন পর্যন্ত বানানো সব Module-এর সারসংক্ষেপ) */}
        {quantityProjectId && imported && (
          <div className="card p-6">
            <ProjectDashboard
              projectId={quantityProjectId}
              projectName={imported.projectName}
              boqItems={boqItems}
            />
          </div>
        )}

        {/* Module 11 — Cost Tracking (Dashboard-এর অসম্পূর্ণ Budget vs Actual অংশ পূরণ করে) */}
        {quantityProjectId && (
          <div className="card p-6">
            <CostTrackingPanel projectId={quantityProjectId} />
          </div>
        )}

        {/* Module 5/6 — Material Database */}
        <div className="card p-6">
          <MaterialDatabase />
        </div>

        {/* Module 9 — Vendor Management (supplier organization-wide, quotation/purchase project-scoped) */}
        {quantityProjectId && (
          <div className="card p-6">
            <VendorPanel projectId={quantityProjectId} />
          </div>
        )}

        {/* Module 4-এর অংশ — Labour/Equipment rate, Material-এর মতোই organization-wide, projectId লাগে না */}
        <div className="card p-6">
          <ResourceRateManager />
        </div>

        {/* Module 2 — Quantity Takeoff */}
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t('quantityTakeoffTitle')}</h2>
            <p className="text-sm text-text-muted mt-1">{t('quantityTakeoffDescription')}</p>
          </div>

          {!quantityData ? (
            <QuantityImportPanel onImportSuccess={handleQuantityImportSuccess} />
          ) : (
            <div className="space-y-4">
              {quantitySaving && <p className="text-xs text-text-muted">{t('savingInProgress')}</p>}
              {quantitySaveError && <p className="text-xs text-red-600">{quantitySaveError}</p>}
              <QuantityBreakdown
                projectId={quantityProjectId!}
                importId={quantityImportId!}
                data={quantityData}
                onDataChanged={refreshQuantityData}
              />
              <button
                className="btn-outline"
                onClick={() => {
                  setQuantityData(null)
                  setQuantityImportId(null)
                }}
              >
                {t('importNewQuantityTakeoff')}
              </button>
            </div>
          )}
        </div>

        {/* Module 3 — BOQ Generator */}
        {quantityProjectId && (
          <div className="card p-6">
            <BOQGenerator
              projectId={quantityProjectId}
              quantityTakeoff={quantityData}
              quantityImportId={quantityImportId}
              boqItems={boqItems}
              onBOQChanged={setBoqItems}
            />
          </div>
        )}

        {/* Module 4 — Rate Analysis */}
        {quantityProjectId && (
          <div className="card p-6">
            <RateAnalysisPanel projectId={quantityProjectId} boqItems={boqItems} />
          </div>
        )}

        {/* Module 8 — Procurement Planning (BOQ + Rate Analysis + BBS-এর উপর নির্ভরশীল) */}
        {quantityProjectId && (
          <div className="card p-6">
            <ProcurementPanel projectId={quantityProjectId} boqItems={boqItems} />
          </div>
        )}

        {/* Module 7 — Reinforcement Estimation (BBS) */}
        {quantityProjectId && (
          <div className="card p-6">
            <BBSTable projectId={quantityProjectId} />
          </div>
        )}

        {/* Module 10 — Budget Planning (এখানেই আসল admin-gated write test হয়) */}
        {quantityProjectId && (
          <div className="card p-6">
            <BudgetPanel projectId={quantityProjectId} />
          </div>
        )}

        {/* Module 12 — Tender Estimation (একই admin-gated finalize প্যাটার্ন) */}
        {quantityProjectId && (
          <div className="card p-6">
            <TenderPanel projectId={quantityProjectId} />
          </div>
        )}

        {/* Module 13 — Reports (এই ধাপে শুধু PDF export) */}
        {quantityProjectId && imported && (
          <div className="card p-6">
            <ReportsPanel
              projectId={quantityProjectId}
              projectName={imported.projectName}
              projectCode={imported.projectCode}
            />
          </div>
        )}

        {/* Module 15 — Integration Hub (Hub-এর path চূড়ান্ত হওয়ার অপেক্ষায়,
            নিজেদের দিকের registry/listener/sync-log foundation রেডি) */}
        {quantityProjectId && (
          <div className="card p-6">
            <IntegrationHubPanel projectId={quantityProjectId} />
          </div>
        )}

        {/* Hub import panel */}
        <div className="card p-6">
          {!imported ? (
            <HubImportPanel onImportSuccess={handleImportSuccess} />
          ) : (
            <div className="space-y-4">
              <div className="badge-active">✓ {t('dataVerified')}</div>
              <div>
                <p className="text-sm text-text-secondary">
                  <span className="font-medium">{imported.projectName}</span> ({imported.projectCode})
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {imported.buildingInfo.numFloors} {t('floors')} · {imported.buildingInfo.buildingType} ·
                  {t('liveLoad')} {imported.bnbcSettings.liveLoadValue} kN/m²
                </p>
              </div>

              {saving && <p className="text-xs text-text-muted">{t('firestoreSaving')}</p>}
              {saveError && <p className="text-xs text-red-600">{saveError}</p>}
              {!saving && !saveError && savedVersion && (
                <div className="space-y-1">
                  <p className="text-xs text-status-activeText">
                    {t('firestoreSaved', { version: savedVersion.importId })}
                  </p>
                  {history.length > 1 && (
                    <p className="text-xs text-text-muted">
                      {t('totalImportHistory', { count: history.length })}
                    </p>
                  )}
                </div>
              )}

              <button
                className="btn-outline"
                onClick={() => {
                  setImported(null)
                  setSavedVersion(null)
                  setHistory([])
                }}
              >
                {t('importAnother')}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
