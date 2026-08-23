import { useCallback, useEffect, useRef, useState } from 'react'
import type { GscSite } from '../types'
import { listSites } from '../lib/gscApi'
import { GscError, isGscError, networkError } from '../lib/errors'

export interface SitesState {
  sites: GscSite[]
  loading: boolean
  error: GscError | null
  reload: () => void
}

/** گرفتن فهرست پراپرتی‌های کاربر با sites.list */
export function useSites(token: string | null, onAuthExpired: () => void): SitesState {
  const [sites, setSites] = useState<GscSite[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<GscError | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const authExpiredRef = useRef(onAuthExpired)
  authExpiredRef.current = onAuthExpired

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    if (!token) {
      setSites([])
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    let active = true

    setLoading(true)
    setError(null)

    listSites({ token, signal: controller.signal })
      .then((result) => {
        if (!active) return
        setSites(result)
      })
      .catch((e: unknown) => {
        if (!active) return
        if (e instanceof DOMException && e.name === 'AbortError') return
        const gscError: GscError = isGscError(e) ? e : networkError(e)
        setError(gscError)
        if (gscError.kind === 'auth') authExpiredRef.current()
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [token, reloadKey])

  return { sites, loading, error, reload }
}
