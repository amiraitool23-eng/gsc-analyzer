interface Props {
  status: 'signedOut' | 'connecting' | 'expired'
  error: string | null
  clientIdMissing: boolean
  onSignIn: () => void
}

/** صفحه‌ی شروع: توضیح ابزار + دکمه‌ی «اتصال به سرچ کنسول». */
export function ConnectPanel({ status, error, clientIdMissing, onSignIn }: Props) {
  return (
    <>
      {status === 'expired' && (
        <div className="alert alert-warn" role="alert">
          <div className="alert-title">نشست شما تمام شد</div>
          <p className="alert-body">
            توکن دسترسی گوگل حدوداً یک ساعت اعتبار دارد و مهلتش تمام شده است. برای دریافت داده‌ی
            تازه دوباره وارد شوید. داده‌های کش‌شده روی همین مرورگر باقی مانده‌اند.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">اتصال به Google Search Console</h2>
        <p className="card-desc">
          با حساب گوگلی وارد شوید که به پراپرتی‌های سرچ کنسول شما دسترسی دارد. ابزار فقط اجازه‌ی
          <span className="ltr"> webmasters.readonly </span>
          می‌گیرد؛ یعنی هیچ تغییری در حساب شما نمی‌دهد و فقط داده را می‌خواند.
        </p>

        {clientIdMissing ? (
          <div className="alert alert-error" role="alert">
            <div className="alert-title">پیکربندی ناقص است</div>
            <p className="alert-body">
              مقدار <span className="ltr">VITE_GOOGLE_CLIENT_ID</span> تنظیم نشده. فایل{' '}
              <span className="ltr">.env.local</span> را از روی{' '}
              <span className="ltr">.env.example</span> بسازید، Client ID اپ گوگل خود را در آن
              بگذارید و سرور توسعه را دوباره اجرا کنید.
            </p>
          </div>
        ) : (
          <>
            <button
              className="btn btn-primary"
              onClick={onSignIn}
              disabled={status === 'connecting'}
            >
              {status === 'connecting' ? 'در حال اتصال…' : 'اتصال به سرچ کنسول'}
            </button>
            {error && (
              <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>
                <div className="alert-title">ورود کامل نشد</div>
                <p className="alert-body">{error}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">این ابزار چه کار می‌کند؟</h2>
        <ul className="tip-list">
          <li>
            داده‌ی سه ماه گذشته را با ابعاد «صفحه» و «کوئری» از سرچ کنسول می‌گیرد و در جدولی
            قابل مرتب‌سازی نشان می‌دهد.
          </li>
          <li>
            همه‌چیز در مرورگر خودتان اجرا می‌شود. هیچ بک‌اندی وجود ندارد و داده‌ی شما به هیچ سروری
            فرستاده نمی‌شود.
          </li>
          <li>
            توکن دسترسی فقط در حافظه‌ی همین صفحه نگه داشته می‌شود؛ با بستن یا رفرش صفحه پاک می‌شود.
          </li>
          <li>
            داده‌ی دریافت‌شده در IndexedDB همین مرورگر کش می‌شود تا بعد از رفرش دوباره دانلود نشود.
          </li>
        </ul>
      </div>
    </>
  )
}
