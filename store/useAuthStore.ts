// store/useAuthStore.ts
//
// Hub-এর store/useAuthStore.ts-এর সাথে গঠনগতভাবে একই — একই Firebase
// Auth instance শেয়ার করা হচ্ছে (lib/firebase.ts একই shared project
// কানেক্ট করে), তাই sign-in flow ব্যবহারকারীর জন্য অভিজ্ঞতা একই থাকা
// উচিত।
//
// গুরুত্বপূর্ণ পার্থক্য: users/{uid} collection-টা Hub-এর সাথে শেয়ার্ড
// (একই Firestore project, একই collection নাম)। Hub-এ ইতিমধ্যে
// role: 'engineer' | 'admin' ফিল্ড লেখা হয় সেই document-এ। যদি আমরা
// সরাসরি সেই একই "role" ফিল্ডে 'admin' | 'member' লিখে বসিয়ে দিই,
// দুই app-এর role vocabulary সংঘর্ষ করবে (Hub আশা করবে 'engineer',
// আমরা লিখবো 'member' — Hub যদি কখনো role-based logic যোগ করে সেটা
// ভেঙে যাবে)।
//
// তাই এই app নিজের role আলাদা ফিল্ডে রাখছে:
// users/{uid}.estimatingRole — Hub-এর "role" ফিল্ডকে স্পর্শ না করেই।

import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { UserRole } from '@/lib/types/auth.types'

interface AuthState {
  user: FirebaseUser | null
  estimatingRole: UserRole | null
  loading: boolean
  error: string | null
  initialized: boolean
  signIn: (email: string, password: string) => Promise<boolean>
  signUp: (email: string, password: string, name: string) => Promise<boolean>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<boolean>
  clearError: () => void
  initialize: () => () => void
}

const errorMessage = (code: string): string => {
  const map: Record<string, string> = {
    'auth/user-not-found': 'এই ইমেইলে কোনো একাউন্ট নেই।',
    'auth/wrong-password': 'পাসওয়ার্ড সঠিক নয়।',
    'auth/invalid-email': 'ইমেইল ঠিকানা সঠিক নয়।',
    'auth/email-already-in-use': 'এই ইমেইলে ইতিমধ্যে একাউন্ট আছে।',
    'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
    'auth/too-many-requests': 'অনেক বার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
    'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড ভুল।',
  }
  return map[code] ?? 'সমস্যা হয়েছে। আবার চেষ্টা করুন।'
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  estimatingRole: null,
  loading: false,
  error: null,
  initialized: false,

  initialize: () => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid))
        const estimatingRole = (snap.data()?.estimatingRole as UserRole) ?? null
        set({ user, estimatingRole, initialized: true })
      } else {
        set({ user: null, estimatingRole: null, initialized: true })
      }
    })
    return unsub
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null })
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      set({ loading: false })
      return true
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? ''
      set({ loading: false, error: errorMessage(code) })
      return false
    }
  },

  signUp: async (email, password, name) => {
    set({ loading: true, error: null })
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: name })
      // merge: true — Hub-এর role ফিল্ড (বা অন্য কোনো ফিল্ড) যদি আগে
      // থেকে এই document-এ থাকে, সেটা মুছে না দিয়ে শুধু আমাদের
      // ফিল্ডগুলো যোগ/আপডেট করা হচ্ছে।
      await setDoc(
        doc(db, 'users', cred.user.uid),
        {
          uid: cred.user.uid,
          email: email.trim(),
          displayName: name,
          // এখন single-user অ্যাপ — নিজেকে admin না বানালে নিজের
          // Budget/Tender approve করা যাবে না। ভবিষ্যতে
          // কর্মচারী/পার্টনার যোগ করার সময় Firestore console থেকে
          // তাদের estimatingRole: 'member' বসিয়ে দিলেই যথেষ্ট।
          estimatingRole: 'admin' satisfies UserRole,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )
      set({ loading: false })
      return true
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? ''
      set({ loading: false, error: errorMessage(code) })
      return false
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth)
    set({ user: null, estimatingRole: null })
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null })
    try {
      await sendPasswordResetEmail(auth, email.trim())
      set({ loading: false })
      return true
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? ''
      set({ loading: false, error: errorMessage(code) })
      return false
    }
  },

  clearError: () => set({ error: null }),
}))
