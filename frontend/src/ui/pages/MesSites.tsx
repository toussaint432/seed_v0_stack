import React, { useEffect, useState } from 'react'
import { MapPin, Plus, RefreshCw, Edit2, CheckCircle2, Star, Trash2, Lock, Navigation } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormActions, Toast } from '../components/Modal'
import type { ZoneAgro, Departement } from '../../lib/types'

interface Props { roleKey: string }

/* ── Localités par département avec coordonnées GPS et zone agro-écologique ── */
type Localite = { nom: string; lat: number; lng: number; zone: string; region: string }
const LOCALITES: Record<string, Localite[]> = {
  'Dakar':        [{ nom: 'Dakar (Plateau)', lat: 14.6928, lng: -17.4467, zone: 'NAY', region: 'Dakar' }, { nom: 'Yoff', lat: 14.7572, lng: -17.4927, zone: 'NAY', region: 'Dakar' }, { nom: 'Ngor', lat: 14.7517, lng: -17.5127, zone: 'NAY', region: 'Dakar' }, { nom: 'Almadies', lat: 14.7417, lng: -17.5253, zone: 'NAY', region: 'Dakar' }],
  'Guédiawaye':   [{ nom: 'Guédiawaye', lat: 14.7731, lng: -17.3967, zone: 'NAY', region: 'Dakar' }, { nom: 'Golf Sud', lat: 14.762, lng: -17.409, zone: 'NAY', region: 'Dakar' }],
  'Keur Massar':  [{ nom: 'Keur Massar', lat: 14.7881, lng: -17.3147, zone: 'NAY', region: 'Dakar' }, { nom: 'Malika', lat: 14.788, lng: -17.285, zone: 'NAY', region: 'Dakar' }],
  'Pikine':       [{ nom: 'Pikine', lat: 14.7506, lng: -17.3906, zone: 'NAY', region: 'Dakar' }, { nom: 'Thiaroye', lat: 14.738, lng: -17.387, zone: 'NAY', region: 'Dakar' }],
  'Rufisque':     [{ nom: 'Rufisque', lat: 14.7186, lng: -17.2681, zone: 'NAY', region: 'Dakar' }, { nom: 'Bargny', lat: 14.698, lng: -17.233, zone: 'NAY', region: 'Dakar' }, { nom: 'Diamniadio', lat: 14.718, lng: -17.181, zone: 'NAY', region: 'Dakar' }],
  'Bambey':       [{ nom: 'Bambey', lat: 14.7038, lng: -16.4572, zone: 'BA', region: 'Diourbel' }, { nom: 'Ndangalma', lat: 14.73, lng: -16.5, zone: 'BA', region: 'Diourbel' }, { nom: 'Lambaye', lat: 14.67, lng: -16.53, zone: 'BA', region: 'Diourbel' }, { nom: 'Baba Garage', lat: 14.68, lng: -16.42, zone: 'BA', region: 'Diourbel' }],
  'Diourbel':     [{ nom: 'Diourbel', lat: 14.6554, lng: -16.2313, zone: 'BA', region: 'Diourbel' }, { nom: 'Touba', lat: 14.8503, lng: -15.8822, zone: 'BA', region: 'Diourbel' }, { nom: 'Ndoulo', lat: 14.65, lng: -16.4, zone: 'BA', region: 'Diourbel' }],
  'Mbacké':       [{ nom: 'Mbacké', lat: 14.8003, lng: -15.9122, zone: 'BA', region: 'Diourbel' }, { nom: 'Touba Mosquée', lat: 14.8503, lng: -15.8822, zone: 'BA', region: 'Diourbel' }, { nom: 'Dara', lat: 15.35, lng: -15.48, zone: 'BA', region: 'Diourbel' }],
  'Fatick':       [{ nom: 'Fatick', lat: 14.3393, lng: -16.4114, zone: 'BA', region: 'Fatick' }, { nom: 'Ndoss', lat: 14.32, lng: -16.52, zone: 'BA', region: 'Fatick' }],
  'Foundiougne':  [{ nom: 'Foundiougne', lat: 14.1381, lng: -16.47, zone: 'BA', region: 'Fatick' }, { nom: 'Sokone', lat: 13.883, lng: -16.367, zone: 'BA', region: 'Fatick' }, { nom: 'Toubacouta', lat: 13.7, lng: -16.25, zone: 'BA', region: 'Fatick' }],
  'Gossas':       [{ nom: 'Gossas', lat: 14.5, lng: -16.05, zone: 'BA', region: 'Fatick' }, { nom: 'Colobane', lat: 14.55, lng: -16.0, zone: 'BA', region: 'Fatick' }],
  'Birkelane':    [{ nom: 'Birkelane', lat: 14.2, lng: -15.7, zone: 'BA', region: 'Kaffrine' }, { nom: 'Mbirkilane', lat: 14.21, lng: -15.72, zone: 'BA', region: 'Kaffrine' }],
  'Kaffrine':     [{ nom: 'Kaffrine', lat: 14.1058, lng: -15.5508, zone: 'BA', region: 'Kaffrine' }, { nom: 'Nganda', lat: 14.17, lng: -15.38, zone: 'BA', region: 'Kaffrine' }],
  'Koungheul':    [{ nom: 'Koungheul', lat: 13.9833, lng: -14.8, zone: 'BA', region: 'Kaffrine' }, { nom: 'Ida Mouride', lat: 14.0, lng: -14.75, zone: 'BA', region: 'Kaffrine' }],
  'Malem Hodar':  [{ nom: 'Malem Hodar', lat: 14.1833, lng: -14.7833, zone: 'BA', region: 'Kaffrine' }],
  'Guinguinéo':   [{ nom: 'Guinguinéo', lat: 14.2667, lng: -15.95, zone: 'BA', region: 'Kaolack' }, { nom: 'Mbadakhoun', lat: 14.28, lng: -16.0, zone: 'BA', region: 'Kaolack' }],
  'Kaolack':      [{ nom: 'Kaolack', lat: 14.1507, lng: -16.075, zone: 'BA', region: 'Kaolack' }, { nom: 'Kahone', lat: 14.1, lng: -15.92, zone: 'BA', region: 'Kaolack' }, { nom: 'Passy', lat: 14.2, lng: -16.1, zone: 'BA', region: 'Kaolack' }],
  'Nioro du Rip': [{ nom: 'Nioro du Rip', lat: 13.7437, lng: -15.7939, zone: 'BA', region: 'Kaolack' }, { nom: 'Paoskoto', lat: 13.8, lng: -15.7, zone: 'BA', region: 'Kaolack' }, { nom: 'Keur Ayib', lat: 13.7, lng: -15.9, zone: 'BA', region: 'Kaolack' }],
  'Kédougou':     [{ nom: 'Kédougou', lat: 12.5561, lng: -12.1747, zone: 'SO', region: 'Kédougou' }, { nom: 'Bandafassi', lat: 12.55, lng: -12.25, zone: 'SO', region: 'Kédougou' }],
  'Salémata':     [{ nom: 'Salémata', lat: 12.6331, lng: -12.8206, zone: 'SO', region: 'Kédougou' }],
  'Saraya':       [{ nom: 'Saraya', lat: 12.8333, lng: -11.75, zone: 'SO', region: 'Kédougou' }, { nom: 'Kolia', lat: 12.8, lng: -11.9, zone: 'SO', region: 'Kédougou' }],
  'Kolda':              [{ nom: 'Kolda', lat: 12.8946, lng: -14.9411, zone: 'HC', region: 'Kolda' }, { nom: 'Saré Yoro Bana', lat: 12.9, lng: -14.9, zone: 'HC', region: 'Kolda' }],
  'Médina Yoro Foula':  [{ nom: 'Médina Yoro Foula', lat: 12.9383, lng: -13.9928, zone: 'HC', region: 'Kolda' }],
  'Vélingara':          [{ nom: 'Vélingara', lat: 13.1514, lng: -14.1136, zone: 'HC', region: 'Kolda' }, { nom: 'Diaobé', lat: 13.2, lng: -14.25, zone: 'HC', region: 'Kolda' }],
  'Kébémer':  [{ nom: 'Kébémer', lat: 15.3667, lng: -16.45, zone: 'ZSP', region: 'Louga' }, { nom: 'Darou Mousty', lat: 15.2, lng: -16.25, zone: 'ZSP', region: 'Louga' }],
  'Linguère':  [{ nom: 'Linguère', lat: 15.3833, lng: -15.1167, zone: 'ZSP', region: 'Louga' }, { nom: 'Dahra', lat: 15.35, lng: -15.48, zone: 'ZSP', region: 'Louga' }, { nom: 'Yang Yang', lat: 15.38, lng: -15.08, zone: 'ZSP', region: 'Louga' }],
  'Louga':     [{ nom: 'Louga', lat: 15.6167, lng: -16.2333, zone: 'ZSP', region: 'Louga' }, { nom: 'Sakal', lat: 15.5, lng: -16.4, zone: 'ZSP', region: 'Louga' }, { nom: 'Coki', lat: 15.48, lng: -16.05, zone: 'ZSP', region: 'Louga' }],
  'Kanel':         [{ nom: 'Kanel', lat: 15.4929, lng: -13.1736, zone: 'VF', region: 'Matam' }],
  'Matam':         [{ nom: 'Matam', lat: 15.6558, lng: -13.2558, zone: 'VF', region: 'Matam' }, { nom: 'Ourossogui', lat: 15.618, lng: -13.323, zone: 'VF', region: 'Matam' }],
  'Ranérou Ferlo': [{ nom: 'Ranérou', lat: 15.3, lng: -13.9667, zone: 'ZSP', region: 'Matam' }],
  'Dagana':      [{ nom: 'Richard-Toll', lat: 16.4622, lng: -15.7022, zone: 'VF', region: 'Saint-Louis' }, { nom: 'Dagana', lat: 16.5167, lng: -15.5, zone: 'VF', region: 'Saint-Louis' }, { nom: 'Rosso', lat: 16.5089, lng: -15.8167, zone: 'VF', region: 'Saint-Louis' }],
  'Podor':       [{ nom: 'Podor', lat: 16.65, lng: -14.9667, zone: 'VF', region: 'Saint-Louis' }, { nom: 'Ndioum', lat: 16.517, lng: -14.65, zone: 'VF', region: 'Saint-Louis' }],
  'Saint-Louis': [{ nom: 'Saint-Louis', lat: 16.0179, lng: -16.4896, zone: 'VF', region: 'Saint-Louis' }, { nom: 'Sor', lat: 16.02, lng: -16.47, zone: 'VF', region: 'Saint-Louis' }],
  'Bounkiling':  [{ nom: 'Bounkiling', lat: 12.8333, lng: -15.7, zone: 'MC', region: 'Sédhiou' }],
  'Goudomp':     [{ nom: 'Goudomp', lat: 12.5667, lng: -15.8, zone: 'MC', region: 'Sédhiou' }],
  'Sédhiou':     [{ nom: 'Sédhiou', lat: 12.706, lng: -15.5572, zone: 'MC', region: 'Sédhiou' }, { nom: 'Marsassoum', lat: 12.83, lng: -15.98, zone: 'MC', region: 'Sédhiou' }],
  'Bakel':        [{ nom: 'Bakel', lat: 14.9, lng: -12.4667, zone: 'SO', region: 'Tambacounda' }],
  'Goudiry':      [{ nom: 'Goudiry', lat: 14.1833, lng: -12.7167, zone: 'SO', region: 'Tambacounda' }],
  'Koumpentoum':  [{ nom: 'Koumpentoum', lat: 13.9833, lng: -14.5667, zone: 'SO', region: 'Tambacounda' }],
  'Tambacounda':  [{ nom: 'Tambacounda', lat: 13.7707, lng: -13.6673, zone: 'SO', region: 'Tambacounda' }, { nom: 'Dialacoto', lat: 13.33, lng: -13.37, zone: 'SO', region: 'Tambacounda' }, { nom: 'Missirah', lat: 13.42, lng: -14.42, zone: 'SO', region: 'Tambacounda' }],
  'Mbour':     [{ nom: 'Mbour', lat: 14.3691, lng: -16.9717, zone: 'NAY', region: 'Thiès' }, { nom: 'Saly', lat: 14.4558, lng: -17.0153, zone: 'NAY', region: 'Thiès' }, { nom: 'Joal-Fadiouth', lat: 14.163, lng: -16.845, zone: 'NAY', region: 'Thiès' }],
  'Thiès':     [{ nom: 'Thiès', lat: 14.7877, lng: -16.9261, zone: 'NAY', region: 'Thiès' }, { nom: 'Pout', lat: 14.765, lng: -17.054, zone: 'NAY', region: 'Thiès' }, { nom: 'Fandène', lat: 14.7833, lng: -16.8667, zone: 'NAY', region: 'Thiès' }],
  'Tivaouane': [{ nom: 'Tivaouane', lat: 14.9531, lng: -16.8169, zone: 'NAY', region: 'Thiès' }, { nom: 'Mékhé', lat: 15.11, lng: -16.61, zone: 'NAY', region: 'Thiès' }, { nom: 'Pire Goureye', lat: 15.07, lng: -16.73, zone: 'NAY', region: 'Thiès' }],
  'Bignona':    [{ nom: 'Bignona', lat: 12.8108, lng: -16.2267, zone: 'BC', region: 'Ziguinchor' }, { nom: 'Diouloulou', lat: 13.15, lng: -16.4, zone: 'BC', region: 'Ziguinchor' }],
  'Oussouye':   [{ nom: 'Oussouye', lat: 12.4883, lng: -16.5408, zone: 'BC', region: 'Ziguinchor' }],
  'Ziguinchor': [{ nom: 'Ziguinchor', lat: 12.5675, lng: -16.2719, zone: 'BC', region: 'Ziguinchor' }, { nom: 'Niaguis', lat: 12.5, lng: -16.2, zone: 'BC', region: 'Ziguinchor' }],
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '0 12px', height: 36, borderRadius: 6,
  border: '1px solid var(--border-strong)', background: 'var(--surface)',
  fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--text)', cursor: 'pointer',
}

