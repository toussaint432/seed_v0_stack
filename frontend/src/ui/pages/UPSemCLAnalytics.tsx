import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, RefreshCw, ChevronRight, AlertTriangle, Download, ArrowRight } from 'lucide-react'
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

interface G3BarEntry {
  codeVariete: string; nomVariete: string; stockKg: number; demandKg: number
}

interface CoverageRow {
  codeVariete: string; nomVariete: string; codeEspece: string
  stockG3Kg: number; demandG3Kg: number
}

interface TransfertRow {
  id: number; codeLot: string; nomVariete: string
  destinataire: string; statut: string; dateTransfert: string
}

/* ── Diagramme barres verticales G3 stock vs demande ── */
const G3_STOCK_COLOR  = '#eab308'  // jaune
const G3_DEMAND_COLOR = '#dc2626'  // rouge

function G3CompareChart({ data }: { data: G3BarEntry[] }) {
  const [hov, setHov] = useState<number | null>(null)
  if (data.length === 0) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:160, color:'var(--text-muted)', fontSize:12 }}>
      Aucune donnée G3
    </div>
  )
  const W=380; const H=190; const PT=22; const PB=32; const PL=6; const PR=6
  const iW=W-PL-PR; const iH=H-PT-PB
  const grpW=iW/data.length
  const bW=grpW*0.38
  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, color:'var(--text-muted)' }}>
          <span style={{ width:10, height:8, borderRadius:2, background:G3_STOCK_COLOR, display:'inline-block' }} />
          Stock G3
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, color:'var(--text-muted)' }}>
          <span style={{ width:10, height:8, borderRadius:2, background:G3_DEMAND_COLOR, display:'inline-block' }} />
          Demande G3
        </span>
        <span style={{ fontSize:9.5, color:'var(--text-muted)', fontStyle:'italic', marginLeft:'auto' }}>Échelle par variété</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:'visible', display:'block' }}>
        <line x1={PL} y1={PT+iH} x2={W-PR} y2={PT+iH} stroke="var(--border)" strokeWidth={1.5} />
        {data.map((d, i) => {
          const localMax = Math.max(d.stockKg, d.demandKg, 1)
          const cx=PL+i*grpW+grpW/2
          const x1=cx-bW-1; const x2=cx+1
          const sh1=Math.max((d.stockKg/localMax)*iH, d.stockKg>0?3:0)
          const sh2=Math.max((d.demandKg/localMax)*iH, d.demandKg>0?3:0)
          const y1=PT+iH-sh1; const y2=PT+iH-sh2
          const isH=hov===i
          const lbl=d.nomVariete.length>10 ? d.nomVariete.slice(0,10)+'…' : d.nomVariete
          return (
            <g key={i} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)} style={{cursor:'default'}}>
              {isH && <rect x={x1-3} y={PT} width={bW*2+8} height={iH} rx={3} fill={G3_STOCK_COLOR} opacity={0.05}/>}
              <rect x={x1} y={y1} width={bW} height={Math.max(sh1,2)} rx={3}
                fill={G3_STOCK_COLOR} opacity={isH?1:0.8} style={{transition:'opacity 0.15s'}}/>
              {d.stockKg>0 && (
                <text x={x1+bW/2} y={y1-4} textAnchor="middle" fontSize={isH?9:8}
                  fontWeight={700} fill={G3_STOCK_COLOR} fontFamily="var(--font-sans)">{fmtT(d.stockKg)}</text>
              )}
              <rect x={x2} y={y2} width={bW} height={Math.max(sh2,2)} rx={3}
                fill={G3_DEMAND_COLOR} opacity={isH?1:0.8} style={{transition:'opacity 0.15s'}}/>
              {d.demandKg>0 && (
                <text x={x2+bW/2} y={y2-4} textAnchor="middle" fontSize={isH?9:8}
                  fontWeight={700} fill={G3_DEMAND_COLOR} fontFamily="var(--font-sans)">{fmtT(d.demandKg)}</text>
              )}
              <text x={cx} y={H-PB+14} textAnchor="middle" fontSize={isH?8.5:8}
                fontWeight={isH?700:400} fill={isH?G3_STOCK_COLOR:'var(--text-muted)'} fontFamily="var(--font-sans)">
                {lbl}
              </text>
              {isH && (
                <g>
                  <rect x={Math.max(PL+2,cx-52)} y={Math.min(y1,y2)-46} width={104} height={38} rx={5}
                    fill="var(--text-primary)" opacity={0.93}/>
                  <text x={cx} y={Math.min(y1,y2)-32} textAnchor="middle" fontSize={9}
                    fontWeight={700} fill="#fff" fontFamily="var(--font-sans)">{d.nomVariete}</text>
                  <text x={cx} y={Math.min(y1,y2)-20} textAnchor="middle" fontSize={8.5}
                    fill={G3_STOCK_COLOR} fontFamily="var(--font-sans)">Stock {fmtT(d.stockKg)}</text>
                  <text x={cx} y={Math.min(y1,y2)-10} textAnchor="middle" fontSize={8.5}
                    fill={G3_DEMAND_COLOR} fontFamily="var(--font-sans)">Dem. {fmtT(d.demandKg)}</text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ── Couverture G3 stock vs demandes mult. ── */
function G3CoverageBar({ rows }: { rows: CoverageRow[] }) {
  const navigate = useNavigate()
  const [popoverKey, setPopoverKey] = useState<string | null>(null)
  if (rows.length===0) return (
    <div style={{padding:'24px 0',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>
      Aucune donnée de stock G3
    </div>
  )
  const maxKg = Math.max(...rows.map(r=>Math.max(r.stockG3Kg,r.demandG3Kg)),1)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}} onClick={()=>setPopoverKey(null)}>
      {rows.sort((a,b)=>b.demandG3Kg-a.demandG3Kg).map(r=>{
        const ratio = r.demandG3Kg>0 ? r.stockG3Kg/r.demandG3Kg : Infinity
        const isCrit = r.demandG3Kg>0 && ratio<1
        const isWarn = r.demandG3Kg>0 && ratio>=1 && ratio<2
        const clr = isCrit?'#dc2626':isWarn?'#d97706':'#15803d'
        const pctStock  = Math.min((r.stockG3Kg/maxKg)*100,100)
        const pctDemand = Math.min((r.demandG3Kg/maxKg)*100,100)
        const isOpen = popoverKey === r.codeVariete
        return (
          <div key={r.codeVariete} style={{position:'relative'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
              <span style={{fontSize:11.5,fontWeight:600,color:'var(--text-primary)',flex:1,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.nomVariete}</span>
              <span style={{fontSize:9.5,color:'var(--text-muted)',fontFamily:'monospace',flexShrink:0}}>{r.codeEspece}</span>
              {r.demandG3Kg>0 && (
                <span
                  style={{fontSize:9.5,fontWeight:700,padding:'1px 6px',borderRadius:99,
                    background:`${clr}14`,color:clr,border:`1px solid ${clr}30`,flexShrink:0,
                    cursor:'pointer',userSelect:'none'}}
                  onClick={e=>{e.stopPropagation();setPopoverKey(isOpen?null:r.codeVariete)}}
                >
                  {isCrit?'⚠ Critique':isWarn?'⚠ Bas':'✓ OK'}
                </span>
              )}
            </div>
            <div style={{position:'relative',height:8,borderRadius:4,background:'var(--surface-2)',overflow:'hidden'}}>
              <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${pctStock}%`,
                background:clr,borderRadius:4,opacity:0.85,transition:'width 0.5s ease'}}/>
              {r.demandG3Kg>0 && (
                <div style={{position:'absolute',left:`${pctDemand}%`,top:0,bottom:0,
                  width:2,background:'#374151',borderRadius:1,transform:'translateX(-1px)'}}/>
              )}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
              <span style={{fontSize:10,color:'var(--text-muted)',fontVariantNumeric:'tabular-nums'}}>
                Stock {fmtT(r.stockG3Kg)}
              </span>
              {r.demandG3Kg>0 && (
                <span style={{fontSize:10,color:clr,fontVariantNumeric:'tabular-nums',fontWeight:600}}>
                  Demande {fmtT(r.demandG3Kg)}
                </span>
              )}
            </div>
            {isOpen && (
              <div
                style={{position:'absolute',top:'100%',right:0,marginTop:6,zIndex:300,
                  background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,
                  boxShadow:'0 8px 24px rgba(0,0,0,0.13)',padding:'12px 14px',minWidth:210}}
                onClick={e=>e.stopPropagation()}
              >
                <div style={{fontSize:12,fontWeight:700,color:'var(--text-primary)',marginBottom:8}}>{r.nomVariete}</div>
                <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11}}>
                    <span style={{color:'var(--text-muted)'}}>Stock G3</span>
                    <span style={{fontWeight:700,fontFamily:'monospace',color:G3_STOCK_COLOR}}>{fmtT(r.stockG3Kg)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11}}>
                    <span style={{color:'var(--text-muted)'}}>Demande active</span>
                    <span style={{fontWeight:700,fontFamily:'monospace',color:clr}}>{fmtT(r.demandG3Kg)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11}}>
                    <span style={{color:'var(--text-muted)'}}>Couverture</span>
                    <span style={{fontWeight:700,fontFamily:'monospace',color:clr}}>
                      {isFinite(ratio)?`${Math.round(ratio*100)}%`:'—'}
                    </span>
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>navigate('/orders')}
                    style={{flex:1,fontSize:10.5,fontWeight:600,padding:'5px 8px',borderRadius:6,
                      border:'1px solid #0f766e28',background:'#0f766e10',color:'#0f766e',cursor:'pointer'}}>
                    Voir les commandes
                  </button>
                  <button onClick={()=>navigate('/lots')}
                    style={{flex:1,fontSize:10.5,fontWeight:600,padding:'5px 8px',borderRadius:6,
                      border:'1px solid var(--border)',background:'var(--surface-2)',
                      color:'var(--text-secondary)',cursor:'pointer'}}>
                    Planifier G3
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      <div style={{display:'flex',gap:12,marginTop:2,paddingTop:8,borderTop:'1px solid var(--border)',flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <div style={{width:10,height:8,borderRadius:2,background:'#15803d',opacity:0.85}}/>
          <span style={{fontSize:9.5,color:'var(--text-muted)'}}>Stock G3</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <div style={{width:2,height:10,background:'#374151',borderRadius:1}}/>
          <span style={{fontSize:9.5,color:'var(--text-muted)'}}>Demande active</span>
        </div>
      </div>
    </div>
  )
}

export function UPSemCLAnalytics() {
  const [kpi,          setKpi]         = useState({ g1Kg:0, g2Kg:0, g3Kg:0, g3TransfKg:0, cmdG3:0 })
  const [g3Bars,       setG3Bars]      = useState<G3BarEntry[]>([])
  const [coverageRows, setCoverageRows]= useState<CoverageRow[]>([])
  const [transferts,   setTransferts]  = useState<TransfertRow[]>([])
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
        if (!ACTIVE_LOT.includes((l.statutLot??'').toUpperCase())) return
        if (gen==='G1') g1Kg+=qty
        else if (gen==='G2') g2Kg+=qty
        else if (gen==='G3') g3Kg+=qty
      })
      const g3TransfKg = transRaw
        .filter((t:any) => t.generationTransferee === 'G3' && t.statut === 'ACCEPTE')
        .reduce((s:number,t:any)=>s+(parseFloat(t.quantite??0)||0),0)
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
      setG3Bars(Object.values(g3Map).sort((a,b)=>b.demandKg-a.demandKg).slice(0,8))
      const covRows: CoverageRow[] = Object.values(g3Map).map(e=>({
        codeVariete: e.codeVariete, nomVariete: e.nomVariete,
        codeEspece: varMap[varieties.find((v:any)=>v.codeVariete===e.codeVariete)?.id??-1]?.espece?.codeEspece??'?',
        stockG3Kg: e.stockKg, demandG3Kg: e.demandKg,
      }))
      setCoverageRows(covRows)

      /* ── Transferts G3 envoyés ── */
      const lotById: Record<number,any> = Object.fromEntries(lotsData.map((l:any)=>[l.id,l]))
      const tRows: TransfertRow[] = transRaw
        .filter((t:any) => t.generationTransferee === 'G3')
        .sort((a:any,b:any)=>
          new Date(b.dateAcceptation??b.dateDemande??b.createdAt??0).getTime()
          - new Date(a.dateAcceptation??a.dateDemande??a.createdAt??0).getTime()
        )
        .slice(0,10)
        .map((t:any)=>{
          const lot = lotById[t.idLot]
          return {
            id: t.id??0,
            codeLot: t.codeTransfert??'—',
            nomVariete: lot?.nomVariete || lot?.codeVariete || '—',
            destinataire: t.usernameDestinataire??'—',
            statut: (t.statut??'').toUpperCase(),
            dateTransfert: t.dateAcceptation??t.dateDemande??t.createdAt??'',
          }
        })
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
        const statut = (l.statutLot??'').toUpperCase()
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
    const covRows = coverageRows.map(r=>[r.nomVariete,r.codeVariete,Math.round(r.stockG3Kg),Math.round(r.demandG3Kg)])
    const trRows  = transferts.map(t=>[t.codeLot,t.nomVariete,t.destinataire,t.statut,t.dateTransfert?new Date(t.dateTransfert).toLocaleDateString('fr-FR'):'—'])
    downloadXlsx(`senjiw-upsemcl-${date}`,[
      {name:'Couverture G3',headers:['Variété','Code','Stock G3 (kg)','Demande G3 (kg)'],rows:covRows},
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

      {/* ══ ② G3 stock vs demande ══ */}
      <div className="card" style={{overflow:'visible'}}>
        <div style={{padding:'12px 18px 0',borderBottom:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}}>
            <span className="card-title">
              <span className="card-title-icon"><TrendingUp size={14}/></span>
              G3 stock vs demande — par variété
            </span>
            {!loading && g3Bars.length>0 && (
              <span className="badge badge-blue" style={{marginLeft:'auto',fontSize:10}}>
                {g3Bars.length} variété{g3Bars.length>1?'s':''}
              </span>
            )}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
          <div style={{padding:'16px 20px',borderRight:'1px solid var(--border)'}}>
            {loading?(
              <div className="skeleton" style={{height:160,borderRadius:6}}/>
            ):(
              <G3CompareChart data={g3Bars}/>
            )}
          </div>
          <div style={{padding:'16px 20px'}}>
            <div style={{fontSize:11.5,fontWeight:700,color:'var(--text-primary)',marginBottom:12}}>
              Couverture G3 · Multiplicateurs
            </div>
            {loading?(
              <div className="skeleton" style={{height:160,borderRadius:6}}/>
            ):(
              <G3CoverageBar rows={coverageRows}/>
            )}
          </div>
        </div>
      </div>

      {/* ══ ③ Transferts G3 envoyés ══ */}
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
