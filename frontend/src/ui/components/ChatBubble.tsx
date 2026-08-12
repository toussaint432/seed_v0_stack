import React, { useState, useRef, useEffect } from 'react'
import { ShoppingCart, Mic, Play, Pause } from 'lucide-react'

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

function AudioPlayer({ src, isMine }: { src: string; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying]     = useState(false)
  const [duration, setDuration]   = useState(0)
  const [currentTime, setCurrent] = useState(0)
  const [hasError, setHasError]   = useState(false)

  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
    } else {
      a.play().catch(() => setHasError(true))
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current
    if (!a || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (hasError) {
    return (
      <div className="audio-player-error">
        <Mic size={14} />
        <span>Fichier audio non disponible</span>
      </div>
    )
  }

  return (
    <div className={`audio-player ${isMine ? 'mine' : 'other'}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (a && isFinite(a.duration) && a.duration > 0) setDuration(a.duration)
        }}
        onDurationChange={() => {
          const a = audioRef.current
          if (a && isFinite(a.duration) && a.duration > 0) setDuration(a.duration)
        }}
        onTimeUpdate={() => {
          const a = audioRef.current
          if (a) setCurrent(a.currentTime)
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrent(0)
          if (audioRef.current) audioRef.current.currentTime = 0
        }}
        onError={() => setHasError(true)}
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

export function ChatBubble({ message, isMine }: Props) {
  const [lightbox, setLightbox] = useState(false)

  const content = (() => {
    switch (message.type) {
      case 'AUDIO':
        return <AudioPlayer src={`${ORDER_BASE}${message.urlMedia}`} isMine={isMine} />
      case 'IMAGE':
        return (
          <div className="bubble-image">
            <img
              src={`${ORDER_BASE}${message.urlMedia}`}
              alt={message.nomFichier || 'image'}
              onClick={() => setLightbox(true)}
              loading="lazy"
            />
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
          <img
            src={`${ORDER_BASE}${message.urlMedia}`}
            alt={message.nomFichier || 'image'}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
