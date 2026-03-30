import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  MessageCircle, Plus, ArrowLeft, Send, Image, ShoppingCart, X, RefreshCw,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { ChatBubble } from '../components/ChatBubble'
import { AudioRecorder } from '../components/AudioRecorder'
import { Toast } from '../components/Modal'

interface Props { roleKey: string; username: string }

interface ConvSummary {
  id: number
  autreParticipant: string
  autreParticipantNom: string
  autreParticipantRole: string
  autreParticipantOrg: string
  dernierMessage: string
  dernierMessageType: string
  dernierMessageAt: string
  nonLus: number
}

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

interface MembreInfo {
  id: number
  keycloakUsername: string
  nomComplet: string
  keycloakRole: string
  organisation: { id: number; nomOrganisation: string }
}

/* Destinataires autorisés selon le rôle */
const DEST_ROLES: Record<string, string[]> = {
  'seed-quotataire':    ['seed-multiplicator'],
  'seed-multiplicator': ['seed-quotataire', 'seed-upseml'],
  'seed-upseml':        ['seed-multiplicator', 'seed-selector'],
  'seed-selector':      ['seed-upseml'],
  'seed-admin':         ['seed-quotataire','seed-multiplicator','seed-upseml','seed-selector','seed-admin'],
}

function initiales(nom: string) {
  return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  } catch { return '' }
}

