// lib/firestore/supplier.firestore.ts
//
// পাথ: suppliers/{supplierId}
//
// material.firestore.ts-এর একই top-level, organization-wide প্যাটার্ন
// (Phase 0/Module 5-এ "suppliers" collection rules-এ আগেভাগে
// রিজার্ভ করা হয়েছিল)। material-এর মতো priceHistory subcollection
// লাগে না — supplier নিজে কোনো "rate" রাখে না, rate থাকে
// Quotation-এ (vendor.firestore.ts)।

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Supplier } from '@/lib/types/material.types'

const SUPPLIERS_COLLECTION = 'suppliers'

function generateId(): string {
  return `supplier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function createSupplier(input: Omit<Supplier, 'id'>): Promise<Supplier> {
  const id = generateId()
  const supplier: Supplier = { ...input, id }
  await setDoc(doc(db, SUPPLIERS_COLLECTION, id), supplier)
  return supplier
}

export async function getSupplier(supplierId: string): Promise<Supplier | null> {
  const snap = await getDoc(doc(db, SUPPLIERS_COLLECTION, supplierId))
  if (!snap.exists()) return null
  return snap.data() as Supplier
}

export async function listSuppliers(): Promise<Supplier[]> {
  const suppliersRef = collection(db, SUPPLIERS_COLLECTION)
  const q = query(suppliersRef, orderBy('name'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as Supplier)
}

export async function updateSupplier(supplierId: string, updates: Partial<Omit<Supplier, 'id'>>): Promise<void> {
  await updateDoc(doc(db, SUPPLIERS_COLLECTION, supplierId), updates)
}
