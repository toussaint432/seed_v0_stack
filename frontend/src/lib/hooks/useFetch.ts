import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useFetch<T>(
  url: string | null,
  options?: { defaultData?: T }
): FetchState<T> {
  const [data, setData] = useState<T | null>(options?.defaultData ?? null)
  const [loading, setLoading] = useState(url !== null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetch = useCallback(() => {
    if (!url) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)
    api.get(url)
      .then(r => { setData(r.data); setError(null) })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === 'CanceledError') return
        setError('Erreur de chargement')
      })
      .finally(() => setLoading(false))
  }, [url])

  useEffect(() => {
    fetch()
    return () => abortRef.current?.abort()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
