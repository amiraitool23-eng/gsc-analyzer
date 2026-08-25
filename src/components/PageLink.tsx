/**
 * آدرس صفحه به‌صورت لینکِ باز شونده در تب تازه.
 *
 * دو نکته:
 *
 * ۱) `target="_blank"` همراه `rel="noopener noreferrer"` می‌آید. بدون `noopener`،
 *    صفحه‌ی مقصد از طریق `window.opener` به این تب دسترسی دارد.
 *
 * ۲) آدرس فارسی در سرچ کنسول درصدکدشده برمی‌گردد
 *    (`/%D8%A7%D9%84%D9%81%D8%A8%D8%A7%DB%8C-%D8%B3%D8%A6%D9%88`). خواندنش برای
 *    کاربر ناممکن است، پس برای **نمایش** رمزگشایی می‌شود؛ خودِ `href` دست‌نخورده
 *    می‌ماند چون گوگل همان شکل کدشده را برگردانده و مرورگر با همان می‌رود.
 */

export function prettyUrl(url: string): string {
  try {
    return decodeURI(url)
  } catch {
    // آدرس بدشکل (٪ تنها): همان خام را نشان بده، خطا ندهیم
    return url
  }
}

interface Props {
  url: string
  className?: string
}

export function PageLink({ url, className }: Props) {
  return (
    <a
      className={`page-link ltr${className ? ` ${className}` : ''}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={prettyUrl(url)}
    >
      {prettyUrl(url)}
    </a>
  )
}
