import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  Leaf, Sprout, CheckCircle2, XCircle, Plus, Search,
  X, RefreshCw, ChevronRight, ArrowLeft, FlaskConical,
  Calendar, Hash, Tag, Info, Package, Radio
} from 'lucide-react'
import { api } from '../../lib/api'

interface Props { roleKey: string }
interface Species {
  id: number; codeEspece: string; nomCommun: string
  nomScientifique?: string; description?: string; famille?: string; origine?: string
}
interface Variety {
  id: number; codeVariete: string; nomVariete: string
  codeEspece?: string; espece?: { codeEspece: string; nomCommun: string }
  actif: boolean; description?: string; cycleVegetatif?: string
  rendementMoyen?: string; resistanceMaladie?: string; zoneAdaptation?: string
  dateHomologation?: string; anneeCreation?: string; obtenteur?: string; caracteristiques?: string
}

const POLL_INTERVAL = 8000

function LiveBadge({ syncing, lastSync }: { syncing: boolean; lastSync: Date }) {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 15000)
    return () => clearInterval(t)
  }, [])
  const diffSec = Math.floor((Date.now() - lastSync.getTime()) / 1000)
  const label = diffSec < 10 ? "à l'instant" : diffSec < 60 ? `il y a ${diffSec}s` : `il y a ${Math.floor(diffSec/60)}min`
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:6, fontSize:11.5,
      color: syncing ? 'var(--green-700)' : 'var(--text-muted)',
      background: syncing ? 'var(--green-50)' : 'var(--surface-3)',
      border: `1px solid ${syncing ? 'var(--green-200)' : 'var(--border)'}`,
      padding:'4px 10px', borderRadius:99, transition:'all 0.3s',
    }}>
      {syncing
        ? <RefreshCw size={11} style={{ animation:'spin 0.8s linear infinite', color:'var(--green-600)' }} />
        : <Radio size={11} color="var(--green-500)" />}
      {syncing ? 'Synchronisation…' : `Sync ${label}`}
    </div>
  )
}

