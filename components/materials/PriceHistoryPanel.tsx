// components/materials/PriceHistoryPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getPriceHistory } from '@/lib/firestore/material.firestore'
import { PriceHistoryEntry } from '@/lib/types/material.types'
import { useLang } from '@/components/providers/LanguageProvider'

interface PriceHistoryPanelProps {
  materialId: string
  materialName: string
  onClose: () => void
}

/**
 * Module 5-এর "Price History" চাহিদার সরাসরি বাস্তবায়ন। একটা
 * material-এর সব রেট পরিবর্তনের কালানুক্রমিক তালিকা, নতুনটা প্রথমে।
 */
export function PriceHistoryPanel({ materialId, materialName, onClose }: PriceHistoryPanelProps) {
  const { t, lang } = useLang()
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPriceHistory(materialId)
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [materialId])

  const locale = lang === 'bn' ? 'bn-BD' : 'en-US'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="card w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{t('priceHistoryTitle')}</h3>
            <p className="text-xs text-text-muted">{materialName}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <p className="text-sm text-text-muted">{t('loading')}</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-text-muted">{t('noHistoryFound')}</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry, i) => {
                const prevEntry = entries[i + 1] // পরের index-এ পুরনো entry (নতুনটা প্রথমে সাজানো)
                const change = prevEntry ? entry.rate - prevEntry.rate : null
                return (
                  <li key={entry.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-text-primary font-medium">
                        ৳{entry.rate.toLocaleString(locale)}
                      </p>
                      <p className="text-xs text-text-muted">
                        {new Date(entry.recordedAt).toLocaleDateString(locale, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </p>
                    </div>
                    {change !== null && change !== 0 && (
                      <span
                        className={`text-xs font-medium ${change > 0 ? 'text-red-600' : 'text-status-activeText'}`}
                      >
                        {change > 0 ? '+' : ''}
                        {change.toLocaleString(locale)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
