// app/project/[projectId]/integration/page.tsx
//
// Module 15 — এই পেজে দুটো আলাদা কম্পোনেন্ট একসাথে বসানো হয়:
//
// ১. Hub Building/BNBC auto-sync status — আগে এখানে HubImportPanel
//    (manual paste/upload JSON) ছিল, ব্যবহারকারীর নির্দেশে সেই
//    ম্যানুয়াল পথ সম্পূর্ণ বাদ দিয়ে hub-native-sync.ts এর automatic
//    mechanism দিয়ে প্রতিস্থাপিত হয়েছে — Hub-এর buildingInfo/
//    bnbcSettings/projectSettings document সরাসরি real-time subscribe
//    করে, ব্যবহারকারীর কোনো action ছাড়াই। এই page এখন শুধু sync-এর
//    বর্তমান status দেখায় (syncing/synced/error/no_data), কোনো ইনপুট
//    ফর্ম না।
// ২. IntegrationHubPanel — connection health + event log (read-only
//    monitoring, real-time listener-ভিত্তিক)।
//
// Dashboard ও Reports page-এর empty-state থেকে এখানেই পাঠানো হয় —
// এখন empty-state message আপডেট করা উচিত "import করুন" থেকে "Hub-এ
// ফর্ম পূরণ করুন" এ (useProjectEstimatingData.ts/সংশ্লিষ্ট empty-state
// UI দ্রষ্টব্য, এই ফাইলের scope-এর বাইরে)।

'use client'

import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2, AlertTriangle, Clock } from 'lucide-react'
import { useProjectEstimatingData } from '@/lib/hooks/useProjectEstimatingData'
import { useHubNativeSync } from '@/lib/integration/useHubNativeSync'
import { IntegrationHubPanel } from '@/components/integration/IntegrationHubPanel'
import { useLang } from '@/components/providers/LanguageProvider'

export default function IntegrationPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { imported } = useProjectEstimatingData(projectId)
  const { status, errorDetail } = useHubNativeSync(projectId)
  const { t } = useLang()

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t('hubNativeSyncTitle')}</h2>
            <p className="text-sm text-text-muted mt-1">{t('hubNativeSyncDescription')}</p>
          </div>
          {imported && (
            <span className="badge-active flex-shrink-0">
              <CheckCircle2 size={12} />
              {imported.projectName}
            </span>
          )}
        </div>

        {/* status === null মানে এখনো প্রথম Firestore snapshot আসেনি
            (initial load) — কিছু দেখানো হয় না, flash এড়াতে। */}
        {status === 'syncing' && (
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            {t('hubNativeSyncSyncing')}
          </p>
        )}
        {status === 'synced' && (
          <p className="flex items-center gap-1.5 text-xs text-status-activeText">
            <CheckCircle2 size={12} />
            {t('hubAutoSyncedLabel')}
          </p>
        )}
        {status === 'no_data' && (
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <Clock size={12} />
            {t('hubNativeSyncWaiting')}
          </p>
        )}
        {status === 'error' && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertTriangle size={12} />
            {t('hubNativeSyncError')}
            {errorDetail ? ` — ${errorDetail}` : ''}
          </p>
        )}
      </div>

      <IntegrationHubPanel projectId={projectId} />
    </div>
  )
}
