/**
 * لایه‌ی احراز هویت روی Google Identity Services (GIS).
 *
 * از OAuth implicit flow با Token Client استفاده می‌کنیم؛ چون اپ کاملاً
 * سمت مرورگر است و هیچ بک‌اندی برای نگه‌داری client secret وجود ندارد.
 * توکن فقط در حافظه‌ی همین صفحه نگه داشته می‌شود — نه localStorage، نه کوکی.
 */

import { getClientId } from './clientId'

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** توکن دسترسی در حافظه؛ با رفرش صفحه از بین می‌رود (عمدی است). */
export interface AccessToken {
  token: string
  /** زمان انقضا به میلی‌ثانیه (Date.now) — گوگل معمولاً ۱ ساعت می‌دهد */
  expiresAt: number
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type?: string; message?: string }) => void
  }): TokenClient
  revoke(token: string, done?: () => void): void
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } }
  }
}

let gisPromise: Promise<GoogleOAuth2> | null = null

/** اسکریپت GIS را یک‌بار و به‌صورت تنبل بارگذاری می‌کند. */
export function loadGis(): Promise<GoogleOAuth2> {
  if (gisPromise) return gisPromise

  gisPromise = new Promise<GoogleOAuth2>((resolve, reject) => {
    const ready = () => {
      const oauth2 = window.google?.accounts?.oauth2
      if (oauth2) resolve(oauth2)
      else reject(new Error('اسکریپت گوگل بارگذاری شد اما آماده نبود.'))
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (existing) {
      if (window.google?.accounts?.oauth2) ready()
      else {
        existing.addEventListener('load', ready, { once: true })
        existing.addEventListener('error', () => reject(new Error('بارگذاری اسکریپت گوگل ناموفق بود.')), {
          once: true,
        })
      }
      return
    }

    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', ready, { once: true })
    script.addEventListener(
      'error',
      () =>
        reject(
          new Error(
            'بارگذاری اسکریپت ورود گوگل (accounts.google.com) ناموفق بود. ' +
              'دسترسی شبکه به سرویس‌های گوگل را بررسی کنید.',
          ),
        ),
      { once: true },
    )
    document.head.appendChild(script)
  }).catch((e: unknown) => {
    // تا دفعه‌ی بعد اجازه‌ی تلاش مجدد بدهیم
    gisPromise = null
    throw e
  })

  return gisPromise
}

/**
 * پنجره‌ی ورود گوگل را باز می‌کند و access token برمی‌گرداند.
 * @param prompt خالی یعنی اگر قبلاً اجازه داده شده بی‌سروصدا توکن بده؛
 *               'consent' یعنی همیشه صفحه‌ی انتخاب حساب را نشان بده.
 */
export async function requestAccessToken(prompt: '' | 'consent' = ''): Promise<AccessToken> {
  const clientId = getClientId()
  if (!clientId) {
    throw new Error('اول باید Client ID اپ گوگل خود را وارد کنید.')
  }

  const oauth2 = await loadGis()

  return new Promise<AccessToken>((resolve, reject) => {
    let settled = false

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GSC_SCOPE,
      callback: (response) => {
        if (settled) return
        settled = true
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ||
                describeOAuthError(response.error) ||
                'دریافت توکن از گوگل ناموفق بود.',
            ),
          )
          return
        }
        // expires_in بر حسب ثانیه است؛ ۶۰ ثانیه حاشیه‌ی امن کم می‌کنیم
        const lifetimeSec = response.expires_in ?? 3600
        resolve({
          token: response.access_token,
          expiresAt: Date.now() + Math.max(lifetimeSec - 60, 30) * 1000,
        })
      },
      error_callback: (error) => {
        if (settled) return
        settled = true
        if (error?.type === 'popup_closed') {
          reject(new Error('پنجره‌ی ورود گوگل بسته شد. برای ادامه باید ورود را کامل کنید.'))
        } else if (error?.type === 'popup_failed_to_open') {
          reject(
            new Error(
              'مرورگر اجازه‌ی باز شدن پنجره‌ی ورود را نداد. مسدودکننده‌ی پاپ‌آپ را برای این سایت غیرفعال کنید.',
            ),
          )
        } else {
          reject(new Error(error?.message || 'ورود به گوگل ناتمام ماند.'))
        }
      },
    })

    client.requestAccessToken({ prompt })
  })
}

/** باطل کردن توکن سمت گوگل هنگام خروج (بهترین تلاش؛ خطایش مهم نیست) */
export async function revokeToken(token: string): Promise<void> {
  try {
    const oauth2 = await loadGis()
    await new Promise<void>((resolve) => oauth2.revoke(token, resolve))
  } catch {
    /* اگر نشد هم اشکالی ندارد: توکن فقط در حافظه بود و پاک می‌شود */
  }
}

export function isExpired(token: AccessToken | null): boolean {
  return !token || Date.now() >= token.expiresAt
}

function describeOAuthError(code?: string): string {
  switch (code) {
    case 'access_denied':
      return 'دسترسی رد شد. برای استفاده از ابزار باید اجازه‌ی خواندن سرچ کنسول را بدهید.'
    case 'invalid_client':
      return 'Client ID نامعتبر است. مقدار VITE_GOOGLE_CLIENT_ID را بررسی کنید.'
    case 'idpiframe_initialization_failed':
      return 'راه‌اندازی ورود گوگل ناموفق بود؛ معمولاً یعنی origin سایت در تنظیمات اپ گوگل مجاز نشده.'
    default:
      return ''
  }
}
