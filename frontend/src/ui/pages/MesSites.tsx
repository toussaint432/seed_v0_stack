import React, { useEffect, useState } from 'react'
import { MapPin, Plus, RefreshCw, Edit2, CheckCircle2, Star, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

/* ── Coordonnées centroïdes par code ZAE (source : géographie Sénégal) ── */
const ZAE_GPS: Record<string, { lat: number; lng: number; region: string }> = {
  NAY: { lat: 14.80, lng: -17.10, region: 'Dakar / Thiès' },
  BA:  { lat: 14.20, lng: -15.80, region: 'Diourbel / Kaolack / Fatick' },
  ZSP: { lat: 15.60, lng: -15.00, region: 'Louga / Matam' },
  VF:  { lat: 16.20, lng: -15.60, region: 'Saint-Louis' },
  SO:  { lat: 13.80, lng: -13.50, region: 'Tambacounda / Kédougou' },
  HC:  { lat: 12.90, lng: -14.80, region: 'Kolda' },
  MC:  { lat: 12.70, lng: -15.60, region: 'Sédhiou' },
  BC:  { lat: 12.50, lng: -16.30, region: 'Ziguinchor' },
}

/* ── 46 départements du Sénégal groupés par région ── */
const DEPARTEMENTS: { region: string; depts: string[] }[] = [
  { region: 'Dakar',        depts: ['Dakar', 'Guédiawaye', 'Keur Massar', 'Pikine', 'Rufisque'] },
  { region: 'Diourbel',     depts: ['Bambey', 'Diourbel', 'Mbacké'] },
  { region: 'Fatick',       depts: ['Fatick', 'Foundiougne', 'Gossas'] },
  { region: 'Kaffrine',     depts: ['Birkelane', 'Kaffrine', 'Koungheul', 'Malem Hodar'] },
  { region: 'Kaolack',      depts: ['Guinguinéo', 'Kaolack', 'Nioro du Rip'] },
  { region: 'Kédougou',     depts: ['Kédougou', 'Salémata', 'Saraya'] },
  { region: 'Kolda',        depts: ['Kolda', 'Médina Yoro Foula', 'Vélingara'] },
  { region: 'Louga',        depts: ['Kébémer', 'Linguère', 'Louga'] },
  { region: 'Matam',        depts: ['Kanel', 'Matam', 'Ranérou Ferlo'] },
  { region: 'Saint-Louis',  depts: ['Dagana', 'Podor', 'Saint-Louis'] },
  { region: 'Sédhiou',      depts: ['Bounkiling', 'Goudomp', 'Sédhiou'] },
  { region: 'Tambacounda',  depts: ['Bakel', 'Goudiry', 'Koumpentoum', 'Tambacounda'] },
  { region: 'Thiès',        depts: ['Mbour', 'Thiès', 'Tivaouane'] },
  { region: 'Ziguinchor',   depts: ['Bignona', 'Oussouye', 'Ziguinchor'] },
]

const TYPES_SITE = [
  { value: 'FERME',            label: 'Ferme de multiplication' },
  { value: 'MAGASIN',          label: 'Magasin de stockage' },
  { value: 'SILO',             label: 'Silo / Dépôt' },
  { value: 'STATION_RECHERCHE',label: 'Station de recherche' },
]

const TYPE_LABELS: Record<string, string> = {
  FERME:            'Ferme de multiplication',
  MAGASIN:          'Magasin de stockage',
  SILO:             'Silo / Dépôt',
  STATION_RECHERCHE:'Station de recherche',
  LABORATOIRE:      'Laboratoire',
}

const EMPTY_FORM = {
  nomSite: '', typeSite: 'FERME', zoneCode: '',
  departement: '', localite: '', region: '', latitude: '', longitude: '',
}

export function MesSites({ roleKey }: Props) {
  const [sites,    setSites]    = useState<any[]>([])
  const [zones,    setZones]    = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editCode, setEditCode] = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })

  const canManage = ['seed-multiplicator', 'seed-quotataire'].includes(roleKey)

  async function fetchSites() {
    setLoading(true)
    try {
      const r = await api.get(endpoints.sitesMesSites)
      setSites(Array.isArray(r.data) ? r.data : [])
    } catch { setSites([]) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchSites()
    api.get(endpoints.zones)
      .then(r => setZones(Array.isArray(r.data) ? r.data : []))
      .catch(() => setZones([]))
  }, [])

  function onZoneChange(code: string) {
    const gps = ZAE_GPS[code]
    setForm(f => ({
      ...f, zoneCode: code,
      region:    gps?.region ?? f.region,
      latitude:  gps ? gps.lat.toString() : f.latitude,
      longitude: gps ? gps.lng.toString() : f.longitude,
    }))
  }

  function openCreate() {
    setEditCode(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
  }

  function openEdit(s: any) {
    setEditCode(s.codeSite)
    setForm({
      nomSite:    s.nomSite    ?? '',
      typeSite:   s.typeSite   ?? 'FERME',
      zoneCode:   s.zoneCode   ?? '',
      departement:s.departement ?? '',
      localite:   s.localite   ?? '',
      region:     s.region     ?? '',
      latitude:   s.latitude   != null ? String(s.latitude)  : '',
      longitude:  s.longitude  != null ? String(s.longitude) : '',
    })
    setShowForm(true)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nomSite.trim()) return
    setSaving(true)
    try {
      const payload = {
        nomSite:    form.nomSite.trim(),
        typeSite:   form.typeSite,
        zoneCode:   form.zoneCode    || undefined,
        departement:form.departement || undefined,
        localite:   form.localite    || undefined,
        region:     form.region      || undefined,
        latitude:   form.latitude    ? Number(form.latitude)  : undefined,
        longitude:  form.longitude   ? Number(form.longitude) : undefined,
      }
      if (editCode) {
        await api.put(endpoints.siteMesSitesByCode(editCode), payload)
        setToast({ msg: `Site "${form.nomSite}" mis à jour`, type: 'success' })
      } else {
        await api.post(endpoints.sitesMesSites, payload)
        setToast({ msg: `Site "${form.nomSite}" créé avec succès`, type: 'success' })
      }
      setShowForm(false)
      fetchSites()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors de la sauvegarde', type: 'error' })
    } finally { setSaving(false) }
  }

  async function supprimerSite(s: any) {
    if (!window.confirm(`Supprimer le site "${s.nomSite}" ? Cette action est irréversible.`)) return
    try {
      await api.delete(endpoints.siteMesSitesByCode(s.codeSite))
      setToast({ msg: `Site "${s.nomSite}" supprimé`, type: 'success' })
      fetchSites()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Impossible de supprimer ce site', type: 'error' })
    }
  }

  async function definirPrincipal(s: any) {
    try {
      await api.patch(endpoints.siteMesSitesPrincipal(s.codeSite))
      setToast({ msg: `"${s.nomSite}" défini comme site principal`, type: 'success' })
      fetchSites()
    } catch {
      setToast({ msg: 'Erreur lors de la mise à jour', type: 'error' })
    }
  }

  const roleLabel = roleKey === 'seed-multiplicator' ? 'Multiplicateur' : 'Quotataire / OP'

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><MapPin size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : sites.length}</div>
            <div className="stat-label">Mes sites</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Star size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : sites.filter(s => s.estPrincipal).length}</div>
            <div className="stat-label">Site principal</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><CheckCircle2 size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">
              {loading ? '…' : [...new Set(sites.map(s => s.region).filter(Boolean))].length}
            </div>
            <div className="stat-label">Régions</div>
          </div>
        </div>
      </div>

      {/* En-tête table */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color="var(--green-600)" />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Mes sites de stockage / production</span>
            {!loading && (
              <span style={{
                background: 'var(--green-50)', color: 'var(--green-700)',
                borderRadius: 20, padding: '1px 10px', fontSize: 11, fontWeight: 700,
              }}>{sites.length} site{sites.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={fetchSites} title="Rafraîchir">
              <RefreshCw size={13} />
            </button>
            {canManage && (
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={14} /> Nouveau site
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Chargement…</div>
        ) : sites.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><MapPin size={24} /></div>
            <div className="empty-title">Aucun site enregistré</div>
            <div className="empty-sub">
              En tant que {roleLabel}, créez votre premier site de stockage ou de multiplication.
            </div>
            {canManage && (
              <button className="btn-primary" onClick={openCreate} style={{ marginTop: 16 }}>
                <Plus size={14} /> Créer mon site
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {sites.map(s => (
              <SiteCard
                key={s.id} site={s} canManage={canManage} zones={zones}
                onEdit={() => openEdit(s)}
                onDelete={() => supprimerSite(s)}
                onSetPrincipal={() => definirPrincipal(s)}
                isOnly={sites.length === 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal formulaire ── */}
      {showForm && (
        <Modal
          title={editCode ? `Modifier — ${editCode}` : 'Nouveau site de stockage / production'}
          subtitle={editCode
            ? 'Mettez à jour les informations de votre site'
            : 'Le code site sera généré automatiquement'}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={submitForm}>
            <Field label="Nom du site" required>
              <FormInput
                placeholder="Ex: Ferme Diallo — Kaolack"
                value={form.nomSite}
                onChange={v => setForm(f => ({ ...f, nomSite: v }))}
                required
              />
            </Field>

            <FormRow>
              <Field label="Type de site" required>
                <FormSelect
                  value={form.typeSite}
                  onChange={v => setForm(f => ({ ...f, typeSite: v }))}
                  options={TYPES_SITE}
                />
              </Field>
              <Field label="Zone agro-écologique">
                <FormSelect
                  value={form.zoneCode}
                  onChange={onZoneChange}
                  options={[
                    { value: '', label: '— Sélectionner une ZAE —' },
                    ...zones.map(z => ({
                      value: z.code,
                      label: ZAE_GPS[z.code]
                        ? `${z.nom} (${ZAE_GPS[z.code].region})`
                        : z.nom,
                    })),
                  ]}
                />
              </Field>
            </FormRow>

            <FormRow>
              <Field label="Département">
                <select
                  value={form.departement}
                  onChange={e => setForm(f => ({ ...f, departement: e.target.value }))}
                  style={{
                    width: '100%', padding: '0 12px', height: 36, borderRadius: 6,
                    border: '1px solid var(--border-strong)', background: 'var(--surface)',
                    fontSize: 13, fontFamily: 'Outfit, sans-serif', color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">— Département —</option>
                  {DEPARTEMENTS.map(g => (
                    <optgroup key={g.region} label={g.region}>
                      {g.depts.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Localité exacte">
                <FormInput
                  placeholder="Village, quartier…"
                  value={form.localite}
                  onChange={v => setForm(f => ({ ...f, localite: v }))}
                />
              </Field>
            </FormRow>

            {form.zoneCode && (
              <div style={{
                background: 'var(--green-50)', border: '1px solid var(--green-200)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                fontSize: 12, color: 'var(--green-700)', display: 'flex', gap: 10,
                alignItems: 'center',
              }}>
                <MapPin size={13} />
                <span>
                  Coordonnées GPS auto-remplies depuis la ZAE
                  <strong> {zones.find(z => z.code === form.zoneCode)?.nom ?? form.zoneCode}</strong> :
                  {' '}{form.latitude}, {form.longitude}
                </span>
              </div>
            )}

            <FormRow>
              <Field label="Latitude GPS">
                <FormInput
                  placeholder="Ex: 14.7128"
                  value={form.latitude}
                  onChange={v => setForm(f => ({ ...f, latitude: v }))}
                />
              </Field>
              <Field label="Longitude GPS">
                <FormInput
                  placeholder="Ex: -16.4596"
                  value={form.longitude}
                  onChange={v => setForm(f => ({ ...f, longitude: v }))}
                />
              </Field>
            </FormRow>

            <FormActions>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={saving || !form.nomSite.trim()}>
                {saving ? 'Enregistrement…' : editCode ? 'Mettre à jour' : 'Créer le site'}
              </button>
            </FormActions>
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ── Card d'un site ── */
function SiteCard({
  site, canManage, zones, onEdit, onDelete, onSetPrincipal, isOnly,
}: {
  site: any; canManage: boolean; zones: any[]; isOnly: boolean;
  onEdit: () => void; onDelete: () => void; onSetPrincipal: () => void;
}) {
  const typeLabel = TYPE_LABELS[site.typeSite] ?? site.typeSite
  const hasGps    = site.latitude != null && site.longitude != null
  const zoneLabel = site.zoneCode ? (zones.find(z => z.code === site.zoneCode)?.nom ?? site.zoneCode) : null

  return (
    <div style={{
      border: `1px solid ${site.estPrincipal ? 'var(--green-300)' : 'var(--border)'}`,
      borderRadius: 10, padding: 18, background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: site.estPrincipal ? '0 0 0 2px var(--green-100)' : 'none',
    }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{site.nomSite}</span>
            {site.estPrincipal && (
              <span style={{
                background: 'var(--green-100)', color: 'var(--green-700)',
                borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <Star size={9} /> Principal
              </span>
            )}
          </div>
          <code style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {site.codeSite}
          </code>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={onEdit}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: 4, fontSize: 11, color: 'var(--text-muted)',
              }}
              title="Modifier ce site"
            >
              <Edit2 size={11} /> Modifier
            </button>
            {!site.estPrincipal && (
              <button
                onClick={onSetPrincipal}
                style={{
                  background: 'none', border: '1px solid var(--green-300)', borderRadius: 6,
                  padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: 4, fontSize: 11, color: 'var(--green-700)',
                }}
                title="Définir comme site principal"
              >
                <Star size={11} />
              </button>
            )}
            {!isOnly && (
              <button
                onClick={onDelete}
                style={{
                  background: 'none', border: '1px solid var(--red-200)', borderRadius: 6,
                  padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: 4, fontSize: 11, color: 'var(--red-600)',
                }}
                title="Supprimer ce site"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Infos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Chip color="blue">{typeLabel}</Chip>
        {zoneLabel && <Chip color="green">{zoneLabel}</Chip>}
        {site.departement && <Chip color="gray">{site.departement}</Chip>}
        {site.region      && <Chip color="gray">{site.region}</Chip>}
      </div>

      {site.localite && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={11} />{site.localite}
        </div>
      )}

      {hasGps && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          GPS : {Number(site.latitude).toFixed(4)}, {Number(site.longitude).toFixed(4)}
        </div>
      )}
    </div>
  )
}

function Chip({ children, color }: { children: React.ReactNode; color: 'blue' | 'gray' | 'green' }) {
  const palettes = {
    blue:  { bg: 'var(--blue-50)',   fg: 'var(--blue-700)',  border: 'var(--blue-200)' },
    green: { bg: 'var(--green-50)',  fg: 'var(--green-700)', border: 'var(--green-200)' },
    gray:  { bg: 'var(--surface-2)', fg: 'var(--text-muted)',border: 'var(--border)' },
  }
  const p = palettes[color]
  return (
    <span style={{
      background: p.bg, color: p.fg, border: `1px solid ${p.border}`,
      borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 600,
    }}>
      {children}
    </span>
  )
}
