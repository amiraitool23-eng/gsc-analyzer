import { useState } from 'react'
import { looksLikeClientId } from '../lib/clientId'

interface Props {
  /** مقدار فعلی (خالی یعنی هنوز تنظیم نشده) */
  current: string
  onSave: (clientId: string) => void
  onCancel?: () => void
}

/**
 * فرم وارد کردن Client ID.
 *
 * روی نسخه‌ی تحت وب هیچ فایل .env وجود ندارد، پس کاربر باید Client ID خودش را
 * همین‌جا وارد کند. آدرس origin سایت را هم نشان می‌دهیم چون کاربر باید دقیقاً
 * همان را در تنظیمات اپ گوگل مجاز کند و اشتباه در همین یک قدم، رایج‌ترین دلیل
 * کار نکردن ورود است.
 */
export function ClientIdSetup({ current, onSave, onCancel }: Props) {
  const [value, setValue] = useState(current)
  const [touched, setTouched] = useState(false)

  const trimmed = value.trim()
  const valid = looksLikeClientId(trimmed)
  const showWarning = touched && trimmed !== '' && !valid
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="card">
      <h2 className="card-title">قدم اول: Client ID اپ گوگل</h2>
      <p className="card-desc">
        برای اینکه این ابزار بتواند به حساب سرچ کنسول شما وصل شود، به Client ID اپ گوگل خودتان
        نیاز دارد. آن را یک‌بار اینجا وارد کنید؛ در همین مرورگر ذخیره می‌شود و دفعه‌ی بعد لازم
        نیست دوباره واردش کنید.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (trimmed !== '') onSave(trimmed)
        }}
      >
        <label className="field-label" htmlFor="client-id-input">
          Client ID
        </label>
        <input
          id="client-id-input"
          className="search-input field-wide ltr"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="123456789-abcdefg.apps.googleusercontent.com"
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
        />

        {showWarning && (
          <p className="field-warn">
            معمولاً Client ID به <span className="ltr">.apps.googleusercontent.com</span> ختم
            می‌شود. مطمئنید مقدار درست را کپی کرده‌اید؟ (اگر مطمئنید، باز هم می‌توانید ذخیره کنید.)
          </p>
        )}

        <div className="alert-actions" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" type="submit" disabled={trimmed === ''}>
            ذخیره و ادامه
          </button>
          {onCancel && (
            <button className="btn btn-ghost" type="button" onClick={onCancel}>
              انصراف
            </button>
          )}
        </div>
      </form>

      <details className="setup-help">
        <summary>Client ID ندارم / نمی‌دانم از کجا بیاورم</summary>
        <ol className="tip-list" style={{ marginTop: 10 }}>
          <li>
            به <span className="ltr">console.cloud.google.com</span> بروید و یک پروژه بسازید یا
            انتخاب کنید.
          </li>
          <li>
            از <span className="ltr">APIs &amp; Services → Library</span> دنبال{' '}
            <span className="ltr">Google Search Console API</span> بگردید و{' '}
            <span className="ltr">Enable</span> را بزنید.
          </li>
          <li>
            در <span className="ltr">OAuth consent screen</span> نوع{' '}
            <span className="ltr">External</span> را بزنید و در بخش{' '}
            <span className="ltr">Test users</span> ایمیل گوگل خودتان را اضافه کنید. (اگر این را
            جا بیندازید، موقع دریافت داده خطای ۴۰۳ می‌گیرید.)
          </li>
          <li>
            در <span className="ltr">Credentials → Create Credentials → OAuth client ID</span> نوع{' '}
            <span className="ltr">Web application</span> را انتخاب کنید.
          </li>
          <li>
            در بخش <span className="ltr">Authorized JavaScript origins</span> دقیقاً این آدرس را
            اضافه کنید:
            <div className="origin-box ltr">{origin}</div>
            <span className="faint">
              بدون اسلش آخر و بدون هیچ چیز اضافه. اگر این آدرس ثبت نشود، پنجره‌ی ورود گوگل باز
              می‌شود ولی خطا می‌دهد.
            </span>
          </li>
          <li>Client ID ساخته‌شده را کپی و در کادر بالا وارد کنید.</li>
        </ol>
      </details>
    </div>
  )
}
