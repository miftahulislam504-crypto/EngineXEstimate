// components/providers/AuthProvider.tsx
//
// Hub-এর app/layout.tsx-এর একই AuthProvider pattern — root এ mount
// হয়ে useAuthStore().initialize() কল করে, যেটা Firebase-এর
// onAuthStateChanged subscribe করে store-এর user/estimatingRole/
// initialized state ভরে দেয় (store/useAuthStore.ts দ্রষ্টব্য)।
//
// এটা শুধু একটা subscription bootstrap — নিজে কোনো UI render করে না,
// children যেভাবে আসে সেভাবেই pass করে দেয়। app/page.tsx এবং
// app/project/[projectId]/layout.tsx দুটোই initialized/user state-এর
// উপর নির্ভর করে auth guard করে, তাই এই provider layout tree-র
// একদম উপরে (RootLayout-এ) থাকা জরুরি।

'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [initialize])

  return <>{children}</>
}
