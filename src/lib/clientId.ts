/**
 * Client ID اپ گوگل.
 *
 * توجه: Client ID **رمز نیست**. در OAuth مرورگری، Client ID یک شناسه‌ی عمومی است
 * که در هر درخواست به گوگل دیده می‌شود؛ چیزی که هرگز نباید ذخیره شود access token
 * است (آن فقط در حافظه می‌ماند — به `googleAuth.ts` نگاه کنید).
 * برای همین نگه داشتن Client ID در localStorage اشکالی ندارد و باعث می‌شود کاربر
 * لازم نباشد هر بار آن را وارد کند.
 *
 * ترتیب اولویت:
 *   ۱) مقداری که کاربر در همین مرورگر وارد کرده (localStorage)
 *   ۲) مقدار build-time از VITE_GOOGLE_CLIENT_ID (برای اجرای محلی با .env.local)
 */

const STORAGE_KEY = 'gsc-analyzer:client-id'

function fromEnv(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
}

function fromStorage(): string {
  try {
    return (localStorage.getItem(STORAGE_KEY) ?? '').trim()
  } catch {
    // حالت ناشناس یا ذخیره‌سازی بسته
    return ''
  }
}

export function getClientId(): string {
  return fromStorage() || fromEnv()
}

/** آیا مقدار از build آمده؟ (در این حالت UI دکمه‌ی تغییر را لازم ندارد) */
export function isClientIdFromEnv(): boolean {
  return fromStorage() === '' && fromEnv() !== ''
}

export function saveClientId(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value.trim())
  } catch {
    /* اگر ذخیره نشد، همان نشست فعلی کار می‌کند */
  }
}

export function clearClientId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* بی‌اهمیت */
  }
}

/**
 * اعتبارسنجی سرانگشتی تا کاربر متوجه اشتباه رایج شود:
 * Client ID همیشه به `.apps.googleusercontent.com` ختم می‌شود.
 * (این جای احراز هویت را نمی‌گیرد؛ فقط جلوی خطای گیج‌کننده‌ی گوگل را می‌گیرد.)
 */
export function looksLikeClientId(value: string): boolean {
  return /^[\w-]+\.apps\.googleusercontent\.com$/.test(value.trim())
}
