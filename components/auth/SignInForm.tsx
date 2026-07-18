// components/auth/SignInForm.tsx
//
// Hub-এর app/login/page.tsx-এর ফর্ম অংশ থেকে গঠন ধার করা হয়েছে
// (mode switching, show/hide password, ইত্যাদি), কিন্তু কয়েকটা
// ইচ্ছাকৃত পার্থক্য আছে:
//
// 1. Hub-এর login page LanguageProvider, AuthProvider,
//    দুই-প্যানেল branded layout-এর উপর নির্ভরশীল — এগুলো এই
//    scaffold-এ কপি করা হয়নি (app/layout.tsx-এর কমেন্টে এই সিদ্ধান্ত
//    আগেই নথিভুক্ত)। তাই এখানে শুধু single-column ফর্ম, provider
//    ছাড়া।
//
// 2. Hub-এর login page bg-primary-900, text-primary-900,
//    hover:bg-primary-700 ব্যবহার করে — কিন্তু tailwind.config.ts-এ
//    কোথাও 'primary' নামে কোনো numeric color scale সংজ্ঞায়িত নেই
//    (শুধু text.primary: '#0f172a' আছে, যেটা 'text-primary' class
//    বানায়, 'bg-primary-900' না)। তাই ওই class-গুলো বর্তমানে কোনো
//    CSS render করছে না — এটা Hub-এর pre-existing bug, এই কাজের
//    আওতার বাইরে। এই component সেই ভুল pattern এড়িয়ে বরং
//    tailwind.config.ts-এ প্রকৃতপক্ষে সংজ্ঞায়িত brand-* scale
//    ব্যবহার করে (btn-primary class-ও একই brand-600/700/800
//    ব্যবহার করে, globals.css দ্রষ্টব্য)।

'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useLang } from '@/components/providers/LanguageProvider'

type Mode = 'login' | 'register' | 'reset'

export function SignInForm() {
  const { loading, error, signIn, signUp, resetPassword, clearError } = useAuthStore()
  const { t } = useLang()

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (mode === 'reset') {
      const ok = await resetPassword(email)
      if (ok) setResetSent(true)
      return
    }
    if (mode === 'login') {
      await signIn(email, password)
    } else {
      await signUp(email, password, name)
    }
  }

  function switchMode(m: Mode) {
    setMode(m)
    clearError()
    setResetSent(false)
  }

  return (
    <div className="card p-8 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-text-primary mb-1">
        {mode === 'login' ? t('signIn') : mode === 'register' ? t('newAccount') : t('resetPasswordTitle')}
      </h2>
      <p className="text-text-muted text-sm mb-6">
        {mode === 'login' ? t('signInSubtitle') : mode === 'register' ? t('signUpSubtitle') : t('resetSubtitle')}
      </p>

      {resetSent && (
        <div className="bg-status-activeBg border border-status-activeBorder text-status-activeText rounded-lg p-3 mb-4 text-sm">
          {t('resetEmailSent')}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('fullName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input-field"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{t('email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-field"
          />
        </div>

        {mode !== 'reset' && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('password')}</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-field pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        )}

        {mode === 'login' && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => switchMode('reset')}
              className="text-sm text-brand-700 hover:underline"
            >
              {t('forgotPassword')}
            </button>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading && <Loader2 className="animate-spin" size={18} />}
          {mode === 'login' ? t('signIn') : mode === 'register' ? t('createAccountBtn') : t('sendResetLink')}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-text-muted">
        {mode !== 'login' ? (
          <>
            {t('haveAccount')}{' '}
            <button onClick={() => switchMode('login')} className="text-brand-700 font-semibold hover:underline">
              {t('signInHere')}
            </button>
          </>
        ) : (
          <>
            {t('noAccount')}{' '}
            <button onClick={() => switchMode('register')} className="text-brand-700 font-semibold hover:underline">
              {t('createAccountHere')}
            </button>
          </>
        )}
      </div>

      {mode === 'reset' && (
        <div className="mt-3 text-center">
          <button onClick={() => switchMode('login')} className="text-sm text-brand-700 hover:underline">
            {t('backToSignIn')}
          </button>
        </div>
      )}
    </div>
  )
}
