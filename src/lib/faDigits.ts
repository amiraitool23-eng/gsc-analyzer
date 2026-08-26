/**
 * تبدیل ارقام فارسی و عربی به لاتین.
 *
 * فقط برای «خواندن ورودی» است، نه نمایش — نمایش همیشه فارسی می‌ماند
 * (`Intl.NumberFormat('fa-IR')`).
 *
 * دو جا لازم شد و هر دو با دادهٔ واقعی معلوم شدند:
 *
 *   ۱) ورودی عددی کاربر در فیلترها: `Number('۱۲')` برابر NaN است.
 *   ۲) **نام ستون‌های خروجی کراولر.** Screaming Frog روی ویندوز فارسی، هدرها را
 *      محلی‌سازی می‌کند: `Title ۱` به‌جای `Title 1` و `H1-۱` به‌جای `H1-1`.
 *      بدون این تبدیل، ستون عنوان پیدا نمی‌شود و **همهٔ ۶۵۹ عنوان خالی** می‌آید —
 *      بی‌سروصدا، چون فایل درست خوانده می‌شود و فقط محتوایش خالی است.
 */

const FA_ZERO = 0x06f0 // ۰
const AR_ZERO = 0x0660 // ٠

export function foldDigits(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= FA_ZERO && code <= FA_ZERO + 9) out += String(code - FA_ZERO)
    else if (code >= AR_ZERO && code <= AR_ZERO + 9) out += String(code - AR_ZERO)
    else out += ch
  }
  return out
}
