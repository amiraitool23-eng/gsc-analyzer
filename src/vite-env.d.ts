/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth 2.0 Client ID اپ گوگل — از .env.local خوانده می‌شود */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
