import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import type { LoadStatus } from '../types/booking.ts'

interface ResourceResult<T> {
  key: string
  requestKey: string
  data: T | null
  error: unknown
}

interface UseAsyncResourceResult<T> {
  status: LoadStatus
  /** Último dato cargado para esta `key` (se conserva mientras se refresca con `retry`). */
  data: T | null
  error: unknown
  retry: () => void
}

/**
 * Carga un recurso asíncrono identificado por `key` (null = no cargar).
 * El estado "loading" se deriva comparando la petición en curso con la del último
 * resultado, sin setState sincrónico dentro del efecto. Ignora respuestas viejas.
 */
export function useAsyncResource<T>(
  key: string | null,
  load: () => Promise<T>,
): UseAsyncResourceResult<T> {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<ResourceResult<T> | null>(null)
  const requestKey = key === null ? null : `${key}#${attempt}`
  const runLoad = useEffectEvent(load)

  useEffect(() => {
    if (key === null || requestKey === null) {
      return
    }

    let cancelled = false
    runLoad()
      .then((data) => {
        if (!cancelled) {
          setResult({ key, requestKey, data, error: null })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({ key, requestKey, data: null, error })
        }
      })

    return () => {
      cancelled = true
    }
  }, [key, requestKey])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  if (requestKey === null) {
    return { status: 'idle', data: null, error: null, retry }
  }

  if (result?.requestKey !== requestKey) {
    const staleData = result?.key === key ? result.data : null
    return { status: 'loading', data: staleData, error: null, retry }
  }

  return {
    status: result.error === null ? 'ready' : 'error',
    data: result.data,
    error: result.error,
    retry,
  }
}
