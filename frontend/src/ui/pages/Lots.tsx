import React, { useEffect, useState } from 'react'
import {
  Package, RefreshCw, Plus, ArrowRightLeft, ChevronLeft,
  ChevronRight, Filter, X, ArrowRight, GitBranch,
  Calendar, Scale, Microscope, Leaf, TrendingUp, Layers, ShieldCheck
} from 'lucide-react'
import { api } from '../../lib/api'

interface Props { roleKey: string }

interface Lot {
  id: number
  codeLot: string
  idVariete: number
  generation?: { codeGeneration: string }
  lotParent?: Lot
  campagne?: string
  dateProduction?: string
  quantiteNette?: number | string
  unite?: string
  tauxGermination?: number | string
  puretePhysique?: number | string
  statutLot?: string
}

const GEN_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  G0: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  G1: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  G2: { bg: '#fef9ed', color: '#92660a', border: '#fde68a' },
  G3: { bg: '#faf5ff', color: '#6d28d9', border: '#ddd6fe' },
  G4: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  R1: { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4' },
  R2: { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
}

const ROLE_GENERATIONS: Record<string, string[]> = {
  'seed-admin':         ['G0','G1','G2','G3','G4','R1','R2'],
  'seed-selector':      ['G0','G1'],
  'seed-upseml':        ['G1','G2','G3'],
  'seed-multiplicator': ['G3','G4','R1','R2'],
  'seed-quotataire':    [],
}

const GEN_LABELS: Record<string, string> = {
  G0:'Noyau', G1:'Pré-base', G2:'Base',
  G3:'Cert. C1', G4:'Cert. C2', R1:'R1', R2:'Comm.',
}

const STATUT_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  CERTIFIE:    { label: 'Certifié',    bg: '#f0fdf4', color: '#15803d' },
  EN_ANALYSE:  { label: 'En analyse',  bg: '#fffbeb', color: '#92400e' },
  REJETE:      { label: 'Rejeté',      bg: '#fef2f2', color: '#dc2626' },
  EN_STOCK:    { label: 'En stock',    bg: '#eff6ff', color: '#1d4ed8' },
  TRANSFERE:   { label: 'Transféré',   bg: '#f5f3ff', color: '#6d28d9' },
}

const roleContext: Record<string, string> = {
  'seed-selector':      'Lots G0 et G1 — vérifiez les lots avant transfert vers UPSemCL',
  'seed-upseml':        'Lots G1→G3 reçus — multipliez et préparez le transfert G3',
  'seed-multiplicator': 'Lots G3→R2 — produisez les semences commerciales certifiées',
  'seed-admin':         'Accès complet à toute la chaîne générationnelle G0→R2',
}

const PAGE_SIZE = 10

function fmt(val: any, suffix = ''): string {
  if (val === null || val === undefined || val === '') return '—'
  return `${val}${suffix}`
}

