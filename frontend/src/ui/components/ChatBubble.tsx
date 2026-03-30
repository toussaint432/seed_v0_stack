import React, { useState, useRef } from 'react'
import { ShoppingCart } from 'lucide-react'

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

function formatHeure(iso: string) {
  try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
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
          {data.idLot && <div>Lot #{data.idLot}</div>}
          {data.quantite && <div><strong>{data.quantite}</strong> {data.unite || 'kg'}</div>}
          {data.notes && <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>{data.notes}</div>}
        </div>
      </div>
    )
  } catch {
    return <span>{contenu}</span>
  }
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [dur, setDur] = useState<string>('')

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const ss = Math.floor(s % 60)
    return `${m}:${ss.toString().padStart(2, '0')}`
  }

  function handleLoadedMetadata() {
    const a = audioRef.current
    if (!a) return
    if (isNaN(a.duration) || a.duration === Infinity) {
      // WebM sans durée — seek au bout pour forcer le calcul
      a.currentTime = 1e101
    } else {
      setDur(fmt(a.duration))
    }
  }

  function handleTimeUpdate() {
    const a = audioRef.current
    if (!a) return
    if (!isNaN(a.duration) && a.duration !== Infinity) {
      setDur(fmt(a.duration))
      a.removeEventListener('timeupdate', handleTimeUpdate)
      a.currentTime = 0
    }
  }

  return (
    <div className="bubble-audio">
      <audio
        ref={audioRef}
        controls
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
      />
      {dur && <span className="audio-dur">{dur}</span>}
    </div>
  )
}

export function ChatBubble({ message, isMine }: Props) {
  const [lightbox, setLightbox] = useState(false)

  const bubbleClass = `bubble ${isMine ? 'mine' : 'other'}`

  const content = (() => {
    switch (message.type) {
      case 'AUDIO':
        return <AudioPlayer src={`http://localhost:18084${message.urlMedia}`} />
      case 'IMAGE':
        return (
          <div className="bubble-image">
            <img
              src={`http://localhost:18084${message.urlMedia}`}
              alt={message.nomFichier || 'image'}
              onClick={() => setLightbox(true)}
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
        <div className={bubbleClass}>
          {content}
          <div className="bubble-time">{formatHeure(message.createdAt)}</div>
        </div>
      </div>

      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(false)}>
          <button className="lightbox-close" onClick={() => setLightbox(false)}>✕</button>
          <img
            src={`http://localhost:18084${message.urlMedia}`}
            alt={message.nomFichier || 'image'}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
