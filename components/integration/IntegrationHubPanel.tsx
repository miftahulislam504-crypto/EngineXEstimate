// components/integration/IntegrationHubPanel.tsx
//
// Module 15 — connection registry-র প্রতিটা entry-র status, listener
// health (hub-import connection-এর জন্য সত্যিকারের), ও সাম্প্রতিক
// sync log একসাথে দেখায়। ReportsPanel-এর card-grid + badge কনভেনশন
// অনুসরণ করা হয়েছে।

'use client'

import { useState, useEffect } from 'react'
import { Radio, Clock, AlertTriangle, CheckCircle2, XCircle, Link2, Info, Activity } from 'lucide-react'
import { useLang, TFn } from '@/components/providers/LanguageProvider'
import { CONNECTION_REGISTRY } from '@/lib/integration/connection-registry'
import { useHubImportListener } from '@/lib/integration/useHubImportListener'
import { subscribeToEvents } from '@/lib/integration/hub-sdk-client'
import { getSyncLog } from '@/lib/firestore/sync-log.firestore'
import { summarizeConnectionHealth, ConnectionHealth } from '@/lib/services/integration-hub.service'
import { SyncLogEntry, ConnectionStatus } from '@/lib/types/integration-hub.types'
import { HubEvent, EVENT_LABELS_BN } from '@/lib/types/event.types'
import type { TranslationKey } from '@/lib/i18n'

interface IntegrationHubPanelProps {
  projectId: string
}

const STATUS_LABEL_KEYS: Record<ConnectionStatus, TranslationKey> = {
  live: 'connectionStatusLive',
  listening: 'connectionStatusListening',
  manual: 'connectionStatusManual',
  planned: 'connectionStatusPlanned',
}

const STATUS_BADGE_CLASS: Record<ConnectionStatus, string> = {
  live: 'badge-active',
  listening: 'badge-hold',
  manual: 'badge-hold',
  planned: 'badge-done',
}