const EMPTY_FORM = {
  nomSite:       '',
  idZoneAgro:    0,
  departement:   '',   // nom département (clé LOCALITES)
  idDepartement: 0,
  localite:      '',
  latitude:      '',
  longitude:     '',
}

export function MesSites({ roleKey }: Props) {
  const [sites,   setSites]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editCode, setEditCode] = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })

  const [zones,        setZones]        = useState<ZoneAgro[]>([])
  const [deptsForZone, setDeptsForZone] = useState<Departement[]>([])
  const [loadingDepts, setLoadingDepts] = useState(false)
  const [gpsLoading,   setGpsLoading]   = useState(false)

  const isReadOnly = ['seed-selector', 'seed-upsemcl'].includes(roleKey)
  const canEdit    = ['seed-multiplicator', 'seed-quotataire', 'seed-admin'].includes(roleKey)
  const canCreate  = canEdit && !isReadOnly

  const localitesForDept: Localite[] = form.departement ? (LOCALITES[form.departement] ?? []) : []

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
      .catch(() => {})
  }, [])

  function onZoneChange(zoneId: number) {
    setForm(f => ({ ...f, idZoneAgro: zoneId, departement: '', idDepartement: 0, localite: '', latitude: '', longitude: '' }))
    setDeptsForZone([])
    if (!zoneId) return
    setLoadingDepts(true)
    api.get(endpoints.departementsParZone(zoneId))
      .then(r => setDeptsForZone(Array.isArray(r.data) ? r.data : []))
      .catch(() => setDeptsForZone([]))
      .finally(() => setLoadingDepts(false))
  }

  function onDeptChange(deptId: number, deptNom: string) {
    setForm(f => ({ ...f, idDepartement: deptId, departement: deptNom, localite: '', latitude: '', longitude: '' }))
  }

  function onLocaliteChange(localiteNom: string) {
    const loc = (LOCALITES[form.departement] ?? []).find(l => l.nom === localiteNom)
    setForm(f => ({
      ...f,
      localite:  localiteNom,
      latitude:  loc ? String(loc.lat) : f.latitude,
      longitude: loc ? String(loc.lng) : f.longitude,
    }))
  }

  function handleGetGPS() {
    if (!navigator.geolocation) {
      setToast({ msg: 'Géolocalisation non supportée par ce navigateur', type: 'error' })
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLoading(false)
        const { latitude, longitude } = pos.coords
        if (latitude < 12.0 || latitude > 16.7 || longitude < -17.6 || longitude > -11.3) {
          setToast({ msg: 'Position détectée hors des limites du Sénégal. Vérifiez votre signal GPS.', type: 'error' })
          return
        }
        setForm(f => ({ ...f, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }))
        setToast({ msg: 'Position GPS enregistrée', type: 'success' })
      },
      () => {
        setGpsLoading(false)
        setToast({ msg: 'Localisation refusée. Vérifiez les permissions dans Chrome → Paramètres → Confidentialité → Paramètres des sites → Position, puis réessayez.', type: 'error' })
      },
      { timeout: 15000, maximumAge: 60000 }
    )
  }

  function openCreate() {
    setEditCode(null)
    setForm({ ...EMPTY_FORM })
    setDeptsForZone([])
    setShowForm(true)
  }

  function openEdit(s: any) {
    setEditCode(s.codeSite)
    const zoneForSite = zones.find(z => z.code === s.zoneCode)
    const zoneId = zoneForSite?.id ?? 0
    setForm({
      nomSite:       s.nomSite ?? '',
      idZoneAgro:    zoneId,
      departement:   s.departement ?? '',
      idDepartement: 0,
      localite:      s.localite ?? '',
      latitude:      s.latitude != null ? String(s.latitude) : '',
      longitude:     s.longitude != null ? String(s.longitude) : '',
    })
    if (zoneId) {
      setLoadingDepts(true)
      api.get(endpoints.departementsParZone(zoneId))
        .then(r => {
          const depts: Departement[] = Array.isArray(r.data) ? r.data : []
          setDeptsForZone(depts)
          const matched = depts.find(d => d.nom === s.departement)
          if (matched) setForm(f => ({ ...f, idDepartement: matched.id }))
        })
        .catch(() => setDeptsForZone([]))
        .finally(() => setLoadingDepts(false))
    }
    setShowForm(true)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nomSite.trim() || !form.idZoneAgro || !form.departement || !form.localite) return
    setSaving(true)

    const selectedZoneObj = zones.find(z => z.id === form.idZoneAgro)
    const loc = (LOCALITES[form.departement] ?? []).find(l => l.nom === form.localite)
    const typeSite = roleKey === 'seed-multiplicator' ? 'FERME' : 'MAGASIN'

    const payload: Record<string, unknown> = {
      nomSite:       form.nomSite.trim(),
      typeSite,
      departement:   form.departement,
      localite:      form.localite,
      region:        loc?.region,
      zoneCode:      selectedZoneObj?.code,
      idZoneAgro:    form.idZoneAgro   || undefined,
      idDepartement: form.idDepartement || undefined,
      latitude:      form.latitude  ? parseFloat(form.latitude)  : undefined,
      longitude:     form.longitude ? parseFloat(form.longitude) : undefined,
    }

    try {
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

  const roleLabel = {
    'seed-multiplicator': 'Multiplicateur',
    'seed-quotataire':    'Quotataire / OP',
    'seed-upsemcl':       'UPSemCL',
    'seed-selector':      'Sélectionneur ISRA/CNRA',
  }[roleKey] ?? 'votre rôle'

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
              {loading ? '…' : [...new Set(sites.map((s: any) => s.region).filter(Boolean))].length}
            </div>
            <div className="stat-label">Régions</div>
          </div>
        </div>
      </div>

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
            {isReadOnly && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--surface-2)', color: 'var(--text-muted)',
                borderRadius: 20, padding: '1px 10px', fontSize: 11, fontWeight: 600,
              }}>
                <Lock size={9} /> Lecture seule
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={fetchSites} title="Rafraîchir">
              <RefreshCw size={13} />
            </button>
            {canCreate && sites.length === 0 && (
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
              {canCreate
                ? `En tant que ${roleLabel}, enregistrez votre lieu de stockage ou de production.`
                : `Aucun site n'est encore associé à votre compte.`}
            </div>
            {canCreate && (
              <button className="btn-primary" onClick={openCreate} style={{ marginTop: 16 }}>
                <Plus size={14} /> Créer mon site
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {sites.map((s: any) => (
              <SiteCard
                key={s.id} site={s}
                canEdit={canEdit && !isReadOnly}
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
          title={editCode ? `Modifier mon site` : 'Nouveau site'}
          subtitle={editCode ? 'Mettez à jour les informations de votre site' : 'Votre lieu de stockage ou de production'}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={submitForm}>
            <Field label="Nom du site" required>
              <FormInput
                placeholder={roleKey === 'seed-multiplicator' ? 'Ex: Ferme Diallo Moussa' : 'Ex: Dépôt OP Sine-Saloum'}
                value={form.nomSite}
                onChange={e => setForm(f => ({ ...f, nomSite: (e as React.ChangeEvent<HTMLInputElement>).target.value }))}
                required
              />
            </Field>

            {/* ── Niveau 1 : Zone Agro-Écologique ── */}
            <Field label="Zone Agro-Écologique (ZAE)" required>
              <select
                value={form.idZoneAgro || ''}
                onChange={e => onZoneChange(Number(e.target.value))}
                required
                style={selectStyle}
              >
                <option value="">— Sélectionner une ZAE —</option>
                {zones.map(z => (
                  <option key={z.id} value={z.id}>{z.nom} ({z.code})</option>
                ))}
              </select>
            </Field>

            {/* ── Niveau 2 : Département (filtré par ZAE) ── */}
            <Field label="Département" required>
              <select
                value={form.idDepartement || ''}
                onChange={e => {
                  const id = Number(e.target.value)
                  const dept = deptsForZone.find(d => d.id === id)
                  onDeptChange(id, dept?.nom ?? '')
                }}
                required
                disabled={!form.idZoneAgro || loadingDepts}
                style={{ ...selectStyle, opacity: form.idZoneAgro ? 1 : 0.5 }}
              >
                <option value="">
                  {!form.idZoneAgro
                    ? '— Choisir d\'abord une ZAE —'
                    : loadingDepts
                    ? 'Chargement…'
                    : '— Sélectionner un département —'}
                </option>
                {deptsForZone.map(d => (
                  <option key={d.id} value={d.id}>{d.nom}</option>
                ))}
              </select>
            </Field>

            {/* ── Niveau 3 : Localité ── */}
            <Field label="Localité / Ville" required>
              <select
                value={form.localite}
                onChange={e => onLocaliteChange(e.target.value)}
                required
                disabled={!form.departement}
                style={{ ...selectStyle, opacity: form.departement ? 1 : 0.5 }}
              >
                <option value="">
                  {form.departement ? '— Sélectionner une localité —' : '— Choisir d\'abord un département —'}
                </option>
                {localitesForDept.map(l => (
                  <option key={l.nom} value={l.nom}>{l.nom}</option>
                ))}
              </select>
            </Field>

            {/* ── GPS — inputs readOnly + bouton capteur ── */}
            <Field label="Coordonnées GPS">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                      Latitude
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={form.latitude}
                      placeholder="—"
                      style={{
                        ...selectStyle,
                        background: 'var(--surface-2)',
                        cursor: 'default',
                        color: form.latitude ? 'var(--text)' : 'var(--text-muted)',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                      Longitude
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={form.longitude}
                      placeholder="—"
                      style={{
                        ...selectStyle,
                        background: 'var(--surface-2)',
                        cursor: 'default',
                        color: form.longitude ? 'var(--text)' : 'var(--text-muted)',
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGetGPS}
                  disabled={gpsLoading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    cursor: gpsLoading ? 'wait' : 'pointer',
                    border: '1px solid #0369a1',
                    background: gpsLoading ? 'var(--surface-2)' : '#eff6ff',
                    color: gpsLoading ? 'var(--text-muted)' : '#1d4ed8',
                    fontFamily: 'var(--font-sans)',
                    transition: 'background 0.15s',
                  }}
                >
                  <Navigation size={13} />
                  {gpsLoading ? 'Localisation en cours…' : 'Récupérer ma position GPS actuelle'}
                </button>
                {form.latitude && form.longitude && (
                  <div style={{
                    background: 'var(--green-50)', border: '1px solid var(--green-200)',
                    borderRadius: 6, padding: '7px 12px', fontSize: 11, color: 'var(--green-700)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <MapPin size={11} />
                    <span>Position enregistrée — {parseFloat(form.latitude).toFixed(4)}°N, {parseFloat(form.longitude).toFixed(4)}°E</span>
                  </div>
                )}
              </div>
            </Field>

            <FormActions>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
              <button
                type="submit" className="btn-primary"
                disabled={saving || !form.nomSite.trim() || !form.idZoneAgro || !form.departement || !form.localite}
              >
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
  site, canEdit, onEdit, onDelete, onSetPrincipal, isOnly,
}: {
  site: any; canEdit: boolean; isOnly: boolean;
  onEdit: () => void; onDelete: () => void; onSetPrincipal: () => void;
}) {
  return (
    <div style={{
      border: `1px solid ${site.estPrincipal ? 'var(--green-300)' : 'var(--border)'}`,
      borderRadius: 10, padding: 18, background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: site.estPrincipal ? '0 0 0 2px var(--green-100)' : 'none',
    }}>
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
        {canEdit && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={onEdit}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: 4, fontSize: 11, color: 'var(--text-muted)',
              }}
              title="Modifier ce site"
            ><Edit2 size={11} /> Modifier</button>
            {!site.estPrincipal && (
              <button
                onClick={onSetPrincipal}
                style={{
                  background: 'none', border: '1px solid var(--green-300)', borderRadius: 6,
                  padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: 4, fontSize: 11, color: 'var(--green-700)',
                }}
                title="Définir comme site principal"
              ><Star size={11} /></button>
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
              ><Trash2 size={11} /></button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {site.typeSite && <Chip color="blue">{site.typeSite === 'FERME' ? 'Ferme de multiplication' : site.typeSite === 'MAGASIN' ? 'Magasin de stockage' : site.typeSite === 'STATION_RECHERCHE' ? 'Station de recherche' : site.typeSite}</Chip>}
        {site.zoneCode && <Chip color="green">Zone {site.zoneCode}</Chip>}
        {site.departement && <Chip color="gray">{site.departement}</Chip>}
        {site.region      && site.region !== site.departement && <Chip color="gray">{site.region}</Chip>}
      </div>

      {site.localite && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={11} />{site.localite}
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
    }}>{children}</span>
  )
}
