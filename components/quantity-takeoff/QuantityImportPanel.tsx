// components/quantity-takeoff/QuantityImportPanel.tsx
'use client'

import { useState, useRef } from 'react'
import { parseQuantityTakeoffExport } from '@/lib/services/quantity-takeoff.service'
import { QuantityTakeoffExport } from '@/lib/types/quantity-takeoff.types'
import { useLang } from '@/components/providers/LanguageProvider'
import { AutoSyncStatus } from '@/lib/integration/hub-module-import'

interface QuantityImportPanelProps {
  /** manual JSON/paste path-এর জন্য — auto-sync (page-level,
   * এই component-এর বাইরে) নিজেই save+link করে ফেলে, তাই manual
   * path-এর payload page-কে দিয়ে page-ই আগের মতো save করবে
   * (sourceVersions সবসময় undefined এখানে, কারণ raw JSON-এ থাকা
   * version Hub-verified না)।
   */
  onImportSuccess: (payload: QuantityTakeoffExport, sourceVersions?: { architectural: number; structural: number }) => void
  /** page থেকে pass করা হয় (useHubQuantityAutoSync ওখানে মাউন্ট
   * করা থাকে, সবসময় সক্রিয় — এই panel unmount হলেও চলতে থাকে,
   * quantityData ইতিমধ্যে থাকলেও upstream বদলালে auto-sync হওয়া
   * উচিত) — এই component শুধু status দেখায়, নিজে listener মাউন্ট
   * করে না।
   */
  autoSyncStatus: AutoSyncStatus | null
}

/**
 * এখন দুটো path সমান্তরালে চলে:
 *  1. Hub auto-sync status (উপরে, শুধু status দেখায়, কোনো বাটন নেই) —
 *     আসল listener page-level-এ (app/.../quantity-takeoff/page.tsx)
 *     মাউন্ট করা, কারণ auto-sync-কে চালু থাকতে হবে এই panel
 *     unmount হওয়ার পরও (quantityData থাকলে এই panel আর দেখানো হয়
 *     না, কিন্তু upstream তখনও বদলাতে পারে)।
 *  2. Manual JSON (drag-drop + paste, নিচে, অপরিবর্তিত) — Structural
 *     app এখনো Hub-এ কিছু পাঠায় না বলে auto-sync আজ "waiting"-এ
 *     থাকবে; ততক্ষণ এই fallback ব্যবহার করা যায়।
 */
export function QuantityImportPanel({ onImportSuccess, autoSyncStatus }: QuantityImportPanelProps) {
  const { t } = useLang()
  const [pasteValue, setPasteValue] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleParsed(rawJson: string) {
    const result = parseQuantityTakeoffExport(rawJson)
    setErrors(result.errors)
    setWarnings(result.warnings)
    if (result.success && result.payload) {
      onImportSuccess(result.payload)
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') handleParsed(reader.result)
    }
    reader.onerror = () => {
      setErrors([t('fileReadError')])
      setWarnings([])
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('quantityImportTitle')}</h2>
        <p className="mt-1 text-sm text-text-muted">{t('quantityImportDescription')}</p>
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <p className="text-sm font-medium text-text-primary">{t('hubAutoFetchTitle')}</p>
        {!autoSyncStatus && <p className="mt-2 text-sm text-text-muted">{t('hubAutoFetchLoading')}</p>}
        {autoSyncStatus?.state === 'waiting' && (
          <p className="mt-2 text-sm text-text-muted">
            {!autoSyncStatus.result.architecturalAvailable ? t('hubAutoFetchArchNotFound') : t('hubAutoFetchStructNotFound')}
          </p>
        )}
        {autoSyncStatus?.state === 'error' && (
          <ul className="mt-2 space-y-1 text-sm text-status-holdText list-disc list-inside">
            {autoSyncStatus.result.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        )}
        {autoSyncStatus?.state === 'synced' && (
          <p className="mt-2 text-xs text-text-muted">
            {t('hubAutoSyncedLabel')} — Architectural {t('hubAutoFetchVersionLabel')} {autoSyncStatus.result.architecturalVersion} · Structural{' '}
            {t('hubAutoFetchVersionLabel')} {autoSyncStatus.result.structuralVersion}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="divider flex-1" />
        <span className="text-xs text-text-muted">{t('or')}</span>
        <div className="divider flex-1" />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
          px-6 py-10 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-surface-border bg-white hover:border-text-muted'}
        `}
      >
        <svg
          className="h-8 w-8 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        <p className="text-sm text-text-secondary">
          <span className="font-medium text-brand-600">{t('chooseFile')}</span> {t('orDragHere')}
        </p>
        <p className="text-xs text-text-muted">{t('jsonFileOnly')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="divider flex-1" />
        <span className="text-xs text-text-muted">{t('or')}</span>
        <div className="divider flex-1" />
      </div>

      <div>
        <label htmlFor="quantity-json-paste" className="block text-sm font-medium text-text-secondary mb-1.5">
          {t('pasteJson')}
        </label>
        <textarea
          id="quantity-json-paste"
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
          rows={6}
          placeholder='{"projectId": "...", "architecturalFloors": [...], "structuralFloors": [...]}'
          className="input-field font-mono"
        />
        <button
          onClick={() => pasteValue.trim() && handleParsed(pasteValue)}
          disabled={!pasteValue.trim()}
          className="btn-primary mt-2"
        >
          {t('verifyData')}
        </button>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{t('fixTheseIssues')}</p>
          <ul className="mt-2 space-y-1 text-sm text-red-700 list-disc list-inside">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-status-holdBorder bg-status-holdBg p-4">
          <p className="text-sm font-medium text-status-holdText">{t('noticeImportProceeds')}</p>
          <ul className="mt-2 space-y-1 text-sm text-status-holdText list-disc list-inside">
            {warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
