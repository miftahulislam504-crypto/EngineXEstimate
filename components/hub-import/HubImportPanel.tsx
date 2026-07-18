// components/hub-import/HubImportPanel.tsx
'use client'

import { useState, useRef } from 'react'
import { parseHubExport } from '@/lib/services/hub-import.service'
import { EstimatingRelevantPayload } from '@/lib/types/hub-import.types'
import { useLang } from '@/components/providers/LanguageProvider'

interface HubImportPanelProps {
  onImportSuccess: (payload: EstimatingRelevantPayload) => void
}

/**
 * Hub থেকে manually export করা JSON গ্রহণ করার প্যানেল।
 * যতক্ষণ না civilos_bridge লাইভ হচ্ছে, এটাই Module 2-এর একমাত্র
 * data-entry পয়েন্ট। ফাইল আপলোড ও পেস্ট — দুইটা পথই রাখা হয়েছে,
 * কারণ Hub-এর integration.service.ts-এ downloadJSON() ও
 * copyToClipboard() দুইটাই আছে।
 */
export function HubImportPanel({ onImportSuccess }: HubImportPanelProps) {
  const { t } = useLang()
  const [pasteValue, setPasteValue] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleParsed(rawJson: string) {
    const result = parseHubExport(rawJson)
    setErrors(result.errors)
    setWarnings(result.warnings)

    if (result.success && result.payload) {
      onImportSuccess(result.payload)
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleParsed(reader.result)
      }
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
        <h2 className="text-lg font-semibold text-text-primary">{t('hubImportTitle')}</h2>
        <p className="mt-1 text-sm text-text-muted">{t('hubImportDescription')}</p>
      </div>

      {/* File drop zone */}
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

      {/* Paste area */}
      <div>
        <label htmlFor="hub-json-paste" className="block text-sm font-medium text-text-secondary mb-1.5">
          {t('pasteJson')}
        </label>
        <textarea
          id="hub-json-paste"
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
          rows={6}
          placeholder='{"version": "1.0", "projectId": "...", ...}'
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

      {/* Errors */}
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

      {/* Warnings — non-blocking */}
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