/* ══════════════════════════════════════════════════════════════ */
export function Messages({ roleKey, username }: Props) {
  const [convs, setConvs]             = useState<ConvSummary[]>([])
  const [selectedConv, setSelected]   = useState<ConvSummary | null>(null)
  const [messages, setMessages]       = useState<MessageData[]>([])
  const [membres, setMembres]         = useState<MembreInfo[]>([])
  const [loading, setLoading]         = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [text, setText]               = useState('')
  const [sending, setSending]         = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [showCmd, setShowCmd]         = useState(false)
  const [showMobile, setShowMobile]   = useState<'list'|'chat'>('list')
  const [toast, setToast]             = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string|null>(null)
  const [cmdForm, setCmdForm]         = useState({ idLot: '', quantite: '', unite: 'kg', notes: '' })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const pollingRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Charger conversations ── */
  async function fetchConvs() {
    try {
      const r = await api.get(endpoints.chatConversations)
      setConvs(r.data)
    } catch { /* ignoré */ }
    finally { setLoading(false) }
  }

  /* ── Charger membres disponibles pour "Nouveau message" ── */
  async function fetchMembres() {
    const destRoles = DEST_ROLES[roleKey] || []
    try {
      const r = await api.get(endpoints.membres)
      setMembres(r.data.filter((m: MembreInfo) =>
        destRoles.includes(m.keycloakRole) && m.keycloakUsername !== username
      ))
    } catch { setMembres([]) }
  }

  useEffect(() => {
    fetchConvs()
    fetchMembres()
  }, [])

  /* ── Charger les messages d'une conversation ── */
  const fetchMessages = useCallback(async (convId: number) => {
    try {
      const r = await api.get(endpoints.chatMessages(convId))
      setMessages(r.data)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch { /* ignoré */ }
  }, [])

  /* ── Sélectionner une conversation ── */
  async function openConv(conv: ConvSummary) {
    setSelected(conv)
    setShowMobile('chat')
    setLoadingMsgs(true)
    await fetchMessages(conv.id)
    setLoadingMsgs(false)
    // Polling toutes les 3 secondes
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(() => fetchMessages(conv.id), 3000)
    // Rafraîchir la liste pour mettre à jour les badges non-lus
    setTimeout(fetchConvs, 500)
  }

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [])

  /* ── Créer ou ouvrir une conversation ── */
  async function startConv(destUsername: string) {
    try {
      const r = await api.post(endpoints.chatConversations, { destinataireUsername: destUsername })
      const conv = r.data
      await fetchConvs()
      // Trouver le summary de la conv créée
      const fresh = await api.get(endpoints.chatConversations)
      setConvs(fresh.data)
      const found = fresh.data.find((c: ConvSummary) => c.id === conv.id)
      if (found) openConv(found)
      else {
        const pseudo: ConvSummary = {
          id: conv.id,
          autreParticipant: destUsername,
          autreParticipantNom: destUsername,
          autreParticipantRole: '',
          autreParticipantOrg: '',
          dernierMessage: '',
          dernierMessageType: 'TEXT',
          dernierMessageAt: conv.createdAt,
          nonLus: 0,
        }
        openConv(pseudo)
      }
      setShowNew(false)
    } catch (err: any) {
      setToast({ msg: err?.response?.status === 403 ? 'Canal non autorisé pour ce contact' : 'Erreur lors de la création', type: 'error' })
    }
  }

  /* ── Envoyer un message texte ── */
  async function sendText(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !selectedConv || sending) return
    setSending(true)
    try {
      await api.post(endpoints.chatMessages(selectedConv.id), { type: 'TEXT', contenu: text.trim() })
      setText('')
      await fetchMessages(selectedConv.id)
      fetchConvs()
    } catch { setToast({ msg: "Erreur d'envoi", type: 'error' }) }
    finally { setSending(false) }
  }

  /* ── Envoyer une commande ── */
  async function sendCommande(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedConv || sending) return
    setSending(true)
    try {
      const json = JSON.stringify({ idLot: cmdForm.idLot ? Number(cmdForm.idLot) : undefined, quantite: Number(cmdForm.quantite), unite: cmdForm.unite, notes: cmdForm.notes || undefined })
      await api.post(endpoints.chatMessages(selectedConv.id), { type: 'COMMANDE', contenu: json })
      setCmdForm({ idLot: '', quantite: '', unite: 'kg', notes: '' })
      setShowCmd(false)
      await fetchMessages(selectedConv.id)
      fetchConvs()
      setToast({ msg: 'Commande envoyée et enregistrée', type: 'success' })
    } catch { setToast({ msg: "Erreur d'envoi de la commande", type: 'error' }) }
    finally { setSending(false) }
  }

  /* ── Upload image ── */
  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedConv) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.post(endpoints.chatUpload(selectedConv.id), formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      await fetchMessages(selectedConv.id)
      fetchConvs()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Fichier non accepté (type ou taille)', type: 'error' })
    }
    e.target.value = ''
  }

  /* ── Upload audio ── */
  async function sendAudio(blob: Blob, mimeType: string) {
    if (!selectedConv) return
    const ext = mimeType.includes('mp4') ? '.mp4' : mimeType.includes('ogg') ? '.ogg' : '.webm'
    const file = new File([blob], `audio_${Date.now()}${ext}`, { type: mimeType })
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.post(endpoints.chatUpload(selectedConv.id), formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      await fetchMessages(selectedConv.id)
      fetchConvs()
    } catch { setToast({ msg: "Erreur envoi audio", type: 'error' }) }
  }

  /* ── Textarea auto-resize ── */
  function onTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
  }

  /* ── Envoi avec Entrée (Shift+Entrée = saut de ligne) ── */
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(e as any) }
  }

  /* ══════════════════════════════════
     RENDU
     ══════════════════════════════════ */
  const totalNonLus = convs.reduce((s, c) => s + c.nonLus, 0)

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {lightboxSrc && (
        <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
          <button className="lightbox-close">✕</button>
          <img src={lightboxSrc} alt="aperçu" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div className="chat-layout">
        {/* ─────────────── SIDEBAR CONVERSATIONS ─────────────── */}
        <div className={`chat-sidebar ${showMobile === 'chat' ? 'hidden' : ''}`}>
          <div className="chat-sidebar-header">
            <span className="chat-sidebar-title">
              Messages {totalNonLus > 0 && <span className="conv-badge">{totalNonLus}</span>}
            </span>
            <button className="btn btn-primary" style={{ height: 30, fontSize: 11, padding: '0 10px' }}
              onClick={() => { fetchMembres(); setShowNew(true) }}>
              <Plus size={12} /> Nouveau
            </button>
          </div>

          <div className="conv-list">
            {loading
              ? [0,1,2].map(i => (
                <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div className="skeleton" style={{ height: 14, borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 11, borderRadius: 4, width: '70%' }} />
                </div>
              ))
              : convs.length === 0
                ? (
                  <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <MessageCircle size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: .3 }} />
                    Aucune conversation.<br />Cliquez sur "Nouveau".
                  </div>
                )
                : convs.map(conv => (
                  <div key={conv.id}
                    className={`conv-item ${selectedConv?.id === conv.id ? 'active' : ''}`}
                    onClick={() => openConv(conv)}>
                    <div className="conv-avatar">{initiales(conv.autreParticipantNom)}</div>
                    <div className="conv-info">
                      <div className="conv-nom">{conv.autreParticipantNom}</div>
                      <div className="conv-apercu">{conv.dernierMessage || conv.autreParticipantOrg}</div>
                    </div>
                    <div className="conv-meta">
                      <span className="conv-heure">{formatDate(conv.dernierMessageAt)}</span>
                      {conv.nonLus > 0 && <span className="conv-badge">{conv.nonLus}</span>}
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* ─────────────── PANEL CHAT ─────────────── */}
        <div className={`chat-panel ${showMobile === 'list' ? 'hidden' : ''}`}>
          {!selectedConv ? (
            <div className="chat-empty">
              <MessageCircle size={48} className="chat-empty-icon" />
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Sélectionnez une conversation</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="chat-header">
                <button className="btn btn-ghost btn-icon" onClick={() => { setShowMobile('list'); if (pollingRef.current) clearInterval(pollingRef.current) }}>
                  <ArrowLeft size={16} />
                </button>
                <div className="conv-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                  {initiales(selectedConv.autreParticipantNom)}
                </div>
                <div className="chat-header-info">
                  <div className="chat-contact-nom">{selectedConv.autreParticipantNom}</div>
                  <div className="chat-contact-sub">{selectedConv.autreParticipantOrg}</div>
                </div>
                <button className="btn btn-secondary btn-icon" onClick={() => fetchMessages(selectedConv.id)} title="Rafraîchir">
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* Messages */}
              <div className="chat-messages">
                {loadingMsgs
                  ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Chargement…</div>
                  : messages.length === 0
                    ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32, fontSize: 13 }}>Aucun message — commencez la conversation !</div>
                    : messages.map(msg => (
                      <ChatBubble key={msg.id} message={msg} isMine={msg.expediteur === username} />
                    ))
                }
                <div ref={messagesEndRef} />
              </div>

              {/* Mini-formulaire commande */}
              {showCmd && (
                <div className="chat-commande-form">
                  <div className="chat-commande-title" style={{ justifyContent: 'space-between' }}>
                    <span><ShoppingCart size={14} /> Passer une commande</span>
                    <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24 }} onClick={() => setShowCmd(false)}><X size={12} /></button>
                  </div>
                  <form onSubmit={sendCommande}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>ID Lot (optionnel)</label>
                        <input type="number" value={cmdForm.idLot} onChange={e => setCmdForm(f => ({ ...f, idLot: e.target.value }))}
                          style={{ width: '100%', padding: '5px 9px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit,sans-serif' }} placeholder="5" />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Quantité *</label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input type="number" required min="1" value={cmdForm.quantite} onChange={e => setCmdForm(f => ({ ...f, quantite: e.target.value }))}
                            style={{ flex: 1, padding: '5px 9px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit,sans-serif' }} placeholder="500" />
                          <select value={cmdForm.unite} onChange={e => setCmdForm(f => ({ ...f, unite: e.target.value }))}
                            style={{ width: 54, padding: '5px 4px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 12, fontFamily: 'Outfit,sans-serif' }}>
                            <option value="kg">kg</option><option value="t">t</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Notes</label>
                      <input type="text" value={cmdForm.notes} onChange={e => setCmdForm(f => ({ ...f, notes: e.target.value }))}
                        style={{ width: '100%', padding: '5px 9px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit,sans-serif' }} placeholder="Livraison Kaffrine…" />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 32, fontSize: 12 }} disabled={sending}>
                      Envoyer la commande
                    </button>
                  </form>
                </div>
              )}

              {/* Zone de saisie */}
              <div className="chat-input-area">
                {roleKey === 'seed-quotataire' && (
                  <button type="button"
                    className={`chat-btn-icon secondary ${showCmd ? 'active' : ''}`}
                    onClick={() => setShowCmd(v => !v)}
                    title="Passer une commande"
                    style={showCmd ? { background: '#fef9ed', color: '#92660a', borderColor: '#f59e0b' } : {}}>
                    <ShoppingCart size={15} />
                  </button>
                )}

                <div className="chat-input-wrap">
                  <textarea
                    className="chat-textarea"
                    placeholder="Écrire un message…"
                    value={text}
                    onChange={onTextChange}
                    onKeyDown={onKeyDown}
                    rows={1}
                    disabled={sending}
                  />
                  <button type="button" className="chat-btn-icon secondary" onClick={() => fileInputRef.current?.click()} title="Envoyer une image">
                    <Image size={14} />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={uploadFile} />
                </div>

                <AudioRecorder onAudioReady={sendAudio} disabled={sending} />

                <button type="button" className="chat-btn-icon" onClick={sendText as any} disabled={!text.trim() || sending}>
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal "Nouveau message" */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowNew(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: 340, maxHeight: '70vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Nouveau message</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowNew(false)}><X size={14} /></button>
            </div>
            {membres.length === 0
              ? <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Aucun contact disponible</div>
              : membres.map(m => (
                <div key={m.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)', marginBottom: 8 }}
                  onClick={() => startConv(m.keycloakUsername)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div className="conv-avatar" style={{ width: 38, height: 38, fontSize: 13 }}>
                    {initiales(m.nomComplet)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.nomComplet}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.organisation?.nomOrganisation}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
