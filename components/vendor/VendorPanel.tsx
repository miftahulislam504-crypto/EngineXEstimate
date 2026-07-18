// components/vendor/VendorPanel.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Award, ClipboardList } from 'lucide-react'
import { Supplier, Material } from '@/lib/types/material.types'
import { Quotation, PurchaseRecord } from '@/lib/types/vendor.types'
import { createSupplier, listSuppliers } from '@/lib/firestore/supplier.firestore'
import { getVendorData, addQuotation, addPurchaseRecord } from '@/lib/firestore/vendor.firestore'
import { listMaterials } from '@/lib/firestore/material.firestore'
import { buildPriceComparison, validateSupplier, validateQuotation, validatePurchaseRecord } from '@/lib/services/vendor.service'
import { useLang } from '@/components/providers/LanguageProvider'

interface VendorPanelProps {
  projectId: string
}

export function VendorPanel({ projectId }: VendorPanelProps) {
  const { t, lang } = useLang()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')

  const locale = lang === 'bn' ? 'bn-BD' : 'en-US'

  useEffect(() => {
    refresh()
  }, [projectId])

  async function refresh() {
    setLoading(true)
    try {
      const [supplierList, matList, vendorData] = await Promise.all([
        listSuppliers(),
        listMaterials(),
        getVendorData(projectId),
      ])
      setSuppliers(supplierList)
      setMaterials(matList)
      setQuotations(vendorData?.quotations ?? [])
      setPurchases(vendorData?.purchases ?? [])
    } finally {
      setLoading(false)
    }
  }

  const priceComparison = useMemo(
    () => (selectedMaterialId ? buildPriceComparison(selectedMaterialId, quotations, suppliers) : []),
    [selectedMaterialId, quotations, suppliers]
  )

  async function handleAddSupplier(input: { name: string; contactPerson?: string; phone?: string; address?: string }) {
    await createSupplier(input)
    setShowSupplierForm(false)
    refresh()
  }

  async function handleAddQuotation(input: { supplierId: string; materialId: string; quotedRate: number; notes?: string }) {
    const material = materials.find((m) => m.id === input.materialId)
    await addQuotation(projectId, { ...input, materialName: material?.name ?? '' })
    setShowQuoteForm(false)
    refresh()
  }

  async function handleAddPurchase(input: { supplierId: string; materialId: string; quantity: number; unitRate: number; invoiceReference?: string }) {
    const material = materials.find((m) => m.id === input.materialId)
    await addPurchaseRecord(projectId, { ...input, materialName: material?.name ?? '' })
    setShowPurchaseForm(false)
    refresh()
  }

  if (loading) {
    return <p className="text-sm text-text-muted">{t('loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('vendorTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('vendorDescription')}</p>
      </div>

      {/* Supplier List */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-text-primary">{t('supplierListTitle')}</h3>
          <button className="btn-outline text-xs py-1 px-2" onClick={() => setShowSupplierForm(true)}>
            <Plus size={14} />
            {t('newSupplier')}
          </button>
        </div>
        {showSupplierForm && (
          <SupplierForm onCancel={() => setShowSupplierForm(false)} onSubmit={handleAddSupplier} />
        )}
        {suppliers.length === 0 ? (
          <p className="text-sm text-text-muted mt-2">{t('noSuppliersYet')}</p>
        ) : (
          <div className="divide-y divide-surface-border mt-2">
            {suppliers.map((s) => (
              <div key={s.id} className="py-2">
                <p className="text-sm text-text-primary font-medium">{s.name}</p>
                {(s.contactPerson || s.phone) && (
                  <p className="text-xs text-text-muted">
                    {s.contactPerson}
                    {s.contactPerson && s.phone ? ' · ' : ''}
                    {s.phone}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quotation Collection + Price Comparison */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">
            <Award size={16} /> {t('quotationPriceComparisonTitle')}
          </h3>
          <button className="btn-outline text-xs py-1 px-2" onClick={() => setShowQuoteForm(true)}>
            <Plus size={14} />
            {t('newQuote')}
          </button>
        </div>

        {showQuoteForm && (
          <QuotationForm
            suppliers={suppliers}
            materials={materials}
            onCancel={() => setShowQuoteForm(false)}
            onSubmit={handleAddQuotation}
          />
        )}

        <select
          value={selectedMaterialId}
          onChange={(e) => setSelectedMaterialId(e.target.value)}
          className="input-field text-sm mt-3"
        >
          <option value="">{t('selectMaterialToCompare')}</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {selectedMaterialId && (
          priceComparison.length === 0 ? (
            <p className="text-sm text-text-muted mt-2">{t('noQuotationForMaterial')}</p>
          ) : (
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-text-muted">
                  <th className="py-2"></th>
                  <th className="py-2">{t('supplierCol')}</th>
                  <th className="py-2">{t('priceCol')}</th>
                </tr>
              </thead>
              <tbody>
                {priceComparison.map((row) => (
                  <tr key={row.supplierId} className="border-b border-surface-border last:border-0">
                    <td className="py-2">{row.isLowest && <Award size={14} className="text-brand-600" />}</td>
                    <td className="py-2 text-text-primary">{row.supplierName}</td>
                    <td className="py-2 font-medium">৳{row.quotedRate.toLocaleString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Purchase History */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">
            <ClipboardList size={16} /> {t('purchaseHistoryTitle')}
          </h3>
          <button className="btn-outline text-xs py-1 px-2" onClick={() => setShowPurchaseForm(true)}>
            <Plus size={14} />
            {t('newPurchase')}
          </button>
        </div>
        {showPurchaseForm && (
          <PurchaseForm
            suppliers={suppliers}
            materials={materials}
            onCancel={() => setShowPurchaseForm(false)}
            onSubmit={handleAddPurchase}
          />
        )}
        {purchases.length === 0 ? (
          <p className="text-sm text-text-muted mt-2">{t('noPurchaseRecords')}</p>
        ) : (
          <div className="divide-y divide-surface-border mt-2">
            {[...purchases].sort((a, b) => b.purchasedAt - a.purchasedAt).map((p) => {
              const supplier = suppliers.find((s) => s.id === p.supplierId)
              return (
                <div key={p.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-primary">
                      {p.materialName} — {p.quantity} × ৳{p.unitRate} = ৳{p.totalAmount.toLocaleString(locale)}
                    </p>
                    <p className="text-xs text-text-muted">{supplier?.name ?? t('unknownSupplier')}</p>
                  </div>
                  <span className="text-xs text-text-muted">
                    {new Date(p.purchasedAt).toLocaleDateString(locale)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function SupplierForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (input: { name: string; contactPerson?: string; phone?: string; address?: string }) => void
}) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const validation = validateSupplier({ name })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSubmit({
      name: name.trim(),
      contactPerson: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
    })
  }

  return (
    <div className="space-y-2 border-t border-surface-border pt-3 mb-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('supplierNamePlaceholder')} className="input-field text-sm" />
      <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder={t('contactPersonPlaceholder')} className="input-field text-sm" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phonePlaceholder')} className="input-field text-sm" />
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('addressPlaceholder')} className="input-field text-sm" />
      {errors.length > 0 && <p className="text-xs text-red-600">{errors[0]}</p>}
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost text-xs py-1 px-2" onClick={onCancel}>{t('cancel')}</button>
        <button className="btn-primary text-xs py-1 px-2" onClick={handleSubmit}>{t('add')}</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function QuotationForm({
  suppliers,
  materials,
  onCancel,
  onSubmit,
}: {
  suppliers: Supplier[]
  materials: Material[]
  onCancel: () => void
  onSubmit: (input: { supplierId: string; materialId: string; quotedRate: number; notes?: string }) => void
}) {
  const { t } = useLang()
  const [supplierId, setSupplierId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [quotedRate, setQuotedRate] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const parsed = parseFloat(quotedRate)
    if (!supplierId || !materialId) {
      setErrors([t('supplierAndMaterialRequired')])
      return
    }
    const validation = validateQuotation({ quotedRate: parsed })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSubmit({ supplierId, materialId, quotedRate: parsed })
  }

  return (
    <div className="space-y-2 border-b border-surface-border pb-3 mb-3">
      <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input-field text-sm">
        <option value="">{t('selectSupplierEllipsis')}</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="input-field text-sm">
        <option value="">{t('selectMaterialEllipsisPlain')}</option>
        {materials.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <input
        type="number"
        value={quotedRate}
        onChange={(e) => setQuotedRate(e.target.value)}
        placeholder={t('quotedRatePlaceholder')}
        className="input-field text-sm"
      />
      {errors.length > 0 && <p className="text-xs text-red-600">{errors[0]}</p>}
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost text-xs py-1 px-2" onClick={onCancel}>{t('cancel')}</button>
        <button className="btn-primary text-xs py-1 px-2" onClick={handleSubmit}>{t('add')}</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

function PurchaseForm({
  suppliers,
  materials,
  onCancel,
  onSubmit,
}: {
  suppliers: Supplier[]
  materials: Material[]
  onCancel: () => void
  onSubmit: (input: { supplierId: string; materialId: string; quantity: number; unitRate: number; invoiceReference?: string }) => void
}) {
  const { t } = useLang()
  const [supplierId, setSupplierId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitRate, setUnitRate] = useState('')
  const [invoiceReference, setInvoiceReference] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit() {
    const parsedQty = parseFloat(quantity)
    const parsedRate = parseFloat(unitRate)
    if (!supplierId || !materialId) {
      setErrors([t('supplierAndMaterialRequired')])
      return
    }
    const validation = validatePurchaseRecord({ quantity: parsedQty, unitRate: parsedRate })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSubmit({
      supplierId,
      materialId,
      quantity: parsedQty,
      unitRate: parsedRate,
      invoiceReference: invoiceReference.trim() || undefined,
    })
  }

  return (
    <div className="space-y-2 border-t border-surface-border pt-3 mb-3">
      <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input-field text-sm">
        <option value="">{t('selectSupplierEllipsis')}</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="input-field text-sm">
        <option value="">{t('selectMaterialEllipsisPlain')}</option>
        {materials.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t('quantityPlaceholder')} className="input-field text-sm" />
        <input type="number" value={unitRate} onChange={(e) => setUnitRate(e.target.value)} placeholder={t('unitRatePlaceholder')} className="input-field text-sm" />
      </div>
      <input value={invoiceReference} onChange={(e) => setInvoiceReference(e.target.value)} placeholder={t('invoiceReferencePlaceholder')} className="input-field text-sm" />
      {errors.length > 0 && <p className="text-xs text-red-600">{errors[0]}</p>}
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost text-xs py-1 px-2" onClick={onCancel}>{t('cancel')}</button>
        <button className="btn-primary text-xs py-1 px-2" onClick={handleSubmit}>{t('add')}</button>
      </div>
    </div>
  )
}