function ListView({ species, varieties, loading, refreshing, search, selectedSpecies, canCreate, readOnly, newIds, onSearch, onSelectSpecies, onSelectVariety, onRefresh }: {
  species: Species[]; varieties: Variety[]; loading: boolean; refreshing: boolean
  search: string; selectedSpecies: string | null; canCreate: boolean; readOnly: boolean
  newIds: Set<number>; onSearch:(v:string)=>void; onSelectSpecies:(c:string|null)=>void
  onSelectVariety:(v:Variety)=>void; onRefresh:()=>void
}) {
  const activeCount   = varieties.filter(v => v.actif !== false).length
  const inactiveCount = varieties.length - activeCount
  const filtered = varieties.filter(v => {
    const ms = !search || v.nomVariete?.toLowerCase().includes(search.toLowerCase()) || v.codeVariete?.toLowerCase().includes(search.toLowerCase()) || (v.codeEspece||v.espece?.codeEspece||'').toLowerCase().includes(search.toLowerCase())
    const me = !selectedSpecies || (v.codeEspece||v.espece?.codeEspece) === selectedSpecies
    return ms && me
  })
  const selObj = species.find(s => s.codeEspece === selectedSpecies)
  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon green"><Leaf size={18}/></div><div className="stat-body"><div className="stat-value">{loading?'…':species.length}</div><div className="stat-label">Espèces enregistrées</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Sprout size={18}/></div><div className="stat-body"><div className="stat-value">{loading?'…':varieties.length}</div><div className="stat-label">Variétés au total</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={18}/></div><div className="stat-body"><div className="stat-value">{loading?'…':activeCount}</div><div className="stat-label">Variétés actives</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={18}/></div><div className="stat-body"><div className="stat-value">{loading?'…':inactiveCount}</div><div className="stat-label">Variétés inactives</div></div></div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title"><span className="card-title-icon"><Leaf size={15}/></span>Espèces{!loading&&<span className="badge badge-green" style={{marginLeft:6,fontSize:11}}>{species.length}</span>}</span>
            <div style={{display:'flex',gap:8}}>
              {canCreate&&<a href="http://localhost:18081/swagger-ui/index.html" target="_blank" rel="noopener noreferrer"><button className="btn btn-primary" style={{height:28,fontSize:11,padding:'0 10px'}}><Plus size={11}/>Nouvelle espèce</button></a>}
              <button className="btn btn-secondary btn-icon" style={{width:28,height:28}} onClick={onRefresh} disabled={refreshing}><RefreshCw size={12} style={{animation:refreshing?'spin 0.8s linear infinite':'none'}}/></button>
            </div>
          </div>
          {selectedSpecies&&<div style={{padding:'8px 18px',background:'var(--green-50)',borderBottom:'1px solid var(--green-100)',display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:12,color:'var(--green-700)',fontWeight:500}}>Filtre actif : <strong>{selObj?.nomCommun||selectedSpecies}</strong></span><button onClick={()=>onSelectSpecies(null)} style={{background:'none',border:'none',cursor:'pointer',display:'flex',padding:2}}><X size={13} color="var(--green-700)"/></button></div>}
          <div className="card-body" style={{padding:'6px 18px 14px'}}>
            {loading ? (
              <div style={{display:'flex',flexDirection:'column',gap:8,paddingTop:8}}>
                {[0,1,2,3].map(i=><div key={i} style={{display:'flex',gap:12,padding:'8px 0',opacity:1-i*0.2}}><div className="skeleton" style={{width:52,height:26,borderRadius:5}}/><div className="skeleton" style={{width:120,height:13,borderRadius:4}}/></div>)}
              </div>
            ) : species.length===0 ? (
              <div className="empty-state" style={{padding:'40px 0'}}><div className="empty-icon"><Leaf size={20}/></div><div className="empty-title">Aucune espèce</div></div>
            ) : species.map(s => {
              const count   = varieties.filter(v=>(v.codeEspece||v.espece?.codeEspece)===s.codeEspece).length
              const isActive= selectedSpecies===s.codeEspece
              const hasNew  = varieties.some(v=>newIds.has(v.id)&&(v.codeEspece||v.espece?.codeEspece)===s.codeEspece)
              return (
                <div key={s.id} onClick={()=>onSelectSpecies(isActive?null:s.codeEspece)}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'10px 10px',borderRadius:8,marginBottom:2,cursor:'pointer',background:isActive?'var(--green-50)':'transparent',border:isActive?'1px solid var(--green-200)':'1px solid transparent',transition:'all 0.15s'}}
                  onMouseEnter={e=>{if(!isActive)(e.currentTarget as HTMLElement).style.background='var(--surface-3)'}}
                  onMouseLeave={e=>{if(!isActive)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                  <span className="species-code" style={isActive?{background:'var(--green-100)',color:'var(--green-800)'}:{}}>{s.codeEspece}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span className="species-name">{s.nomCommun}</span>
                      {hasNew&&<span style={{width:7,height:7,borderRadius:'50%',background:'var(--green-500)',animation:'pulse-dot 1.5s ease-in-out infinite',flexShrink:0}} title="Nouvelle variété ajoutée"/>}
                    </div>
                    {s.nomScientifique&&<div style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic',marginTop:1}}>{s.nomScientifique}</div>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    {count>0&&<span style={{fontSize:11,fontWeight:600,color:isActive?'var(--green-700)':'var(--text-muted)',background:isActive?'var(--green-100)':'var(--surface-3)',padding:'2px 7px',borderRadius:99}}>{count} var.</span>}
                    <ChevronRight size={14} color={isActive?'var(--green-600)':'var(--text-muted)'}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><Sprout size={15}/></span>
              {selectedSpecies&&selObj?<>Variétés <span style={{color:'var(--green-600)',marginLeft:4}}>— {selObj.nomCommun}</span></>:'Variétés'}
              {!loading&&<span className="badge badge-gold" style={{marginLeft:6,fontSize:11}}>{filtered.length}/{varieties.length}</span>}
            </span>
            {canCreate&&<a href="http://localhost:18081/swagger-ui/index.html" target="_blank" rel="noopener noreferrer"><button className="btn btn-primary" style={{height:28,fontSize:11,padding:'0 10px'}}><Plus size={11}/>Nouvelle variété</button></a>}
          </div>
          <div style={{padding:'10px 18px',borderBottom:'1px solid var(--border)',background:'var(--surface-2)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--surface)',border:'1px solid var(--border-strong)',borderRadius:'var(--radius-sm)',padding:'0 11px',height:34}}>
              <Search size={13} color="var(--text-muted)" style={{flexShrink:0}}/>
              <input placeholder="Rechercher par code, nom ou espèce…" value={search} onChange={e=>onSearch(e.target.value)} style={{border:'none',background:'none',outline:'none',flex:1,fontSize:13,color:'var(--text-primary)',fontFamily:'Outfit, sans-serif'}}/>
              {search&&<button onClick={()=>onSearch('')} style={{background:'none',border:'none',cursor:'pointer',display:'flex',padding:0}}><X size={13} color="var(--text-muted)"/></button>}
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Code</th><th>Nom variété</th><th>Espèce</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {loading?(<>{[0,1,2,3,4].map(i=><tr key={i} className="skeleton-row" style={{opacity:1-i*0.15}}><td><div className="skeleton" style={{width:80,height:13,borderRadius:4}}/></td><td><div className="skeleton" style={{width:120,height:13,borderRadius:4}}/></td><td><div className="skeleton" style={{width:50,height:20,borderRadius:99}}/></td><td><div className="skeleton" style={{width:55,height:20,borderRadius:99}}/></td><td></td></tr>)}</>)
                :filtered.length===0?(<tr><td colSpan={5}><div className="empty-state" style={{padding:'40px 0'}}><div className="empty-icon"><Sprout size={20}/></div><div className="empty-title">{search?'Aucun résultat':selectedSpecies?`Aucune variété pour ${selectedSpecies}`:'Aucune variété'}</div><div className="empty-sub">{search?`Aucune variété pour « ${search} »`:readOnly?'Aucune semence disponible':'Créez une variété via Swagger'}</div></div></td></tr>)
                :filtered.map(v=>{
                  const isActive=v.actif!==false
                  const espCode=v.codeEspece||v.espece?.codeEspece
                  const isNew=newIds.has(v.id)
                  return (
                    <tr key={v.id} style={{cursor:'pointer',background:isNew?'var(--green-50)':undefined,transition:'background 1s ease'}} onClick={()=>onSelectVariety(v)}>
                      <td><div style={{display:'flex',alignItems:'center',gap:6}}><span className="td-mono" style={{fontWeight:600}}>{v.codeVariete}</span>{isNew&&<span style={{fontSize:9,fontWeight:700,color:'var(--green-700)',background:'var(--green-100)',padding:'1px 5px',borderRadius:99,textTransform:'uppercase',letterSpacing:'0.05em'}}>Nouveau</span>}</div></td>
                      <td style={{fontWeight:500}}>{v.nomVariete}</td>
                      <td>{espCode?<span className="badge badge-green">{espCode}</span>:<span style={{color:'var(--text-muted)'}}>—</span>}</td>
                      <td>{isActive?<span className="badge badge-green" style={{gap:5}}><CheckCircle2 size={11}/>Actif</span>:<span className="badge badge-red" style={{gap:5}}><XCircle size={11}/>Inactif</span>}</td>
                      <td><ChevronRight size={14} color="var(--text-muted)"/></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!loading&&filtered.length>0&&<div style={{padding:'10px 18px',borderTop:'1px solid var(--border)',background:'var(--surface-2)',fontSize:12,color:'var(--text-muted)',display:'flex',justifyContent:'space-between'}}><span>{filtered.length} variété{filtered.length>1?'s':''}{search&&` · « ${search} »`}</span><span>{activeCount} active{activeCount>1?'s':''} · {inactiveCount} inactive{inactiveCount>1?'s':''}</span></div>}
        </div>
      </div>
    </div>
  )
}

function VarietyDetail({ variety, species, onBack }: { variety:Variety; species:Species[]; onBack:()=>void }) {
  const espCode=variety.codeEspece||variety.espece?.codeEspece
  const espObj=species.find(s=>s.codeEspece===espCode)
  const isActive=variety.actif!==false
  const fields=[
    {icon:Hash,label:'Code variété',value:variety.codeVariete},
    {icon:Tag,label:'Nom commun',value:variety.nomVariete},
    {icon:Leaf,label:'Espèce',value:espObj?`${espCode} — ${espObj.nomCommun}`:espCode},
    {icon:Calendar,label:'Année de création',value:variety.anneeCreation},
    {icon:Calendar,label:"Date d'homologation",value:variety.dateHomologation},
    {icon:FlaskConical,label:'Cycle végétatif',value:variety.cycleVegetatif},
    {icon:Package,label:'Rendement moyen',value:variety.rendementMoyen},
    {icon:Info,label:'Résistance maladie',value:variety.resistanceMaladie},
    {icon:Sprout,label:"Zone d'adaptation",value:variety.zoneAdaptation},
    {icon:Info,label:'Obtenteur',value:variety.obtenteur},
  ].filter(f=>f.value)
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:22}}>
        <button onClick={onBack} className="btn btn-secondary" style={{gap:6,height:32,padding:'0 12px',fontSize:12}}><ArrowLeft size={13}/>Retour</button>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-muted)'}}>
          <span>Variétés</span><ChevronRight size={13}/>
          {espObj&&<><span>{espObj.nomCommun}</span><ChevronRight size={13}/></>}
          <span style={{color:'var(--text-primary)',fontWeight:500}}>{variety.nomVariete}</span>
        </div>
      </div>
      <div className="card" style={{marginBottom:18}}>
        <div style={{padding:'24px 28px',display:'flex',alignItems:'flex-start',gap:20}}>
          <div style={{width:56,height:56,borderRadius:14,flexShrink:0,background:'var(--green-50)',border:'1px solid var(--green-200)',display:'flex',alignItems:'center',justifyContent:'center'}}><Sprout size={26} color="var(--green-600)"/></div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <h2 style={{fontSize:20,fontWeight:600,color:'var(--text-primary)',margin:0}}>{variety.nomVariete}</h2>
              {isActive?<span className="badge badge-green" style={{gap:5}}><CheckCircle2 size={11}/>Actif</span>:<span className="badge badge-red" style={{gap:5}}><XCircle size={11}/>Inactif</span>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:8,flexWrap:'wrap'}}>
              <span className="td-mono" style={{fontSize:13,color:'var(--text-secondary)'}}>{variety.codeVariete}</span>
              {espObj&&<><span style={{color:'var(--text-muted)'}}>·</span><span className="badge badge-green">{espCode}</span><span style={{fontSize:13,color:'var(--text-secondary)'}}>{espObj.nomCommun}</span>{espObj.nomScientifique&&<span style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>({espObj.nomScientifique})</span>}</>}
            </div>
          </div>
        </div>
      </div>
      <div className="grid-2" style={{alignItems:'start'}}>
        <div className="card">
          <div className="card-header"><span className="card-title"><span className="card-title-icon"><FlaskConical size={15}/></span>Caractéristiques</span></div>
          <div className="card-body" style={{padding:'8px 0'}}>
            {fields.length===0?(
              <div className="empty-state" style={{padding:'32px 0'}}><div className="empty-icon"><Info size={18}/></div><div className="empty-title">Données limitées</div><div className="empty-sub">Les caractéristiques détaillées ne sont pas encore renseignées</div></div>
            ):fields.map(({icon:Icon,label,value})=>(
              <div key={label} style={{display:'flex',alignItems:'flex-start',gap:14,padding:'11px 22px',borderBottom:'1px solid var(--border)'}}>
                <div style={{width:30,height:30,borderRadius:7,flexShrink:0,background:'var(--surface-3)',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon size={14} color="var(--text-muted)"/></div>
                <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{label}</div><div style={{fontSize:13.5,color:'var(--text-primary)',fontWeight:500}}>{value}</div></div>
              </div>
            ))}
            {(variety.description||variety.caracteristiques)&&<div style={{padding:'14px 22px'}}><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Description</div><p style={{fontSize:13.5,color:'var(--text-secondary)',lineHeight:1.65,margin:0}}>{variety.description||variety.caracteristiques}</p></div>}
          </div>
        </div>
        <div>
          {espObj&&<div className="card" style={{marginBottom:16}}>
            <div className="card-header"><span className="card-title"><span className="card-title-icon"><Leaf size={15}/></span>Espèce associée</span></div>
            <div className="card-body">
              <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}><span className="species-code" style={{fontSize:13,padding:'6px 12px'}}>{espObj.codeEspece}</span><div><div style={{fontWeight:600,fontSize:15,color:'var(--text-primary)'}}>{espObj.nomCommun}</div>{espObj.nomScientifique&&<div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic',marginTop:2}}>{espObj.nomScientifique}</div>}</div></div>
              {[{label:'Famille botanique',value:espObj.famille},{label:'Origine',value:espObj.origine}].filter(f=>f.value).map(({label,value})=>(
                <div key={label} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:'1px solid var(--border)',fontSize:13}}><span style={{color:'var(--text-muted)'}}>{label}</span><span style={{fontWeight:500}}>{value}</span></div>
              ))}
              {espObj.description&&<p style={{fontSize:13,color:'var(--text-secondary)',marginTop:12,lineHeight:1.6}}>{espObj.description}</p>}
            </div>
          </div>}
          <div className="card">
            <div className="card-header"><span className="card-title">Actions rapides</span></div>
            <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
              <a href="http://localhost:18082/swagger-ui/index.html" target="_blank" rel="noopener noreferrer" style={{textDecoration:'none'}}><button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}}><Package size={14}/>Créer un lot G0 pour cette variété</button></a>
              <a href="http://localhost:18081/swagger-ui/index.html" target="_blank" rel="noopener noreferrer" style={{textDecoration:'none'}}><button className="btn btn-secondary" style={{width:'100%',justifyContent:'center'}}><Sprout size={14}/>Modifier la variété</button></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Varieties({ roleKey }: Props) {
  const [species,         setSpecies]         = useState<Species[]>([])
  const [varieties,       setVarieties]       = useState<Variety[]>([])
  const [search,          setSearch]          = useState('')
  const [loading,         setLoading]         = useState(true)
  const [refreshing,      setRefreshing]      = useState(false)
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)
  const [selectedVariety, setSelectedVariety] = useState<Variety | null>(null)
  const [newIds,          setNewIds]          = useState<Set<number>>(new Set())
  const [lastSync,        setLastSync]        = useState<Date>(new Date())
  const [syncing,         setSyncing]         = useState(false)
  const prevIdsRef = useRef<Set<number>>(new Set())
  const timerRef   = useRef<ReturnType<typeof setInterval>|null>(null)

  const canCreate = ['seed-admin','seed-selector'].includes(roleKey)
  const readOnly  = roleKey === 'seed-quotataire'

  const fetchVarieties = useCallback(async (isRefresh=false) => {
    isRefresh ? setRefreshing(true) : setSyncing(true)
    const [sRes,vRes] = await Promise.allSettled([
      api.get('http://localhost:18081/api/species'),
      api.get('http://localhost:18081/api/varieties'),
    ])
    const newSpecies   = sRes.status==='fulfilled' ? sRes.value.data : []
    const newVarieties = vRes.status==='fulfilled' ? vRes.value.data : []
    setSpecies(newSpecies)
    setVarieties(newVarieties)
    setLastSync(new Date())
    const incomingIds = new Set<number>(newVarieties.map((v:Variety)=>v.id))
    const added = new Set<number>()
    incomingIds.forEach(id => { if(prevIdsRef.current.size>0 && !prevIdsRef.current.has(id)) added.add(id) })
    prevIdsRef.current = incomingIds
    if(added.size>0) {
      setNewIds(prev=>new Set([...prev,...added]))
      setTimeout(()=>setNewIds(prev=>{ const n=new Set(prev); added.forEach(id=>n.delete(id)); return n }),12000)
    }
    isRefresh ? setRefreshing(false) : setSyncing(false)
  },[])

  useEffect(()=>{
    fetchVarieties(false).then(()=>setLoading(false))
    timerRef.current = setInterval(()=>fetchVarieties(false), POLL_INTERVAL)
    return ()=>{ if(timerRef.current) clearInterval(timerRef.current) }
  },[fetchVarieties])

  if(selectedVariety) return (
    <>
      <VarietyDetail variety={selectedVariety} species={species} onBack={()=>setSelectedVariety(null)}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )

  return (
    <>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
        <LiveBadge syncing={syncing} lastSync={lastSync}/>
      </div>
      <ListView
        species={species} varieties={varieties} loading={loading} refreshing={refreshing}
        search={search} selectedSpecies={selectedSpecies} canCreate={canCreate} readOnly={readOnly}
        newIds={newIds} onSearch={setSearch}
        onSelectSpecies={code=>{ setSelectedSpecies(code); setSelectedVariety(null); setSearch('') }}
        onSelectVariety={v=>{ setSelectedVariety(v); window.scrollTo({top:0,behavior:'smooth'}) }}
        onRefresh={()=>fetchVarieties(true)}
      />
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}
      `}</style>
    </>
  )
}
