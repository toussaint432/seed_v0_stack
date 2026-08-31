import { useEffect, useRef, useState } from 'react'
import { RefreshCw, ChevronRight, AlertTriangle, Download, ArrowRight } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, normalizeVariete, extractList } from '../../lib/normalizers'
import { fmtT } from '../../lib/fmt'
import { GEN_CHART_COLORS } from '../../lib/constants'
import { downloadXlsx } from '../../lib/exportUtils'

const GC = GEN_CHART_COLORS

const REFRESH_INTERVAL = 30_000
const ACTIVE_LOT = ['DISPONIBLE','EN_PRODUCTION','CERTIFIE','EN_COURS_CERT']
const ACTIVE_ORDER = ['SOUMISE','ACCEPTEE','EN_PREPARATION']

interface TransfertRow {
  id: number; codeLot: string; nomVariete: string
  destinataire: string; statut: string; dateTransfert: string
}

export function UPSemCLAnalytics() {
  const [kpi,        setKpi]       = useState({ g1Kg:0, g2Kg:0, g3Kg:0, g3TransfKg:0, cmdG3:0 })
  const [transferts, setTransferts]= useState<TransfertRow[]>([])
  const [alertes,     setAlertes]     = useState<{label:string;detail:string;critical:boolean}[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const timer = useRef<ReturnType<typeof setInterval>|null>(null)

  async function fetchData(isRefresh=false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    try {
      const [lotsRes, stocksRes, ordersRes, transfertsRes, varietiesRes] = await Promise.allSettled([
        api.get(endpoints.lotsMesLots),
        api.get(endpoints.stocksAgrege),
        api.get(`${endpoints.orders}?size=200`),
        api.get(endpoints.transfertsLot),
        api.get(endpoints.varieties),
      ])

      const lotsData  = extractList(lotsRes.status       ==='fulfilled'?lotsRes.value.data      :null).map(normalizeLot)
      const stocks    = extractList(stocksRes.status      ==='fulfilled'?stocksRes.value.data    :null)
      const orders    = extractList(ordersRes.status      ==='fulfilled'?ordersRes.value.data    :null)
      const transRaw  = extractList(transfertsRes.status  ==='fulfilled'?transfertsRes.value.data:null)
      const varieties = extractList(varietiesRes.status   ==='fulfilled'?varietiesRes.value.data :null).map(normalizeVariete)
      const varMap: Record<number,any> = Object.fromEntries(varieties.map((v:any)=>[v.id,v]))

      /* ── KPI pipeline G1→G2→G3 ── */
      let g1Kg=0, g2Kg=0, g3Kg=0
      lotsData.forEach((l:any)=>{
        const gen = l.generation?.codeGeneration??''
        const qty = parseFloat(l.quantiteNette)||0
        if (!ACTIVE_LOT.includes((l.statut??'').toUpperCase())) return
        if (gen==='G1') g1Kg+=qty
        else if (gen==='G2') g2Kg+=qty
        else if (gen==='G3') g3Kg+=qty
      })
      const g3TransfKg = transRaw
        .filter((t:any)=>{
          const gen = t.lot?.generation?.codeGeneration??t.codeGeneration??''
          return gen==='G3'
        })
        .reduce((s:number,t:any)=>s+(parseFloat(t.quantite??t.quantiteTransferee??0)||0),0)
      const cmdG3 = new Set(
        orders.filter((o:any)=>ACTIVE_ORDER.includes((o.statut??'').toUpperCase()) &&
          (o.lignes??[]).some((l:any)=>l.generation?.codeGeneration==='G3'||l.codeGeneration==='G3'))
        .map((o:any)=>o.id)
      ).size
      setKpi({g1Kg,g2Kg,g3Kg,g3TransfKg,cmdG3})

      /* ── Graphe couverture G3 : stock vs demande par variété ── */
      const g3Map: Record<string,{codeVariete:string;nomVariete:string;stockKg:number;demandKg:number}> = {}
      stocks.forEach((s:any)=>{
        if (s.codeGeneration!=='G3') return
        const cv = s.codeVariete; if (!cv) return
        if (!g3Map[cv]) g3Map[cv]={
          codeVariete:cv,
          nomVariete:s.nomVariete??cv,
          stockKg:0,demandKg:0,
        }
        g3Map[cv].stockKg += parseFloat(s.quantiteTotale)||0
      })
      orders.forEach((o:any)=>{
        if (!ACTIVE_ORDER.includes((o.statut??'').toUpperCase())) return
        ;(o.lignes??[]).forEach((ligne:any)=>{
          if ((ligne.generation?.codeGeneration??ligne.codeGeneration??'')!=='G3') return
          const v = varMap[ligne.idVariete??ligne.varieteId??-1]??ligne.variete??{}
          const cv = v.codeVariete; if (!cv) return
          if (!g3Map[cv]) g3Map[cv]={codeVariete:cv,nomVariete:v.nomVariete??cv,stockKg:0,demandKg:0}
          g3Map[cv].demandKg += parseFloat(ligne.quantiteDemandee??0)||0
        })
      })
      /* ── Transferts G3 envoyés ── */
      const tRows: TransfertRow[] = transRaw
        .filter((t:any)=>{
          const gen = t.lot?.generation?.codeGeneration??t.codeGeneration??''
          return gen==='G3'
        })
        .slice(0,10)
        .map((t:any)=>({
          id: t.id??0,
          codeLot: t.lot?.codeLot??t.codeLot??'—',
          nomVariete: varMap[t.lot?.idVariete??t.lot?.varieteId??-1]?.nomVariete??t.lot?.variete?.nomVariete??'—',
          destinataire: t.destinataire??t.usernameDestinataire??t.organisationDestinataire??'—',
          statut: (t.statut??'').toUpperCase(),
          dateTransfert: t.dateTransfert??t.createdAt??'',
        }))
        .sort((a:TransfertRow,b:TransfertRow)=>
          new Date(b.dateTransfert).getTime()-new Date(a.dateTransfert).getTime()
        )
      setTransferts(tRows)

      /* ── Alertes spécifiques UPSemCL ── */
      const als: {label:string;detail:string;critical:boolean}[] = []
      Object.values(g3Map).forEach(r=>{
        if (r.demandKg>0 && r.stockKg<r.demandKg) {
          als.push({
            label:`Stock G3 insuffisant — ${r.nomVariete}`,
            detail:`Stock ${fmtT(r.stockKg)} · Demande ${fmtT(r.demandKg)}`,
            critical: r.stockKg===0,
          })
        }
      })
      lotsData.forEach((l:any)=>{
        const gen = l.generation?.codeGeneration??''
        const statut = (l.statut??'').toUpperCase()
        if (gen==='G1' && statut==='DISPONIBLE') {
          const daysAgo = l.dateCreation
            ? Math.floor((Date.now()-new Date(l.dateCreation).getTime())/86400000) : null
          if (daysAgo!==null && daysAgo>60) {
            als.push({
              label:`Lot G1 non traité — ${l.codeLot??l.code??'?'}`,
              detail:`G1 DISPONIBLE depuis ${daysAgo} jours sans transformation`,
              critical: daysAgo>90,
            })
          }
        }
      })
      setAlertes(als)

    } catch { /* silencieux */ } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(()=>{
    fetchData()
    timer.current=setInterval(()=>fetchData(true),REFRESH_INTERVAL)
    return ()=>{ if(timer.current) clearInterval(timer.current) }
  },[])

  function handleExport() {
    const date = new Date().toISOString().slice(0,10)
    const trRows = transferts.map(t=>[t.codeLot,t.nomVariete,t.destinataire,t.statut,t.dateTransfert?new Date(t.dateTransfert).toLocaleDateString('fr-FR'):'—'])
    downloadXlsx(`senjiw-upsemcl-${date}`,[
      {name:'Transferts G3',headers:['Code lot','Variété','Destinataire','Statut','Date'],rows:trRows},
    ])
  }

  const pipelineSteps = [
    {label:'G1 reçus',    value:fmtT(kpi.g1Kg),       color:GC.G1, sub:'du Sélectionneur'},
    {label:'G2 en stock', value:fmtT(kpi.g2Kg),       color:GC.G2, sub:'base certifiée'},
    {label:'G3 produits', value:fmtT(kpi.g3Kg),       color:GC.G3, sub:'certification C1'},
    {label:'G3 distribués',value:fmtT(kpi.g3TransfKg),color:'#6b7280',sub:'transférés mult.'},
    {label:'Cmdes G3',    value:String(kpi.cmdG3),     color:'#6b7280',sub:'actives'},
  ]

  const statutColor: Record<string,string> = {
    SOUMISE:'#6b7280',EN_ATTENTE:'#d97706',ACCEPTE:'#15803d',REFUSE:'#dc2626',EN_COURS:'#2563eb',
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16,marginTop:16}}>

      {/* ── En-tête ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <ArrowRight size={16} color={GC.G3} />
          <span style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>
            Pilotage G1 → G3 — Multiplicateurs
          </span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {!loading && (
            <button onClick={handleExport}
              style={{display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontWeight:600,
                padding:'4px 10px',borderRadius:7,background:'var(--surface-2)',
                border:'1px solid var(--border)',cursor:'pointer',color:'var(--text-secondary)'}}>
              <Download size={11}/> Export .xls
            </button>
          )}
          <button className="btn btn-ghost" style={{gap:5,fontSize:12}}
            onClick={()=>fetchData(true)} disabled={refreshing}>
            <RefreshCw size={12} style={{animation:refreshing?'spin 0.8s linear infinite':'none'}}/>
            {refreshing?'Actualisation…':'Actualiser'}
          </button>
        </div>
      </div>

      {/* ══ ① Pipeline KPI G1→G2→G3→Distribués→Commandes ══ */}
      <div style={{display:'flex',gap:0,borderRadius:12,overflow:'hidden',
        border:'1px solid var(--border)',boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
        {pipelineSteps.map((step,i)=>(
          <div key={step.label} style={{flex:1,display:'flex',alignItems:'center',
            background:'var(--surface)',minWidth:0}}>
            <div style={{flex:1,padding:'12px 14px',minWidth:0}}>
              {loading?(
                <div className="skeleton" style={{height:40,borderRadius:6}}/>
              ):(
                <>
                  <div style={{fontSize:9.5,fontWeight:600,color:'var(--text-muted)',
                    textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:3,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {step.label}
                  </div>
                  <div style={{fontSize:18,fontWeight:800,color:step.color,
                    fontVariantNumeric:'tabular-nums',lineHeight:1.1}}>
                    {step.value}
                  </div>
                  <div style={{fontSize:9.5,color:'var(--text-muted)',marginTop:2}}>
                    {step.sub}
                  </div>
                </>
              )}
            </div>
            {i<pipelineSteps.length-1 && (
              <ChevronRight size={14} style={{color:'var(--border)',flexShrink:0,marginRight:-1}}/>
            )}
          </div>
        ))}
      </div>

      {/* ══ ② Transferts G3 envoyés ══ */}
      {!loading && transferts.length>0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon" style={{background:`${GC.G3}15`}}>
                <ArrowRight size={13} color={GC.G3}/>
              </span>
              Transferts G3 — Multiplicateurs
            </span>
            <span className="badge badge-blue" style={{fontSize:11}}>
              {transferts.length} transfert{transferts.length>1?'s':''}
            </span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Code lot</th>
                  <th>Variété</th>
                  <th>Destinataire</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transferts.map(t=>{
                  const sc = statutColor[t.statut]??'#6b7280'
                  return (
                    <tr key={t.id}>
                      <td><span style={{fontFamily:'monospace',fontSize:11.5,fontWeight:600}}>{t.codeLot}</span></td>
                      <td style={{fontSize:12.5,fontWeight:500}}>{t.nomVariete}</td>
                      <td style={{fontSize:12,color:'var(--text-secondary)'}}>{t.destinataire}</td>
                      <td>
                        <span style={{fontSize:10.5,fontWeight:700,borderRadius:99,padding:'2px 8px',
                          background:`${sc}14`,color:sc,border:`1px solid ${sc}30`}}>
                          {t.statut.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td style={{fontSize:11,color:'var(--text-muted)',fontVariantNumeric:'tabular-nums'}}>
                        {t.dateTransfert?new Date(t.dateTransfert).toLocaleDateString('fr-FR'):'—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ ④ Alertes UPSemCL ══ */}
      {!loading && alertes.length>0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{color:alertes.some(a=>a.critical)?'var(--red-600)':'var(--gold-dark)'}}>
              <span className="card-title-icon"
                style={{background:alertes.some(a=>a.critical)?'#fef2f2':'var(--gold-light)'}}>
                <AlertTriangle size={14} color={alertes.some(a=>a.critical)?'var(--red-600)':'var(--gold-dark)'}/>
              </span>
              Alertes — stock G3 & lots en attente
            </span>
            <span style={{fontSize:11,fontWeight:700,padding:'1px 8px',borderRadius:99,
              background:alertes.some(a=>a.critical)?'#fef2f2':'#fffbeb',
              color:alertes.some(a=>a.critical)?'#dc2626':'#d97706',
              border:`1px solid ${alertes.some(a=>a.critical)?'#fecaca':'#fde68a'}`}}>
              {alertes.length}
            </span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:0}}>
            {alertes.map((a,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,
                padding:'10px 16px',
                borderBottom:i<alertes.length-1?'1px solid var(--border)':'none',
                background:a.critical?'#fef2f220':'#fffbeb20'}}>
                <span style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
                  background:a.critical?'#dc2626':'#d97706',
                  animation:'pulse-dot 1.5s ease-in-out infinite',display:'inline-block'}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:'var(--text-primary)'}}>{a.label}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
      `}</style>
    </div>
  )
}