/* ── Carte lot dans la modale ── */
function LotCard({ lot, isActuel, varietyMap }: { lot: Lot; isActuel: boolean; varietyMap: Record<number,string> }) {
  const gen = lot.generation?.codeGeneration || 'N/A'
  const col = GEN_COLORS[gen]
  const varName = varietyMap[lot.idVariete] || `#${lot.idVariete}`
  const statut  = lot.statutLot ? (STATUT_CONFIG[lot.statutLot] || null) : null

  const fields = [
    { icon: Calendar,   label: 'Date production', value: fmt(lot.dateProduction) },
    { icon: Scale,      label: 'Quantité',         value: fmt(lot.quantiteNette, ` ${lot.unite||'kg'}`) },
    { icon: Microscope, label: 'Germination',       value: fmt(lot.tauxGermination, '%') },
    { icon: Leaf,       label: 'Pureté physique',   value: fmt(lot.puretePhysique, '%') },
  ]

  return (
    <div style={{
      flex:1, borderRadius:12, overflow:'hidden',
      background: isActuel ? 'var(--green-50)' : 'var(--surface)',
      border: `1.5px solid ${isActuel ? 'var(--green-200)' : 'var(--border)'}`,
      boxShadow: isActuel ? '0 4px 16px rgba(22,163,74,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Header génération */}
      <div style={{
        padding:'11px 14px',
        background: col ? col.bg : 'var(--surface-2)',
        borderBottom: `1px solid ${col ? col.border : 'var(--border)'}`,
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <span style={{
          fontSize:12, fontWeight:700,
          color: col ? col.color : 'var(--text-secondary)',
          background:'rgba(255,255,255,0.75)',
          padding:'3px 9px', borderRadius:99,
          fontFamily:'DM Mono, monospace',
        }}>● {gen}</span>
        {isActuel && (
          <span style={{ fontSize:10, fontWeight:800, color:'#15803d', background:'#dcfce7', padding:'2px 8px', borderRadius:99, letterSpacing:'0.06em', textTransform:'uppercase' }}>
            Actuel
          </span>
        )}
      </div>

      {/* Code lot + variété */}
      <div style={{ padding:'12px 14px 8px' }}>
        <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:12, color:'var(--text-primary)', wordBreak:'break-all', lineHeight:1.3 }}>
          {lot.codeLot}
        </div>
        <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:3 }}>{varName}</div>
        {/* Statut lot */}
        {statut && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color:statut.color, background:statut.bg, padding:'2px 7px', borderRadius:99, marginTop:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
            <ShieldCheck size={9}/>{statut.label}
          </span>
        )}
      </div>

      {/* Métriques */}
      <div style={{ padding:'4px 14px 14px', display:'flex', flexDirection:'column', gap:7 }}>
        {fields.map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, color:'var(--text-muted)', fontSize:11 }}>
              <Icon size={11}/>{label}
            </div>
            <span style={{ fontSize:12, fontWeight:600, color: value==='—' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Modale traçabilité ── */
function TraceModal({ lot, varietyMap, onClose }: { lot: Lot; varietyMap: Record<number,string>; onClose: () => void }) {
  const gen       = lot.generation?.codeGeneration || 'N/A'
  const parent    = lot.lotParent
  const parentGen = parent?.generation?.codeGeneration || (parent ? '?' : null)

  const qteActuel  = parseFloat(String(lot.quantiteNette || 0))
  const qteParent  = parseFloat(String(parent?.quantiteNette || 0))
  const multFactor = qteParent > 0 ? (qteActuel / qteParent).toFixed(1) : null

  let depth = 1; let cursor: any = lot
  while (cursor?.lotParent) { depth++; cursor = cursor.lotParent }
  let origine: any = lot
  while (origine?.lotParent) { origine = origine.lotParent }

  const chainLabel = parent ? `Chaîne ${parentGen} → ${gen}` : `Lot d'origine — génération ${gen}`

  const synthese = [
    { icon: Layers,     label: 'GÉNÉRATIONS',    value: String(depth),                     color:'var(--blue-600)',      bg:'var(--blue-50)',   small: false },
    { icon: Package,    label: 'LOT ORIGINE',    value: origine?.codeLot || lot.codeLot,   color:'var(--text-secondary)',bg:'var(--surface-3)', small: true  },
    ...(multFactor ? [{ icon: TrendingUp, label:'MULTIPLICATION', value:`×${multFactor}`,  color:'#7c3aed',              bg:'#f5f3ff',          small: false }] : []),
    { icon: Microscope, label: 'GERMINATION',    value: fmt(lot.tauxGermination, '%'),      color:'var(--green-600)',     bg:'var(--green-50)',  small: false },
    { icon: Leaf,       label: 'PURETÉ',         value: fmt(lot.puretePhysique, '%'),       color:'#0f766e',              bg:'#f0fdfa',          small: false },
  ]

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(10,18,30,0.62)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(6px)', padding:20 }}
      onClick={onClose}
    >
      <div
        style={{ background:'var(--surface)', borderRadius:18, width:'100%', maxWidth:620, maxHeight:'90vh', overflow:'auto', boxShadow:'0 32px 80px rgba(0,0,0,0.28)', animation:'slideUp 0.22s cubic-bezier(0.4,0,0.2,1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding:'24px 28px 0', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:'var(--blue-50)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <GitBranch size={16} color="var(--blue-600)"/>
              </div>
              <h2 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Traçabilité</h2>
            </div>
            <p style={{ fontSize:13, color:'var(--text-muted)', margin:0, fontFamily:'DM Mono, monospace' }}>{lot.codeLot}</p>
            <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'4px 0 0' }}>{chainLabel}</p>
          </div>
          <button onClick={onClose} style={{ background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:8, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', flexShrink:0 }}>
            <X size={14}/>
          </button>
        </div>

        {/* Cartes côte à côte */}
        <div style={{ padding:'22px 28px' }}>
          {parent ? (
            <div style={{ display:'flex', alignItems:'stretch', gap:0 }}>
              <LotCard lot={parent} isActuel={false} varietyMap={varietyMap}/>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 12px', gap:4, flexShrink:0 }}>
                <div style={{ width:1, flex:1, background:'var(--border)', maxHeight:24 }}/>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#16a34a,#15803d)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 10px rgba(22,163,74,0.3)', flexShrink:0 }}>
                  <ArrowRight size={16} color="#fff"/>
                </div>
                <div style={{ width:1, flex:1, background:'var(--border)', maxHeight:24 }}/>
              </div>
              <LotCard lot={lot} isActuel={true} varietyMap={varietyMap}/>
            </div>
          ) : (
            <div style={{ display:'flex', justifyContent:'center' }}>
              <div style={{ width:'55%' }}><LotCard lot={lot} isActuel={true} varietyMap={varietyMap}/></div>
            </div>
          )}
        </div>

        {/* Bandeau synthèse */}
        <div style={{
          margin:'0 28px 28px',
          background:'var(--surface-2)',
          border:'1px solid var(--border)',
          borderRadius:12,
          display:'grid',
          gridTemplateColumns:`repeat(${synthese.length},1fr)`,
          overflow:'hidden',
        }}>
          {synthese.map(({ icon: Icon, label, value, color, bg, small }, i) => (
            <div key={label} style={{
              padding:'14px 10px',
              borderRight: i < synthese.length-1 ? '1px solid var(--border)' : 'none',
              textAlign:'center',
            }}>
              <div style={{ width:30, height:30, borderRadius:8, background:bg, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 7px' }}>
                <Icon size={14} color={color}/>
              </div>
              <div style={{
                fontSize: small ? 9 : 18,
                fontWeight:700,
                color:'var(--text-primary)',
                fontFamily: small ? 'DM Mono, monospace' : 'inherit',
                wordBreak:'break-all', lineHeight:1.2,
              }}>{value}</div>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>{[0,1,2,3,4].map(i => (
      <tr key={i} className="skeleton-row" style={{ opacity:1-i*0.15 }}>
        {Array.from({ length:cols }).map((_,j) => (
          <td key={j}><div className="skeleton" style={{ width:j===0?110:80, height:13, borderRadius:4 }}/></td>
        ))}
      </tr>
    ))}</>
  )
}

export function Lots({ roleKey }: Props) {
  const [lots,        setLots]        = useState<Lot[]>([])
  const [varieties,   setVarieties]   = useState<any[]>([])
  const [generation,  setGeneration]  = useState('')
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [traceLot,    setTraceLot]    = useState<Lot|null>(null)

  const allowedGens = ROLE_GENERATIONS[roleKey] || []
  const canTransfer = ['seed-selector','seed-upseml'].includes(roleKey)
  const canCreate   = ['seed-admin','seed-selector','seed-upseml','seed-multiplicator'].includes(roleKey)

  const varietyMap: Record<number,string> = {}
  varieties.forEach((v:any) => { varietyMap[v.id] = v.nomVariete || v.codeVariete || `#${v.id}` })

  async function refresh(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    setCurrentPage(1)
    const url = generation ? `http://localhost:18082/api/lots?generation=${generation}` : 'http://localhost:18082/api/lots'
    const [lotsRes, varRes] = await Promise.allSettled([
      api.get(url),
      api.get('http://localhost:18081/api/varieties'),
    ])
    let data: Lot[] = lotsRes.status === 'fulfilled' ? lotsRes.value.data : []
    if (allowedGens.length > 0) data = data.filter(l => allowedGens.includes(l.generation?.codeGeneration || ''))
    setLots(data)
    if (varRes.status === 'fulfilled') setVarieties(varRes.value.data)
    setLoading(false); setRefreshing(false)
  }

  useEffect(() => { refresh() }, [])

  const genCounts = lots.reduce((acc:Record<string,number>, l) => {
    const g = l.generation?.codeGeneration || 'N/A'; acc[g]=(acc[g]||0)+1; return acc
  }, {})

  const totalPages  = Math.max(1, Math.ceil(lots.length/PAGE_SIZE))
  const pageLots    = lots.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE)
  const pageNumbers = Array.from({ length:Math.min(totalPages,5) }, (_,i) => {
    if (totalPages<=5) return i+1
    if (currentPage<=3) return i+1
    if (currentPage>=totalPages-2) return totalPages-4+i
    return currentPage-2+i
  })

  return (
    <div>
      {roleContext[roleKey] && <div className="context-banner"><Package size={14}/>{roleContext[roleKey]}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Package size={18}/></div>
          <div className="stat-body"><div className="stat-value">{lots.length}</div><div className="stat-label">Total lots visibles</div></div>
        </div>
        {Object.entries(genCounts).slice(0,3).map(([gen,count]) => {
          const col = GEN_COLORS[gen]
          return (
            <div key={gen} className="stat-card" style={{ cursor:'pointer' }} onClick={()=>{ setGeneration(gen); setTimeout(()=>refresh(),50) }}>
              <div className="stat-icon" style={{ background:col?.bg||'var(--surface-3)', color:col?.color||'var(--text-secondary)' }}>
                <span style={{ fontSize:13, fontWeight:700, fontFamily:'DM Mono, monospace' }}>{gen}</span>
              </div>
              <div className="stat-body"><div className="stat-value">{count as number}</div><div className="stat-label">Génération {gen} · {GEN_LABELS[gen]}</div></div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Package size={15}/></span>
            Liste des lots
            {!loading && <span className="badge badge-gray" style={{ marginLeft:6, fontSize:11 }}>{lots.length}</span>}
          </span>
          <div style={{ display:'flex', gap:8 }}>
            {canCreate && <a href="http://localhost:18082/swagger-ui/index.html" target="_blank" rel="noopener noreferrer"><button className="btn btn-primary"><Plus size={13}/>Nouveau lot</button></a>}
            {canTransfer && <a href="http://localhost:18082/swagger-ui/index.html" target="_blank" rel="noopener noreferrer"><button className="btn btn-secondary"><ArrowRightLeft size={13}/>Transférer</button></a>}
            <button className="btn btn-secondary btn-icon" onClick={()=>refresh(true)} disabled={refreshing}>
              <RefreshCw size={13} style={{ animation:refreshing?'spin 0.8s linear infinite':'none' }}/>
            </button>
          </div>
        </div>

        {roleKey==='seed-admin' && (
          <div className="gen-chain">
            <span className="gen-chain-label">Chaîne :</span>
            {['G0','G1','G2','G3','G4','R1','R2'].map((g,i,arr) => {
              const col=GEN_COLORS[g]; const isActive=generation===g
              return (
                <React.Fragment key={g}>
                  <button className={`gen-chain-btn ${isActive?'active':''}`}
                    style={{ background:isActive?col.bg:'transparent', color:col.color, opacity:(genCounts[g]||0)===0?0.4:1 }}
                    onClick={()=>{ setGeneration(isActive?'':g); setTimeout(()=>refresh(),50) }}>
                    {g}{(genCounts[g]||0)>0&&<span className="gen-chain-count">{genCounts[g]}</span>}
                  </button>
                  {i<arr.length-1&&<ArrowRight size={11} color="var(--text-muted)" style={{ flexShrink:0 }}/>}
                </React.Fragment>
              )
            })}
            {generation && <button className="btn btn-ghost" style={{ height:24,fontSize:11,marginLeft:4,padding:'0 8px' }} onClick={()=>{ setGeneration(''); setTimeout(()=>refresh(),50) }}><X size={11}/>Effacer</button>}
          </div>
        )}

        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Génération</label>
            <select className="input" value={generation} onChange={e=>setGeneration(e.target.value)} style={{ width:160 }}>
              <option value="">Toutes</option>
              {allowedGens.map(g=><option key={g} value={g}>{g} — {GEN_LABELS[g]}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" style={{ gap:6 }} onClick={()=>refresh()}><Filter size={12}/>Filtrer</button>
          {generation && <button className="btn btn-ghost" onClick={()=>{ setGeneration(''); setTimeout(()=>refresh(),50) }}><X size={12}/>Effacer</button>}
          {!loading && <span style={{ marginLeft:'auto',fontSize:12,color:'var(--text-muted)' }}>{lots.length} lot{lots.length>1?'s':''}{generation&&` · génération ${generation}`}</span>}
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Code lot</th><th>Variété</th><th>Génération</th>
                <th>Lot parent</th><th>Quantité</th><th>Campagne</th>
                <th>Statut</th><th>Traçabilité</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows cols={8}/> :
               lots.length===0 ? (
                <tr><td colSpan={8}><div className="empty-state">
                  <div className="empty-icon"><Package size={22}/></div>
                  <div className="empty-title">Aucun lot trouvé</div>
                  <div className="empty-sub">{generation?`Aucun lot de génération ${generation}`:`Aucun lot pour les générations ${allowedGens.join(', ')}`}</div>
                  {canCreate&&<a href="http://localhost:18082/swagger-ui/index.html" target="_blank" rel="noopener noreferrer" style={{ marginTop:14 }}><button className="btn btn-primary"><Plus size={13}/>Créer le premier lot</button></a>}
                </div></td></tr>
               ) : pageLots.map(l => {
                const gen=l.generation?.codeGeneration||'N/A'
                const col=GEN_COLORS[gen]
                const varName=varietyMap[l.idVariete]||`#${l.idVariete}`
                const statut=l.statutLot ? (STATUT_CONFIG[l.statutLot]||null) : null
                return (
                  <tr key={l.id}>
                    <td><span className="td-mono" style={{ fontWeight:600 }}>{l.codeLot}</span></td>
                    <td><span style={{ fontWeight:500 }}>{varName}</span></td>
                    <td>{col?<span className="badge" style={{ background:col.bg,color:col.color }}>{gen}</span>:<span className="badge badge-gray">{gen}</span>}</td>
                    <td>{l.lotParent?.codeLot?<span className="td-mono">{l.lotParent.codeLot}</span>:<span style={{ color:'var(--text-muted)',fontSize:13 }}>—</span>}</td>
                    <td><span style={{ fontWeight:600 }}>{l.quantiteNette}</span><span style={{ color:'var(--text-muted)',marginLeft:4,fontSize:12 }}>{l.unite}</span></td>
                    <td style={{ color:'var(--text-muted)',fontSize:13 }}>{l.campagne||'—'}</td>
                    <td>
                      {statut
                        ? <span className="badge" style={{ background:statut.bg,color:statut.color }}>{statut.label}</span>
                        : <span style={{ color:'var(--text-muted)',fontSize:13 }}>—</span>}
                    </td>
                    <td>
                      <button onClick={()=>setTraceLot(l)}
                        style={{ display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:500,color:'var(--blue-600)',background:'var(--blue-50)',border:'1px solid #bfdbfe',borderRadius:6,padding:'4px 10px',cursor:'pointer',transition:'all 0.15s' }}
                        onMouseEnter={e=>(e.currentTarget.style.background='#dbeafe')}
                        onMouseLeave={e=>(e.currentTarget.style.background='var(--blue-50)')}>
                        <GitBranch size={12}/>Voir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && lots.length>PAGE_SIZE && (
          <div className="pagination">
            <span className="pagination-info">{(currentPage-1)*PAGE_SIZE+1}–{Math.min(currentPage*PAGE_SIZE,lots.length)} sur {lots.length}</span>
            <div className="pagination-btns">
              <button className="page-btn" onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}><ChevronLeft size={13}/></button>
              {pageNumbers.map(n=><button key={n} className={`page-btn ${currentPage===n?'active':''}`} onClick={()=>setCurrentPage(n)}>{n}</button>)}
              <button className="page-btn" onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}><ChevronRight size={13}/></button>
            </div>
          </div>
        )}
      </div>

      {traceLot && <TraceModal lot={traceLot} varietyMap={varietyMap} onClose={()=>setTraceLot(null)}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