export function IntegrationHubPanel({ projectId }: IntegrationHubPanelProps) {
  const { t, lang } = useLang()
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US'

  const [logEntries, setLogEntries] = useState<SyncLogEntry[]>([])
  const [loadingLog, setLoadingLog] = useState(true)
  const [hubEvents, setHubEvents] = useState<HubEvent[]>([])

  // hub-import connection-এর জন্য সত্যিকারের সক্রিয় listener — এই
  // panel মাউন্ট থাকা অবস্থায় activeImport pointer বদলালে রিয়েল-টাইমে
  // ধরা পড়বে ও নিচের sync log নিজে থেকেই রিফ্রেশ হবে।
  const { connected: listenerConnected, error: listenerError } = useHubImportListener(projectId)

  useEffect(() => {
    loadLog()
  }, [projectId])

  // Hub SDK-এর প্রকৃত events subscription — Hub নিজে ও Estimating
  // (এই app) একই projects/{projectId}/events collection-এ লেখে/পড়ে,
  // তাই এখানে দেখা event-গুলো সত্যিই cross-app হতে পারে (ভবিষ্যতে
  // Structural/Architectural যোগ হলে তাদের event-ও এখানে দেখা যাবে)।
  useEffect(() => {
    const unsubscribe = subscribeToEvents(projectId, setHubEvents, 15)
    return () => unsubscribe()
  }, [projectId])

  // listener কোনো নতুন sync log entry লিখলে (success/failure) সেটা
  // এখানে দেখানোর জন্য পুনরায় লোড — listener নিজে থেকে UI push করে
  // না, তাই এই সাধারণ re-fetch যথেষ্ট (Firestore-এর নিজস্ব onSnapshot
  // ব্যবহার না করে সরল রাখা হয়েছে, কারণ log ঘন ঘন বদলায় না)।
  useEffect(() => {
    if (listenerConnected) loadLog()
  }, [listenerConnected])

  async function loadLog() {
    setLoadingLog(true)
    try {
      const stored = await getSyncLog(projectId)
      setLogEntries(stored?.entries ?? [])
    } finally {
      setLoadingLog(false)
    }
  }

  const health = summarizeConnectionHealth(CONNECTION_REGISTRY, logEntries)
  const recentLog = [...logEntries].sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 10)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('integrationHubTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('integrationHubDescription')}</p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Radio size={14} className={listenerConnected ? 'text-status-activeText' : 'text-text-muted'} />
        <span className={listenerConnected ? 'text-status-activeText' : 'text-text-muted'}>
          {listenerConnected ? t('listenerConnectedLabel') : t('listenerDisconnectedLabel')}
        </span>
        {listenerError && (
          <span className="text-red-600 flex items-center gap-1">
            <XCircle size={14} />
            {t('listenerErrorLabel')}: {listenerError.message}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {health.map((h) => (
          <ConnectionCard key={h.connection.id} health={h} locale={locale} t={t} />
        ))}
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5">
          <Activity size={14} className="text-brand-600" />
          {t('hubEventsFeedTitle')}
        </p>
        {hubEvents.length === 0 ? (
          <p className="text-xs text-text-muted">{t('noHubEventsYet')}</p>
        ) : (
          <ul className="space-y-2">
            {hubEvents.map((event: HubEvent) => (
              <li key={event.id} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase text-brand-700 bg-brand-50 border border-brand-200 rounded-md px-1.5 py-0.5">
                  {event.sourceApp}
                </span>
                <div className="min-w-0">
                  <span className="text-text-primary font-medium">
                    {lang === 'bn' ? EVENT_LABELS_BN[event.type] ?? event.type : event.type}
                  </span>
                  <span className="block text-text-muted mt-0.5">{new Date(event.createdAt).toLocaleString(locale)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold text-text-primary mb-3">{t('recentSyncLogTitle')}</p>
        {loadingLog ? (
          <p className="text-xs text-text-muted">{t('loading')}</p>
        ) : recentLog.length === 0 ? (
          <p className="text-xs text-text-muted">{t('noSyncLogYet')}</p>
        ) : (
          <ul className="space-y-2">
            {recentLog.map((entry) => (
              <SyncLogRow key={entry.id} entry={entry} locale={locale} t={t} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function ConnectionCard({
  health,
  locale,
  t,
}: {
  health: ConnectionHealth
  locale: string
  t: TFn
}) {
  const { connection, lastSync, isStale } = health
  const directionKey = connection.direction === 'upstream' ? 'connectionDirectionUpstream' : 'connectionDirectionDownstream'

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{connection.label}</p>
          <p className="text-xs text-text-muted mt-0.5">
            <Link2 size={11} className="inline mr-1" />
            {connection.counterpartApp} · {t(directionKey)}
          </p>
        </div>
        <span className={STATUS_BADGE_CLASS[connection.status]}>{t(STATUS_LABEL_KEYS[connection.status])}</span>
      </div>

      <p className="text-xs text-text-secondary">{connection.dataDescription}</p>

      <div className="flex items-center gap-1 text-xs text-text-muted">
        <Clock size={11} />
        {t('lastSyncLabel')}:{' '}
        {lastSync ? new Date(lastSync.occurredAt).toLocaleString(locale) : t('neverSyncedLabel')}
      </div>

      {!connection.isPathConfirmed && (
        <div className="flex items-start gap-1.5 text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2 py-1.5">
          <Info size={12} className="mt-0.5 shrink-0" />
          {t('pathNotConfirmed')}
        </div>
      )}

      {isStale && (
        <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {t('staleWarning')}
        </div>
      )}

      <p className="text-[11px] text-text-muted">
        {t('relatedModulesLabel')}: {connection.relatedModules.join(', ')}
      </p>
    </div>
  )
}

function SyncLogRow({
  entry,
  locale,
  t,
}: {
  entry: SyncLogEntry
  locale: string
  t: TFn
}) {
  const statusKey =
    entry.status === 'success' ? 'syncStatusSuccess' : entry.status === 'failure' ? 'syncStatusFailure' : 'syncStatusStale'
  const Icon = entry.status === 'success' ? CheckCircle2 : entry.status === 'failure' ? XCircle : AlertTriangle
  const colorClass =
    entry.status === 'success' ? 'text-status-activeText' : entry.status === 'failure' ? 'text-red-600' : 'text-amber-600'

  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon size={13} className={`mt-0.5 shrink-0 ${colorClass}`} />
      <div className="min-w-0">
        <span className={`font-medium ${colorClass}`}>{t(statusKey)}</span>{' '}
        <span className="text-text-secondary">{entry.detail}</span>
        {entry.errorMessage && <span className="block text-text-muted mt-0.5">{entry.errorMessage}</span>}
        <span className="block text-text-muted mt-0.5">{new Date(entry.occurredAt).toLocaleString(locale)}</span>
      </div>
    </li>
  )
}
