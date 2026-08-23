import { useCallback, useEffect, useRef, useState } from 'react'
import type { AccessToken } from '../lib/googleAuth'
import { getClientId, isExpired, requestAccessToken, revokeToken } from '../lib/googleAuth'

export type AuthStatus = 'signedOut' | 'connecting' | 'signedIn' | 'expired'

export interface AuthState {
  status: AuthStatus
  /** توکن فقط در همین state (حافظه) نگه داشته می‌شود، نه localStorage */
  token: AccessToken | null
  error: string | null
  /** اگر Client ID تنظیم نشده باشد، UI باید راهنمای پیکربندی نشان دهد */
  clientIdMissing: boolean
  signIn: (prompt?: '' | 'consent') => Promise<void>
  signOut: () => Promise<void>
  /** وقتی API با ۴۰۱ جواب داد، UI این را صدا می‌زند تا حالت «منقضی» شود */
  markExpired: () => void
  clearError: () => void
}

export function useAuth(): AuthState {
  const [token, setToken] = useState<AccessToken | null>(null)
  const [status, setStatus] = useState<AuthStatus>('signedOut')
  const [error, setError] = useState<string | null>(null)
  const expiryTimer = useRef<number | undefined>(undefined)

  const clientIdMissing = getClientId() === ''

  // با رسیدن زمان انقضا (حدود یک ساعت) خودمان حالت را «منقضی» می‌کنیم
  // تا کاربر به جای خطای ناگهانی، پیام روشن و دکمه‌ی ورود مجدد ببیند.
  useEffect(() => {
    window.clearTimeout(expiryTimer.current)
    if (!token) return
    const remaining = token.expiresAt - Date.now()
    if (remaining <= 0) {
      setStatus('expired')
      return
    }
    expiryTimer.current = window.setTimeout(() => {
      setToken(null)
      setStatus('expired')
    }, remaining)
    return () => window.clearTimeout(expiryTimer.current)
  }, [token])

  const signIn = useCallback(async (prompt: '' | 'consent' = '') => {
    setError(null)
    setStatus('connecting')
    try {
      const next = await requestAccessToken(prompt)
      setToken(next)
      setStatus('signedIn')
    } catch (e) {
      setToken(null)
      setStatus('signedOut')
      setError(e instanceof Error ? e.message : 'ورود به گوگل ناموفق بود.')
    }
  }, [])

  const signOut = useCallback(async () => {
    const current = token
    setToken(null)
    setStatus('signedOut')
    setError(null)
    if (current && !isExpired(current)) await revokeToken(current.token)
  }, [token])

  const markExpired = useCallback(() => {
    setToken(null)
    setStatus('expired')
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { status, token, error, clientIdMissing, signIn, signOut, markExpired, clearError }
}
