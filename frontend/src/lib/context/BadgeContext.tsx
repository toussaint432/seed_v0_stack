import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { endpoints } from '../endpoints'
import { keycloak } from '../keycloak'

interface BadgeCounts {
  messages: number
  lots: number
  transferts: number
  stocks: number
  commandes: number
  certifications: number
}

interface BadgeContextValue {
  counts: BadgeCounts
  certifNotifs: any[]
  refreshBadge: (key: keyof BadgeCounts | 'all') => Promise<void>
  clearBadge: (key: 'messages') => Promise<void>
}

const DEFAULT_COUNTS: BadgeCounts = {
  messages: 0, lots: 0, transferts: 0, stocks: 0, commandes: 0, certifications: 0,
}

const BadgeContext = createContext<BadgeContextValue>({
  counts: DEFAULT_COUNTS,
  certifNotifs: [],
  refreshBadge: async () => {},
  clearBadge: async () => {},
})

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<BadgeCounts>(DEFAULT_COUNTS)
  const [certifNotifs, setCertifNotifs] = useState<any[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const r = await api.get(endpoints.chatUnread)
      setCounts(c => ({ ...c, messages: r.data?.count ?? 0 }))
    } catch { /* ignoré */ }
  }, [])

  const fetchCertifNotifs = useCallback(async () => {
    try {
      const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles ?? []
      const role = roles.find((r: string) => r.startsWith('seed-')) ?? ''
      if (role === 'seed-multiplicator') {
        const r = await api.get(endpoints.lotsMultCertif)
        const data = r.data ?? []
        setCertifNotifs(data)
        setCounts(c => ({
          ...c,
          certifications: data.filter((l: any) => l.statutCertification === 'REJETE').length,
        }))
      } else if (role === 'seed-upsemcl' || role === 'seed-admin') {
        const r = await api.get(endpoints.lotsACertifier)
        const data = r.data ?? []
        setCertifNotifs(data)
        setCounts(c => ({ ...c, certifications: data.length }))
      }
    } catch { /* ignoré */ }
  }, [])

  const fetchAlertCounts = useCallback(async () => {
    try {
      const [lots, transferts, stock, commandes] = await Promise.allSettled([
        api.get(endpoints.alertsCountLots),
        api.get(endpoints.alertsCountTransferts),
        api.get(endpoints.alertsCountStock),
        api.get(endpoints.alertsCountCommandes),
      ])
      setCounts(c => ({
        ...c,
        lots:       lots.status       === 'fulfilled' ? (lots.value.data?.count       ?? 0) : c.lots,
        transferts: transferts.status === 'fulfilled' ? (transferts.value.data?.count ?? 0) : c.transferts,
        stocks:     stock.status      === 'fulfilled' ? (stock.value.data?.count      ?? 0) : c.stocks,
        commandes:  commandes.status  === 'fulfilled' ? (commandes.value.data?.count  ?? 0) : c.commandes,
      }))
    } catch { /* ignoré */ }
  }, [])

  const refreshBadge = useCallback(async (key: keyof BadgeCounts | 'all') => {
    if (key === 'all') {
      await Promise.all([fetchMessages(), fetchCertifNotifs(), fetchAlertCounts()])
      return
    }
    if (key === 'messages')      { await fetchMessages(); return }
    if (key === 'certifications') { await fetchCertifNotifs(); return }
    await fetchAlertCounts()
  }, [fetchMessages, fetchCertifNotifs, fetchAlertCounts])

  const clearBadge = useCallback(async (key: 'messages') => {
    if (key === 'messages') {
      setCounts(c => ({ ...c, messages: 0 }))
      try { await api.put(endpoints.chatMarkAllRead) } catch { /* ignoré */ }
    }
  }, [])

  useEffect(() => {
    refreshBadge('all')
    timerRef.current = setInterval(() => refreshBadge('all'), 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  return (
    <BadgeContext.Provider value={{ counts, certifNotifs, refreshBadge, clearBadge }}>
      {children}
    </BadgeContext.Provider>
  )
}

export function useBadges() {
  return useContext(BadgeContext)
}
