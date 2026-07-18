// lib/integration/hub-import-listener.ts
//
// Module 15 — "Firestore-based event/listener system" sub-task-এর
// প্রথম বাস্তব implementation। connection-registry.ts-এর
// 'hub-to-estimating-building-bnbc' entry-র জন্য।
//
// কেন এটা এখনই সত্যিকারের "live" (শুধু placeholder না), Hub সরাসরি
// এখনো এই path-এ না লিখলেও: এই listener projects/{projectId}/
// estimatingInput/activeImport doc-টা শোনে — এটা *আমাদের নিজের*
// path, hub-import.firestore.ts-এর saveHubImport() যেটাতে লেখে।
// তাই আজই এটা কাজ করে: কেউ manual JSON import করলে (এই ব্রাউজারে
// বা অন্য কোনো ট্যাব/ডিভাইসে, একই ব্যবহারকারী), সব খোলা ট্যাব
// রিয়েল-টাইমে আপডেট পাবে, কোনো manual refresh ছাড়াই। আর ভবিষ্যতে
// Hub যদি সরাসরি এই একই activeImport path-এ লিখতে রাজি হয় (যেটা
// ব্যবহারকারী এখন Hub-এর দিকে গিয়ে ঠিক করছেন), তাহলে এই একই কোড
// কোনো পরিবর্তন ছাড়াই "সত্যিকারের cross-app live sync" হয়ে যাবে।
//
// এই ফাইলে React-নির্ভরতা রাখা হয়নি (শুধু plain Firestore + callback)
// যাতে ভবিষ্যতে Cloud Function/background context থেকেও reuse করা
// যায় — React hook wrapper আলাদা (useHubImportListener, নিচে)।

import { doc, onSnapshot, Unsubscribe, DocumentSnapshot, FirestoreError } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getHubImportById, StoredHubImport } from '@/lib/firestore/hub-import.firestore'
import { appendSyncLogEntry } from '@/lib/firestore/sync-log.firestore'

const PARENT_COLLECTION = 'estimatingInput'
const ACTIVE_POINTER_DOC = 'activeImport'
const CONNECTION_ID = 'hub-to-estimating-building-bnbc'

interface ActiveImportPointer {
  importId: string
}

export interface HubImportListenerCallbacks {
  onUpdate: (imported: StoredHubImport) => void
  onError?: (error: Error) => void
}

/**
 * projects/{projectId}/estimatingInput/activeImport pointer শোনে।
 * pointer বদলালে (নতুন import active হলে, বা rollback হলে) পুরো
 * StoredHubImport document fetch করে onUpdate-এ পাঠায়।
 *
 * প্রতিটা সফল আপডেট ও প্রতিটা ব্যর্থতা sync log-এ লেখা হয় — silent
 * failure এড়ানোর জন্য (Dashboard-এর itemsWithoutRateAnalysis-এর একই
 * নীতি: ব্যবহারকারী জানার অধিকার রাখেন কখন sync ব্যর্থ হয়েছে)।
 *
 * Returns an unsubscribe function — caller-কে অবশ্যই component
 * unmount/cleanup-এ এটা কল করতে হবে, নাহলে Firestore listener leak
 * হবে।
 */
export function listenToActiveHubImport(
  projectId: string,
  callbacks: HubImportListenerCallbacks
): Unsubscribe {
  const pointerRef = doc(db, 'projects', projectId, PARENT_COLLECTION, ACTIVE_POINTER_DOC)

  const unsubscribe = onSnapshot(
    pointerRef,
    async (snap: DocumentSnapshot) => {
      if (!snap.exists()) return // এখনো কোনো import হয়নি — এটা error না, শুধু "এখনো ডেটা নেই"

      const { importId } = snap.data() as ActiveImportPointer
      try {
        const fullImport = await getHubImportById(projectId, importId)
        if (!fullImport) {
          // pointer আছে কিন্তু document নেই — অসামঞ্জস্যপূর্ণ অবস্থা, silently ignore করা যাবে না
          const message = `activeImport pointer importId "${importId}" নির্দেশ করে, কিন্তু সেই document পাওয়া যায়নি।`
          await appendSyncLogEntry(projectId, CONNECTION_ID, 'failure', message)
          callbacks.onError?.(new Error(message))
          return
        }
        callbacks.onUpdate(fullImport)
        await appendSyncLogEntry(
          projectId,
          CONNECTION_ID,
          'success',
          `Building/BNBC data sync হয়েছে (importId: ${importId})।`
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'অজানা ত্রুটি'
        await appendSyncLogEntry(projectId, CONNECTION_ID, 'failure', 'activeImport আপডেট প্রসেস করতে ব্যর্থ।', message)
        callbacks.onError?.(err instanceof Error ? err : new Error(message))
      }
    },
    async (error: FirestoreError) => {
      // Firestore listener নিজেই ব্যর্থ হলে (permission-denied, network, ইত্যাদি)
      await appendSyncLogEntry(projectId, CONNECTION_ID, 'failure', 'Firestore listener ব্যর্থ হয়েছে।', error.message)
      callbacks.onError?.(error)
    }
  )

  return unsubscribe
}
