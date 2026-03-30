import React, { useRef, useState, useEffect } from 'react'
import { Mic, Square, Send, X, RotateCcw } from 'lucide-react'

interface Props {
  onAudioReady: (blob: Blob, mimeType: string) => void
  disabled?: boolean
}

type State = 'idle' | 'recording' | 'preview'

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AudioRecorder({ onAudioReady, disabled }: Props) {
  const [state,   setState]   = useState<State>('idle')
  const [seconds, setSeconds] = useState(0)
  const [objUrl,  setObjUrl]  = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const streamRef   = useRef<MediaStream | null>(null)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeRef     = useRef<string>('audio/webm')
  const blobRef     = useRef<Blob | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (objUrl) URL.revokeObjectURL(objUrl)
  }, [])

  async function startRecording() {
    if (disabled) return
    // Libérer l'ancien object URL si re-enregistrement
    if (objUrl) { URL.revokeObjectURL(objUrl); setObjUrl(null) }
    blobRef.current = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm'
      mimeRef.current = mimeType

      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: mimeRef.current })
        if (blob.size > 0) {
          blobRef.current = blob
          setObjUrl(URL.createObjectURL(blob))
          setState('preview')
        } else {
          setState('idle')
        }
      }

      recorder.start(100)
      setState('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      setState('idle')
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    recorderRef.current?.stop()
    // setState('preview') sera appelé dans onstop
  }

  function send() {
    if (!blobRef.current) return
    onAudioReady(blobRef.current, mimeRef.current)
    cleanup()
  }

  function cancel() {
    cleanup()
  }

  function cleanup() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (objUrl) { URL.revokeObjectURL(objUrl); setObjUrl(null) }
    blobRef.current = null
    chunksRef.current = []
    setState('idle')
    setSeconds(0)
  }

  /* ── Enregistrement en cours ── */
  if (state === 'recording') return (
    <div className="audio-recorder-active">
      <div className="audio-recorder-timer">
        <span className="audio-rec-dot" />
        {fmt(seconds)}
      </div>
      <button type="button" className="chat-btn-icon danger" onClick={stopRecording} title="Arrêter l'enregistrement">
        <Square size={14} fill="currentColor" />
      </button>
      <button type="button" className="chat-btn-icon secondary" onClick={cancel} title="Annuler">
        <X size={14} />
      </button>
    </div>
  )

  /* ── Prévisualisation — écouter avant d'envoyer ── */
  if (state === 'preview') return (
    <div className="audio-recorder-preview">
      <button type="button" className="chat-btn-icon secondary" onClick={cancel} title="Annuler">
        <X size={14} />
      </button>
      <audio controls src={objUrl || ''} autoPlay={false} style={{ height: 32, width: 180 }} />
      <button type="button" className="chat-btn-icon secondary" onClick={startRecording} title="Réenregistrer">
        <RotateCcw size={14} />
      </button>
      <button type="button" className="chat-btn-icon primary" onClick={send} title="Envoyer">
        <Send size={15} />
      </button>
    </div>
  )

  /* ── Repos ── */
  return (
    <button
      type="button"
      className="chat-btn-icon secondary"
      onClick={startRecording}
      disabled={disabled}
      title="Enregistrer un message vocal"
    >
      <Mic size={16} />
    </button>
  )
}
