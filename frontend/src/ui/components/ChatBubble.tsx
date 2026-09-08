import React, { useState, useRef, useEffect } from 'react'
import { ShoppingCart, Mic, Play, Pause } from 'lucide-react'
import { api } from '../../lib/api'

interface MessageData {
  id: number
  expediteur: string
  type: string
  contenu?: string
  urlMedia?: string
  nomFichier?: string
  createdAt: string
  lu: boolean
}

interface Props {
  message: MessageData
  isMine: boolean
}

const ORDER_BASE = `${(import.meta.env.VITE_API_BASE ?? 'http://localhost').replace(/\/$/, '')}:18084`

function formatHeure(iso: string) {
  try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00'
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

/** Récupère un fichier protégé via axios (JWT) et retourne une Blob URL locale. */
function useAuthMediaUrl(urlMedia: string | undefined): { blobUrl: string | null; error: boolean } {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!urlMedia) return
    let revoked = false
    let objectUrl: string | null = null

    api.get(`${ORDER_BASE}${urlMedia}`, { responseType: 'blob' })
      .then(res => {
        if (revoked) return
        objectUrl = URL.createObjectURL(res.data as Blob)
        setBlobUrl(objectUrl)
      })
      .catch(() => {
        if (!revoked) setError(true)
      })

    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [urlMedia])

  return { blobUrl, error }
}

function CommandeCard({ contenu }: { contenu: string }) {
  try {
    const data = JSON.parse(contenu)
    return (
      <div className="bubble-commande">
        <div className="bubble-commande-header">
          <ShoppingCart size={14} /> Commande
        </div>
        <div className="bubble-commande-detail">
          {data.nomVariete && <div style={{ fontWeight: 600 }}>{data.nomVariete}</div>}
          {data.quantite && <div><strong>{data.quantite}</strong> {data.unite || 'kg'}</div>}
          {data.notes && <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>{data.notes}</div>}
        </div>
      </div>
    )
  } catch {
    return <span>{contenu}</span>
  }
}

function AudioPlayer({ urlMedia, isMine }: { urlMedia: string; isMine: boolean }) {
  const { blobUrl, error } = useAuthMediaUrl(urlMedia)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying]     = useState(false)
  const [duration, setDuration]   = useState(0)
  const [currentTime, setCurrent] = useState(0)

  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause() } else { a.play().catch(() => {}) }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current
    if (!a || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (error) {
    return (
      <div className="audio-player-error">
        <Mic size={14} />
        <span>Fichier audio non disponible</span>
      </div>
    )
  }

  if (!blobUrl) {
    return (
      <div className={`audio-player ${isMine ? 'mine' : 'other'}`} style={{ opacity: 0.5 }}>
        <button className="audio-play-btn" disabled><Play size={14} fill="currentColor" /></button>
        <div className="audio-track-wrap"><div className="audio-track-bg" /></div>
        <span className="audio-time-label">…</span>
      </div>
    )
  }

  return (
    <div className={`audio-player ${isMine ? 'mine' : 'other'}`}>
      <audio
        ref={audioRef}
        src={blobUrl}
        preload="metadata"
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (a && isFinite(a.duration) && a.duration > 0) setDuration(a.duration)
        }}
        onDurationChange={() => {
          const a = audioRef.current
          if (a && isFinite(a.duration) && a.duration > 0) setDuration(a.duration)
        }}
        onTimeUpdate={() => { const a = audioRef.current; if (a) setCurrent(a.currentTime) }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrent(0)
          if (audioRef.current) audioRef.current.currentTime = 0
        }}
      />
      <button className="audio-play-btn" onClick={toggle} title={playing ? 'Pause' : 'Lecture'}>
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>
      <div className="audio-track-wrap" onClick={seek}>
        <div className="audio-track-bg">
          <div className="audio-track-fill" style={{ width: `${progress}%` }} />
          <div className="audio-track-thumb" style={{ left: `${progress}%` }} />
        </div>
      </div>
      <span className="audio-time-label">
        {playing || currentTime > 0 ? fmt(currentTime) : fmt(duration)}
      </span>
    </div>
  )
}

function AuthImage({ urlMedia, nomFichier }: { urlMedia: string; nomFichier?: string }) {
  const { blobUrl, error } = useAuthMediaUrl(urlMedia)

  if (error) {
    return (
      <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>🖼</span> Image non disponible
      </div>
    )
  }

  if (!blobUrl) {
    return <div style={{ width: 200, height: 120, background: 'var(--bg-muted, #f1f5f9)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⏳</div>
  }

  return <img src={blobUrl} alt={nomFichier || 'image'} />
}

export function ChatBubble({ message, isMine }: Props) {
  const [lightbox, setLightbox] = useState(false)
  const { blobUrl: lightboxUrl } = useAuthMediaUrl(
    lightbox && message.type === 'IMAGE' ? message.urlMedia : undefined
  )

  const content = (() => {
    switch (message.type) {
      case 'AUDIO':
        return <AudioPlayer urlMedia={message.urlMedia ?? ''} isMine={isMine} />
      case 'IMAGE':
        return (
          <div className="bubble-image" onClick={() => setLightbox(true)} style={{ cursor: 'zoom-in' }}>
            <AuthImage urlMedia={message.urlMedia ?? ''} nomFichier={message.nomFichier} />
          </div>
        )
      case 'COMMANDE':
        return <CommandeCard contenu={message.contenu || ''} />
      default:
        return <span style={{ whiteSpace: 'pre-wrap' }}>{message.contenu}</span>
    }
  })()

  return (
    <>
      <div className={`bubble-row ${isMine ? 'mine' : 'other'}`}>
        <div className={`bubble ${isMine ? 'mine' : 'other'}`}>
          {content}
          <div className="bubble-time">{formatHeure(message.createdAt)}</div>
        </div>
      </div>

      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(false)}>
          <button className="lightbox-close" onClick={() => setLightbox(false)}>✕</button>
          {lightboxUrl
            ? <img src={lightboxUrl} alt={message.nomFichier || 'image'} onClick={e => e.stopPropagation()} />
            : <div style={{ color: '#fff' }}>Chargement…</div>
          }
        </div>
      )}
    </>
  )
}
