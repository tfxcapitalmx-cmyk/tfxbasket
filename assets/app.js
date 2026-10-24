
/* ---------- lector de Excel, bajo demanda ---------- */
// SheetJS 0.18.5 (same version that used to be inlined) is fetched only when someone uploads an Excel file.
function ensureXLSX(){return typeof XLSX!=="undefined";}
function loadXLSX(){
  if(ensureXLSX())return Promise.resolve(true);
  return new Promise(res=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload=()=>res(ensureXLSX());s.onerror=()=>res(false);document.head.appendChild(s);});
}

const S = D.snap, SER = D.series;
const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const sg = (x,d=2) => (x>0?'+':x<0?'−':'')+Math.abs(x).toFixed(d);
const pct = p => Math.round(p*100)+'%';
const ptsCls = p => p>=2?'p2':p===1?'p1':p===0?'p0':p===-1?'m1':'m2';
const ptsTxt = p => p>0?'+'+p:p<0?'−'+Math.abs(p):'0';
const regime = c => c>=1?'Restrictivo fuerte':c>=0.4?'Sesgo restrictivo':c>-0.4?'Neutral':c>-1?'Sesgo de alivio':'Alivio claro';
const store = {get(k,d){try{const v=localStorage.getItem('tfx-mon-'+k);return v?JSON.parse(v):d;}catch(e){return d;}},set(k,v){try{localStorage.setItem('tfx-mon-'+k,JSON.stringify(v));}catch(e){}}};
function chipset(el,items,active,onPick,cls='chip'){
  el.innerHTML='';items.forEach(it=>{const b=document.createElement('button');b.type='button';b.className=cls;b.id=`${el.id}-${it.id}`.replace(/\s/g,'');b.textContent=it.label;
    b.setAttribute('aria-pressed',String(it.id===active));if(it.off){b.disabled=true;}b.onclick=()=>onPick(it.id);el.appendChild(b);});
}
const PHN={EXP:'Expansión',DES:'Desaceleración',CON:'Contracción',REC:'Recuperación'};

// ---------- Resumen ----------
const fact=(k,v,n)=>`<div class="fact"><span class="k">${k}</span><span class="v">${v}</span><span class="n">${n}</span></div>`;
const factc=(k,v,n,c)=>`<div class="fact"><span class="k">${k}</span><span class="v ${c||''}">${v}</span><span class="n">${n}</span></div>`;
const hc=v=>v>0.0001?'hot':v<-0.0001?'cold':'flat';
const projLab=l=>l>=1?'Restrictivo fuerte':l>=0.4?'Sesgo restrictivo':l>=0.2?'Neutral con inclinación restrictiva':l>-0.2?'Neutral':l>-0.4?'Neutral con inclinación al alivio':l>-1?'Sesgo de alivio':'Alivio claro';
const fedSent=c=>c>=1?'Hawkish fuerte':c>=0.4?'Hawkish moderado':c>-0.4?'Neutral':c>-1?'Dovish moderado':'Dovish';
const RW=n=>S.rows.find(r=>r.name===n);
const stA=p=>p>0?['Expansión','hot']:p<0?['Contracción','cold']:['Neutral','flat'];
const stI=p=>p>0?['Calentamiento','hot']:p<0?['Enfriamiento','cold']:['Estable','flat'];
const stF=p=>p>0?['Restrictiva','hot']:p<0?['Expansiva','cold']:['Neutral','flat'];
function ideaCond(){
  const c=S.composite,l=S.sub.lead,co=S.sub.coin,b=S.breadth,sig=b.hot+b.cold,br=sig?Math.max(b.hot,b.cold)/sig:0;
  const same=Math.sign(l)===Math.sign(co)&&Math.sign(c)===Math.sign(co);
  if(Math.abs(c)<0.2||!same)return {lab:'Desfavorable',cls:'fl',br};
  if(Math.abs(c)>=0.4&&Math.abs(l)>=0.4&&br>=0.7)return {lab:'Favorable',cls:c>0?'up':'dn',br};
  return {lab:'Selectiva',cls:'fl',br};
}
function renderSummary(){
  $('stamp').textContent='Datos al '+S.asof;
  const c=S.composite,pos=((c+2)/4*100).toFixed(1),sb=S.sub;
  $('regime').innerHTML=`<span class="k">Régimen de política monetaria</span>
    <div class="big">${regime(c)}</div><span class="num">Puntaje compuesto ${sg(c)} de ±2</span>
    <div style="display:grid;gap:10px"><div class="gauge"><i style="left:${pos}%"></i></div>
    <div class="gscale"><span>Alivio claro</span><span>Alivio</span><span>Neutral</span><span>Restrictivo</span><span>Restrictivo fuerte</span></div></div>
    <span class="num" style="font-size:14px">Catalizadores ${sg(sb.coin)} · Líderes ${sg(sb.lead)}</span>
    <div class="rchart"><canvas id="rChart"></canvas></div>`;
  drawBias();
  const row=(lab,val,[st,cl])=>`<div class="ir"><span class="il">${lab}</span><span class="iv">${val}</span><span class="is ${cl}">${st}</span></div>`;
  const card=(k,rows)=>`<div class="panel vcard lift"><span class="k">${k}</span><div class="irows">${rows.join('')}</div></div>`;
  const pmi=RW('ISM Manufactura (PMI)'),nmi=RW('ISM Servicios (NMI)'),um=RW('Sentimiento del consumidor (UMCSI)'),cli=RW('OECD CLI (EE.UU.)'),lei=RW('LEI Conference Board, 6m');
  const k1=RW('Core CPI a/a'),k3=RW('Core CPI 3m anualizado'),pp=RW('Core PPI 3m anualizado'),mi=RW('Expectativa de inflación 1 año (UMich)'),gs=RW('Petróleo WTI a/a');
  const un=RW('Desempleo · cambio 12m (prom. 3m)'),nf=RW('Nóminas NFP · promedio 3 meses'),cl=RW('Solicitudes iniciales · 4 sem vs 52 sem');
  const rr=RW('Tasa real (Fed funds − core a/a)'),y10=RW('UST 10 años · cambio 6m');
  const emp=Math.sign(pmi.pts+nmi.pts),d2ff=S.d2-S.ff,ffchg=S.ff-S.ff_prev,bp=RW('Permisos de construcción'),adp=S.info.find(r=>r.name.startsWith('ADP'));
  $('vcards').innerHTML=
    card('Líderes',[row('Empresas',`ISM ${S.pmi.toFixed(1)} · ${S.nmi.toFixed(1)}`,stA(emp)),row('Consumidor',`UMCSI ${S.umcsi.toFixed(1)}`,stA(um.pts)),row('Ciclo',`CLI ${cli.val.replace(' ↑','')}`,stA(cli.pts)),row('LEI 6m',lei.val,stA(lei.pts)),row('Vivienda',`Permisos ${bp.val}`,stA(bp.pts))])+
    card('Inflación · catalizador',[row('CPI a/a',`${S.cpi_yy.toFixed(1)}%`,stI(S.cpi_yy>=3?1:S.cpi_yy<2?-1:0)),row('Core a/a',k1.val,stI(k1.pts)),row('Core 3m',k3.val,stI(k3.pts)),row('PPI core 3m',pp.val,stI(pp.pts)),row('Expect. 1a',mi.val,stI(mi.pts)),row('WTI a/a',gs.val,stI(gs.pts))])+
    card('Empleo · catalizador',[row('Desempleo',`${S.unrate.toFixed(1)}% · ${sg(S.u_chg)} pp`,stA(un.pts)),row('NFP 3m',nf.val,stA(nf.pts)),row('Solicitudes',`${Math.round(S.claims4/1000)}k`,stA(cl.pts)),row('ADP',`${adp.val} · ${adp.date.slice(0,3)}`,stA(adp.state==='hot'?1:adp.state==='cold'?-1:0))])+
    card('Fed',[row('Fed funds',`${S.ff.toFixed(2)}% · ${sg(ffchg*100,0)} pb`,stF(Math.sign(ffchg))),row('Tasa real',rr.val,stF(rr.pts>0?-1:rr.pts<0?1:0)),row('UST 2Y',`${S.d2.toFixed(2)}% · ${sg(d2ff*100,0)} pb`,stF(d2ff>0.25?1:d2ff<-0.25?-1:0)),row('UST 10Y',`${S.d10.toFixed(2)}%`,stF(Math.sign(y10.pts)))]);
  const ic=ideaCond(),b=S.breadth,dir=sb.lead<sb.coin-0.05?'la presión se modera':sb.lead>sb.coin+0.05?'la presión aumenta':'la presión se mantiene';
  const bias=c>=0.4?'USD alcista condicional':c<=-0.4?'USD bajista condicional':'Sin sesgo direccional';
  const cp=S.cycproj,des=cp.acc<0?cp.h['3'].dist2.DES:cp.h['3'].dist.DES,rm=S.regime_mkt;
  const t=(k,v,n,cls='')=>`<div class="st"><span class="k">${k}</span><b class="${cls}">${v}</b><span class="n">${n}</span></div>`;
  $('idea').innerHTML=`<span class="tag">Sesgo TFX</span><div class="sesgo">`+
    t('Régimen proyectado',projLab(sb.lead),`Líderes ${sg(sb.lead)} · catalizadores ${sg(sb.coin)}: ${dir}. Ciclo: ${Math.round(des*100)}% de pasar a desaceleración en 3 meses.`)+
    t('Sentimiento',fedSent(c),`Proyectado: ${fedSent(sb.lead).toLowerCase()}. Régimen de mercado: ${rm.cur.toLowerCase()} → ${rm.proj.toLowerCase()}.`)+
    t('Condiciones para ideas',ic.lab,`${b.hot} de ${b.hot+b.cold} indicadores con señal calientan (${Math.round(ic.br*100)}%); ${b.flat} neutrales.`,ic.cls)+
    t('Sesgo operativo',bias,c>=0.4?'Evitar ideas contra el régimen. Confirmar con el catalizador.':c<=-0.4?'Evitar ideas contra el régimen.':'Operar solo catalizadores con sorpresa clara.',c>=0.4?'up':c<=-0.4?'dn':'')+`</div>`;
}

let rC;
function drawBias(){
  const H=S.hist;if(!H||!window.Chart)return;
  rC?.destroy();
  const lab=[...H.d,'actual'],v=[...H.v,S.composite],co=[...H.coin,S.sub.coin],le=[...H.lead,S.sub.lead];
  const fg=getComputedStyle($('regime')).color.match(/\d+/g)||[255,255,255];
  const W=`rgba(${fg[0]},${fg[1]},${fg[2]},`, hot=css('--hot'), cool=css('--cool');
  const FG=`rgb(${fg[0]},${fg[1]},${fg[2]})`;
  const bands={id:'bands',beforeDatasetsDraw(c,_,o){if(!o||!o.on)return;const{ctx,chartArea:a,scales:{y}}=c;if(!a)return;ctx.save();
    const zone=(lo,hi,col,al)=>{const y1=y.getPixelForValue(Math.min(hi,y.max)),y2=y.getPixelForValue(Math.max(lo,y.min));
      if(y2<a.top||y1>a.bottom)return;ctx.fillStyle=col;ctx.globalAlpha=al;ctx.fillRect(a.left,Math.max(a.top,y1),a.right-a.left,Math.min(a.bottom,y2)-Math.max(a.top,y1));ctx.globalAlpha=1;};
    zone(0.4,2,hot,.16);zone(-2,-0.4,cool,.16);ctx.restore();}};
  if(!Chart.registry.plugins.get('bands'))Chart.register(bands);
  rC=new Chart($('rChart'),{type:'line',data:{labels:lab,datasets:[
    {label:'Compuesto',data:v,borderColor:FG,borderWidth:2,pointRadius:lab.map((_,i)=>i===lab.length-1?4:0),pointBackgroundColor:FG,fill:false,tension:.2},
    {label:'Catalizadores',data:co,borderColor:W+'.55)',borderWidth:1,pointRadius:0,borderDash:[4,3]},
    {label:'Líderes',data:le,borderColor:W+'.35)',borderWidth:1,pointRadius:0,borderDash:[2,3]}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
      plugins:{bands:{on:true},legend:{labels:{color:W+'.7)',boxWidth:10,font:{size:11}}},
        tooltip:{callbacks:{title:t=>t[0].label==='actual'?'Hoy · '+S.asof:t[0].label,label:i=>`${i.dataset.label}: ${sg(i.raw)}`}}},
      scales:{x:{grid:{display:false},ticks:{color:W+'.45)',maxTicksLimit:6,callback:function(x){const l=this.getLabelForValue(x);return l==='actual'?'hoy':l.slice(0,4);}}},
        y:{min:-2,max:2,grid:{color:W+'.12)'},ticks:{color:W+'.45)',stepSize:1,callback:v=>sg(v,0)}}}}});
}

// ---------- Análisis cuantitativo ----------
let fScore=store.get('fScore7','Líder'),fSort=store.get('fSort7','bloque'),fYield=store.get('fYield9','curva');
const colv=v=>v>0?'var(--hot)':v<0?'var(--cool)':'var(--muted)';
function renderScore(){
  const B=Object.keys(S.weights),SD=S.side;
  if(!['Líder','Coincidente','Rezagado'].includes(fScore))fScore='Líder';
  chipset($('fScore'),[{id:'Líder',label:'Indicadores líderes'},{id:'Coincidente',label:'Indicadores coincidentes'},{id:'Rezagado',label:'Indicadores rezagados'}],fScore,id=>{fScore=id;store.set('fScore7',id);renderScore();});
  chipset($('fSort'),[{id:'bloque',label:'Por bloque'},{id:'hot',label:'Más calentamiento'},{id:'cold',label:'Más enfriamiento'}],fSort,id=>{fSort=id;store.set('fSort7',id);renderScore();},'chip sm');
  const c=S.composite,w=Math.min(50,Math.abs(c)/2*50);
  $('scTotal').innerHTML=`<div class="tt"><span class="k">Ponderación total · cinco bloques</span><b style="color:${colv(c)}">${sg(c)}</b><span class="n">${regime(c)} · ${c>0?'calentamiento':c<0?'enfriamiento':'neutral'}</span></div>
    <div class="tb"><div class="pbar" role="img" aria-label="Puntaje ponderado ${sg(c)} de ±2"><i style="left:${c>=0?50:50-w}%;width:${Math.max(w,0.6)}%;background:${colv(c)}"></i><em style="left:${((c+2)/4*100).toFixed(1)}%"></em></div>
      <div class="pscale"><span>−2<i> · enfriamiento fuerte</i></span><span>0</span><span>+2<i> · calentamiento fuerte</i></span></div>
      <div class="contrib">${B.map(b=>`<span>${b} <b style="color:${colv(S.blocks[b])}">${sg(S.blocks[b]*S.weights[b])}</b></span>`).join('')}</div></div>`;
  const blk=b=>{const v=S.blocks[b],w2=Math.abs(v)/2*50,left=v>=0?50:50-w2;
    return `<div class="panel blk lift"><span class="k"><span>${b}</span><span>${Math.round(S.weights[b]*100)}%</span></span><span class="v" style="color:${colv(v)}">${sg(v,2)}</span>
      <div class="bar"><i style="left:${left}%;width:${Math.max(w2,1)}%;background:${colv(v)}"></i></div></div>`;};
  const grp=(lab,side,val)=>{const bs=B.filter(b=>SD[b]===side),wt=bs.reduce((a,b)=>a+S.weights[b],0);
    return `<div class="grpbox"><div class="gh"><span>${lab} · ${Math.round(wt*100)}%</span><b style="color:${colv(val)}">${sg(val)}</b></div><div class="gb">${bs.map(blk).join('')}</div></div>`;};
  $('blocks').innerHTML=grp('Catalizadores · coincidentes','Coincidente',S.sub.coin)+grp('Líderes','Líder',S.sub.lead);
  const row=(r,tag)=>`<tr><td><b>${r.name}</b>${tag?`<span class="side L" style="margin-left:8px">${r.block}</span>`:''}<span class="sub">${r.what}</span></td><td class="num">${r.val}<span class="sub">${r.date}</span></td>
    <td class="rule"><span class="th0">Estable</span> ${r.stable}<br><span class="th1">Calienta</span> ${r.hot}<br><span class="th2">Enfría</span> ${r.cold}</td><td class="num"><span class="pts ${ptsCls(r.pts)}">${ptsTxt(r.pts)}</span></td></tr>`;
  const bs=B.filter(b=>SD[b]===fScore),rows=S.rows.filter(r=>bs.includes(r.block)),sv=fScore==='Rezagado'?null:S.sub[fScore==='Líder'?'lead':'coin'];
  const STL={hot:'Calienta',cold:'Enfría',flat:'Estable'},GI={'Componentes ISM':'Componentes ISM · informativos: el PMI y el NMI ya los incluyen','Empleo':'Empleo · informativo: ADP no tiene tabla TFX','PIB':'PIB · rezagado: confirma el ciclo, no suma al puntaje'};
  const irow=r=>`<tr class="info"><td><b>${r.name}</b><span class="side C">${r.pts!=null?'no pondera':'informativo'}</span><span class="sub">${r.what}</span></td><td class="num">${r.val}<span class="sub">${r.prev} · ${r.date}</span></td>
    <td class="rule"><span class="th0">Estable</span> ${r.stable}<br><span class="th1">Calienta</span> ${r.hot}<br><span class="th2">Enfría</span> ${r.cold}</td><td class="num">${r.pts!=null?`<span class="pts ${ptsCls(r.pts)}">${ptsTxt(r.pts)}</span>`:`<span class="is ${r.state}">${STL[r.state]}</span>`}</td></tr>`;
  const IR=S.info.filter(r=>r.side===fScore),ig=[...new Set(IR.map(r=>r.block))].map(g=>`<tr class="grp"><td colspan="4">${GI[g]||g}</td></tr>`+IR.filter(r=>r.block===g).map(irow).join('')).join('');
  let h='<thead><tr><th>Indicador · qué mide</th><th class="num">Lectura</th><th>Umbrales</th><th class="num">Puntos</th></tr></thead><tbody>';
  if(fSort==='bloque')bs.forEach(b=>{h+=`<tr class="grp"><td colspan="4">${b} · promedio ${sg(S.blocks[b],2)}</td></tr>`;rows.filter(r=>r.block===b).forEach(r=>h+=row(r,false));});
  else [...rows].sort((a,b)=>fSort==='hot'?b.pts-a.pts:a.pts-b.pts).forEach(r=>h+=row(r,true));
  h+=ig;
  h+=sv==null?`</tbody><tfoot><tr class="tot"><td colspan="3">Rezagados · confirman el ciclo; no entran al puntaje compuesto</td><td class="num">—</td></tr></tfoot>`:`</tbody><tfoot><tr class="tot"><td colspan="3">${fScore==='Líder'?'Líderes':'Catalizadores (coincidentes)'} · promedio ponderado de sus bloques</td><td class="num">${sg(sv)}</td></tr></tfoot>`;
  $('score').innerHTML=h;
  renderYields();
}
let ylC;
function renderYields(){
  if(!['curva','d2','d10'].includes(fYield))fYield='curva';
  chipset($('fYield'),[{id:'curva',label:'Curva por tramos'},{id:'d2',label:'UST 2 años'},{id:'d10',label:'UST 10 años'}],fYield,id=>{fYield=id;store.set('fYield9',id);renderYields();},'chip sm');
  $('ylOne').hidden=fYield==='curva';$('ylCurve').hidden=fYield!=='curva';
  if(fYield==='curva'){renderCurve();return;}
  ylC?.destroy();
  const Y=S.yields[fYield],nm=fYield==='d2'?'UST 2Y':'UST 10Y';
  const cur=Y.rows.find(r=>r.lab===Y.curb),bd=Y.rows[0],bu=Y.rows[4];
  $('ylKpis').innerHTML=factc(`${nm} · ${Y.date.slice(8)}-${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][+Y.date.slice(5,7)-1]}`,Y.last.toFixed(2)+'%',`Cambio 6m ${sg(Y.cur)} pp · ${Y.curb.toLowerCase()}`,hc(Y.cur))+
    factc('Fed funds en 12 meses',`${sg(cur.ff12,0)} pb`,`Sube ${pct(cur.ffup12)} · recorta ${pct(cur.ffdn12)} de las veces`,hc(cur.ff12))+
    factc('Core a/a en 12 meses',`${sg(cur.k12)} pp`,`Sube ${pct(cur.kup12)} de las veces`,hc(cur.k12))+
    factc('CPI a/a en 12 meses',`${sg(cur.c12)} pp`,`Sube ${pct(cur.cup12)} de las veces`,hc(cur.c12));
  $('ylTable').innerHTML=`<thead><tr><th>Si el ${nm} en 6 meses…</th><th class="num">Meses</th><th class="num">Fed funds 6m</th><th class="num">Fed funds 12m</th><th class="num">Prob. alza</th><th class="num">Prob. recorte</th><th class="num">Core a/a 12m</th><th class="num">CPI a/a 12m</th></tr></thead><tbody>`+
    Y.rows.map(r=>`<tr class="${r.lab===Y.curb?'here':''}"><td>${r.lab}${r.lab===Y.curb?' <b>· actual</b>':''}<span class="sub">${{'Bajan fuerte':'≤ −75 pb','Bajan':'−75 a −25 pb','Estables':'±25 pb','Suben':'+25 a +75 pb','Suben fuerte':'≥ +75 pb'}[r.lab]}</span></td><td class="num">${r.n}</td>
      <td class="num">${sg(r.ff6,0)} pb</td><td class="num ${r.ff12>0?'up':'dn'}">${sg(r.ff12,0)} pb</td><td class="num">${pct(r.ffup12)}</td><td class="num">${pct(r.ffdn12)}</td><td class="num ${r.k12>0?'up':'dn'}">${sg(r.k12)} pp</td><td class="num">${sg(r.c12)} pp</td></tr>`).join('')+'</tbody>';
  const tasas=cur.ffup12>=0.6?`la Fed subió tasas en los 12 meses siguientes ${pct(cur.ffup12)} de las veces (${sg(cur.ff12,0)} pb en promedio)`:cur.ffdn12>=0.6?`la Fed recortó en los 12 meses siguientes ${pct(cur.ffdn12)} de las veces (${sg(cur.ff12,0)} pb)`:`la Fed no tuvo una dirección clara en los 12 meses siguientes (${sg(cur.ff12,0)} pb)`;
  const infl=Math.abs(cur.k12)<0.15?`el core casi no cambió (${sg(cur.k12)} pp): el rendimiento anticipa tasas, no inflación`:cur.k12>0?`el core subió ${cur.k12.toFixed(2)} pp: anticipa más inflación`:`el core bajó ${Math.abs(cur.k12).toFixed(2)} pp: anticipa desinflación`;
  $('ylRead').innerHTML=`<b>Lectura actual:</b> el ${nm} ${Y.cur>=0?'subió':'bajó'} ${Math.abs(Y.cur*100).toFixed(0)} pb en 6 meses (${Y.curb.toLowerCase()}). En ese escenario ${tasas} y ${infl}. <b>Si recortan:</b> cuando el ${nm} cayó 75 pb o más, la Fed recortó ${pct(bd.ffdn12)} de las veces (${sg(bd.ff12,0)} pb) y el core ${bd.k12<0?'bajó':'subió'} ${Math.abs(bd.k12).toFixed(2)} pp. <b>Si suben fuerte:</b> la Fed subió ${pct(bu.ffup12)} de las veces (${sg(bu.ff12,0)} pb).`;
}
function renderCurve(){
  const C=S.curve,R=C.rows,dd=C.date,dl=`${dd.slice(8)}-${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][+dd.slice(5,7)-1]}`;
  const pb=v=>sg(v*100,0),cl=v=>v>0.0001?'up':v<-0.0001?'dn':'fl',BK={'Bajan fuerte':'≤ −75 pb','Bajan':'−75 a −25 pb','Estables':'±25 pb','Suben':'+25 a +75 pb','Suben fuerte':'≥ +75 pb'};
  const r=t=>R.find(x=>x.t===t),y2=r('2Y'),y10=r('10Y'),y3m=r('3M'),s210=C.spreads[0],s103=C.spreads[1],nw=C.now,rg=C.regimes.find(x=>x.lab===nw.reg);
  const TR={Corto:['Tramo corto','3M–2Y','Descuenta a la Fed de los próximos 1–2 años.'],Intermedio:['Tramo intermedio','3Y–7Y','Política monetaria más crecimiento a mediano plazo.'],Largo:['Tramo largo','10Y–30Y','Crecimiento, inflación de largo plazo y prima por plazo.']};
  const avg=(tr,k)=>{const a=R.filter(x=>x.tramo===tr);return a.reduce((s,x)=>s+x[k],0)/a.length;};
  $('ylCurveK').innerHTML=factc(`Régimen de la curva · 6m`,nw.reg,`Nivel ${pb(nw.dl)} pb · pendiente 10Y−2Y ${pb(nw.ds)} pb`,hc(nw.dl))+
    factc('Tramo corto · 6m',`${pb(avg('Corto','d6'))} pb`,`2Y ${y2.last.toFixed(2)}% · 3M ${y3m.last.toFixed(2)}%`,hc(avg('Corto','d6')))+
    factc('Tramo intermedio · 6m',`${pb(avg('Intermedio','d6'))} pb`,`5Y ${r('5Y').last.toFixed(2)}% · percentil 10 años ${Math.round(r('5Y').pct10*100)}`,hc(avg('Intermedio','d6')))+
    factc('Tramo largo · 6m',`${pb(avg('Largo','d6'))} pb`,`10Y ${y10.last.toFixed(2)}% · 30Y ${r('30Y').last.toFixed(2)}%`,hc(avg('Largo','d6')));
  let h=`<thead><tr><th>Plazo</th><th class="num">Rend. ${dl}</th><th class="num">Δ 1m</th><th class="num">Δ 3m</th><th class="num">Δ 6m</th><th class="num">Δ 12m</th><th class="num">Pctl 10a</th><th class="num">Fed funds 12m</th><th class="num">Prob. alza</th><th class="num">Core a/a 12m</th><th class="num">Desempleo 12m</th></tr></thead><tbody>`;
  ['Corto','Intermedio','Largo'].forEach(tr=>{const [a,b,c]=TR[tr];h+=`<tr class="grp"><td colspan="11">${a} · ${b} · ${c}</td></tr>`;
    R.filter(x=>x.tramo===tr).forEach(x=>{h+=`<tr><td><b>UST ${x.t}</b><span class="sub">${x.b} (${BK[x.b]}) · ${x.n} casos desde ${x.since}</span></td><td class="num">${x.last.toFixed(2)}%</td>
      <td class="num ${cl(x.d1)}">${pb(x.d1)}</td><td class="num ${cl(x.d3)}">${pb(x.d3)}</td><td class="num ${cl(x.d6)}"><b>${pb(x.d6)}</b></td><td class="num ${cl(x.d12)}">${pb(x.d12)}</td><td class="num">${Math.round(x.pct10*100)}</td>
      <td class="num ${cl(x.ff12)}">${sg(x.ff12,0)} pb</td><td class="num">${pct(x.ffup)}</td><td class="num ${cl(x.k12)}">${sg(x.k12)} pp</td><td class="num ${x.u12>0?'dn':x.u12<0?'up':'fl'}">${sg(x.u12)} pp</td></tr>`;});});
  $('ylCurveT').innerHTML=h+'</tbody>';
  $('ylSpr').innerHTML=`<thead><tr><th>Pendientes</th><th class="num">Actual</th><th class="num">Δ 6m</th><th class="num">Δ 12m</th><th class="num">Pctl 10a</th></tr></thead><tbody>`+
    C.spreads.map(x=>`<tr><td><b>${x.lab}</b><span class="sub">${x.what}</span></td><td class="num">${sg(x.last)} pp</td><td class="num ${cl(x.d6)}">${pb(x.d6)} pb</td><td class="num ${cl(x.d12)}">${pb(x.d12)} pb</td><td class="num">${Math.round(x.pct10*100)}</td></tr>`).join('')+'</tbody>';
  $('ylReg').innerHTML=`<thead><tr><th>Si la curva en 6 meses…</th><th class="num">Meses</th><th class="num">Fed funds 12m</th><th class="num">Prob. alza</th><th class="num">Prob. recorte</th><th class="num">Core a/a 12m</th><th class="num">Desempleo 12m</th><th class="num">10Y 12m</th></tr></thead><tbody>`+
    C.regimes.map(x=>`<tr class="${x.lab===nw.reg?'here':''}"><td><b>${x.lab}</b>${x.lab===nw.reg?' <b>· actual</b>':''}<span class="sub">${x.what}</span></td><td class="num">${x.n}</td><td class="num ${cl(x.ff12)}">${sg(x.ff12,0)} pb</td><td class="num">${pct(x.ffup)}</td><td class="num">${pct(x.ffdn)}</td><td class="num ${cl(x.k12)}">${sg(x.k12)} pp</td><td class="num ${x.u12>0?'dn':x.u12<0?'up':'fl'}">${sg(x.u12)} pp</td><td class="num ${cl(x.y10)}">${sg(x.y10,0)} pb</td></tr>`).join('')+'</tbody>';
  const ink=css('--ink'),acc=css('--accent'),muted=css('--muted'),line=css('--line'),cool=css('--cool');
  const SH=C.shape;ylC?.destroy();
  ylC=window.Chart&&new Chart($('ylChart'),{type:'line',data:{labels:SH.ten,datasets:[
    {label:`Hoy · ${dl}`,data:SH.hoy,borderColor:acc,backgroundColor:acc,borderWidth:2.4,pointRadius:3},
    {label:'Promedio sep',data:SH.m1,borderColor:ink,borderWidth:1.3,pointRadius:0,borderDash:[2,3]},
    {label:'Promedio abr',data:SH.m6,borderColor:muted,borderWidth:1.3,pointRadius:0,borderDash:[6,4]},
    {label:'Promedio oct-25',data:SH.m12,borderColor:cool,borderWidth:1.3,pointRadius:0}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:muted,boxWidth:12}},tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw.toFixed(2)}%`}}},
      scales:{x:{grid:{display:false},ticks:{color:muted}},y:{grid:{color:line},ticks:{color:muted,callback:v=>v.toFixed(1)+'%'}}}}});
  const shortLead=avg('Corto','d6')>avg('Largo','d6')+0.1,longLead=avg('Largo','d6')>avg('Corto','d6')+0.1;
  const mv=(avg('Corto','d6')+avg('Intermedio','d6')+avg('Largo','d6'))/3,mvT=mv>0.25?'toda la curva subió':mv<-0.25?'toda la curva bajó':'la curva se movió poco';
  $('ylCurveR').innerHTML=`<b>Lectura actual:</b> ${mvT} en 6 meses (corto ${pb(avg('Corto','d6'))} pb, intermedio ${pb(avg('Intermedio','d6'))} pb, largo ${pb(avg('Largo','d6'))} pb): ${nw.reg.toLowerCase()}${shortLead?', con el tramo corto al frente':longLead?', con el tramo largo al frente':''}. `+
    `<b>Tramo corto:</b> con el 2Y ${y2.b.toLowerCase()}, la Fed subió en los 12 meses siguientes ${pct(y2.ffup)} de las veces (${sg(y2.ff12,0)} pb en promedio). `+
    `<b>Tramo largo:</b> con el 10Y ${y10.b.toLowerCase()}, la Fed fue al alza solo ${pct(y10.ffup)} de las veces (${sg(y10.ff12,0)} pb): el tramo largo refleja prima por plazo e inflación de largo plazo, no la siguiente decisión de la Fed. `+
    `<b>Pendiente:</b> 10Y−3M en ${sg(s103.last)} pp${s103.last>0?', sin inversión: la curva no señala recesión':', invertida: históricamente precede recesiones'}. En el régimen actual (${rg.n} casos) la Fed movió ${sg(rg.ff12,0)} pb en 12 meses y el desempleo cambió ${sg(rg.u12)} pp.`;
}

// ---------- Ciclo ----------
let fCycle=store.get('fCycle',24);
function renderCycle(){
  const cy=S.cycle;
  chipset($('fCycle'),[{id:12,label:'12 meses'},{id:24,label:'24 meses'},{id:60,label:'5 años'}],fCycle,id=>{fCycle=id;store.set('fCycle',id);renderCycle();});
  const n=cy.vals.length,k=Math.min(fCycle,n-1),pts=[];
  for(let i=n-k;i<n;i++)pts.push({d:cy.dates[i],x:cy.vals[i]-100,y:cy.vals[i]-cy.vals[i-1]});
  const W=560,H=420,cx=W/2,cyy=H/2,mx=Math.max(0.6,...pts.map(p=>Math.abs(p.x)))*1.25,my=Math.max(0.08,...pts.map(p=>Math.abs(p.y)))*1.3;
  const sx=v=>cx+v/mx*(W/2-40),sy=v=>cyy-v/my*(H/2-40);
  const ink=css('--ink'),muted=css('--muted'),line=css('--line'),acc=css('--accent'),panel=css('--panel');
  const q=(x,y,t,c,a='middle')=>`<text x="${x}" y="${y}" fill="${c}" font-family="JetBrains Mono, monospace" font-size="12" font-weight="600" letter-spacing="1.5" text-anchor="${a}">${t}</text>`;
  let s=`<rect x="${cx}" y="16" width="${W/2-16}" height="${H/2-16}" fill="${css('--hot-soft')}" opacity=".55" rx="10"/>`;
  s+=`<rect x="${cx}" y="${cyy}" width="${W/2-16}" height="${H/2-16}" fill="${css('--accent-soft')}" opacity=".55" rx="10"/>`;
  s+=`<rect x="16" y="${cyy}" width="${W/2-16}" height="${H/2-16}" fill="${css('--cool-soft')}" opacity=".55" rx="10"/>`;
  s+=`<rect x="16" y="16" width="${W/2-16}" height="${H/2-16}" fill="${css('--soft')}" rx="10"/>`;
  s+=`<line x1="16" y1="${cyy}" x2="${W-16}" y2="${cyy}" stroke="${line}" stroke-width="1.5"/><line x1="${cx}" y1="16" x2="${cx}" y2="${H-16}" stroke="${line}" stroke-width="1.5"/>`;
  s+=q(W-32,42,'EXPANSIÓN',css('--hot'),'end')+q(W-32,H-28,'DESACELERACIÓN',acc,'end')+q(32,H-28,'CONTRACCIÓN',css('--cool'),'start')+q(32,42,'RECUPERACIÓN',muted,'start');
  const path=pts.map((p,i)=>`${i?'L':'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  s+=`<path d="${path}" fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width="1.5"/>`;
  pts.forEach((p,i)=>{const last=i===pts.length-1,first=i===0;
    s+=`<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${last?8:3.5}" fill="${last?acc:ink}" fill-opacity="${last?1:.35+.65*i/pts.length}" stroke="${panel}" stroke-width="${last?3:1}"><title>${p.d}: ${(p.x+100).toFixed(2)} (${sg(p.y,3)})</title></circle>`;
    if(last||first)s+=`<text x="${sx(p.x)+(last?14:-10)}" y="${sy(p.y)+(last?5:-10)}" fill="${last?acc:muted}" font-family="JetBrains Mono, monospace" font-size="12" font-weight="600" text-anchor="${last?'start':'end'}">${p.d}</text>`;});
  $('clock').innerHTML=s;
  const last=pts.at(-1);
  const f=(k,v,nn)=>`<div class="fact"><span class="k">${k}</span><span class="v">${v}</span><span class="n">${nn}</span></div>`;
  $('cycleFacts').innerHTML=f('OECD CLI · '+last.d,cy.vals.at(-1).toFixed(2),`Sube ${last.y.toFixed(3)} pts/mes. El impulso se modera.`)+
    f('Fase actual',`${cy.run} meses`,`Duración promedio de la expansión: ${cy.avgdur.EXP.toFixed(1)} meses.`)+
    f('LEI Conference Board · 6m',`${sg(cy.lei_6m,1)}%`,`Previo ${sg(cy.lei_6m_prev,1)}%. Sin señal de recesión.`)+
    f('Índice coincidente · 6m',`${sg(cy.cei_6m,1)}%`,'La actividad actual sigue creciendo.');
  const cols={EXP:'var(--hot)',DES:'var(--accent)',CON:'var(--cool)',REC:'var(--muted)'};
  $('phases').innerHTML=['EXP','DES','CON','REC'].map(p=>`<div class="ph ${p===cy.phase?'cur':''}"><span>${PHN[p]}${p===cy.phase?' · actual':''}</span><div class="b"><i style="width:${(cy.freq[p]*100/0.35).toFixed(0)}%;background:${cols[p]}"></i></div><span class="t">${pct(cy.freq[p])} · ${cy.avgdur[p].toFixed(1)}m</span></div>`).join('');
  const cp=S.cycproj,[pp,ppv]=projPhase(),rm=S.regime_mkt,Q=rm.quad[rm.proj];
  const risk=Q.spx.mean<0?'Risk-off':'Risk-on',usd=S.composite>=0.4?'Long USD':S.composite<=-0.4?'Short USD':(Q.dxy.mean>=0?'Long USD':'Short USD');
  const it=(k,v,n)=>`<div><span class="k">${k}</span><b>${v}</b><i>${n}</i></div>`;
  $('cycProj').innerHTML=it('Proyección',PHN[pp],`${Math.round(ppv*100)}% · 3 meses`)+it('Tiempo',`~${cp.rem_med.toFixed(0)} meses`,`rango ${cp.rem_q[0].toFixed(0)}–${cp.rem_q[1].toFixed(0)}`)+
    it('Sentimiento',risk,`S&P ${sg(Q.spx.mean)}%/mes`)+it('Dólar',usd,`DXY ${sg(Q.dxy.mean)}%/mes`)+it('Régimen',rm.proj,`actual: ${rm.cur.toLowerCase()}`);
}

// ---------- Catalizador ----------
const CATN={cpi:'CPI',ppi:'PPI',nfp:'Nóminas no agrícolas (NFP)',fomc:'Decisión de tasas FOMC',gdp:'PIB',pce:'PCE',retail:'Ventas minoristas',ism:'ISM manufactura',nmi:'ISM servicios',lei:'LEI Conference Board',jolts:'Vacantes JOLTS',eci:'Costo del empleo',umich:'Sentimiento UMich',claims:'Solicitudes iniciales',un:'Tasa de desempleo'};
const TZL=[['America/Mexico_City','México · CDMX (UTC−6)','CDMX'],['America/Guatemala','Centroamérica · Guatemala, Costa Rica (UTC−6)','Centroamérica'],
 ['America/Bogota','Colombia · Perú · Ecuador (UTC−5)','Bogotá'],['America/Caracas','Venezuela · Bolivia (UTC−4)','Caracas'],
 ['America/Santiago','Chile (UTC−3/−4)','Santiago'],['America/Argentina/Buenos_Aires','Argentina · Uruguay · Brasil (UTC−3)','Buenos Aires'],
 ['America/New_York','EE.UU. Este · Nueva York (ET)','ET'],['America/Chicago','EE.UU. Centro (CT)','CT'],['America/Denver','EE.UU. Montaña (MT)','MT'],
 ['America/Los_Angeles','EE.UU. Pacífico (PT)','PT'],['Europe/Madrid','España · Madrid (CET)','Madrid']];
let TZ=store.get('tz','America/Mexico_City');
if(!TZL.some(z=>z[0]===TZ))TZ='America/Mexico_City';
const TZN=()=>(TZL.find(z=>z[0]===TZ)||TZL[0])[2];
const fDate=t=>new Date(t).toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:TZ});
const fTime=t=>new Date(t).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:TZ});
const fShort=t=>new Date(t).toLocaleDateString('es-MX',{weekday:'short',day:'2-digit',month:'short',timeZone:TZ}).replace(/\./g,'');
const numOf=s=>{if(!s)return null;const m=String(s).replace('−','-').match(/-?\+?\d+(\.\d+)?/);return m?parseFloat(m[0]):null;};
const NCK={cpi:['cpi','core'],ppi:['ppi','ppic'],nfp:['nfp']};
const NCN={cpi:'CPI',core:'Core CPI',ppi:'PPI',ppic:'Core PPI',nfp:'NFP'};
const MESL=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MABR={ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12};
const refLab=r=>{const [y,m]=r.split('-');return MESL[+m-1]+' '+y;};
const refShort=r=>MESL[+r.split('-')[1]-1].slice(0,3);
const isK=t=>S.nowcast[t].unit==='k';
const fx=(t,v,d=2)=>v==null||!isFinite(v)?'—':isK(t)?sg(v,0)+'k':(d===1?sg(v,1):sg(v,d))+'%';
const pub=(t,v)=>isK(t)?sg(Math.round(v),0)+'k':sg(Math.round(v*10)/10,1)+'%';
function nextCat(now=Date.now()){return S.calendar.filter(e=>e.major&&Date.parse(e.t)>now).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t))[0];}
function nextModeled(now=Date.now()){return S.calendar.filter(e=>e.major&&NCK[e.key]&&Date.parse(e.t)>now).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t))[0];}
function evTargets(e){return e?NCK[e.key].filter(t=>S.nowcast[t]&&+S.nowcast[t].ref.split('-')[1]===MABR[e.ref]&&Date.parse(S.nowcast[t].release)>Date.now()):[];}
const SCN={
  cpi:['La energía pasa al índice general. Confirma si el 2Y sostiene la subida 1–2 h después.','Descontado. El foco pasa al core.','Alivio si el core acompaña.'],
  core:['La presión se extiende a la canasta. Sube la probabilidad de otra alza.','Sin ventaja. Manda la reacción del 2Y.','El ciclo de alzas pierde urgencia. Es el escenario que más ha movido al USD y al 2Y.'],
  ppi:['Costos al alza en la cadena: presiona al core PCE y refuerza el sesgo restrictivo.','Descontado: el foco pasa a ventas minoristas y al PCE.','Alivio en costos: resta presión a la Fed.'],
  ppic:['Márgenes y servicios presionan: el traspaso al consumidor sigue activo.','Sin sorpresa en la presión subyacente.','El traspaso de costos se modera.'],
  nfp:['Empleo firme: sostiene el sesgo restrictivo y al USD.','Sin sorpresa: mandan el desempleo y los salarios.','Empleo débil: abre espacio para que la Fed pause.']};
let fCat=store.get('fCat','modelo');
function renderCatalyst(){
  const nx=nextCat(),nm=nextModeled(),TG=evTargets(nm);
  chipset($('fCat'),[{id:'modelo',label:'Modelo vs consenso'},{id:'escenarios',label:'Escenarios y reacción'},{id:'agenda',label:'Agenda'}],fCat,id=>{fCat=id;store.set('fCat',id);renderCatalyst();});
  ['modelo','escenarios','agenda'].forEach(t=>$('cat-'+t).hidden=t!==fCat);
  if(!nm||!TG.length){
    $('cpiCtx').textContent=nm?`${CATN[nm.key]} ${nm.ref} · ${fDate(nm.t)}, ${fTime(nm.t)} ${TZN()}. El modelo de este dato se calcula al publicarse el dato previo.`:'Sin catalizadores con modelo en el calendario.';
    $('cpiTable').innerHTML='';$('scen').innerHTML='';$('scenNote').textContent='';
  }else{
    const N0=S.nowcast[TG[0]],same=nx&&nm.t===nx.t&&nm.key===nx.key;
    $('cpiCtx').innerHTML=`<b>${CATN[nm.key]} ${refLab(N0.ref)}</b> · ${fDate(nm.t)}, ${fTime(nm.t)} ${TZN()}${same?'':' · próximo dato con modelo'}. ${TG.some(t=>S.nowcast[t].cons==null)?'Sin consenso publicado aún: las probabilidades se miden contra el dato previo.':'Probabilidades redondeadas como las publica la fuente.'}`;
    const CL={reg:'Regresión',arima:'ARIMA',ens:'Ensamble'};
    const row=t=>{const N=S.nowcast[t],M=N.mc,ref=N.refv;
      return `<tr><td><b>${NCN[t]}</b><span class="sub">${isK(t)?'cambio mensual':'m/m'} · central: ${CL[N.central]}</span></td><td class="num"><b>${fx(t,N.pred)}</b><span class="sub">publicaría ${pub(t,N.pred)}</span></td>
        <td class="num">${fx(t,N.reg.pred)}</td><td class="num">${fx(t,N.arima.pred)}</td><td class="num">${N.cons==null?'—':isK(t)?sg(N.cons,0)+'k':sg(N.cons,1)+'%'}</td><td class="num">${isK(t)?sg(N.prev,0)+'k':sg(N.prev,1)+'%'}</td>
        <td class="num"><span class="up">${pct(M.above)}</span> / ${pct(M.inline)} / <span class="dn">${pct(M.below)}</span><span class="sub">vs ${N.consKind} ${isK(t)?sg(ref,0)+'k':sg(ref,1)+'%'}${isK(t)?' (±10k = en línea)':''}</span></td><td class="num">${fx(t,M.p5)} a ${fx(t,M.p95)}</td></tr>`;};
    $('cpiTable').innerHTML=`<thead><tr><th>Indicador</th><th class="num">Modelo TFX</th><th class="num">Regresión</th><th class="num">ARIMA</th><th class="num">Consenso</th><th class="num">Previo</th><th class="num">Arriba / en línea / abajo</th><th class="num">Rango 90%</th></tr></thead><tbody>${TG.map(row).join('')}</tbody>`;
    // escenarios
    const EA=S.evt.assets,ev=nm.key==='cpi';
    const cellv=(k,col,tk)=>{const v=EA[k].surp[col].terc[tk].mean,u=EA[k].unit;return `<td class="num ${v>0?'up':v<0?'dn':'fl'}">${fmtU(v,u)}</td>`;};
    const step=t=>isK(t)?10:0.1,fr=(t,v)=>isK(t)?sg(v,0)+'k':v.toFixed(1)+'%';
    let h=`<thead><tr><th>Si el dato sale…</th><th class="num">Prob. modelo</th>${ev?'<th class="num">DXY</th><th class="num">UST 2Y</th><th class="num">S&amp;P 500</th><th class="num">Oro</th>':'<th>Lectura</th>'}</tr></thead><tbody>`;
    TG.forEach(t=>{const N=S.nowcast[t],M=N.mc,ref=N.refv,col=t==='cpi'?'cpi_surp':'core_surp',R=SCN[t];
      h+=`<tr class="grp"><td colspan="${ev?6:3}">${NCN[t]} · ${N.consKind} ${fr(t,ref)}</td></tr>`;
      [[`${isK(t)?'>':'≥'} ${fr(t,ref+step(t))} · arriba`,M.above,'caliente',R[0]],[`${isK(t)?'±10k de '+fr(t,ref):fr(t,ref)} · en línea`,M.inline,'media',R[1]],[`${isK(t)?'<':'≤'} ${fr(t,ref-step(t))} · abajo`,M.below,'fria',R[2]]].forEach(([lab,p,tk,rd])=>{
        h+=ev?`<tr><td><b>${lab}</b><span class="sub">${rd}</span></td><td class="num">${pct(p)}</td>${['dxy','d2','spx','xau'].map(k=>cellv(k,col,tk)).join('')}</tr>`:`<tr><td><b>${lab}</b></td><td class="num">${pct(p)}</td><td>${rd}</td></tr>`;});});
    $('scen').innerHTML=h+'</tbody>';$('scenNote').textContent=ev?'Reacción promedio del día de publicación según la sorpresa frente al modelo, CPI desde 2016.':'Reacción de activos medida solo para el CPI (estudio de evento desde 2016). Para este dato se muestran probabilidades y lectura.';
  }
  const now=Date.now(),evs=[...S.calendar].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t)),past=evs.filter(e=>Date.parse(e.t)<=now).slice(-9),fut=evs.filter(e=>Date.parse(e.t)>now).slice(0,14);
  const tz=$('tzSel');
  if(tz){tz.innerHTML=TZL.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');tz.value=TZ;
    tz.onchange=()=>{TZ=tz.value;store.set('tz',TZ);renderCatalyst();};}
  const ar=e=>{const a=numOf(e.actual),c=numOf(e.cons);const cl=a!=null&&c!=null?(a>c?'up':a<c?'dn':''):'';const isNx=nx&&e===nx;
    return `<tr class="${isNx?'here':''}"><td class="num" style="text-align:left">${fShort(e.t)}<span class="sub">${fTime(e.t)}</span></td><td><b>${e.name}</b>${isNx?' <span class="side L">próximo</span>':''}<span class="sub">${e.ref} · ${e.country}</span></td>
      <td class="num"><b class="${cl}">${e.actual||'—'}</b></td><td class="num">${e.cons||'—'}</td><td class="num">${e.prev||'—'}</td></tr>`;};
  $('agenda').innerHTML=`<thead><tr><th>Fecha · ${TZN()}</th><th>Indicador</th><th class="num">Actual</th><th class="num">Consenso</th><th class="num">Previa</th></tr></thead><tbody>
    <tr class="grp"><td colspan="5">Publicados</td></tr>${past.map(ar).join('')}<tr class="grp"><td colspan="5">Próximos</td></tr>${fut.map(ar).join('')}</tbody>`;
}

// ---------- Modelos · Nowcast TFX Macro ----------
let fMod=store.get('fMod9',null),fModel=store.get('fModel','reg'),mvC,mvC2;
const Phi=z=>{const t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2),p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p;};
function alignInfo(t){
  const N=S.nowcast[t],G=N.garch,b=N.base_mm,k=isK(t),er=m=>N.recent?N.rmse36[m]:(m==='reg'?N.reg.rmse:N.arima.rmse),bias=S.composite>=0.4?1:S.composite<=-0.4?-1:0;
  const bs=v=>k?`${sg(v,0)}k vs promedio 3m ${sg(b,0)}k`:`m/m ${v.toFixed(2)}% vs ${b.toFixed(2)}% de hace un año`;
  const L=[
    {id:'reg',name:'Regresión',p:Phi((N.reg.pred-b)/er('reg')),basis:bs(N.reg.pred),err:er('reg')},
    {id:'arima',name:`ARIMA(${N.arima.order.join(',')})`,p:Phi((N.arima.pred-b)/er('arima')),basis:bs(N.arima.pred)+' · solo inercia',err:er('arima')},
    {id:'garch',name:G.ok?'GARCH':'Volatilidad',p:Phi((N.pred-b)/G.sig[0]),basis:G.ok?`σ ${k?G.sig[0].toFixed(0)+'k':G.sig[0].toFixed(3)+' pp'} (${sg((G.sig[0]/G.uncond-1)*100,0)}% vs normal)`:'Sin efecto ARCH: σ constante',err:G.sig[0]},
    {id:'mc',name:'Monte Carlo',p:N.mc.up,basis:`20,000 escenarios${k?'':' con redondeo de la fuente'}`,err:N.mc.sig1}];
  return L.map(m=>{const pb=bias>=0?m.p:1-m.p,al=bias===0?Math.abs(m.p-0.5)<0.1:pb>=0.55;return {...m,pb,al};});
}
function renderModels(){
  const ORD=S.nc_order,nm=nextModeled(),tg=evTargets(nm);
  if(!fMod||!S.nowcast[fMod])fMod=tg[0]||ORD[0];
  chipset($('fMod'),ORD.map(t=>({id:t,label:`${NCN[t]} · ${refShort(S.nowcast[t].ref)}${S.nowcast[t].actual!=null?' ✓':''}`})),fMod,id=>{fMod=id;store.set('fMod9',id);renderModels();});
  const MD=[{id:'reg',label:'Regresión'},{id:'arima',label:'ARIMA'},{id:'garch',label:'GARCH'},{id:'mc',label:'Monte Carlo'}];
  if(!MD.some(m=>m.id===fModel))fModel='reg';
  chipset($('fModel'),MD,fModel,id=>{fModel=id;store.set('fModel',id);renderModels();},'chip sm');
  const t=fMod,N=S.nowcast[t],G=N.garch,MC=N.mc,k=isK(t),name=`${NCN[t]} ${refLab(N.ref)}`,T=N.table;
  const AL=alignInfo(t),dirTxt=k?(S.composite>=0.4?'empleo más fuerte':S.composite<=-0.4?'empleo más débil':'sin dirección'):(S.composite>=0.4?'inflación al alza':S.composite<=-0.4?'inflación a la baja':'sin dirección');
  const ue=v=>k?'±'+v.toFixed(0)+'k':'±'+v.toFixed(2)+' pp';
  $('modKpis').innerHTML=AL.map(m=>`<div class="panel vcard lift ${m.id===fModel?'sel':''}" data-m="${m.id}" role="button" tabindex="0"><span class="k">${m.name}</span><span class="v ${m.al?'up':'fl'}">${m.al?'Alineado':'No alineado'}</span>
    <span class="n"><span>Prob. ${dirTxt}: ${pct(m.pb)}</span><span>${m.basis}</span><span>Error típico ${ue(m.err)}</span></span></div>`).join('');
  document.querySelectorAll('#modKpis [data-m]').forEach(el=>{const go=()=>{fModel=el.dataset.m;store.set('fModel',fModel);renderModels();};el.onclick=go;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
  const ink=css('--ink'),acc=css('--accent'),hot=css('--hot'),cool=css('--cool'),muted=css('--muted'),line=css('--line');
  const base={responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false}};
  const yf=v=>k?v.toFixed(0)+'k':v.toFixed(2)+'%';
  const ax=(f=v=>v)=>({x:{grid:{display:false},ticks:{color:muted,maxTicksLimit:10}},y:{grid:{color:line},ticks:{color:muted,callback:f}}});
  const tr=(a,b)=>`<tr><td>${a}</td><td class="num">${b}</td></tr>`,dh=v=>v==null?'—':v.toFixed(0)+'%';
  const O=N.oos,ss=k?'k':' pp',rmF=v=>k?v.toFixed(0)+'k':v.toFixed(3)+' pp';
  const dirLab=k?'Acierto: arriba/abajo del prom. 3m':'Acierto dirección a/a';
  const AC=N.actual==null?'':`<tr class="here"><td><b>Publicado</b><span class="sub">resultado oficial</span></td><td class="num"><b>${pub(t,N.actual)}</b></td></tr>`
    +tr('Nowcast del 14-oct',fx(t,N.pred_pub??N.pred))+tr('Error frente a ese nowcast',rmF(Math.abs(N.actual-(N.pred_pub??N.pred))));
  let title='',desc='',stats='',extra='';mvC?.destroy();mvC2?.destroy();
  const line2=(lab,data,col)=>({label:lab,data,borderColor:col,borderWidth:1.4,pointRadius:0});
  if(fModel==='reg'){
    title=`Regresión · ${name}`;desc=`Estima el dato con insumos publicados antes del comunicado.`;
    mvC=window.Chart&&new Chart($('mvChart'),{type:'line',data:{labels:O.dates,datasets:[line2('Real',O.actual,ink),line2('Regresión (fuera de muestra)',O.reg,acc)]},options:{...base,plugins:{legend:{labels:{color:muted,boxWidth:12}}},scales:ax(yf)}});
    const cf=N.reg.coef,x=N.reg.x,lb=N.reg.lab;
    stats=`<thead><tr><th>Regresión · ${N.reg.name}</th><th class="num">Valor</th></tr></thead><tbody>`+tr(`Nowcast ${refShort(N.ref)}`,fx(t,N.reg.pred))+tr('Publicaría',pub(t,N.reg.pred))+tr(`RMSE fuera de muestra${N.recent?' · últimos 36m':''}`,rmF(N.recent?N.rmse36.reg:T[0][1]))+tr(`RMSE dato anterior (ingenuo)${N.recent?' · 36m':''}`,rmF(N.recent?N.rmse36.naive:T[3][1]))+tr(dirLab,dh(T[0][2]))+
      tr('Constante',(cf.const>=0?'+':'−')+Math.abs(cf.const).toFixed(k?0:3)+ss)+Object.keys(x).map(f=>tr(lb[f]||f,`${(cf[f]*x[f]>=0?'+':'−')+Math.abs(cf[f]*x[f]).toFixed(k?0:3)}${ss}`)).join('')+'</tbody>';
    extra=N.recent?`<p class="note">El empleo de equilibrio cambió desde 2024: el modelo se elige por su error en los últimos 36 meses y usa una ventana móvil de ${N.reg.win||'todos los'} meses.</p>`:'';
  }
  if(fModel==='arima'){
    title=`ARIMA(${N.arima.order.join(',')}) · ${name}`;desc='Proyecta el dato con su propia inercia histórica.';
    mvC=window.Chart&&new Chart($('mvChart'),{type:'line',data:{labels:O.dates,datasets:[line2('Real',O.actual,ink),line2('ARIMA (fuera de muestra)',O.ar,cool)]},options:{...base,plugins:{legend:{labels:{color:muted,boxWidth:12}}},scales:ax(yf)}});
    const PL={const:'Media de largo plazo','ar.L1':'AR(1) · persistencia','ar.L2':'AR(2)','ar.L3':'AR(3)','ma.L1':'MA(1)','ma.L2':'MA(2)',sigma2:'Varianza del error'};
    stats=`<thead><tr><th>ARIMA</th><th class="num">Valor</th></tr></thead><tbody>`+tr(`Nowcast ${refShort(N.ref)}`,fx(t,N.arima.pred))+tr('Publicaría',pub(t,N.arima.pred))+tr(`RMSE fuera de muestra${N.recent?' · últimos 36m':''}`,rmF(N.recent?N.rmse36.arima:T[1][1]))+tr(dirLab,dh(T[1][2]))+
      Object.entries(N.arima.params).map(([a,v])=>tr(PL[a]||a,(v<0?'−':'')+Math.abs(v).toFixed(a==='sigma2'&&k?0:3))).join('')+'</tbody>';
  }
  if(fModel==='garch'){
    title=`${G.ok?'GARCH(1,1)':'Volatilidad del error'} · ${name}`;desc=G.ok?'Mide cuánto puede equivocarse el modelo este mes.':'Sin efecto ARCH significativo: el error se trata como constante.';
    mvC=window.Chart&&new Chart($('mvChart'),{type:'line',data:{labels:G.cv_dates,datasets:[{label:G.ok?'Volatilidad condicional':'Error observado (RMS 12m)',data:G.condvol,borderColor:acc,borderWidth:2,pointRadius:0},{label:'Nivel normal',data:G.cv_dates.map(()=>G.uncond),borderColor:muted,borderDash:[5,4],borderWidth:1,pointRadius:0}]},
      options:{...base,plugins:{legend:{labels:{color:muted,boxWidth:12}}},scales:ax(v=>k?v.toFixed(0)+'k':v.toFixed(2))}});
    stats=`<thead><tr><th>${G.ok?'GARCH':'Volatilidad'}</th><th class="num">Valor</th></tr></thead><tbody>`+tr('Volatilidad para este dato',rmF(G.sig[0]))+tr('Nivel normal',rmF(G.uncond))+tr('Diferencia',`${sg((G.sig[0]/G.uncond-1)*100,0)}%`)+
      (G.ok?tr('α · reacción a sorpresas',G.alpha.toFixed(3))+tr('β · memoria',G.beta.toFixed(3))+tr('Persistencia α+β',G.persist.toFixed(2))+tr('Colas t · grados de libertad',G.nu.toFixed(1)):'')+tr('Prueba ARCH-LM',G.arch_lm_p<0.001?'p < 0.001':'p = '+G.arch_lm_p.toFixed(3))+'</tbody>';
  }
  if(fModel==='mc'){
    title=`Monte Carlo · ${name}`;desc='Simula 20,000 escenarios para asignar probabilidades.';
    const q=MC.fan,labels=[...MC.hist_dates,...MC.months],nh=MC.hist_dates.length,last=MC.hist.at(-1),fut=kk=>[...Array(nh-1).fill(null),last,...q[kk]];
    mvC=window.Chart&&new Chart($('mvChart'),{type:'line',data:{labels,datasets:[
      {label:'p95',data:fut('p95'),borderWidth:0,pointRadius:0,backgroundColor:acc+'2a',fill:'+1'},{label:'p5',data:fut('p5'),borderWidth:0,pointRadius:0,fill:false},
      {label:'p75',data:fut('p75'),borderWidth:0,pointRadius:0,backgroundColor:acc+'55',fill:'+1'},{label:'p25',data:fut('p25'),borderWidth:0,pointRadius:0,fill:false},
      {label:'Mediana',data:fut('p50'),borderColor:acc,borderWidth:2,borderDash:[6,4],pointRadius:0,fill:false},
      {label:k?'Histórico m/m':'Histórico a/a',data:[...MC.hist,...Array(MC.months.length).fill(null)],borderColor:ink,borderWidth:2,pointRadius:0,fill:false}]},
      options:{...base,spanGaps:false,plugins:{legend:{labels:{color:muted,boxWidth:12,filter:i=>!['p95','p5','p75','p25'].includes(i.text)}},tooltip:{filter:i=>i.raw!=null,callbacks:{label:i=>`${i.dataset.label}: ${yf(i.raw)}`}}},scales:ax(v=>k?v.toFixed(0)+'k':v.toFixed(1)+'%')}});
    const ref=N.refv,rl=`${N.consKind} ${k?sg(ref,0)+'k':sg(ref,1)+'%'}`;
    stats=`<thead><tr><th>Monte Carlo</th><th class="num">Valor</th></tr></thead><tbody>`+tr(`Arriba del ${rl}`,pct(MC.above))+tr(k?'En línea (±10k)':'En línea',pct(MC.inline))+tr(`Abajo del ${rl}`,pct(MC.below))+tr('Rango 90%',`${fx(t,MC.p5)} a ${fx(t,MC.p95)}`)+
      tr(k?`Prob. supera prom. 3m (${sg(N.base_mm,0)}k)`:`Prob. a/a sube (previo ${N.yprev.toFixed(1)}%)`,pct(MC.up))+tr(`Mediana ${k?'m/m':'a/a'} ${refShort(MC.months.at(-1))}-${MC.months.at(-1).slice(2,4)}`,yf(q.p50.at(-1)))+'</tbody>';
    extra=`<h3 style="margin-top:8px">Probabilidad de cada cifra publicada · ${refLab(N.ref)}</h3><div class="chart" style="height:220px"><canvas id="mvChart2"></canvas></div>${t==='cpi'?'<p class="cap">El a/a de octubre usa una base interpolada: el BLS no publicó el CPI de octubre de 2025.</p>':''}`;
  }
  if(AC&&stats){stats=stats.replace('</tbody>',AC+'</tbody>');
    extra=`<p class="note">Dato ya publicado el ${refLab(N.ref)==='septiembre 2026'?'15 de octubre':'—'}. Las cifras de pronóstico de este panel se recalcularon con los índices revisados por la fuente, así que difieren del nowcast que se publicó antes del dato; la comparación válida es contra el nowcast del 14 de octubre.</p>`+extra;}
  $('mvTitle').textContent=title;$('mvDesc').textContent=desc;$('mvStats').innerHTML=stats;$('mvExtra').innerHTML=extra;
  if(fModel==='mc'&&window.Chart){const rd=MC.dist,c0=N.refv;
    mvC2=new Chart($('mvChart2'),{type:'bar',data:{labels:rd.map(r=>k?sg(r[0]-12.5,0)+' a '+sg(r[0]+12.5,0)+'k':r[0].toFixed(1)+'%'),datasets:[{data:rd.map(r=>r[1]*100),backgroundColor:rd.map(r=>(k?Math.abs(r[0]-c0)<=12.5:Math.abs(r[0]-c0)<1e-9)?ink:acc+'99'),borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>i.raw.toFixed(1)+'% de los escenarios'}}},scales:{x:{grid:{display:false},ticks:{color:muted,maxTicksLimit:12}},y:{grid:{color:line},ticks:{color:muted,callback:v=>v+'%'}}}}});}
}


// ---------- Distribución (DoR) ----------
const CATS=['Inflación','Energía','Empleo','Actividad','Política y tasas','Expectativas'];
const HLAB={MOM:'m/m',YOY:'a/a',A3:'3m anualizado',D:'Diario',W:'Semanal',M:'Mensual (cierre)',LVL:'Nivel',A4Y:'Prom. 4 sem. a/a',MK:'m/m (miles)',QA:'t/t anualizado',QY:'a/a trimestral',RYY:'a/a real'};
const dst=store.get('dor',{c:'Inflación',s:'core',h:'MOM',t:'resumen'});
function fmtU(v,u,signed=true){if(v==null||!isFinite(v))return '—';
  switch(u){case '%':return (signed?sg(v):v.toFixed(2))+'%';case 'pb':return (signed?sg(v,1):v.toFixed(1))+' pb';case 'pp':return (signed?sg(v):v.toFixed(2))+' pp';
  case 'pts':return signed?sg(v,3):v.toFixed(3);case 'lvl%':return v.toFixed(2)+'%';case 'lvlpb':return sg(v,0)+' pb';case 'lvlk':return v.toFixed(0)+'k';case 'lvlidx':return v.toFixed(2);case 'rngpb':return v.toFixed(1)+' pb';case 'k':return (signed?sg(v,0):v.toFixed(0))+'k';case 'pt1':return (signed?sg(v,1):v.toFixed(1))+' pts';default:return v.toFixed(2);}}
function pctl(s,p){const i=(s.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return s[l]+(s[h]-s[l])*(i-l);}
function stats(v){
  const n=v.length,s=[...v].sort((a,b)=>a-b),sum=v.reduce((a,b)=>a+b,0),mean=sum/n,ss=v.reduce((a,b)=>a+(b-mean)**2,0),sd=Math.sqrt(ss/(n-1));
  let m3=0,m4=0;v.forEach(x=>{const z=(x-mean)/sd;m3+=z**3;m4+=z**4;});
  const skew=n/((n-1)*(n-2))*m3, kurt=n*(n+1)/((n-1)*(n-2)*(n-3))*m4-3*(n-1)**2/((n-2)*(n-3));
  const cnt={};v.forEach(x=>{const k=x.toFixed(2);cnt[k]=(cnt[k]||0)+1;});let mode=null,mc=1;for(const k in cnt)if(cnt[k]>mc){mc=cnt[k];mode=+k;}
  return {n,s,sum,mean,sd,se:sd/Math.sqrt(n),var:ss/(n-1),median:pctl(s,.5),mode,skew,kurt,min:s[0],max:s[n-1],range:s[n-1]-s[0]};
}
let hC,tC;
const marker={id:'marker',afterDatasetsDraw(c,_,o){if(o.x==null)return;const{ctx,chartArea:a,scales:{x}}=c,px=x.getPixelForValue(o.x);
  ctx.save();ctx.strokeStyle=o.color;ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(px,a.top);ctx.lineTo(px,a.bottom);ctx.stroke();
  ctx.setLineDash([]);ctx.fillStyle=o.color;ctx.font='600 12px JetBrains Mono, monospace';const r=px>a.right-110;ctx.textAlign=r?'right':'left';ctx.fillText(o.text,px+(r?-8:8),a.top+14);ctx.restore();}};
if(window.Chart)Chart.register(marker);
function dorPick(){
  if(!CATS.includes(dst.c))dst.c='Inflación';
  if(!SER[dst.s])dst.s='core';
  const inCat=Object.keys(SER).filter(k=>SER[k].cat===dst.c);
  if(!inCat.includes(dst.s))dst.s=inCat[0];
  if(!SER[dst.s].h[dst.h])dst.h=Object.keys(SER[dst.s].h)[0];
  if(dst.t==='rango'&&!SER[dst.s].h[dst.h].rng)dst.t='resumen';
  store.set('dor',dst);
}
function renderDor(){
  dorPick();
  const S0=SER[dst.s],H=S0.h[dst.h],u=H.unit,v=H.values,cur=v.at(-1),st=stats(v),rank=st.s.filter(x=>x<=cur).length/st.n*100,z=(cur-st.mean)/st.sd;
  chipset($('fCat2'),CATS.map(c=>({id:c,label:c})),dst.c,id=>{dst.c=id;renderDor();});
  chipset($('series'),Object.keys(SER).filter(k=>SER[k].cat===dst.c).map(k=>({id:k,label:SER[k].name})),dst.s,id=>{dst.s=id;renderDor();},'chip sm');
  chipset($('horizon'),Object.keys(S0.h).map(k=>({id:k,label:HLAB[k]})),dst.h,id=>{dst.h=id;renderDor();},'chip sm');
  const zone=rank>=95?'cola superior':rank>=90?'extendido arriba':rank<=5?'cola inferior':rank<=10?'extendido abajo':'rango normal';
  const f=(k,val,nn)=>`<div class="fact"><span class="k">${k}</span><span class="v">${val}</span><span class="n">${nn}</span></div>`;
  const win=(days,minN)=>{const t1=Date.parse(H.dates.at(-1)+'T00:00:00Z');let k=0;
    for(let i=v.length-1;i>=0;i--){if(t1-Date.parse(H.dates[i]+'T00:00:00Z')>days*864e5)break;k++;}
    k=Math.max(minN,k);k=Math.min(k,v.length);const a=v.slice(-k),mn=Math.min(...a),mx=Math.max(...a);
    return {n:k,mn,mx,amp:mx-mn,net:a.at(-1)-a[0],d0:H.dates.at(-k)};};
  const wm=win(31,2),wq=win(93,4);
  const ampTxt=w=>`mín ${fmtU(w.mn,u,false)} · máx ${fmtU(w.mx,u,false)} · neto ${fmtU(w.net,u)}`;
  $('kpis').innerHTML=f('Lectura actual',fmtU(cur,u),`${H.dates.at(-1)} · ${S0.role==='Catalizador'?'catalizador':S0.role.toLowerCase()}`)+f('Percentil histórico',rank.toFixed(0),zone)+f('Z-score',sg(z),`${sg(z/1,1)} σ de la media`)+f('Muestra',st.n.toLocaleString('es-MX'),`${H.dates[0].slice(0,4)}–${H.dates.at(-1).slice(0,4)} · ${S0.fred.includes(' ')?S0.fred:'FRED '+S0.fred}`);
  $('kpis2').innerHTML=f('Amplitud · último mes',fmtU(wm.amp,u,false),`${ampTxt(wm)} · ${wm.n} datos desde ${wm.d0}`)+
    f('Amplitud · último trimestre',fmtU(wq.amp,u,false),`${ampTxt(wq)} · ${wq.n} datos desde ${wq.d0}`);
  const TABS=[['resumen','Resumen'],['frecuencias','Frecuencias'],['percentiles','Percentiles'],['desviacion','Desviación estándar'],['rango','Rango H-L'],['serie','Serie histórica']];
  $('dorTabs').innerHTML=TABS.map(([id,l])=>`<button class="tab" role="tab" type="button" id="tab-${id}" aria-selected="${dst.t===id}" ${id==='rango'&&!H.rng?'disabled title="Disponible solo en series con datos diarios"':''}>${l}</button>`).join('');
  TABS.forEach(([id])=>{$('tab-'+id).onclick=()=>{dst.t=id;store.set('dor',dst);renderDor();};$('dor-'+id).hidden=dst.t!==id;});
  const ink=css('--ink'),acc=css('--accent'),cool=css('--cool'),hot=css('--hot'),muted=css('--muted'),line=css('--line');
  if(dst.t==='resumen'){
    const lo=Math.min(pctl(st.s,.01),cur),hi=Math.max(pctl(st.s,.99),cur),bins=40,w=(hi-lo)/bins||1,c=new Array(bins).fill(0);
    v.forEach(x=>{if(x>=lo&&x<=hi)c[Math.min(bins-1,Math.floor((x-lo)/w))]++;});
    const ctr=c.map((_,i)=>lo+w*(i+.5)),p5=pctl(st.s,.05),p95=pctl(st.s,.95);
    hC?.destroy();hC=window.Chart&&new Chart($('hist'),{type:'bar',data:{datasets:[{data:ctr.map((x,i)=>({x,y:c[i]/st.n*100})),backgroundColor:ctr.map(x=>(x<p5||x>p95)?acc:acc+'5c'),borderRadius:2,barPercentage:1,categoryPercentage:.92}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},marker:{x:cur,color:cool,text:'Actual '+fmtU(cur,u)},tooltip:{callbacks:{title:t=>fmtU(t[0].raw.x-w/2,u,false)+' a '+fmtU(t[0].raw.x+w/2,u,false),label:t=>t.raw.y.toFixed(1)+'% de las observaciones'}}},
        scales:{x:{type:'linear',min:lo,max:hi,grid:{color:line},ticks:{color:muted,maxTicksLimit:8}},y:{grid:{color:line},ticks:{color:muted,callback:x=>x+'%'},title:{display:true,text:'% de observaciones',color:muted}}}}});
    const r=(k,val)=>`<tr><td>${k}</td><td class="num">${val}</td></tr>`;
    $('desc').innerHTML=`<thead><tr><th>Estadística descriptiva</th><th class="num">Valor</th></tr></thead><tbody>`+
      r('Media',fmtU(st.mean,u))+r('Error estándar',st.se.toFixed(4))+r('Mediana',fmtU(st.median,u))+r('Moda (redondeo 0.01)',st.mode==null?'sin repetición':fmtU(st.mode,u))+
      r('Desviación estándar',st.sd.toFixed(4))+r('Varianza muestral',st.var.toFixed(4))+r('Curtosis (exceso)',st.kurt.toFixed(2))+r('Asimetría',st.skew.toFixed(2))+
      r('Rango',st.range.toFixed(3))+r('Mínimo',fmtU(st.min,u))+r('Máximo',fmtU(st.max,u))+r('Suma',st.sum.toFixed(2))+r('Conteo',st.n.toLocaleString('es-MX'))+'</tbody>';
    const grp=(lab,arr,avg)=>{const n=arr.length,fr=n/st.n;return `<tr><td>${lab}</td><td class="num">${n?fmtU(avg,u):'—'}</td><td class="num">${n}</td><td class="num">${(fr*100).toFixed(1)}%</td><td class="num">${n?fmtU(fr*avg,u):'—'}</td></tr>`;};
    const P=v.filter(x=>x>0),N=v.filter(x=>x<0),Zr=v.filter(x=>x===0),av=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
    $('posneg').innerHTML=`<thead><tr><th>Datos</th><th class="num">Retorno promedio</th><th class="num">Conteo</th><th class="num">Frecuencia</th><th class="num">Retorno ajustado por frecuencia</th></tr></thead><tbody>`+grp('Positivos',P,av(P))+grp('Negativos',N,av(N))+grp('Cero',Zr,0)+'</tbody>';
    const PP=phasePlot(H,u),pr=PP.res,c0=PP.curPh,p0=PP.pp;$('phPlot').innerHTML=PP.svg;
    $('phCap').textContent='Caja: percentiles 25–75 · línea: 10–90 · marca: mediana. Fases según la OECD CLI desde 1955.';
    if(pr[c0]&&pr[p0]){const rk=pr[c0].rank,vd=rk>75?'Alta para la fase actual: por encima de lo típico del ciclo.':rk<25?'Baja para la fase actual: por debajo de lo típico del ciclo.':'Típica de la fase actual: la distribución confirma el régimen.';
      $('phRead').innerHTML=`<b>Lectura actual ${fmtU(PP.cur,u)}:</b> percentil ${rk.toFixed(0)} en ${PHN[c0].toLowerCase()} (fase actual, mediana ${fmtU(pr[c0].p50,u)})${p0!==c0?` y ${pr[p0].rank.toFixed(0)} en ${PHN[p0].toLowerCase()} (fase proyectada, mediana ${fmtU(pr[p0].p50,u)})`:''}. ${vd}`;}
    else $('phRead').textContent='Muestra insuficiente por fase para esta serie.';
  }
  if(dst.t==='frecuencias'){
    const K=[-3,-2.4,-1.8,-1.2,-0.6,0,0.6,1.2,1.8,2.4,3],e=K.map(k=>st.mean+k*st.sd);
    const rows=[];rows.push({lab:'Menor que '+fmtU(e[0],u),c:v.filter(x=>x<=e[0]).length,lo:-Infinity,hi:e[0]});
    for(let i=1;i<e.length;i++)rows.push({lab:`${fmtU(e[i-1],u)} a ${fmtU(e[i],u)}`,c:v.filter(x=>x>e[i-1]&&x<=e[i]).length,lo:e[i-1],hi:e[i],k:`${K[i-1]}σ a ${K[i]}σ`});
    rows.push({lab:'Mayor que '+fmtU(e.at(-1),u),c:v.filter(x=>x>e.at(-1)).length,lo:e.at(-1),hi:Infinity});
    let cum=0;const mx=Math.max(...rows.map(r=>r.c));
    $('freq').innerHTML=`<thead><tr><th>Intervalo</th><th class="num">Frecuencia</th><th class="num">Probabilidad</th><th class="num">Acumulado</th><th style="width:28%"></th></tr></thead><tbody>`+rows.map(r=>{const p=r.c/st.n;cum+=p;const here=cur>r.lo&&cur<=r.hi;
      return `<tr class="${here?'here':''}"><td>${r.lab}${here?' <b>· actual</b>':''}${r.k?`<span class="sub">${r.k.replace(/-/g,'−')}</span>`:''}</td><td class="num">${r.c}</td><td class="num">${(p*100).toFixed(2)}%</td><td class="num">${(cum*100).toFixed(2)}%</td><td><span class="fbar" style="width:${(r.c/mx*100).toFixed(0)}%"></span></td></tr>`;}).join('')+'</tbody>';
  }
  if(dst.t==='percentiles'){
    const g=[[1,15,1],[20,80,5],[85,99,1]],tbl=([a,b,step])=>{let h=`<table><thead><tr><th>Percentil</th><th class="num">Valor</th></tr></thead><tbody>`;
      for(let p=a;p<=b;p+=step){const val=pctl(st.s,p/100),nxt=pctl(st.s,Math.min(.99,(p+step)/100));const here=cur>=val&&cur<nxt&&p<b;h+=`<tr class="${here?'here':''}"><td>p${p}${here?' · actual':''}</td><td class="num">${fmtU(val,u)}</td></tr>`;}
      return `<div class="scroll">${h}</tbody></table></div>`;};
    $('pcts').innerHTML=g.map(tbl).join('');
  }
  if(dst.t==='desviacion'){
    const NORM={1:68.27,2:95.45,3:99.73};
    $('sig').innerHTML=`<thead><tr><th>Desviaciones</th><th class="num">Límite superior</th><th class="num">Límite inferior</th><th class="num">Conteo real</th><th class="num">% real</th><th class="num">% normal</th></tr></thead><tbody>`+
      [1,2,3].map(k=>{const up=st.mean+k*st.sd,lo=st.mean-k*st.sd,c=v.filter(x=>x<up&&x>lo).length;return `<tr><td>±${k}σ</td><td class="num">${fmtU(up,u)}</td><td class="num">${fmtU(lo,u)}</td><td class="num">${c}</td><td class="num">${(c/st.n*100).toFixed(2)}%</td><td class="num">${NORM[k].toFixed(2)}%</td></tr>`;}).join('')+'</tbody>';
  }
  if(dst.t==='rango'&&H.rng){
    const R=H.rng,rv=R.values,rs=stats(rv),ru=R.unit,rc=rv.at(-1),med=rs.median,E=[...Array(11)].map((_,i)=>i*0.4*med);
    const rows=[{lab:'Igual a '+fmtU(0,ru,false),c:rv.filter(x=>x<=0).length}];
    for(let i=1;i<E.length;i++)rows.push({lab:`${fmtU(E[i-1],ru,false)} a ${fmtU(E[i],ru,false)}`,c:rv.filter(x=>x>E[i-1]&&x<=E[i]).length,lo:E[i-1],hi:E[i]});
    rows.push({lab:'Mayor que '+fmtU(E.at(-1),ru,false),c:rv.filter(x=>x>E.at(-1)).length,lo:E.at(-1),hi:Infinity});
    let cum=0;const mx=Math.max(...rows.map(r=>r.c));
    const reach=[0.7,0.65,0.6].map(p=>`<tr><td>${Math.round(p*100)}% de los periodos</td><td class="num">${fmtU(pctl(rs.s,1-p),ru,false)}</td></tr>`).join('');
    let dorBox='';
    if(S0.tradable){const cs=stats(v);
      dorBox=`<div class="scroll"><table><thead><tr><th>Niveles de referencia DoR</th><th class="num">Largo</th><th class="num">Corto</th></tr></thead><tbody>`+
        [[.15,.85],[.20,.80],[.25,.75]].map(([a,b])=>`<tr><td>Retroceso adverso · p${Math.round(a*100)} / p${Math.round(b*100)}</td><td class="num">${fmtU(pctl(cs.s,a),u)}</td><td class="num">${fmtU(pctl(cs.s,b),u)}</td></tr>`).join('')+
        `</tbody></table></div><p class="note">Como en los libros DoR: el stop se referencia en los percentiles 15/20/25 del retorno cierre a cierre y el objetivo en el rango alcanzado con 60–70% de probabilidad histórica. No es probabilidad de acierto de una operación.</p>`;}
    $('rng').innerHTML=`<div class="dor"><div style="display:grid;gap:20px">
        <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">${f('Rango actual',fmtU(rc,ru,false),R.dates.at(-1))+f('Media',fmtU(rs.mean,ru,false),'σ '+rs.sd.toFixed(3))+f('Mediana',fmtU(med,ru,false),'Percentil actual '+(rs.s.filter(x=>x<=rc).length/rs.n*100).toFixed(0))}</div>
        <div class="scroll"><table><thead><tr><th>El rango alcanza al menos…</th><th class="num">Tamaño</th></tr></thead><tbody>${reach}</tbody></table></div>${dorBox}</div>
      <div class="scroll"><table><thead><tr><th>Intervalo de rango</th><th class="num">Frecuencia</th><th class="num">Probabilidad</th><th class="num">Acumulado</th><th style="width:24%"></th></tr></thead><tbody>${rows.map(r=>{const p=r.c/rs.n;cum+=p;const here=r.lo!=null&&rc>r.lo&&rc<=r.hi;return `<tr class="${here?'here':''}"><td>${r.lab}${here?' <b>· actual</b>':''}</td><td class="num">${r.c}</td><td class="num">${(p*100).toFixed(2)}%</td><td class="num">${(cum*100).toFixed(2)}%</td><td><span class="fbar" style="width:${(r.c/mx*100).toFixed(0)}%"></span></td></tr>`;}).join('')}</tbody></table>
      <p class="cap">${ru==='%'?'Rango = (máximo − mínimo) / mínimo del periodo, con cierres diarios (no hay máximos ni mínimos intradía en FRED).':'Rango = máximo − mínimo del periodo, en puntos básicos.'} Intervalos en múltiplos de 0.4 × la mediana.</p></div></div>`;
  }
  if(dst.t==='serie'){
    let dd=H.dates,vv=v;if(vv.length>2500){dd=dd.slice(-2500);vv=vv.slice(-2500);}
    const p5=pctl(st.s,.05),p95=pctl(st.s,.95);
    tC?.destroy();tC=window.Chart&&new Chart($('ts'),{type:'line',data:{labels:dd,datasets:[{data:vv,borderColor:ink,borderWidth:1.3,pointRadius:0},
      {data:dd.map(()=>p95),borderColor:hot,borderWidth:1,borderDash:[6,5],pointRadius:0},{data:dd.map(()=>p5),borderColor:cool,borderWidth:1,borderDash:[6,5],pointRadius:0}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{filter:t=>t.datasetIndex===0,callbacks:{label:t=>fmtU(t.raw,u)}}},
        scales:{x:{grid:{display:false},ticks:{color:muted,maxTicksLimit:10,callback:function(x){return this.getLabelForValue(x).slice(0,4)}}},y:{grid:{color:line},ticks:{color:muted}}}}});
  }
}

// ---------- Fases del ciclo por mes (OECD CLI) ----------
const PHM=(()=>{const cy=S.cycle,m={};for(let i=1;i<cy.vals.length;i++){const lv=cy.vals[i],d=lv-cy.vals[i-1];m[cy.dates[i]]=lv>=100?(d>=0?'EXP':'DES'):(d>=0?'REC':'CON');}return m;})();
const PHC={EXP:'--hot',DES:'--accent',CON:'--cool',REC:'--muted'};
function projPhase(){const cp=S.cycproj,H3=cp.acc<0?cp.h['3'].dist2:cp.h['3'].dist;return Object.entries(H3).sort((a,b)=>b[1]-a[1])[0];}
function phasePlot(H,u){
  const v=H.values,by={EXP:[],DES:[],CON:[],REC:[]};H.dates.forEach((d,i)=>{const p=PHM[d.slice(0,7)];if(p)by[p].push(v[i]);});
  const all=[...v].sort((a,b)=>a-b),cur=v.at(-1),lo=Math.min(pctl(all,.02),cur),hi=Math.max(pctl(all,.98),cur),cw=($('phPlot')&&$('phPlot').clientWidth)||700,W=Math.round(Math.max(330,Math.min(700,cw))),nr=W<520,Hh=200,L=nr?112:200,R=nr?30:44,T=12,rowH=44;
  const X=x=>L+(W-L-R)*(Math.min(hi,Math.max(lo,x))-lo)/((hi-lo)||1);
  const curPh=S.cycle.phase,[pp]=projPhase(),muted=css('--muted'),line=css('--line'),ink=css('--ink');
  let s=`<svg viewBox="0 0 ${W} ${Hh}" class="phsvg" role="img" aria-label="Distribución por fase del ciclo">`;
  for(let g=0;g<=4;g+=(nr?2:1)){const x=lo+(hi-lo)*g/4;s+=`<line x1="${X(x)}" x2="${X(x)}" y1="${T}" y2="${T+rowH*4-8}" stroke="${line}"/><text x="${X(x)}" y="${Hh-4}" font-size="11" text-anchor="middle" fill="${muted}" font-family="JetBrains Mono,monospace">${fmtU(x,u)}</text>`;}
  const res={};
  ['EXP','DES','CON','REC'].forEach((p,j)=>{const a=[...by[p]].sort((x,y)=>x-y),y=T+j*rowH+rowH/2-4,col=css(PHC[p]);if(a.length<8){res[p]=null;return;}
    const q=k=>pctl(a,k),[p10,p25,p50,p75,p90]=[q(.1),q(.25),q(.5),q(.75),q(.9)];res[p]={p50,rank:a.filter(x=>x<=cur).length/a.length*100,n:a.length};
    s+=`<text x="${L-10}" y="${y+4}" font-size="12" text-anchor="end" fill="${p===curPh||p===pp?ink:muted}" font-weight="${p===curPh||p===pp?600:400}" font-family="Archivo,sans-serif">${nr?{EXP:'Expansión',DES:'Desacel.',CON:'Contracción',REC:'Recuperación'}[p]:PHN[p]}${p===curPh?(nr?' ·act':' · actual'):p===pp?(nr?' ·proy':' · proyectada'):''}</text>`+
      `<line x1="${X(p10)}" x2="${X(p90)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="2"/><rect x="${X(p25)}" y="${y-10}" width="${Math.max(2,X(p75)-X(p25))}" height="20" rx="4" fill="${col}" fill-opacity="${p===curPh||p===pp?.55:.25}" stroke="${col}"/>`+
      `<line x1="${X(p50)}" x2="${X(p50)}" y1="${y-12}" y2="${y+12}" stroke="${ink}" stroke-width="2"/>`;});
  s+=`<line x1="${X(cur)}" x2="${X(cur)}" y1="${T-4}" y2="${T+rowH*4-8}" stroke="${ink}" stroke-width="2" stroke-dasharray="5 4"/><text x="${X(cur)+6}" y="${T+6}" font-size="11" fill="${ink}" font-family="JetBrains Mono,monospace">actual ${fmtU(cur,u)}</text></svg>`;
  return {svg:s,res,cur,curPh,pp};
}

// ---------- Gráficos · indicadores líderes ----------
let gx=Object.assign({k:'pmi',r:'10',v:'line',t:'lvl',c:'none',cmp:'',st:'all',ro:'all',h:0,hk:''},store.get('gx',{})),gxC;
const CHS=S.charts,LEADK=Object.keys(CHS).filter(k=>CHS[k].role==='Líder');
const PCTK={wti:1,claims:1,permits:1,retail:1,spx:1,m2:0};
const PRJ=S.proj||{},ROLES=['Líder','Coincidente','Rezagado'];
const GXK=ROLES.flatMap(r=>Object.keys(CHS).filter(k=>CHS[k].role===r));
const RABR={'Líder':'líder','Coincidente':'coinc.','Rezagado':'rezag.'};
const PLAB={hot:'al alza',flat:'sin cambio',cold:'a la baja'};
const stCls=s=>s==='Crecimiento'?'hot':s==='Contracción'?'cold':'flat';
function gxSeries(k,tr){const s=CHS[k].s;if(tr!=='yoy')return {d:s.d,v:s.v};const m={};s.d.forEach((d,i)=>m[d]=s.v[i]);
  const d2=[],v2=[];s.d.forEach((d,i)=>{const [y,mo]=d.split('-'),p=`${+y-1}-${mo}`;if(m[p]!=null){d2.push(d);v2.push(PCTK[k]?(s.v[i]/m[p]-1)*100:s.v[i]-m[p]);}});return {d:d2,v:v2};}
function turning(v,w=9){
  const n=v.length,sm=v.map((_,i)=>{const a=v.slice(Math.max(0,i-1),i+2);return a.reduce((x,y)=>x+y,0)/a.length;});
  const sd=Math.sqrt(sm.reduce((a,x)=>a+(x-sm.reduce((p,q)=>p+q,0)/n)**2,0)/n),minAmp=0.35*sd;let tp=[];
  for(let i=w;i<n-3;i++){const win=sm.slice(Math.max(0,i-w),Math.min(n,i+w+1)),mx=Math.max(...win),mn=Math.min(...win);if(sm[i]===mx)tp.push({i,type:'P',x:sm[i]});else if(sm[i]===mn)tp.push({i,type:'T',x:sm[i]});}
  const out=[];tp.forEach(p=>{const last=out.at(-1);if(!last){out.push(p);return;}if(last.type===p.type){if((p.type==='P'&&p.x>last.x)||(p.type==='T'&&p.x<last.x))out[out.length-1]=p;}else if(p.i-last.i>=6&&Math.abs(p.x-last.x)>=minAmp)out.push(p);});
  for(let k=0;k<4;k++){const last=out.at(-1);if(!last)break;const seg=sm.slice(last.i+1);if(seg.length<4)break;
    const mx=Math.max(...seg),mn=Math.min(...seg);
    if(last.type==='P'&&mx>last.x){const idx=last.i+1+seg.indexOf(mx);if(idx<n-1){out[out.length-1]={i:idx,type:'P',x:mx};continue;}break;}
    if(last.type==='T'&&mn<last.x){const idx=last.i+1+seg.indexOf(mn);if(idx<n-1){out[out.length-1]={i:idx,type:'T',x:mn};continue;}break;}
    const j=last.type==='P'?seg.indexOf(mn):seg.indexOf(mx),idx=last.i+1+j;
    if(idx-last.i>=6&&Math.abs(sm[idx]-last.x)>=minAmp&&idx<n-2)out.push({i:idx,type:last.type==='P'?'T':'P',x:sm[idx]});else break;}
  return out;
}
const gxShade={id:'gxShade',beforeDatasetsDraw(c,_,o){if(!o||!o.segs)return;const{ctx,chartArea:a,scales:{x}}=c;ctx.save();
  o.segs.forEach(s=>{const x0=x.getPixelForValue(s.a),x1=x.getPixelForValue(s.b);if(x1<a.left||x0>a.right)return;ctx.fillStyle=s.col;ctx.fillRect(Math.max(a.left,x0),a.top,Math.min(a.right,x1)-Math.max(a.left,x0),a.bottom-a.top);});ctx.restore();}};
if(window.Chart)Chart.register(gxShade);
function renderCharts(){
  const ST=[{id:'all',label:'Todos'},{id:'Crecimiento',label:'En crecimiento'},{id:'Neutral',label:'Neutral'},{id:'Contracción',label:'En contracción'}];
  chipset($('fState'),ST,gx.st,id=>{gx.st=id;store.set('gx',gx);renderCharts();});
  chipset($('fRole'),[{id:'all',label:'Todos'},{id:'Líder',label:'Líderes'},{id:'Coincidente',label:'Coincidentes'},{id:'Rezagado',label:'Rezagados'}],gx.ro,id=>{gx.ro=id;store.set('gx',gx);renderCharts();});
  const list=GXK.filter(k=>(gx.ro==='all'||CHS[k].role===gx.ro)&&(gx.st==='all'||CHS[k].state===gx.st));
  if(!CHS[gx.k])gx.k='pmi';
  if(list.length&&list.indexOf(gx.k)<0)gx.k=list[0];
  $('gxList').innerHTML=list.length?list.map(k=>`<button type="button" class="chip sm" id="gx-${k}" aria-pressed="${k===gx.k}"><i class="dot ${stCls(CHS[k].state)}"></i>${CHS[k].name}<span class="rol">${RABR[CHS[k].role]}</span></button>`).join(''):'<span class="cap">Ningún indicador con este filtro.</span>';
  list.forEach(k=>{$('gx-'+k).onclick=()=>{gx.k=k;store.set('gx',gx);renderCharts();};});
  chipset($('gxRange'),[{id:'2',label:'2 años'},{id:'5',label:'5 años'},{id:'10',label:'10 años'},{id:'20',label:'20 años'},{id:'all',label:'Todo'}],gx.r,id=>{gx.r=id;store.set('gx',gx);renderCharts();},'chip sm');
  chipset($('gxView'),[{id:'line',label:'Línea'},{id:'area',label:'Área'},{id:'bar',label:'Barras'}],gx.v,id=>{gx.v=id;store.set('gx',gx);renderCharts();},'chip sm');
  chipset($('gxTr'),[{id:'lvl',label:'Nivel'},{id:'yoy',label:'Cambio 12m'}],gx.t,id=>{gx.t=id;store.set('gx',gx);renderCharts();},'chip sm');
  chipset($('gxCyc'),[{id:'none',label:'Ninguno'},{id:'oecd',label:'Fases OCDE'},{id:'tp',label:'Picos y valles'}],gx.c,id=>{gx.c=id;store.set('gx',gx);renderCharts();},'chip sm');
  const sel=$('gxCmp');sel.innerHTML=`<option value="">Sin comparación</option><optgroup label="Líderes">${LEADK.filter(k=>k!==gx.k).map(k=>`<option value="${k}">${CHS[k].name}</option>`).join('')}</optgroup><optgroup label="Coincidentes">${Object.keys(CHS).filter(k=>CHS[k].role==='Coincidente').map(k=>`<option value="${k}">${CHS[k].name}</option>`).join('')}</optgroup><optgroup label="Rezagados">${Object.keys(CHS).filter(k=>CHS[k].role==='Rezagado').map(k=>`<option value="${k}">${CHS[k].name}</option>`).join('')}</optgroup>`;
  if(gx.cmp===gx.k)gx.cmp='';sel.value=gx.cmp;sel.onchange=()=>{gx.cmp=sel.value;store.set('gx',gx);renderCharts();};
  const C0=CHS[gx.k],P=gxSeries(gx.k,gx.t),u=gx.t==='yoy'?(PCTK[gx.k]?'%':C0.unit==='pts'?'pts':'pp'):C0.unit;
  const labels=P.d,vals=P.v,cmp=gx.cmp?gxSeries(gx.cmp,gx.t):null,cm={};if(cmp)cmp.d.forEach((d,i)=>cm[d]=cmp.v[i]);
  $('gxTitle').textContent=`${C0.name}${gx.t==='yoy'?' · cambio 12m':''}`;
  const fv=x=>x==null?'—':(u==='%'?x.toFixed(2)+'%':u==='USD'?'$'+x.toFixed(2):u==='k'?x.toFixed(0)+'k':x.toFixed(2)+(u==='pp'?' pp':''));
  const sorted=[...vals].sort((a,b)=>a-b),lastV=vals.at(-1),rank=sorted.filter(x=>x<=lastV).length/sorted.length*100,yo=gxSeries(gx.k,'yoy');
  const PJ=PRJ[gx.k];
  let hs=PJ?PJ.hs:[],hb=PJ?PJ.hbest:0;
  if(gx.hk!==gx.k){gx.h=hb;gx.hk=gx.k;}
  if(!hs.length||hs.indexOf(gx.h)<0)gx.h=hb;
  chipset($('gxH'),hs.length?hs.map(h=>({id:h,label:h+' meses'+(h===hb?' ★':'')})):[{id:0,label:'Sin muestra',off:true}],gx.h,id=>{gx.h=id;store.set('gx',gx);renderCharts();},'chip sm');
  const PP=PJ&&PJ.proj[String(gx.h)];
  const pcls=l=>l==='hot'?'hot':l==='cold'?'cold':'flat';
  const sfam=(l)=>{const F=(S.projfam||{})[gx.k]||'A';const M={A:['Expansión','Neutral','Contracción'],I:['Calentamiento','Estable','Enfriamiento'],F:['Restrictiva','Neutral','Expansiva']}[F];return l==='hot'?M[0]:l==='cold'?M[2]:M[1];};
  const projCard=PP?fact('Estado proyectado',`<span class="is ${pcls(PP.lab)}">${PP.weak?'Sin señal':sfam(PP.lab)}</span>`,
      PP.weak?`A ${gx.h} meses no supera la tasa base`:`${Math.round(PP.p*100)}% en ${PP.n} casos · base ${Math.round(PP.base[PP.lab]*100)}%`)
    :fact('Estado proyectado','<span class="is flat">—</span>','Muestra insuficiente');
  $('gxKpis').innerHTML=fact('Último dato',fv(lastV),labels.at(-1))
    +fact('Estado actual',`<span class="is ${stCls(C0.state)}">${C0.slab||C0.state||'—'}</span>`,`Puntaje TFX ${C0.pts>0?'+':''}${C0.pts??'—'} · ${CHS[gx.k].role.toLowerCase()}`)
    +projCard
    +fact('Percentil histórico',rank.toFixed(0),`Desde ${labels[0].slice(0,4)}`)
    +fact('Cambio 12m',yo.v.length?(yo.v.at(-1)>0?'+':'')+yo.v.at(-1).toFixed(2)+(PCTK[gx.k]?'%':''):'—',labels.at(-1));
  $('gxProj').innerHTML=PP?(()=>{
      const d=PP.dist,bb=PP.base,pc=x=>Math.round(x*100)+'%';
      const dd=['hot','flat','cold'].map(l=>`${sfam(l)} ${pc(d[l])} <span class="cap" style="display:inline">(base ${pc(bb[l])})</span>`).join(' · ');
      const best=hs.reduce((a,h)=>{const q=PJ.proj[String(h)];return (!a||q.lift>a.lift)?q:a;},null);
      return `<b>Proyección a ${gx.h} meses.</b> De los ${PP.n} meses en que ${C0.name} tuvo el mismo puntaje TFX (${PP.now>0?'+':''}${PP.now}) y la misma dirección de 3 meses, así quedó ${gx.h} meses después: ${dd}. `
        +(PP.weak?'La ventaja sobre la tasa base es nula: a este horizonte la lectura de hoy no añade información.'
                 :`Ventaja sobre la tasa base: ${(PP.lift*100).toFixed(0)} pp.`)
        +` El horizonte con más ventaja para este indicador es ${best.h} meses (${(best.lift*100).toFixed(0)} pp). `
        +'Son frecuencias históricas sobre las mismas bandas del TFX Quant Analysis, no un modelo ajustado; a 3 meses buena parte de la ventaja es simple persistencia, y lo informativo es cuánta se conserva al estirar el horizonte.'
        +((gx.k==='spx'||gx.k==='spxy')?spxGdpRead(6):'');
    })():'<b>Sin proyección.</b> La serie no tiene suficientes casos históricos con esta lectura para estimar una distribución condicional.';
  const acc=css('--accent'),ink=css('--ink'),muted=css('--muted'),line=css('--line'),cool=css('--cool');
  let segs=[],tpts=null,cyRows='';
  if(gx.c==='oecd'){let s=null;labels.forEach((d,i)=>{const p=PHM[d];if(!p)return;if(s&&s.p===p)s.b=i+0.5;else{if(s)segs.push(s);s={p,a:i-0.5,b:i+0.5};}});if(s)segs.push(s);
    segs=segs.map(z=>({...z,col:css(PHC[z.p])+'22'}));}
  if(gx.c==='tp'){const tp=turning(vals);tpts=labels.map(()=>null);tp.forEach(p=>tpts[p.i]=vals[p.i]);
    for(let j=1;j<tp.length;j++)segs.push({a:tp[j-1].i,b:tp[j].i,col:(tp[j].type==='P'?css('--hot'):css('--cool'))+'1f'});
    if(tp.length)segs.push({a:tp.at(-1).i,b:labels.length-1,col:(tp.at(-1).type==='T'?css('--hot'):css('--cool'))+'1f'});
    const recent=tp.slice(-7);
    cyRows=`<div class="scroll"><table><thead><tr><th>Ciclos detectados</th><th class="num">Desde</th><th class="num">Hasta</th><th class="num">Meses</th><th class="num">Cambio</th></tr></thead><tbody>`+
      recent.slice(1).map((p,j)=>{const a=recent[j];return `<tr><td>${a.type==='T'?'Valle → pico · subida':'Pico → valle · caída'}</td><td class="num">${labels[a.i]}</td><td class="num">${labels[p.i]}</td><td class="num">${p.i-a.i}</td><td class="num ${vals[p.i]>vals[a.i]?'up':'dn'}">${(vals[p.i]-vals[a.i]>=0?'+':'−')+Math.abs(vals[p.i]-vals[a.i]).toFixed(2)}</td></tr>`;}).join('')+
      (tp.length?`<tr class="here"><td>${labels.length-1-tp.at(-1).i<6?(tp.at(-1).type==='T'?'Fase actual · cerca del mínimo, giro sin confirmar':'Fase actual · cerca del máximo, giro sin confirmar'):(tp.at(-1).type==='T'?'Fase actual · subiendo desde el valle':'Fase actual · cayendo desde el pico')}</td><td class="num">${labels[tp.at(-1).i]}</td><td class="num">${labels.at(-1)}</td><td class="num">${labels.length-1-tp.at(-1).i}</td><td class="num">${(lastV-vals[tp.at(-1).i]>0?'+':'−')+Math.abs(lastV-vals[tp.at(-1).i]).toFixed(2)}</td></tr>`:'')+'</tbody></table></div><p class="cap">Picos y valles sobre el promedio móvil de 3 meses: extremos locales en ventanas de ±9 meses, al menos 6 meses entre giros.</p>';}
  if(gx.c==='oecd')cyRows=`<div class="legend">${['EXP','DES','CON','REC'].map(p=>`<span><i class="dot" style="background:var(${PHC[p]})"></i>${PHN[p]}</span>`).join('')}</div>`;
  $('gxCycles').innerHTML=cyRows;
  const ds=[{label:C0.name,data:vals,borderColor:acc,backgroundColor:gx.v==='bar'?vals.map(x=>x>=0?acc+'cc':cool+'cc'):acc+'33',borderWidth:gx.v==='bar'?0:1.6,pointRadius:0,fill:gx.v==='area'?'origin':false,yAxisID:'y',type:gx.v==='bar'?'bar':'line'}];
  if(C0.ref!=null&&gx.t==='lvl')ds.push({label:'Umbral '+C0.ref,data:labels.map(()=>C0.ref),borderColor:muted,borderDash:[5,4],borderWidth:1,pointRadius:0,yAxisID:'y',type:'line'});
  if(tpts)ds.push({label:'Picos y valles',data:tpts,type:'line',showLine:false,pointRadius:5,pointBackgroundColor:ink,pointStyle:'triangle',yAxisID:'y'});
  if(cmp)ds.push({label:CHS[gx.cmp].name+(gx.t==='yoy'?' · cambio 12m':''),data:labels.map(d=>cm[d]??null),borderColor:ink,borderWidth:1.3,pointRadius:0,spanGaps:true,yAxisID:'y1',type:'line'});
  const n=labels.length,yrs=gx.r==='all'?null:+gx.r,min=yrs?Math.max(0,n-yrs*12):0;
  gxC?.destroy();
  gxC=window.Chart&&new Chart($('gxChart'),{type:'line',data:{labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
    plugins:{gxShade:{segs},legend:{labels:{color:muted,boxWidth:12,filter:i=>i.text!=='Picos y valles'}},tooltip:{filter:i=>i.raw!=null,callbacks:{label:i=>`${i.dataset.label}: ${typeof i.raw==='number'?i.raw.toFixed(2):i.raw}`}},
      zoom:{zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'},pan:{enabled:true,mode:'x'},limits:{x:{min:'original',max:'original',minRange:12}}}},
    scales:{x:{min,max:n-1,grid:{display:false},ticks:{color:muted,maxTicksLimit:10,callback:function(v){return this.getLabelForValue(v)}}},y:{position:'left',grid:{color:line},ticks:{color:acc}},...(cmp?{y1:{position:'right',grid:{display:false},ticks:{color:ink}}}:{})}}});
  $('gxReset').onclick=()=>{if(gxC){gxC.resetZoom&&gxC.resetZoom();gxC.options.scales.x.min=min;gxC.options.scales.x.max=n-1;gxC.update();}};
}



// ---------- Qué dijo históricamente el S&P 500 sobre el PIB ----------
function spxGdpRead(h){
  const G=S.spxgdp;if(!G)return '';
  const H=G.h[String(h)]||G.h['6'];if(!H)return '';
  const pc=x=>Math.round(x*100)+'%';
  const nm={'2':'muy fuerte','1':'fuerte','0':'medio','-1':'débil','-2':'muy débil'};
  const me=H.rows.find(r=>r.b===G.now);
  const grad=H.rows.map(r=>`${nm[String(r.b)]} ${pc(r.hot)}`).join(' · ');
  const lift=me?Math.round((me.hot-H.base.hot)*100):0;
  return `<br><br><b>Qué dice del PIB.</b> Sobre 1979-2026, el PIB creció por encima de tendencia ${h} meses después según en qué banda estaba el S&P: ${grad} (base ${pc(H.base.hot)}). `
    +(me?`Hoy el a/a está en ${G.yy.toFixed(1)}%, banda <b>${nm[String(G.now)]}</b>: ${pc(me.hot)} de los ${me.n} casos, ${lift>=0?'+':''}${lift} pp frente a la tasa base. `:'')
    +`Este gradiente es limpio a 6 meses y desaparece a 12: el índice adelanta al ciclo alrededor de dos trimestres, no un año.`;
}




// ---------- TV ----------
const TVDEF=[{n:'Bloomberg TV',k:'video',v:'QB5BNdBFujE'}];
let tv=Object.assign({i:0,list:null,cfg:false},store.get('tv',{}));
function tvParse(s){
  s=(s||'').trim();if(!s)return null;
  let m=s.match(/[?&]v=([A-Za-z0-9_-]{11})/)||s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)
       ||s.match(/\/(?:live|embed|shorts)\/([A-Za-z0-9_-]{11})/);
  if(m)return{k:'video',v:m[1]};
  m=s.match(/[?&]channel=(UC[A-Za-z0-9_-]{22})/)||s.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
  if(m)return{k:'channel',v:m[1]};
  if(/^UC[A-Za-z0-9_-]{22}$/.test(s))return{k:'channel',v:s};
  if(/^[A-Za-z0-9_-]{11}$/.test(s))return{k:'video',v:s};
  m=s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/)||s.match(/^@([A-Za-z0-9._-]+)$/);
  if(m)return{k:'handle',v:m[1]};
  return null;
}
const tvSrc=c=>c.k==='channel'
  ?`https://www.youtube.com/embed/live_stream?channel=${c.v}&rel=0&modestbranding=1`
  :`https://www.youtube.com/embed/${c.v}?rel=0&modestbranding=1`;
const tvLink=c=>c.k==='channel'?`https://www.youtube.com/channel/${c.v}/live`
  :c.k==='handle'?`https://www.youtube.com/@${c.v}/live`:`https://www.youtube.com/watch?v=${c.v}`;
function renderTV(){
  const sv=()=>store.set('tv',{i:tv.i,list:tv.list,cfg:tv.cfg});
  if(!Array.isArray(tv.list)||!tv.list.length)tv.list=TVDEF.map(x=>Object.assign({},x));
  if(tv.i>=tv.list.length)tv.i=0;
  const C=tv.list[tv.i];
  $('tvStamp').textContent=`${tv.list.length} canal${tv.list.length===1?'':'es'} · se reproduce en vivo desde YouTube`;
  chipset($('tvTabs'),tv.list.map((c,i)=>({id:String(i),label:c.n})),String(tv.i),id=>{tv.i=+id;sv();renderTV();},'chip sm');

  const F=$('tvFrame');F.innerHTML='';
  if(C.k==='handle'){
    F.innerHTML=`<div class="tvempty"><b>${C.n}</b><span>YouTube no permite incrustar un canal por su arroba. Abre el canal, entra al video en vivo y pega aquí ese enlace, o pega el identificador del canal que empieza con UC.</span></div>`;
  }else{
    const f=document.createElement('iframe');
    f.src=tvSrc(C);f.title=C.n;f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';f.loading='lazy';
    F.appendChild(f);
  }
  $('tvOpen').href=tvLink(C);
  $('tvCap').innerHTML=C.k==='channel'
    ? `<b>${C.n}</b> · se intenta cargar la transmisión en vivo del canal <span class="pop">${C.v}</span>. Si el recuadro aparece en negro o dice que el video no está disponible, ese canal no tiene un directo público ahora mismo o su dueño bloqueó la incrustación. Cambia la fuente en Editar fuentes.`
    : `<b>${C.n}</b> · video <span class="pop">${C.v}</span>. Si la transmisión termina, el enlace deja de servir: pega el nuevo en Editar fuentes.`;

  $('tvCfgBtn').onclick=()=>{tv.cfg=!tv.cfg;sv();renderTV();};
  $('tvCfgBtn').textContent=tv.cfg?'Ocultar fuentes':'Editar fuentes';
  $('tvCfg').hidden=!tv.cfg;
  if(!tv.cfg)return;

  const KN={channel:'Canal en vivo',video:'Video',handle:'Arroba sin resolver'};
  $('tvList').innerHTML=`<thead><tr><th>Canal</th><th>Tipo</th><th>Identificador</th><th></th><th></th></tr></thead><tbody>`
    +tv.list.map((c,i)=>`<tr${i===tv.i?' class="on"':''}><td>${c.n}</td><td>${KN[c.k]||c.k}</td>
      <td class="pop">${c.v}</td><td><button type="button" class="tvuse" data-u="${i}">Ver</button></td>
      <td><button type="button" class="tvx" data-d="${i}">Quitar</button></td></tr>`).join('')+'</tbody>';
  $('tvList').querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{tv.i=+b.dataset.u;sv();renderTV();});
  $('tvList').querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.d;tv.list.splice(i,1);if(tv.i>=tv.list.length)tv.i=Math.max(0,tv.list.length-1);sv();renderTV();});
  $('tvAdd').onclick=()=>{
    const n=$('tvNm').value.trim(),p=tvParse($('tvUrl').value);
    if(!p){$('tvUrl').focus();$('tvCap').innerHTML='<b>No reconocí ese enlace.</b> Sirve el enlace de un video de YouTube, el de un canal con /channel/UC…, o el identificador suelto.';return;}
    tv.list.push({n:n||('Canal '+(tv.list.length+1)),k:p.k,v:p.v});tv.i=tv.list.length-1;
    $('tvNm').value='';$('tvUrl').value='';sv();renderTV();};
  $('tvReset').onclick=()=>{tv.list=TVDEF.map(x=>Object.assign({},x));tv.i=0;sv();renderTV();};

  $('tvHelp').innerHTML=
    `<p><b>Qué pegar.</b> Lo más estable es el enlace del video en vivo: entra al canal en YouTube, abre el directo y copia la barra de direcciones. También acepta el enlace del canal con <span class="pop">/channel/UC…</span>, que carga lo que ese canal tenga en vivo en ese momento, y el identificador suelto de cualquiera de los dos. La arroba del canal no sirve: YouTube no la admite para incrustar.</p>`
    +`<p><b>Por qué es editable.</b> Los directos gratuitos de los canales financieros cambian de identificador y se caen sin aviso. En concreto, Bloomberg movió sus señales de televisión a YouTube TV de suscripción en octubre de 2025, así que el directo libre puede no existir. Dejar la fuente abierta significa que lo arreglas pegando un enlace, sin esperar una versión nueva del dashboard.</p>`
    +`<p><b>Dónde se guarda.</b> En el navegador que estés usando, no en el archivo. Tu lista no viaja a otro equipo y nadie más la ve; si borras los datos del sitio, vuelve a la lista inicial. El recuadro necesita conexión: es lo único del dashboard que no funciona sin internet.</p>`;
}
// ---------- Posicionamiento (COT) ----------
let po=Object.assign({p:'EURUSD',w:'5',nb:52,tf:'D',ix:52},store.get('po',{})),poC={};
const POIX=[[26,'26 sem'],[52,'52 sem'],[156,'3 años']];
const POW=[['1','1 año'],['3','3 años'],['5','5 años'],['10','10 años'],['all','Todo']];
const PONB=[[26,'26 sem'],[52,'1 año'],[104,'2 años'],[260,'5 años']];
const POTF=[['D','Diario'],['W','Semanal'],['M','Mensual']];
const PO50={id:'po50',afterDatasetsDraw(c){const y=c.scales.y,a=c.chartArea;if(!y||!a)return;
  const py=y.getPixelForValue(50),x=c.ctx;x.save();x.beginPath();x.setLineDash([5,4]);x.lineWidth=1.2;
  x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()||'#888';
  x.globalAlpha=.75;x.moveTo(a.left,py);x.lineTo(a.right,py);x.stroke();x.restore();}};
const poK=n=>Math.abs(n)>=1000?(n/1000).toFixed(1)+'K':String(n);
const poSg=n=>(n>0?'+':n<0?'−':'')+poK(Math.abs(n));
function poPairs(){
  const C=S.pos&&S.pos.ccy;if(!C)return[];
  return (typeof MKSEED!=='undefined'?MKSEED.pairs():[]).filter(p=>/^[A-Z]{6}$/.test(p)&&C[p.slice(0,3)]&&C[p.slice(3)]).sort();
}
function poFmtD(n){const s=String(n);return s.slice(6,8)+'/'+s.slice(4,6)+'/'+s.slice(2,4);}
function poFmtW(n){const s=String(n);return s.slice(6,8)+'/'+s.slice(4,6);}
const poMs=n=>Date.UTC(Math.floor(n/10000),Math.floor(n/100)%100-1,n%100);
// Pair view, positive = speculators favour the base. CME currency futures are already quoted against the dollar,
// so XXXUSD uses the base contract alone (subtracting the USD INDEX would count the dollar twice);
// crosses use base minus quote, both legs being "versus USD".
function poAlign(B,Q){
  const A={d:[],rel:[],am:[],mode:Q.ccy==='USD'?'base':B.ccy==='USD'?'quote':'cross'};
  const one=(X,s)=>X.d.forEach((d,j)=>{A.d.push(d);A.rel.push(+(s*X.npoi[j]).toFixed(2));A.am.push(X.anpoi?+(s*X.anpoi[j]).toFixed(2):null);});
  if(A.mode==='base'){one(B,1);return A;}
  if(A.mode==='quote'){one(Q,-1);return A;}
  const qi=new Map(Q.d.map((d,j)=>[d,j]));
  B.d.forEach((d,j)=>{const k=qi.get(d);if(k===undefined)return;A.d.push(d);
    A.rel.push(+(B.npoi[j]-Q.npoi[k]).toFixed(2));
    A.am.push(B.anpoi&&Q.anpoi?+(B.anpoi[j]-Q.anpoi[k]).toFixed(2):null);});
  return A;
}
const poRelLab=(A,b,q)=>A.mode==='base'?`Neto/OI ${b}`:A.mode==='quote'?`Neto/OI ${q} invertido`:`Diferencial ${b}−${q}`;
// COT index: 0–100 position of each value inside its trailing window (Williams).
function poIndex(v,w){
  return v.map((x,j)=>{if(j<w-1)return null;let mn=Infinity,mx=-Infinity;
    for(let k=j-w+1;k<=j;k++){if(v[k]<mn)mn=v[k];if(v[k]>mx)mx=v[k];}
    return mx>mn?+(100*(x-mn)/(mx-mn)).toFixed(1):50;});
}
// Daily closes of the pair, oldest first, with a "first close on or after" lookup.
function poPx(pair){
  const raw=typeof MKSEED!=='undefined'&&MKSEED.get(pair,'D');if(!raw||!raw.length)return null;
  const px=raw.slice().reverse(),t=px.map(r=>poMs(r[0]));
  const at=ms=>{let lo=0,hi=t.length;while(lo<hi){const m=(lo+hi)>>1;if(t[m]<ms)lo=m+1;else hi=m;}return lo<t.length?lo:-1;};
  return {px,t,at};
}
// Pair returns after each report, measured from the Friday release close so nothing is used before it was public.
function poForward(A,idx,P){
  const H=[4,8,13],G={hi:{},lo:{},all:{}};
  for(const g in G)H.forEach(h=>G[g][h]=[]);
  if(!P)return null;
  A.d.forEach((d,j)=>{if(idx[j]==null)return;const e=P.at(poMs(d)+3*864e5);if(e<0||P.t[e]-poMs(d)>7*864e5)return;
    const grp=idx[j]>=80?'hi':idx[j]<=20?'lo':null;
    H.forEach(h=>{const x=P.at(P.t[e]+h*7*864e5);if(x<0||P.t[x]-P.t[e]>(h*7+5)*864e5)return;
      const r=(P.px[x][4]/P.px[e][4]-1)*100;G.all[h].push(r);if(grp)G[grp][h].push(r);});});
  return {H,G};
}
const POBANDS={id:'pobands',beforeDatasetsDraw(c){const y=c.scales.y,a=c.chartArea;if(!y||!a)return;
  const x=c.ctx,hi=y.getPixelForValue(80),lo=y.getPixelForValue(20),top=y.getPixelForValue(100),bot=y.getPixelForValue(0);
  x.save();x.globalAlpha=.10;x.fillStyle=css('--gain');x.fillRect(a.left,top,a.right-a.left,hi-top);
  x.fillStyle=css('--loss');x.fillRect(a.left,lo,a.right-a.left,bot-lo);x.restore();}};
const POQUAD={id:'poquad',beforeDatasetsDraw(c){const xs=c.scales.x,ys=c.scales.y,a=c.chartArea;if(!xs||!ys)return;
  const x=c.ctx;x.save();x.strokeStyle=css('--line');x.setLineDash([4,4]);x.lineWidth=1;x.beginPath();
  [20,80].forEach(v=>{const p=xs.getPixelForValue(v);x.moveTo(p,a.top);x.lineTo(p,a.bottom);});
  const z=ys.getPixelForValue(0);x.moveTo(a.left,z);x.lineTo(a.right,z);x.stroke();x.restore();},
  afterDatasetsDraw(c){const x=c.ctx,m=c.getDatasetMeta(0);x.save();x.font='600 11px '+(css('--f-mono')||'monospace');x.fillStyle=css('--ink');
    m.data.forEach((pt,i)=>{const d=c.data.datasets[0].data[i];x.fillText(d.c,pt.x+7,pt.y-6);});x.restore();}};
function renderPos(){
  const Z=S.pos;if(!Z)return;
  const C=Z.ccy,sv=()=>store.set('po',po),PL=poPairs();
  if(!PL.length)return;
  if(PL.indexOf(po.p)<0)po.p=PL.indexOf('EURUSD')>=0?'EURUSD':PL[0];
  if(!POIX.some(x=>x[0]===po.ix))po.ix=52;
  const b=po.p.slice(0,3),q=po.p.slice(3),B=C[b],Q=C[q];
  // Report = Tuesday positions, released Friday; after a missed release (+holiday margin) the data is flagged.
  const Zm=Z.meta||{},age=Math.floor((Date.now()-Date.parse(Z.asof+'T00:00:00Z'))/864e5);
  $('poStamp').innerHTML=`Leveraged Funds · informe del ${Z.asof}`+(Zm.next_publish_est?` · próximo ≈ ${Zm.next_publish_est}`:'')
    +(age>13?' · <b style="color:var(--loss)">desactualizado</b>':'');
  $('poPair').innerHTML=PL.map(p=>`<option value="${p}"${p===po.p?' selected':''}>${p}</option>`).join('');
  $('poPair').onchange=e=>{po.p=e.target.value;sv();renderPos();};
  chipset($('poQuick'),['EURUSD','GBPUSD','AUDUSD','EURJPY','EURGBP'].filter(x=>PL.indexOf(x)>=0).map(x=>({id:x,label:x})),po.p,id=>{po.p=id;sv();renderPos();},'chip sm');
  chipset($('poWin'),POW.map(([k,l])=>({id:k,label:l})),po.w,id=>{po.w=id;sv();renderPos();},'chip sm');
  chipset($('poNb'),PONB.map(([k,l])=>({id:String(k),label:l})),String(po.nb),id=>{po.nb=+id;sv();renderPos();},'chip sm');
  chipset($('poPxTf'),POTF.filter(([k])=>typeof MKSEED!=='undefined'&&MKSEED.has(po.p,k)).map(([k,l])=>({id:k,label:l})),po.tf,id=>{po.tf=id;sv();renderPos();},'chip sm');

  const g=css('--gain'),l=css('--loss'),mu=css('--muted'),ac=css('--accent'),ln=css('--line'),ink=css('--ink'),fl=css('--flat');
  Object.values(poC).forEach(c=>c&&c.destroy());poC={};

  // ---- donas ----
  const donut=(cv,ti,le,X)=>{
    const n=X.now;$(ti).textContent=`${X.ccy} · ${X.name}`;
    $(le).innerHTML=`<div><span class="pl-k">Posiciones cortas</span><span class="pl-v sh">${poK(n.S)}</span><span class="pl-p">${(100-n.shL).toFixed(1)}%</span></div>`
      +`<div><span class="pl-k">Posiciones largas</span><span class="pl-v lo">${poK(n.L)}</span><span class="pl-p">${n.shL.toFixed(1)}%</span></div>`;
    if(!window.Chart)return;
    poC[cv]=new Chart($(cv),{type:'doughnut',data:{labels:['Corto','Largo'],datasets:[{data:[n.S,n.L],backgroundColor:[l,g],borderWidth:0,hoverOffset:6}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,cutout:'62%',
        plugins:{legend:{position:'top',labels:{color:mu,boxWidth:12,padding:14}},
          tooltip:{callbacks:{label:i=>`${i.label}: ${i.raw.toLocaleString('es-MX')} contratos (${(i.raw/(n.L+n.S)*100).toFixed(1)}%)`}}}}});
  };
  donut('poD1','poT1','poL1',B);donut('poD2','poT2','poL2',Q);

  // ---- kpis ----
  const s5b=B.st[po.w]||B.st['5'],s5q=Q.st[po.w]||Q.st['5'],wl=(POW.find(w=>w[0]===po.w)||['','5 años'])[1].toLowerCase();
  const exc=p=>p>=90||p<=10?'lo':p>=75||p<=25?'md':'';
  $('poKpis').innerHTML=
    factc(`${b} · neto sobre interés abierto`,(B.now.npoi>0?'+':'')+B.now.npoi.toFixed(2)+'%',
      `Percentil ${Math.round(s5b.pct)} en ${wl} · z ${s5b.z>0?'+':''}${s5b.z}`,B.now.npoi>0?'gain':'loss')
    +factc(`${q} · neto sobre interés abierto`,(Q.now.npoi>0?'+':'')+Q.now.npoi.toFixed(2)+'%',
      `Percentil ${Math.round(s5q.pct)} en ${wl} · z ${s5q.z>0?'+':''}${s5q.z}`,Q.now.npoi>0?'gain':'loss')
    +factc(`${b} · cambio en la semana`,poSg(B.now.dnet),
      `Largos ${poSg(B.now.dL)} · cortos ${poSg(B.now.dS)} contratos`,B.now.dnet>0?'gain':B.now.dnet<0?'loss':'')
    +(()=>{const d=B.now.shL-B.now.nshL;
      return factc(`${b} · institucional menos minorista`,(d>0?'+':'')+d.toFixed(1)+' pts',
        `Leveraged ${B.now.shL.toFixed(1)}% largo frente a ${B.now.nshL.toFixed(1)}% de las cuentas pequeñas`,Math.abs(d)>=20?'loss':'');})();

  // ---- lectura swing del par ----
  chipset($('poIxW'),POIX.map(([k,l])=>({id:String(k),label:l})),String(po.ix),id=>{po.ix=+id;sv();renderPos();},'chip sm');
  const A=poAlign(B,Q),nA=A.d.length,ix=poIndex(A.rel,po.ix),ixw=POIX.find(x=>x[0]===po.ix)[1],P=poPx(po.p);
  const relNow=A.rel[nA-1],ixNow=ix[nA-1],fl4=+(relNow-A.rel[nA-5]).toFixed(2),fl1=+(relNow-A.rel[nA-2]).toFixed(2);
  const zone=ixNow>=80?'hi':ixNow<=20?'lo':'mid';
  const read=zone==='hi'?(fl4<0?['lo','Largo saturado y saliendo','Los especuladores reducen compras desde un extremo: es la fase en la que los cierres pueden acelerar una caída del par.']
                                :['md','Largo saturado, aún comprando','La tendencia sigue alimentada, pero queda poco comprador nuevo: el giro, si llega, suele ser brusco. Tamaño menor.'])
    :zone==='lo'?(fl4>0?['hi','Corto saturado y cubriendo','Los especuladores recompran desde un extremo vendedor: es la fase en la que la cobertura de cortos puede impulsar al par.']
                        :['md','Corto saturado, aún vendiendo','La presión vendedora sigue, pero queda poco vendedor nuevo: atención a rebotes violentos. Tamaño menor.'])
    :['md','Sin extremo','El posicionamiento no limita al par en ninguna dirección: manda el flujo y el resto del análisis macro.'];
  $('poSwT').textContent=`Lectura swing · ${po.p}`;
  $('poSwK').innerHTML=
    factc('Posicionamiento del par',(relNow>0?'+':'')+relNow.toFixed(2)+' pp',
      A.mode==='cross'?`Neto/OI de ${b} (${B.now.npoi>0?'+':''}${B.now.npoi.toFixed(2)}%) menos el de ${q} (${Q.now.npoi>0?'+':''}${Q.now.npoi.toFixed(2)}%); ambos contratos cotizan contra el dólar`
        :`El contrato de ${A.mode==='base'?b:q} en CME ya cotiza contra el dólar, así que su neto/OI es el posicionamiento del par`,relNow>0?'gain':'loss')
    +factc(`Índice COT · ${ixw}`,ixNow==null?'—':String(Math.round(ixNow)),
      zone==='hi'?'Saturación compradora (≥ 80)':zone==='lo'?'Saturación vendedora (≤ 20)':'Dentro del rango (20–80)',zone==='hi'?'gain':zone==='lo'?'loss':'')
    +factc('Flujo de 4 semanas',(fl4>0?'+':'')+fl4.toFixed(2)+' pp',
      `Última semana ${fl1>0?'+':''}${fl1.toFixed(2)} pp · ${fl4>0?'entran compras del par':fl4<0?'entran ventas del par':'sin cambio'}`,fl4>0?'gain':fl4<0?'loss':'')
    +factc('Lectura',`<span class="poex ${read[0]}">${read[1]}</span>`,read[2],'');

  const yrsW=po.w==='all'?0:+po.w,kW=yrsW?Math.min(yrsW*52,nA):nA,w0=nA-kW,lbW=A.d.slice(w0).map(poFmtW);
  if(window.Chart){
    // diferencial vs precio (cierre del martes del informe)
    const pxW=A.d.slice(w0).map(d=>{if(!P)return null;const e=P.at(poMs(d));return e<0||P.t[e]-poMs(d)>4*864e5?null:P.px[e][4];});
    const rv=A.rel.slice(w0);
    $('poRelT').textContent=`${po.p} · ${po.w==='all'?'toda la muestra':wl}`;
    poC.poRel=new Chart($('poRel'),{type:'bar',data:{labels:lbW,datasets:[
      {type:'bar',label:poRelLab(A,b,q),data:rv,backgroundColor:rv.map(x=>x>=0?g:l),borderWidth:0,barPercentage:1,categoryPercentage:.92,yAxisID:'y',order:2},
      {type:'line',label:po.p,data:pxW,borderColor:ink,borderWidth:1.6,pointRadius:0,spanGaps:true,yAxisID:'y2',order:1}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{labels:{color:mu,boxWidth:12}},tooltip:{callbacks:{label:i=>i.dataset.type==='bar'?`${i.dataset.label} ${i.raw>0?'+':''}${i.raw} pp`:`${po.p} ${i.raw}`}}},
        scales:{x:{grid:{display:false},ticks:{color:mu,maxTicksLimit:9,autoSkip:true}},
          y:{grid:{color:ln},ticks:{color:mu,callback:v=>v+' pp'}},y2:{position:'right',grid:{display:false},ticks:{color:mu}}}}});
    const lastPx=P?P.px[P.px.length-1][0]:null;
    $('poRelCap').textContent=(A.mode==='cross'?`Barras: neto/OI de Leveraged Funds en ${b} menos el de ${q}.`:`Barras: neto/OI de Leveraged Funds en el contrato de ${A.mode==='base'?b:q}${A.mode==='quote'?', con el signo invertido para leerlo en el sentido del par':''}.`)
      +` Positivo significa que el dinero especulativo favorece a ${b} frente a ${q}. Lo útil es la divergencia: un posicionamiento que se estira mientras el precio deja de avanzar suele anticipar agotamiento.`
      +(lastPx?` El precio llega hasta ${poFmtD(lastPx)}, la última serie cargada en la mesa.`:' No hay serie de precios cargada para este par.');

    // índice COT
    const ixv=ix.slice(w0);
    $('poIxT').textContent=`${po.p} · ventana ${ixw} · hoy ${ixNow==null?'—':Math.round(ixNow)}`;
    poC.poIx=new Chart($('poIx'),{type:'line',data:{labels:lbW,datasets:[{label:'Índice COT',data:ixv,borderColor:ac,borderWidth:1.8,pointRadius:0,fill:false,spanGaps:false}]},
      plugins:[POBANDS],
      options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`Índice COT ${i.raw}`}}},
        scales:{x:{grid:{display:false},ticks:{color:mu,maxTicksLimit:9,autoSkip:true}},y:{min:0,max:100,grid:{color:ln},ticks:{color:mu,stepSize:20}}}}});

    // flujo semanal (últimas 26 semanas)
    const k0=Math.max(5,nA-26),fd=[],fs=[];
    for(let j=k0;j<nA;j++){fd.push(+(A.rel[j]-A.rel[j-1]).toFixed(2));fs.push(+(A.rel[j]-A.rel[j-4]).toFixed(2));}
    $('poFlT').textContent=`${po.p} · últimos ${nA-k0} informes`;
    poC.poFl=new Chart($('poFl'),{type:'bar',data:{labels:A.d.slice(k0).map(poFmtW),datasets:[
      {type:'bar',label:'Cambio semanal',data:fd,backgroundColor:fd.map(x=>x>=0?g:l),borderWidth:0,order:2},
      {type:'line',label:'Acumulado 4 semanas',data:fs,borderColor:ink,borderWidth:1.6,pointRadius:2,order:1}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{labels:{color:mu,boxWidth:12}},tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw>0?'+':''}${i.raw} pp`}}},
        scales:{x:{grid:{display:false},ticks:{color:mu,maxTicksLimit:9,autoSkip:true}},y:{grid:{color:ln},ticks:{color:mu,callback:v=>v+' pp'}}}}});

    // dinero rápido vs dinero real
    if(A.am[nA-1]!=null){
      $('poAmT').textContent=`${po.p} · ${poRelLab(A,b,q).toLowerCase()} · ${po.w==='all'?'toda la muestra':wl}`;
      poC.poAm=new Chart($('poAm'),{type:'line',data:{labels:lbW,datasets:[
        {label:'Leveraged Funds',data:A.rel.slice(w0),borderColor:ac,borderWidth:1.8,pointRadius:0,fill:false},
        {label:'Asset Managers',data:A.am.slice(w0),borderColor:mu,borderWidth:1.6,borderDash:[5,3],pointRadius:0,fill:false}]},
        options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
          plugins:{legend:{labels:{color:mu,boxWidth:12}},tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw>0?'+':''}${i.raw} pp`}}},
          scales:{x:{grid:{display:false},ticks:{color:mu,maxTicksLimit:9,autoSkip:true}},y:{grid:{color:ln},ticks:{color:mu,callback:v=>v+' pp'}}}}});
    }else $('poAmT').textContent='Sin datos de Asset Managers en este archivo.';

    // mapa de saturación
    const pts=Object.values(C).map(X=>{const iv=poIndex(X.npoi,156);return {x:iv[iv.length-1],y:X.now.d4,c:X.ccy};});
    poC.poCr=new Chart($('poCr'),{type:'scatter',data:{datasets:[{data:pts,pointRadius:6,pointHoverRadius:8,
      backgroundColor:pts.map(p=>p.x>=80?g:p.x<=20?l:mu),borderWidth:0}]},plugins:[POQUAD],
      options:{responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{right:24}},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`${i.raw.c}: índice ${Math.round(i.raw.x)} · 4 sem ${i.raw.y>0?'+':''}${i.raw.y} pp`}}},
        scales:{x:{min:0,max:100,grid:{color:ln},ticks:{color:mu,stepSize:20},title:{display:true,text:'Índice COT 3 años',color:mu}},
          y:{grid:{color:ln},ticks:{color:mu,callback:v=>v+' pp'},title:{display:true,text:'Cambio 4 semanas (neto/OI)',color:mu}}}}});
  }

  // qué hizo el par después de los extremos
  const FW=poForward(A,ix,P);
  $('poFwT').textContent=`${po.p} · índice COT ${ixw} · cierre del viernes de publicación`;
  if(FW&&FW.G.all[4].length){
    const st=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=a.reduce((x,y)=>x+y,0)/a.length;return {n:a.length,m,up:a.filter(x=>x>0).length/a.length};};
    const cell=a=>{const s=st(a);return s?`<td class="num pop ${s.m>0?'gain':'loss'}">${s.m>0?'+':''}${s.m.toFixed(2)}%</td><td class="num pop">${Math.round(s.up*100)}%</td><td class="num pop">${s.n}</td>`:'<td class="num">—</td><td class="num">—</td><td class="num">0</td>';};
    const lab={hi:'Índice ≥ 80 (saturación compradora)',lo:'Índice ≤ 20 (saturación vendedora)',all:'Todas las semanas (referencia)'};
    $('poFw').innerHTML=`<thead><tr><th rowspan="2">Situación</th>${FW.H.map(h=>`<th colspan="3" class="num">${h} semanas</th>`).join('')}</tr>`
      +`<tr>${FW.H.map(()=>'<th class="num">Media</th><th class="num">% al alza</th><th class="num">n</th>').join('')}</tr></thead><tbody>`
      +['hi','lo','all'].map(gk=>`<tr${gk===zone?' class="sel"':''}><td><b>${lab[gk]}</b></td>${FW.H.map(h=>cell(FW.G[gk][h])).join('')}</tr>`).join('')+'</tbody>';
    $('poFwCap').textContent=`Retorno de ${po.p} desde el cierre del viernes en que se publicó cada informe hasta 4, 8 y 13 semanas después, según dónde estaba el índice COT ese día. La fila resaltada es la situación actual. Compara siempre contra la fila de referencia: una media parecida a la de todas las semanas significa que el extremo no aportó ventaja en este par. Las semanas consecutivas se solapan, así que n exagera el número de episodios independientes; es estadística descriptiva, no una señal.`;
  }else{$('poFw').innerHTML='';$('poFwCap').textContent=`No hay serie diaria de precios para ${po.p} en la mesa, así que no se puede medir el comportamiento posterior.`;}

  // ---- barras apiladas 100% ----
  const stk=(cv,ti,X)=>{
    $(ti).textContent=`${X.ccy} · últimos ${po.nb} informes`;
    if(!window.Chart)return;
    const k=Math.min(po.nb,X.d.length),i0=X.d.length-k;
    const lb=X.d.slice(i0).map(poFmtW),sl=X.shL.slice(i0),ss=sl.map(v=>100-v);
    poC[cv]=new Chart($(cv),{type:'bar',data:{labels:lb,datasets:[
      {label:'Largo',data:sl,backgroundColor:g,borderWidth:0,stack:'a',barPercentage:1,categoryPercentage:1},
      {label:'Corto',data:ss,backgroundColor:l,borderWidth:0,stack:'a',barPercentage:1,categoryPercentage:1}]},
      plugins:[PO50],
      options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{labels:{color:mu,boxWidth:12}},tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw.toFixed(1)}%`}}},
        scales:{x:{stacked:true,grid:{display:false},ticks:{color:mu,maxTicksLimit:10,autoSkip:true}},
          y:{stacked:true,min:0,max:100,grid:{color:ln},ticks:{color:mu,callback:v=>v+'%'}}}}});
  };
  stk('poS1','poS1T',B);stk('poS2','poS2T',Q);

  // ---- neto sobre interés abierto ----
  const net=(cv,ti,X)=>{
    const yrs=po.w==='all'?0:+po.w,k=yrs?Math.min(yrs*52,X.d.length):X.d.length,i0=X.d.length-k;
    const st=X.st[po.w]||X.st['5'];
    $(ti).textContent=`${X.ccy} · ${po.w==='all'?'toda la muestra':wl} · mín ${st.mn}% máx ${st.mx}%`;
    if(!window.Chart)return;
    const lb=X.d.slice(i0).map(poFmtW),v=X.npoi.slice(i0);
    poC[cv]=new Chart($(cv),{type:'bar',data:{labels:lb,datasets:[{label:'Neto / OI',data:v,
      backgroundColor:v.map(x=>x>=0?g:l),borderWidth:0,barPercentage:1,categoryPercentage:.92}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`${i.raw>0?'+':''}${i.raw}% del interés abierto`}}},
        scales:{x:{grid:{display:false},ticks:{color:mu,maxTicksLimit:9,autoSkip:true}},
          y:{grid:{color:ln},ticks:{color:mu,callback:x=>x+'%'}}}}});
  };
  net('poN1','poN1T',B);net('poN2','poN2T',Q);

  // ---- precio ----
  const raw=(typeof MKSEED!=='undefined'&&MKSEED.get(po.p,po.tf))||null;
  const rows=raw?raw.slice().reverse():null;   // el seed se guarda del más reciente al más antiguo
  $('poPxT').textContent=`${po.p} · precio`;
  if(rows&&window.Chart){
    const yrs=po.w==='all'?0:+po.w;
    const lim=yrs?{D:yrs*260,W:yrs*52,M:yrs*12}[po.tf]:rows.length;
    const r=rows.slice(Math.max(0,rows.length-lim));
    poC.poPx=new Chart($('poPx'),{type:'line',data:{labels:r.map(x=>poFmtD(x[0])),
      datasets:[{label:po.p,data:r.map(x=>x[4]),borderColor:ac,borderWidth:1.8,pointRadius:0,fill:false,tension:.02}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`${po.p} ${i.raw}`}}},
        scales:{x:{grid:{display:false},ticks:{color:mu,maxTicksLimit:10,autoSkip:true}},
          y:{position:'right',grid:{color:ln},ticks:{color:mu}}}}});
    const a=r[0][4],z=r[r.length-1][4];
    $('poPxCap').textContent=`Cierre de ${po.p} en el mismo horizonte que los gráficos de posicionamiento: ${poFmtD(r[0][0])} a ${poFmtD(r[r.length-1][0])}, de ${a} a ${z} (${((z/a-1)*100).toFixed(1)}%). Comparar la forma del neto con la del precio es la lectura útil: un neto que se estira mientras el precio ya no avanza es la señal de agotamiento, no el nivel del neto por sí solo.`;
  }else{$('poPxCap').textContent=`No hay serie de precios cargada para ${po.p} en el seed de la mesa.`;}

  // ---- institucional vs cuentas pequeñas ----
  const kk=Math.min(po.w==='all'?B.d.length:+po.w*52,B.d.length),j0=B.d.length-kk;
  if(window.Chart){
    poC.poDiv=new Chart($('poDiv'),{type:'line',data:{labels:B.d.slice(j0).map(poFmtW),datasets:[
      {label:`Leveraged Funds · % largo de ${b}`,data:B.shL.slice(j0),borderColor:ac,borderWidth:2,pointRadius:0,fill:false},
      {label:`Cuentas pequeñas · % largo de ${b}`,data:B.nshL.slice(j0),borderColor:mu,borderWidth:1.6,borderDash:[5,3],pointRadius:0,fill:false}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{labels:{color:mu,boxWidth:12}},tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw.toFixed(1)}%`}}},
        scales:{x:{grid:{display:false},ticks:{color:mu,maxTicksLimit:10,autoSkip:true}},
          y:{grid:{color:ln},ticks:{color:mu,callback:v=>v+'%'},title:{display:true,text:'% del total largo',color:mu}}}}});
  }
  const dv=B.now.shL-B.now.nshL;
  $('poDivCap').textContent=`Las cuentas no reportables son las que quedan por debajo del umbral de reporte del CFTC: no son el sentimiento minorista de un bróker, pero son el único proxy público de ese lado del mercado y vienen en el mismo informe. Hoy, en ${b}, los Leveraged Funds están ${B.now.shL.toFixed(1)}% largos y las cuentas pequeñas ${B.now.nshL.toFixed(1)}%: una diferencia de ${Math.abs(dv).toFixed(1)} puntos ${dv>0?'a favor del institucional':'en contra del institucional'}.`;
  $('poDivT').innerHTML=`<thead><tr><th>Categoría</th><th class="num">Largos</th><th class="num">Cortos</th><th class="num">% largo</th><th class="num">Neto</th><th class="num">Neto / OI</th><th class="num">Cambio semanal</th></tr></thead><tbody>`
    +`<tr><td><b>Leveraged Funds</b></td><td class="num pop">${B.now.L.toLocaleString('es-MX')}</td><td class="num pop">${B.now.S.toLocaleString('es-MX')}</td>
       <td class="num pop">${B.now.shL.toFixed(1)}%</td><td class="num pop ${B.now.net>0?'gain':'loss'}">${B.now.net.toLocaleString('es-MX')}</td>
       <td class="num pop ${B.now.npoi>0?'gain':'loss'}">${B.now.npoi.toFixed(2)}%</td><td class="num pop">${poSg(B.now.dnet)}</td></tr>`
    +`<tr><td><b>Cuentas no reportables</b></td><td class="num pop">${B.now.nL.toLocaleString('es-MX')}</td><td class="num pop">${B.now.nS.toLocaleString('es-MX')}</td>
       <td class="num pop">${B.now.nshL.toFixed(1)}%</td><td class="num pop ${B.now.nnet>0?'gain':'loss'}">${B.now.nnet.toLocaleString('es-MX')}</td>
       <td class="num pop ${B.now.nnpoi>0?'gain':'loss'}">${B.now.nnpoi.toFixed(2)}%</td><td class="num pop">${poSg(B.now.dnnet)}</td></tr></tbody>`;

  // ---- mapa de divisas ----
  const all=Object.values(C).sort((a,b2)=>b2.st['5'].pct-a.st['5'].pct);
  const amx=Math.max(...all.map(x=>Math.abs(x.now.npoi)))||1;
  $('poMap').innerHTML=`<thead><tr><th>Divisa</th><th>Contrato</th><th class="num">Largos</th><th class="num">Cortos</th><th class="num">% largo</th><th class="num">Neto / OI</th><th>Magnitud</th><th class="num">Percentil 5a</th><th class="num">z 5a</th><th class="num">Δ semana</th><th>Lectura</th></tr></thead><tbody>`
    +all.map(x=>{const p5=x.st['5'],e=exc(p5.pct),w=(Math.abs(x.now.npoi)/amx*64).toFixed(0);
      const lec=x.now.net>=0
        ?(p5.pct>=90?['lo','Largo extremo']:p5.pct>=75?['md','Largo cargado']:['','Largo en rango'])
        :(p5.pct<=10?['lo','Corto extremo']:p5.pct<=25?['md','Corto cargado']:['','Corto en rango']);
      return `<tr data-c="${x.ccy}"${x.ccy===b?' class="sel"':''}><td><b>${x.ccy}</b></td><td>${x.name}</td>
        <td class="num pop">${x.now.L.toLocaleString('es-MX')}</td><td class="num pop">${x.now.S.toLocaleString('es-MX')}</td>
        <td class="num pop">${x.now.shL.toFixed(1)}%</td><td class="num pop ${x.now.npoi>0?'gain':'loss'}"><b>${x.now.npoi>0?'+':''}${x.now.npoi.toFixed(2)}%</b></td>
        <td><span class="pobar" style="width:${w}px;background:${x.now.npoi>0?g:l}"></span></td>
        <td class="num pop">${Math.round(p5.pct)}</td><td class="num pop">${p5.z>0?'+':''}${p5.z}</td><td class="num pop">${poSg(x.now.dnet)}</td>
        <td><span class="poex ${lec[0]||'md'}">${lec[1]}</span></td></tr>`;}).join('')+'</tbody>';
  $('poMap').querySelectorAll('tbody tr').forEach(tr=>tr.onclick=()=>{
    const c=tr.dataset.c,hit=PL.find(p=>p.slice(0,3)===c)||PL.find(p=>p.slice(3)===c);
    if(hit){po.p=hit;sv();renderPos();}});

  $('poHelp').innerHTML=
    `<p><b>De dónde sale.</b> Informe <i>Traders in Financial Futures</i> de la CFTC, futuros únicamente. El corte es el martes y la publicación el viernes a las 15:30 hora de Nueva York, así que lo que ves siempre tiene tres días de retraso: es posicionamiento declarado, no órdenes vivas. La serie arranca en junio de 2006.</p>`
    +`<p><b>Qué es Leveraged Funds.</b> La categoría que agrupa hedge funds, CTAs y gestores que operan con apalancamiento por cuenta propia. Es el dinero especulativo institucional, no el de cobertura comercial ni el de los gestores de activos, que van en categorías aparte. El lado dólar usa el contrato USD INDEX de ICE, igual que la terminal.</p>`
    +`<p><b>Por qué el neto sobre interés abierto.</b> Comparar contratos en bruto entre divisas no dice nada: el euro mueve ocho veces más contratos que el dólar neozelandés. Dividir entre el interés abierto normaliza y permite poner a todas en la misma tabla. Es la misma definición que usan los gráficos de la terminal.</p>`
    +`<p><b>El percentil es la parte accionable.</b> Un 61% corto en euro no significa nada por sí solo. Que ese neto esté en el percentil 2 de los últimos cinco años sí: dice que el posicionamiento está en un extremo histórico y que el margen para seguir vendiendo sin que alguien tenga que cerrar es estrecho. El extremo no da la dirección ni el momento, solo mide cuánto combustible queda del lado que ya está lleno.</p>`
    +`<p><b>Qué no es.</b> No es una señal contraria automática. El posicionamiento extremo puede estirarse meses y los grandes movimientos de tendencia ocurren con el neto cargado, no plano. Sirve para dimensionar: cuando entras del lado donde ya está todo el mundo, el escenario adverso es más violento y el tamaño debería ser menor. Esa es la decisión que cambia, no la dirección.</p>`;
}
// ---------- Estacionalidad ----------
let es=Object.assign({p:'EURUSD',w:'10'},store.get('es',{})),esC;
const ESW=[['5','5 años'],['10','10 años'],['15','15 años'],['20','20 años'],['0','Todo']];
function renderSeas(){
  const Z=S.seas;if(!Z)return;
  const sv=()=>store.set('es',es);
  if(!Z.ins[es.p])es.p=Object.keys(Z.ins)[0];
  const I=Z.ins[es.p],MS=Z.ms,f2=x=>(x>0?'+':'')+x.toFixed(2)+'%',pc=x=>Math.round(x*100)+'%';
  $('esPair').innerHTML=Object.keys(Z.ins).map(p=>`<option value="${p}"${p===es.p?' selected':''}>${p}</option>`).join('');
  $('esPair').onchange=e=>{es.p=e.target.value;sv();renderSeas();};
  const wins=ESW.filter(([k])=>I.st[k]);
  if(!I.st[es.w])es.w=wins[wins.length-1][0];
  chipset($('esWin'),wins.map(([k,l])=>({id:k,label:l})),es.w,id=>{es.w=id;sv();renderSeas();},'chip sm');
  const ST=I.st[es.w],now=new Date().getMonth(),nxt=(now+1)%12;
  $('esStamp').textContent=`${es.p} · ${I.desde}-${I.ly} · ${I.n} meses`;
  const vd=m=>!m||m.p==null?['no','Sin prueba']:m.p<0.05/12?['ok','Robusto']:m.p<0.05?['wk','Débil']:['no','Ruido'];
  const kp=(lab,m)=>{const v=vd(m);
    return fact(lab,m?f2(m.mean):'—',m?`${pc(m.pos)} de ${m.n} años al alza · <span class="esv ${v[0]}">${v[1]}</span>`:'Sin muestra');};
  $('esKpis').innerHTML=kp('Mes en curso · '+MS[now],ST[now])+kp('Mes siguiente · '+MS[nxt],ST[nxt])
    +fact('Meses al alza',pc(I.posm),`Toda la muestra · base del activo`)
    +(()=>{const PA0=I.paths[es.w]||[],k=I.cur.map((x,i)=>x==null?-1:i).filter(i=>i>=0).pop();
       if(k==null||k<0)return fact('Año en curso','—','Sin meses cerrados');
       const a=I.cur[k],b=PA0[k];
       return fact(`${I.ly} acumulado`,(a>0?'+':'')+a.toFixed(2)+'%',
         `Hasta ${MS[k]} · el promedio de la ventana va en ${(b>0?'+':'')+b.toFixed(2)}%`);})();

  const mx=Math.max(...ST.filter(Boolean).map(m=>Math.abs(m.mean)))||1;
  $('esStats').innerHTML=`<thead><tr><th>Mes</th><th class="num">Media</th><th>Magnitud</th><th class="num">Mediana</th><th class="num">Años al alza</th><th class="num">Desv. est.</th><th class="num">Mejor</th><th class="num">Peor</th><th class="num">n</th><th>Veredicto</th></tr></thead><tbody>`+
    ST.map((m,i)=>{if(!m)return '';const v=vd(m),w=(Math.abs(m.mean)/mx*70).toFixed(0);
      return `<tr${i===now?' class="now"':''}><td><b>${MS[i]}</b></td>
        <td class="num ${m.mean>0?'gain':'loss'}"><b>${f2(m.mean)}</b></td>
        <td><span class="esbar" style="width:${w}px;background:${m.mean>0?'var(--gain)':'var(--loss)'}"></span></td>
        <td class="num">${f2(m.med)}</td><td class="num">${pc(m.pos)}</td><td class="num">${m.sd.toFixed(2)}%</td>
        <td class="num gain">${f2(m.best)}</td><td class="num loss">${f2(m.worst)}</td><td class="num">${m.n}</td>
        <td><span class="esv ${v[0]}">${v[1]}</span></td></tr>`;}).join('')+'</tbody>';
  $('esStatsNote').innerHTML=`<b>Cómo se lee el veredicto.</b> Es una prueba t de que la media del mes sea distinta de cero. `
    +`<b>Robusto</b> = p &lt; 0.004, que es 0.05 repartido entre los doce meses; aguanta el hecho de que estás haciendo doce pruebas a la vez. `
    +`<b>Débil</b> = p &lt; 0.05 sin esa corrección: con doce meses, uno o dos salen así por puro azar. <b>Ruido</b> = no se distingue de cero. `
    +`La columna de años al alza importa tanto como la media: un mes con media alta pero 50% de años positivos lo está moviendo un solo año extremo, no un patrón. `
    +`Es contexto de ejecución —cuánto rango esperar y dónde dejar el stop—, nunca el motivo de una entrada.`;

  const PA=I.paths[es.w]||[];
  const line=css('--line'),muted=css('--muted'),acc=css('--accent'),ink=css('--ink');
  esC?.destroy();
  if(window.Chart){
    const WC={'5':[css('--cool'),[2,3]],'10':[css('--hot'),[6,3]],'15':[css('--gain'),[9,3]],'20':[css('--muted'),[3,3]],'0':[css('--flat'),[12,4]]};
    const ds=[{label:`Promedio ${es.w==='0'?'de toda la muestra':es.w+' años'}`,data:PA,borderColor:acc,borderWidth:2.2,pointRadius:0,fill:false}];
    ['5','10','15','20','0'].forEach(k=>{if(k!==es.w&&I.paths[k]){const c=WC[k];
      ds.push({label:(k==='0'?'Toda la muestra':k+' años'),data:I.paths[k],borderColor:c[0],borderWidth:1.4,borderDash:c[1],pointRadius:0,fill:false});}});
    ds.push({label:I.ly+' en curso',data:I.cur,borderColor:ink,borderWidth:2,pointRadius:3,spanGaps:false,fill:false});
    esC=new Chart($('esChart'),{type:'line',data:{labels:MS,datasets:ds},
      options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{labels:{color:muted,boxWidth:12}},tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw==null?'—':(i.raw>0?'+':'')+i.raw+'%'}`}}},
        scales:{x:{grid:{display:false},ticks:{color:muted}},y:{grid:{color:line},ticks:{color:muted,callback:v=>v+'%'},title:{display:true,text:'Acumulado desde enero',color:muted}}}}});
  }
  $('esChartCap').textContent=`Suma de las medias mensuales desde enero. La línea oscura es ${I.ly} hasta el último mes cerrado. Si el año en curso se despega del promedio, el patrón no se está cumpliendo: eso es información, no una señal de reversión.`;

  const G=I.grid,amx=Math.max(...G.flatMap(r=>r.v.filter(x=>x!=null).map(Math.abs)))||1;
  const cell=x=>{if(x==null)return '<td class="m">—</td>';
    const a=(0.08+0.42*Math.abs(x)/amx).toFixed(3);
    return `<td class="m" style="background:color-mix(in srgb,var(--${x>0?'gain':'loss'}) ${(a*100).toFixed(0)}%,transparent)">${x>0?'+':''}${x.toFixed(2)}</td>`;};
  $('esGrid').innerHTML=`<thead><tr><th>Año</th>${MS.map(m=>`<th class="num">${m}</th>`).join('')}<th class="num">Año</th></tr></thead><tbody>`+
    G.map(r=>`<tr${r.y===I.ly?' class="cur"':''}><td>${r.y}</td>${r.v.map(cell).join('')}<td class="m tot ${r.tot>0?'gain':'loss'}">${r.tot==null?'—':(r.tot>0?'+':'')+r.tot.toFixed(1)}</td></tr>`).join('')+
    `<tr class="tot"><td><b>Media</b></td>${ST.map(m=>`<td class="m"><b>${m?(m.mean>0?'+':'')+m.mean.toFixed(2):'—'}</b></td>`).join('')}<td class="m"></td></tr></tbody>`;

}
// ---------- Volatilidad ----------
let vl=Object.assign({h:'d',c:'roll'},store.get('vl',{}));
const VLH={d:['Diario',Math.sqrt(252),'1 sesión'],w:['Semanal',Math.sqrt(52),'5 sesiones'],
           m:['Mensual',Math.sqrt(12),'1 mes'],y:['Anual',1,'12 meses']};
function renderVol(){
  const V=S.vol;if(!V){return;}
  const sv=()=>store.set('vl',vl);
  const f2=x=>x.toFixed(2),pc=x=>Math.round(x*100)+'%';
  const bk=V.buckets.find(b=>{const [lo,hi]=({'<12':[0,12],'12-15':[12,15],'15-20':[15,20],'20-25':[20,25],'25-30':[25,30],'30-40':[30,40],'>40':[40,1e9]})[b.lab];return V.vix>=lo&&V.vix<hi;})||V.buckets[V.buckets.length-1];
  $('vlStamp').textContent='VIX y S&P al '+V.asof.split('-').reverse().join('-');
  const sig=V.vix/Math.sqrt(252);
  $('vlKpis').innerHTML=
     fact('VIX',f2(V.vix),`Volatilidad implícita a 30 días · tramo ${bk.lab}`)
    +fact('Movimiento diario 1σ',f2(sig)+'%',`±${Math.round(V.spx*sig/100)} pts sobre ${V.spx.toLocaleString('es-MX')}`)
    +fact('Esperado hoy, calibrado',f2(sig*0.7979*bk.ratio)+'%',`implícita × ${bk.ratio} medido en el tramo ${bk.lab}`)
    +fact('Correlación con el S&P',V.corr.toFixed(2),`${V.n.toLocaleString('es-MX')} sesiones desde ${V.desde.slice(0,4)}`);

  chipset($('fVlH'),Object.keys(VLH).map(k=>({id:k,label:VLH[k][0]})),vl.h,id=>{vl.h=id;sv();renderVol();},'chip sm');
  const [hl,hd,hs]=VLH[vl.h],s1=V.vix/hd;
  const px=V.spx,pt=x=>Math.round(px*x/100).toLocaleString('es-MX');
  const band=(k,mult,col)=>{const w=Math.min(100,mult*s1/(3*s1)*100);
    return `<div class="vlrow"><span class="k">${k}</span><div class="t"><i style="width:${w.toFixed(0)}%;background:${col}"></i><em></em></div>
      <span class="v">±${f2(mult*s1)}% · ${pt(mult*s1)} pts</span></div>`;};
  $('vlBand').innerHTML=`<div class="mk-h"><span>Rango ${hl.toLowerCase()} sobre ${px.toLocaleString('es-MX')}</span><span>${hs}</span></div>`
    +band('1σ',1,'color-mix(in srgb,var(--accent) 55%,transparent)')
    +band('2σ',2,'color-mix(in srgb,var(--accent) 35%,transparent)')
    +band('3σ',3,'color-mix(in srgb,var(--accent) 18%,transparent)')
    +(vl.h==='d'?`<div class="vlrow"><span class="k">Calibrado</span><div class="t"><i style="width:${Math.min(100,(0.7979*bk.ratio)/3*100).toFixed(0)}%;background:color-mix(in srgb,var(--cool) 55%,transparent)"></i><em></em></div>
      <span class="v">±${f2(s1*0.7979*bk.ratio)}% · ${pt(s1*0.7979*bk.ratio)} pts</span></div>`
     :`<p class="cap" style="margin-top:4px">La calibración por prima de volatilidad está medida solo sobre la sesión siguiente; a este horizonte se muestran únicamente las bandas teóricas.</p>`);

  const LV=[10,12,14,16,18,20,22,25,30,35,40,50];
  $('vlConv').innerHTML=`<thead><tr><th>VIX</th><th class="num">Anual</th><th class="num">Mensual</th><th class="num">Semanal</th><th class="num">Diario</th><th class="num">Pts S&P/día</th></tr></thead><tbody>`+
    LV.map(v=>{const near=Math.abs(v-V.vix)<1.5;
      return `<tr${near?' class="here"':''}><td>${v}</td><td class="num">${f2(v)}%</td><td class="num">${f2(v/Math.sqrt(12))}%</td><td class="num">${f2(v/Math.sqrt(52))}%</td><td class="num">${f2(v/Math.sqrt(252))}%</td><td class="num">${pt(v/Math.sqrt(252))}</td></tr>`;}).join('')+
    '</tbody>';

  $('vlNow').innerHTML=`<thead><tr><th>Con el VIX en ${f2(V.vix)}</th><th class="num">Movimiento</th><th class="num">Puntos</th></tr></thead><tbody>`+
    [['1σ implícita (teórica)',s1],['Esperado calibrado',vl.h==='d'?s1*0.7979*bk.ratio:null],
     ['Mediana histórica del tramo',vl.h==='d'?bk.med:null],['Percentil 75 del tramo',vl.h==='d'?bk.p75:null],
     ['Percentil 90 del tramo',vl.h==='d'?bk.p90:null],['Rango alto-bajo medio',vl.h==='d'?bk.rng:null]]
    .filter(r=>r[1]!=null).map(r=>`<tr><td>${r[0]}</td><td class="num">${f2(r[1])}%</td><td class="num">${pt(r[1])}</td></tr>`).join('')+
    '</tbody>';
  $('vlNote').innerHTML=`<b>Cómo se calcula.</b> El VIX es volatilidad implícita anualizada a 30 días: se divide entre √252 para el día, √52 para la semana y √12 para el mes, igual que la tabla del estudio del ITPM. `
    +`Esa es la cifra teórica. <b>La calibrada corrige por la prima de volatilidad:</b> sobre ${V.n.toLocaleString('es-MX')} sesiones el movimiento real promedió ${V.ratio} veces el implícito, y en el tramo ${bk.lab} ${bk.ratio} veces (${bk.n.toLocaleString('es-MX')} casos). `
    +(vl.h==='d'?`Las medianas y percentiles son del movimiento real del día siguiente dentro de ese mismo tramo, no una distribución normal. `:`Las medianas por tramo solo están medidas para el horizonte diario. `)
    +`Son estadísticas condicionadas al nivel del VIX, no una previsión direccional: dicen cuánto se mueve, nunca hacia dónde.`;

  $('vlBuck').innerHTML=`<thead><tr><th>VIX</th><th class="num">Sesiones</th><th class="num">σ implícita</th><th class="num">Mediana real</th><th class="num">p75</th><th class="num">p90</th><th class="num">Rango H-L</th><th class="num">Dentro de ±1σ</th><th class="num">Real / implícita</th></tr></thead><tbody>`+
    V.buckets.map(b=>`<tr${b.lab===bk.lab?' class="here"':''}><td><b>${b.lab}</b></td><td class="num">${b.n.toLocaleString('es-MX')}</td><td class="num">${f2(b.imp)}%</td>
      <td class="num">${f2(b.med)}%</td><td class="num">${f2(b.p75)}%</td><td class="num">${f2(b.p90)}%</td><td class="num">${f2(b.rng)}%</td>
      <td class="num">${pc(b.cov)}</td><td class="num ${b.ratio<1?'cold':'hot'}"><b>${b.ratio.toFixed(2)}</b></td></tr>`).join('')+'</tbody>';
  $('vlBuckCap').innerHTML=`Movimiento real del día siguiente según dónde cerró el VIX. La última columna es lo que de verdad importa: por debajo de 1 el VIX cobra de más y por encima se queda corto. `
    +`Con el VIX bajo de 12 el mercado se movió apenas ${V.buckets[0].ratio} veces lo implícito; por encima de 40 se movió ${V.buckets[V.buckets.length-1].ratio} veces. `
    +`Y la cobertura de ±1σ pasa de ${pc(V.buckets[0].cov)} a ${pc(V.buckets[V.buckets.length-1].cov)}: en pánico la distribución engorda las colas y el VIX deja de ser un techo.`;

  chipset($('fVlC'),[{id:'roll',label:'Correlación móvil'},{id:'scat',label:'Dispersión diaria'},{id:'lvl',label:'VIX y S&P'}],vl.c,id=>{vl.c=id;sv();renderVol();},'chip sm');
  $('vlCk').innerHTML=
     fact('Correlación diaria',V.corr.toFixed(3),'Retorno del S&P contra cambio % del VIX')
    +fact('Rango móvil 252d',`${V.corr_min.toFixed(2)} a ${V.corr_max.toFixed(2)}`,`Hoy ${V.corr_now.toFixed(2)}`)
    +fact('Días a la baja',`${V.dv_dn>0?'+':''}${f2(V.dv_dn)}%`,`El VIX sube ${Math.abs(V.beta_dn).toFixed(2)}% por cada 1% de caída`)
    +fact('Días al alza',`${f2(V.dv_up)}%`,`Solo baja ${Math.abs(V.beta_up).toFixed(2)}% por cada 1% de subida`);
  const line=css('--line'),muted=css('--muted'),acc=css('--accent'),ink=css('--ink'),cool=css('--cool'),hot=css('--hot');
  vlC?.destroy();
  if(window.Chart){
    if(vl.c==='roll'){
      vlC=new Chart($('vlChart'),{type:'line',data:{labels:V.rollc.d,datasets:[
        {label:'Correlación móvil 252 sesiones',data:V.rollc.v,borderColor:acc,borderWidth:1.5,pointRadius:0,fill:false},
        {label:'Promedio de la muestra',data:V.rollc.d.map(()=>V.corr),borderColor:muted,borderDash:[5,4],borderWidth:1,pointRadius:0}]},
        options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{labels:{color:muted,boxWidth:12}}},
          scales:{x:{grid:{display:false},ticks:{color:muted,maxTicksLimit:10}},y:{grid:{color:line},ticks:{color:muted},min:-1,max:0}}}});
    }else if(vl.c==='scat'){
      vlC=new Chart($('vlChart'),{type:'scatter',data:{datasets:[{label:'Sesiones',
        data:V.scat.map(p=>({x:p[0],y:p[1]})),pointRadius:1.6,
        backgroundColor:V.scat.map(p=>p[0]<0?hot+'66':cool+'66')}]},
        options:{responsive:true,maintainAspectRatio:false,animation:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`S&P ${i.raw.x>0?'+':''}${i.raw.x}% · VIX ${i.raw.y>0?'+':''}${i.raw.y}%`}}},
          scales:{x:{grid:{color:line},ticks:{color:muted,callback:v=>v+'%'},title:{display:true,text:'Retorno diario del S&P 500',color:muted}},
                  y:{grid:{color:line},ticks:{color:muted,callback:v=>v+'%'},title:{display:true,text:'Cambio diario del VIX',color:muted}}}}});
    }else{
      vlC=new Chart($('vlChart'),{type:'line',data:{labels:V.vixm.d,datasets:[
        {label:'VIX (promedio mensual)',data:V.vixm.v,borderColor:acc,borderWidth:1.5,pointRadius:0,yAxisID:'y'},
        {label:'S&P 500',data:(()=>{const m={};V.spxm.d.forEach((d,i)=>m[d]=V.spxm.v[i]);return V.vixm.d.map(d=>m[d]??null);})(),borderColor:ink,borderWidth:1.3,pointRadius:0,yAxisID:'y1',spanGaps:true}]},
        options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{labels:{color:muted,boxWidth:12}}},
          scales:{x:{grid:{display:false},ticks:{color:muted,maxTicksLimit:10}},
                  y:{position:'left',grid:{color:line},ticks:{color:acc}},
                  y1:{position:'right',type:'logarithmic',grid:{display:false},ticks:{color:ink}}}}});
    }
  }
  $('vlCorr').innerHTML=`<b>La correlación es negativa pero no es estable.</b> En promedio ${V.corr.toFixed(2)} sobre ${V.n.toLocaleString('es-MX')} sesiones, pero la ventana móvil de un año se mueve entre ${V.corr_min.toFixed(2)} y ${V.corr_max.toFixed(2)}. `
    +`Y es asimétrica: el VIX sube ${Math.abs(V.beta_dn).toFixed(2)}% por cada 1% que cae el S&P y solo baja ${Math.abs(V.beta_up).toFixed(2)}% por cada 1% que sube, casi el doble de reacción a la baja. `
    +`Esa asimetría es la razón por la que la volatilidad sirve de cobertura, y también por la que cuesta cara: pagas la prima todos los días para cobrar en los pocos en que el mercado se rompe.`;

  const W=[['Al VIX no se le opera directo','El índice no es un activo: para tomar exposición hay que ir a futuros, opciones o ETN como el VXX, y la mayoría de las cuentas minoristas no tiene acceso a los dos primeros.',0],
    ['El VXX no sigue al VIX','Se construye rodando futuros de primer y segundo mes. Como la curva casi siempre está en contango, los futuros caen hacia el contado al vencer y el producto pierde valor por estructura, no por mercado.',1],
    ['Comprar y mantener como cobertura destruye la cartera','En el corte del estudio, el VXX acumulaba −99.99% histórico contra +24,114% del S&P 500; −72.78% a un año contra +27.95%. Una cobertura permanente con ese decaimiento se come la cartera que pretende proteger.',1],
    ['Venderlo y mantener es peor','Al 26 de marzo de 2018 el VXX llevaba +58.85% en el año con el S&P en +2%. El 5 de febrero de 2018 el VIX subió 104% en una sesión y reventó al XIV, que tuvo que liquidarse. Una sola sesión basta.',1],
    ['La correlación inversa no es permanente','Funciona en horizontes largos; en ventanas cortas se rompe. Una cobertura que depende de que se cumpla todos los días no es una cobertura.',0]];
  $('vlWarn').innerHTML='<div class="vlw">'+W.map(w=>`<div class="${w[2]?'hot':''}"><b>${w[0]}</b><span>${w[1]}</span></div>`).join('')+'</div>';
}
// ---------- Carry ----------
let vlC;
let cy=Object.assign({f:'tfx',s:'dif',g7:'all'},store.get('cy',{}));
function renderCarry(){
  const C=S.carry;if(!C){$('cyPairs').innerHTML='';return;}
  const sv=()=>store.set('cy',cy);
  const f2=x=>x.toFixed(2);
  const dt=s=>s?s.split('-').reverse().join('-'):'—';
  const hi=C.rank[0],lo=C.rank[C.rank.length-1];
  const top=C.pairs[0];
  $('cyKpis').innerHTML=
     fact('Tasa más alta',`${hi.ccy} ${f2(hi.tasa)}%`,`${sg(hi.vsfed)} pp frente a la Fed`)
    +fact('Tasa más baja',`${lo.ccy} ${f2(lo.tasa)}%`,`${sg(lo.vsfed)} pp frente a la Fed`)
    +fact('Mayor diferencial',top.p,`${sg(top.diff)} pp · swap positivo a la ${top.dir}`)
    +fact('Fed',`${f2(C.fed)}%`,`Referencia · tasa efectiva`);

  chipset($('fCyG7'),[{id:'all',label:'Todas'},{id:'g7',label:'Solo G7'}],cy.g7,id=>{cy.g7=id;sv();renderCarry();},'chip sm');
  const banks=C.cb.filter(b=>cy.g7==='all'||b.g7);
  const mx=Math.max(...C.cb.map(b=>b.tasa))||1;
  $('cyBanks').innerHTML=`<thead><tr><th>Moneda</th><th>Banco central</th><th class="num">Tasa</th><th>Nivel</th><th class="num">vs Fed</th><th class="num">Cambio</th><th class="num">Próxima</th><th class="num">Fuente</th></tr></thead><tbody>`+
    banks.map(b=>`<tr${b.ccy==='USD'?' class="here"':''}><td><b>${b.ccy}</b>${b.g7?'<span class="cytag g7">G7</span>':'<span class="cytag">G10</span>'}<span class="sub">${b.pais}</span></td>
      <td>${b.banco}</td><td class="num"><span class="cyr">${f2(b.tasa)}%</span><span class="sub">${b.lab}</span></td>
      <td><span class="cybar" style="width:${(b.tasa/mx*90).toFixed(0)}px;background:${b.ccy==='USD'?'var(--accent)':'var(--muted)'}"></span></td>
      <td class="num ${b.vsfed>0?'hot':b.vsfed<0?'cold':''}">${b.ccy==='USD'?'—':sg(b.vsfed)+' pp'}</td>
      <td class="num">${dt(b.desde)}</td><td class="num">${dt(b.prox)}</td><td class="num"><span class="sub">${b.src}</span></td></tr>`).join('')+'</tbody>';
  $('cyG7').textContent=C.g7note;

  chipset($('fCy'),[{id:'tfx',label:'Libro DoR TFX'},{id:'all',label:'Todos los cruces'},{id:'buy',label:'Swap + al comprar'},{id:'sell',label:'Swap + al vender'}],cy.f,id=>{cy.f=id;sv();renderCarry();});
  chipset($('fCySort'),[{id:'dif',label:'Por diferencial'},{id:'usd',label:'Por USD al día'}],cy.s,id=>{cy.s=id;sv();renderCarry();},'chip sm');
  let L=C.pairs.filter(x=>cy.f==='all'?true:cy.f==='tfx'?x.tfx:cy.f==='buy'?x.diff>0:x.diff<0);
  L=L.slice().sort((a,b)=>cy.s==='usd'?b.day-a.day:Math.abs(b.diff)-Math.abs(a.diff));
  const md=Math.max(...L.map(x=>Math.abs(x.diff)))||1;
  $('cyPairs').innerHTML=`<thead><tr><th>Par</th><th class="num">Tasa base</th><th class="num">Tasa cotizada</th><th class="num">Diferencial</th><th>Magnitud</th><th>Swap positivo</th><th class="num">USD/día por lote</th><th class="num">Precio</th></tr></thead><tbody>`+
    (L.length?L.map(x=>{const d=x.diff>0?'buy':x.diff<0?'sell':'none';
      return `<tr${x.tfx?' class="own"':''}><td><b>${x.p}</b><span class="sub">${x.base} / ${x.quote}</span></td>
        <td class="num">${f2(x.rb)}%</td><td class="num">${f2(x.rq)}%</td>
        <td class="num ${x.diff>0?'gain':x.diff<0?'loss':''}"><b>${sg(x.diff)} pp</b></td>
        <td><span class="cybar" style="width:${(Math.abs(x.diff)/md*84).toFixed(0)}px;background:${x.diff>0?'var(--gain)':'var(--loss)'}"></span></td>
        <td><span class="cydir ${d}">${x.diff>0?'Comprar':x.diff<0?'Vender':'Ninguna'}</span></td>
        <td class="num">${x.diff===0?'—':'$'+x.day.toFixed(2)}</td><td class="num">${x.px}</td></tr>`;}).join('')
     :'<tr><td colspan="8">Sin pares con este filtro.</td></tr>')+'</tbody>';
  $('cyNote').innerHTML=`<b>Cómo leerla.</b> Si la tasa de la moneda base supera a la de la cotizada, el swap es positivo al <b>comprar</b>; si manda la cotizada, es positivo al <b>vender</b>. `
    +`El importe es el carry <b>bruto</b> de un lote estándar: 100,000 unidades de la base × diferencial ÷ 360, convertido a dólares con precios del ${C.pxdate}. `
    +`<b>No es el swap de tu bróker.</b> INFINOX, FxPro y FTMO aplican margen sobre el diferencial, así que el cobro real es peor en los dos sentidos y un diferencial pequeño puede pagar negativo tanto en largo como en corto: confirma la tabla de swaps del símbolo antes de dimensionar. `
    +`Los miércoles se cobra triple por el valor del fin de semana. El carry es un filtro entre ideas, nunca el motivo de la entrada: si el precio va en tu contra, la pérdida supera cualquier interés acumulado en un swing de 1 a 14 días.`;
}
// ---------- Mesa de Volatilidad ----------
/* ============================================================
   Mesa de Volatilidad TFX — motor VE (idéntico al dashboard original)
   ============================================================ */
var VE=(function(){
  var TF={
    D:{label:'Diario',bar:'día',h:[[5,'1 Semana'],[20,'1 Mes'],[60,'1 Trimestre'],[250,'1 Año'],[750,'3 Años'],[1250,'5 Años'],[2500,'10 Años'],[5000,'20 Años'],[12500,'50 Años']],sum:[20,60,250],staleDays:10},
    W:{label:'Semanal',bar:'semana',h:[[4,'1 Mes'],[12,'1 Trimestre'],[52,'1 Año'],[156,'3 Años'],[260,'5 Años'],[520,'10 Años'],[1040,'20 Años'],[2600,'50 Años']],sum:[12,52,156],staleDays:21},
    M:{label:'Mensual',bar:'mes',h:[[3,'1 Trimestre'],[12,'1 Año'],[36,'3 Años'],[60,'5 Años'],[120,'10 Años'],[240,'20 Años'],[600,'50 Años']],sum:[12,36,60],staleDays:62}
  };
  var PCTS=[];
  for(var i=1;i<=15;i++)PCTS.push(i/100);
  for(var j=20;j<=80;j+=5)PCTS.push(j/100);
  for(var k=85;k<=99;k++)PCTS.push(k/100);
  function sum(a){var s=0;for(var i=0;i<a.length;i++)s+=a[i];return s;}
  function mean(a){return sum(a)/a.length;}
  function sortAsc(a){return a.slice().sort(function(x,y){return x-y;});}
  function pctInc(sorted,p){var n=sorted.length;if(!n)return NaN;var h=(n-1)*p,lo=Math.floor(h),hi=Math.min(lo+1,n-1);return sorted[lo]+(h-lo)*(sorted[hi]-sorted[lo]);}
  function median(sorted){return pctInc(sorted,0.5);}
  function mode(a){
    var cnt=new Map(),first=new Map();
    for(var i=0;i<a.length;i++){var v=a[i];cnt.set(v,(cnt.get(v)||0)+1);if(!first.has(v))first.set(v,i);}
    var best=null,bc=1,bi=Infinity;
    cnt.forEach(function(c,v){var fi=first.get(v);if(c>bc||(c===bc&&c>1&&fi<bi)){best=v;bc=c;bi=fi;}});
    return bc>1?best:NaN;
  }
  function describe(a){
    var n=a.length,m=mean(a),s2=0,s3=0,s4=0,i;
    for(i=0;i<n;i++){var d=a[i]-m;s2+=d*d;}
    var v=s2/(n-1),sd=Math.sqrt(v);
    for(i=0;i<n;i++){var z=(a[i]-m)/sd;s3+=z*z*z;s4+=z*z*z*z;}
    var skew=n/((n-1)*(n-2))*s3;
    var kurt=n*(n+1)/((n-1)*(n-2)*(n-3))*s4-3*(n-1)*(n-1)/((n-2)*(n-3));
    var srt=sortAsc(a);
    return {mean:m,se:sd/Math.sqrt(n),median:median(srt),mode:mode(a),sd:sd,variance:v,kurt:kurt,skew:skew,
      range:srt[n-1]-srt[0],min:srt[0],max:srt[n-1],sum:sum(a),count:n,sorted:srt};
  }
  function fp(x){return (x*100).toFixed(2)+'%';}
  function bins(a,edges,firstLabelEq){
    var out=[],n=a.length,cum=0;
    for(var b=0;b<=edges.length;b++){
      var c=0,lo=b===0?-Infinity:edges[b-1],hi=b===edges.length?Infinity:edges[b];
      for(var i=0;i<n;i++){var x=a[i];if(x<=hi&&x>lo)c++;}
      var p=c/n;cum+=p;
      var label=b===0?(firstLabelEq?'Igual a ':'Menor a ')+fp(edges[0]):b===edges.length?'Mayor a '+fp(edges[edges.length-1]):fp(lo)+' a '+fp(hi);
      out.push({lo:lo,hi:hi,label:label,count:c,prob:p,cum:cum});
    }
    return out;
  }
  function posneg(a){
    var n=a.length,pos=a.filter(function(x){return x>0;}),neg=a.filter(function(x){return x<0;}),z=n-pos.length-neg.length;
    var r=function(arr,avg){var f=arr.length/n;return {avg:avg,count:arr.length,freq:f,adj:f*avg};};
    return {pos:r(pos,pos.length?mean(pos):NaN),neg:r(neg,neg.length?mean(neg):NaN),zero:r(new Array(z),0)};
  }
  function bands(a,st){
    var normal=[0.6827,0.9545,0.9973];
    return [1,2,3].map(function(k){
      var up=st.mean+k*st.sd,lo=st.mean-k*st.sd,c=0;
      for(var i=0;i<a.length;i++)if(a[i]<up&&a[i]>lo)c++;
      return {k:k,upper:up,lower:lo,count:c,pct:c/a.length,normal:normal[k-1]};
    });
  }
  function compute(rows,tf,opts){
    opts=opts||{};
    var r=opts.excludeLast?rows.slice(1):rows,n=r.length,i;
    if(n<10)return null;
    var cc=[],hl=[],tr=[];
    for(i=0;i<n;i++){
      var o=r[i][1],h=r[i][2],l=r[i][3],c=r[i][4];
      hl.push((h-l)/l);
      if(i<n-1){
        var pc=r[i+1][4];
        cc.push((c-pc)/pc);
        tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(pc-l))/o);
      }
    }
    var ccS=describe(cc),hlS=describe(hl);
    var ccEdges=[-3,-2.4,-1.8,-1.2,-0.6,0,0.6,1.2,1.8,2.4,3].map(function(k){return ccS.mean+k*ccS.sd;});
    var hlEdges=[0,0.4,0.8,1.2,1.6,2,2.4,2.8,3.2,3.6,4].map(function(k){return k*hlS.median;});
    var P=function(st,p){return pctInc(st.sorted,p);};
    var atrp=TF[tf].h.map(function(hz){
      var m=Math.min(hz[0],tr.length);
      return {bars:hz[0],label:hz[1],value:mean(tr.slice(0,m)),used:m,full:m>=hz[0]};
    });
    return {
      n:n,last:r[0],first:r[n-1],
      cc:{stats:ccS,bins:bins(cc,ccEdges,false),pn:posneg(cc),bands:bands(cc,ccS),pct:PCTS.map(function(p){return [p,P(ccS,p)];}),raw:cc},
      hl:{stats:hlS,bins:bins(hl,hlEdges,true),pn:posneg(hl),bands:bands(hl,hlS),pct:PCTS.map(function(p){return [p,P(hlS,p)];}),raw:hl},
      levels:{
        sl:[[0.15,P(ccS,0.15)],[0.20,P(ccS,0.20)],[0.25,P(ccS,0.25)]],
        tp:[[0.60,P(hlS,0.40)],[0.65,P(hlS,0.35)],[0.70,P(hlS,0.30)]],
        std:[1,2,3].map(function(k){return [k,hlS.mean+k*hlS.sd];}),
        mean:hlS.mean
      },
      atrp:atrp
    };
  }
  function weekStart(ymd){
    var d=new Date(Date.UTC(Math.floor(ymd/10000),Math.floor(ymd/100)%100-1,ymd%100));
    d.setUTCDate(d.getUTCDate()-d.getUTCDay());
    return d.getUTCFullYear()*10000+(d.getUTCMonth()+1)*100+d.getUTCDate();
  }
  function resample(daily,tf){
    var asc=daily.slice().sort(function(a,b){return a[0]-b[0];}),g=new Map();
    asc.forEach(function(x){
      var k=tf==='W'?weekStart(x[0]):Math.floor(x[0]/100)*100+1,b=g.get(k);
      if(!b)g.set(k,[k,x[1],x[2],x[3],x[4]]);else{b[2]=Math.max(b[2],x[2]);b[3]=Math.min(b[3],x[3]);b[4]=x[4];}
    });
    return Array.from(g.values()).sort(function(a,b){return b[0]-a[0];});
  }
  return {TF:TF,compute:compute,resample:resample,pctInc:pctInc,describe:describe};
})();

/* ============================================================
   Decodificador del seed (delta base-36) — perezoso por serie
   ============================================================ */
const MKSEED=(function(){
  const E=MKT_ENC,cache={};
  function dec(e){
    const sc=e[0],d0=e[1],o0=e[2],s=e[3];
    let dt=Date.UTC(Math.floor(d0/10000),Math.floor(d0/100)%100-1,d0%100);
    const parts=s.split(';'),rows=new Array(parts.length);
    let pc=null;
    for(let i=0;i<parts.length;i++){
      const t=parts[i],a=t.split(',');
      dt+=parseInt(a[0],36)*864e5;
      const o=pc===null?o0:pc+parseInt(a[1],36);
      const h=o+parseInt(a[2],36),l=o-parseInt(a[3],36),c=o+parseInt(a[4],36);
      pc=c;
      const d=new Date(dt);
      rows[i]=[d.getUTCFullYear()*10000+(d.getUTCMonth()+1)*100+d.getUTCDate(),o/sc,h/sc,l/sc,c/sc];
    }
    rows.reverse();
    return rows;
  }
  return {
    pairs(){return Object.keys(E);},
    has(p,tf){return !!(E[p]&&E[p][tf]);},
    get(p,tf){
      if(!E[p]||!E[p][tf])return null;
      const k=p+tf;
      return cache[k]||(cache[k]=dec(E[p][tf]));
    }
  };
})();

/* ============================================================
   Mesa de Volatilidad — interfaz
   ============================================================ */
const MK=(function(){
  const COMMOD={XAUUSD:1,XAGUSD:1,WTI:1,XBRUSD:1,BRENT:1,XPTUSD:1,NGAS:1};
  const INDEX={US30:1,NAS100:1,SPX500:1,GER40:1,UK100:1,JPN225:1,US2000:1};
  const GRPS=[['all','Todos'],['maj','Divisas mayores'],['min','Divisas menores'],['idx','Índices'],['com','Materias primas']];
  const GRPL={maj:'Divisa mayor',min:'Divisa menor',idx:'Índice',com:'Materia prima'};
  const TABS=[['niveles','Niveles'],['atrp','ATRP'],['cc','DoR C-C'],['hl','DoR H-L'],['pct','Percentiles'],['matriz','Matriz'],['pips','Pips'],['datos','Actualizar datos']];
  const INCID=[
    'FX (18 cruces EUR, AUD y GBP), XAUUSD, XAGUSD, WTI, US30, NAS100 y SPX500 con datos al 12-10-2026, exportados de Investing.com.',
    'US30 diario: el archivo recibido termina el 31-10-2025. Hay que exportarlo de nuevo con el rango hasta hoy.',
    'XAUUSD y XAGUSD semanal y mensual empiezan en febrero de 2006: antes de esa fecha el archivo trae velas inválidas (Máximo y Mínimo iguales al Cierre).',
    'US30 mensual: el archivo traía 68 velas duplicadas; se dejó una por mes.',
    'Las series semanales y mensuales anteriores a ~1990 traen velas planas (Apertura = Máximo = Mínimo = Cierre). Inflan el tramo «Igual a 0.00%» del H-L y bajan su media.'
  ];
  const UPMSG0='Formatos aceptados: exportación de Investing.com, MT4/MT5, TradingView o tus propias hojas. Detecta coma decimal y fechas DD.MM.AAAA, MM/DD/AAAA o AAAA-MM-DD.';

  let st=Object.assign({pair:'EURUSD',tf:'W',ex:false,tab:'niveles',
    price:'',dir:'L',slI:0,tpI:0,
    fmx:{grp:'all',dir:'asc',col:'name'},fpp:{grp:'all',dir:'desc',col:'6'}},store.get('mkt',{}));
  let ovr=store.get('mktovr',{});
  let up={pending:null,pair:'',newT:'',tf:'DX',msg:UPMSG0,warn:false};
  let memo={},ovrVer=0;
  const mkCharts={};

  const save=()=>store.set('mkt',st);
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fp=(x,d)=>(x==null||isNaN(x))?'—':(x*100).toFixed(d==null?2:d)+'%';
  const fx=(x,d)=>(x==null||isNaN(x))?'—':x.toFixed(d==null?4:d);
  const fdate=ymd=>{const s=String(ymd);return s.slice(6,8)+'-'+s.slice(4,6)+'-'+s.slice(0,4);};
  const kind=p=>COMMOD[p]?'C':INDEX[p]?'I':(/^[A-Z]{6}$/.test(p)?'F':(/^(US|NAS|SPX|GER|UK|JPN)/.test(p)?'I':'C'));
  const priceDec=(p,px)=>{const k=kind(p);if(k==='F')return /JPY$/.test(p)||px>20?3:5;if(k==='I')return 2;return px<10?4:px<100?3:2;};
  const pipSize=(p,px)=>kind(p)==='F'?(/JPY$/.test(p)||px>20?0.01:0.0001):1;
  const dist=(p,px,d)=>{const k=kind(p),a=Math.abs(d);
    if(k==='F')return Math.round(a/pipSize(p,px)).toLocaleString('es-MX')+' pips';
    if(k==='I')return Math.round(a).toLocaleString('es-MX')+' pts';
    return '$'+a.toFixed(a<10?2:1);};
  const unitLabel=p=>{const k=kind(p);return k==='F'?'pips':k==='I'?'puntos':'dólares';};
  const ageDays=ymd=>{const d=new Date(Math.floor(ymd/1e4),Math.floor(ymd/100)%100-1,ymd%100);return Math.round((Date.now()-d)/864e5);};
  const grpOf=p=>{const k=kind(p);return k==='F'?(/USD/.test(p)?'maj':'min'):k==='I'?'idx':'com';};
  const allPairs=()=>{const s=new Set(MKSEED.pairs());Object.keys(ovr).forEach(k=>s.add(k));return Array.from(s);};
  const rowsOf=(p,tf)=>(ovr[p]&&ovr[p][tf])||MKSEED.get(p,tf)||null;
  const isUser=(p,tf)=>!!(ovr[p]&&ovr[p][tf]);
  function comp(p,tf,ex){
    const rows=rowsOf(p,tf);if(!rows||rows.length<10)return null;
    const k=p+tf+ex+rows.length+rows[0][0]+ovrVer;
    return memo[k]||(memo[k]=VE.compute(rows,tf,{excludeLast:ex}));
  }

  /* ---------- controles ---------- */
  function renderControls(){
    const ps=allPairs(),groups={};
    ps.forEach(p=>{const k=kind(p),g=k==='F'?p.slice(0,3):k==='I'?'Índices':'Materias primas';(groups[g]=groups[g]||[]).push(p);});
    $('mkPair').innerHTML=Object.keys(groups).map(g=>
      `<optgroup label="${esc(g)}">`+groups[g].map(p=>`<option value="${esc(p)}"${p===st.pair?' selected':''}>${esc(p)}</option>`).join('')+'</optgroup>').join('');
    $('mkPair').onchange=e=>{st.pair=e.target.value;save();render();};
    chipset($('mkTf'),[['D','Diario'],['W','Semanal'],['M','Mensual']].map(([id,label])=>({id,label})),st.tf,id=>{st.tf=id;save();render();},'chip sm');
    const b=$('mkEx');b.innerHTML='';
    const bt=document.createElement('button');bt.type='button';bt.className='chip sm';bt.textContent='Excluir vela en curso';
    bt.setAttribute('aria-pressed',String(st.ex));bt.onclick=()=>{st.ex=!st.ex;save();render();};b.appendChild(bt);
    // tira de instrumentos
    const items=ps.map(p=>{
      let r=rowsOf(p,st.tf);if(!r||r.length<3)return null;
      if(st.ex)r=r.slice(1);
      const c=r[0][4],pc=r[1][4],ch=(c-pc)/pc;
      return {p,c:fx(c,priceDec(p,c)),ch:(ch>=0?'+':'')+(ch*100).toFixed(2)+'%',up:ch>=0};
    }).filter(Boolean);
    $('mkTick').innerHTML=items.map(it=>
      `<button type="button" class="tk${it.p===st.pair?' on':''}" data-p="${esc(it.p)}"><b>${esc(it.p)}</b><span class="num">${it.c}</span><span class="${it.up?'gain':'loss'}">${it.up?'▲':'▼'} ${it.ch}</span></button>`).join('');
    $('mkTick').querySelectorAll('.tk').forEach(el=>{el.onclick=()=>{st.pair=el.dataset.p;save();render();};});
  }

  /* ---------- cabecera ---------- */
  function renderHero(R){
    const TF=VE.TF[st.tf];
    if(!R){
      $('mkHero').innerHTML=`<div class="mk-kick">Mesa de volatilidad · ${TF.label.toUpperCase()}</div><div class="mk-px">—</div>
        <p class="cap">Sin datos ${TF.label.toLowerCase()}s para ${esc(st.pair)}. Cárgalos en «Actualizar datos».</p>`;
      $('mkSpark').innerHTML='';$('mkReg').innerHTML='';return;
    }
    let rows=rowsOf(st.pair,st.tf);if(st.ex)rows=rows.slice(1);
    const px=R.last[4],dec=priceDec(st.pair,px);
    const chg=(rows[0][4]-rows[1][4])/rows[1][4];
    const age=ageDays(R.last[0]),stale=age>TF.staleDays;
    $('mkHero').innerHTML=`<div class="mk-kick">Mesa de volatilidad · ${TF.label.toUpperCase()}</div>
      <div class="mk-name">${esc(st.pair)}</div>
      <div class="mk-pxrow"><span class="mk-px">${fx(px,dec)}</span><span class="${chg>=0?'gain':'loss'} mk-chg">${chg>=0?'▲ +':'▼ '}${(chg*100).toFixed(2)}%</span></div>
      <div class="mk-meta">${R.n.toLocaleString('es-MX')} velas · ${fdate(R.first[0])} → ${fdate(R.last[0])}</div>
      <div class="mk-chips"><span class="is ${stale?'hot':'cold'}">${stale?'Desactualizado · '+age+' días':'Al día'}</span>${isUser(st.pair,st.tf)?'<span class="is flat">Datos cargados por ti</span>':''}</div>`;
    // sparkline
    const N=Math.min(90,rows.length),cl=rows.slice(0,N).map(r=>r[4]).reverse();
    const lo=Math.min(...cl),hi=Math.max(...cl),W=320,H=110;
    const pts=cl.map((v,i)=>[(i/(N-1))*W,H-6-((v-lo)/((hi-lo)||1))*(H-14)]);
    const line='M'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join('L');
    $('mkSpark').innerHTML=`<div class="mk-h"><span>Cierres · últimas ${N} velas</span><span>${TF.label}</span></div>
      <svg class="mk-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="mkArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
        <path d="${line}L${W},${H}L0,${H}Z" fill="url(#mkArea)"></path>
        <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>
      </svg>
      <div class="mk-h"><span>Mín ${fx(lo,dec)}</span><span>Máx ${fx(hi,dec)}</span></div>`;
    // régimen de volatilidad
    const sumH=TF.sum,a0=R.atrp.find(a=>a.bars===sumH[0]),a2=R.atrp.find(a=>a.bars===sumH[2]);
    const ratio=a0&&a2?a0.value/a2.value:1;
    const reg=ratio>1.15?['Expansión','hot']:ratio<0.85?['Contracción','cold']:['Normal','flat'];
    const pos=(Math.max(0,Math.min(1,(ratio-0.5)/1))*100).toFixed(1);
    $('mkReg').innerHTML=`<div class="mk-h"><span>Régimen de volatilidad</span><span class="num">×${ratio.toFixed(2)}</span></div>
      <div class="mk-reg ${reg[1]}">${reg[0]}</div>
      <div class="mk-track"><i style="left:${pos}%"></i></div>
      <p class="cap">ATRP ${a0?a0.label:''} frente a ${a2?a2.label:''}. Por encima de ×1.15 el mercado se mueve más de lo habitual; por debajo de ×0.85, menos.</p>`;
  }

  /* ---------- niveles + calculadora ---------- */
  function renderNiveles(R){
    const el=$('mk-niveles');
    if(!R){el.innerHTML='<p class="note">Sin datos para este instrumento y temporalidad.</p>';return;}
    const TF=VE.TF[st.tf],px=R.last[4];
    const grp=(arr,labs)=>{const mx=Math.max(...arr.map(Math.abs))||1;
      return arr.map((v,i)=>`<div class="lv"><span class="lv-l">${labs[i]}</span><div class="lv-b"><span class="num">${fp(v)}</span><div class="lv-t"><i style="width:${(Math.abs(v)/mx*100).toFixed(1)}%"></i></div></div><span class="lv-x num">${dist(st.pair,px,v*px)}</span></div>`).join('');};
    const box=(t,s,html,cls)=>`<div class="lv-box ${cls||''}"><div class="mk-h"><span>${t}</span><span>${s}</span></div>${html}</div>`;
    const sl=R.levels.sl.map(x=>x[1]),tp=R.levels.tp.map(x=>x[1]),sd=[R.levels.mean].concat(R.levels.std.map(x=>x[1]));
    // calculadora
    const slI=Math.min(+st.slI||0,2),tpI=Math.min(+st.tpI||0,2);
    const calcOut=()=>{
      const slV=Math.abs(R.levels.sl[Math.min(+st.slI||0,2)][1]),tpV=R.levels.tp[Math.min(+st.tpI||0,2)][1],L=st.dir==='L';
      const P=parseFloat(st.price);
      if(!(P>0))return '<p class="cap">Escribe un precio de entrada para calcular stop, objetivo y relación R:R.</p>';
      const d=priceDec(st.pair,P),stop=L?P*(1-slV):P*(1+slV),tg=L?P*(1+tpV):P*(1-tpV);
      const lo2=Math.min(stop,tg),hi2=Math.max(stop,tg),ps=v=>(8+84*(v-lo2)/((hi2-lo2)||1)).toFixed(1);
      return `<div class="mk-calcout">
        <div class="fact"><span class="k">Precio stop</span><span class="v loss">${fx(stop,d)}</span><span class="n">${fp(slV)} · ${dist(st.pair,P,P-stop)}</span></div>
        <div class="fact"><span class="k">Precio target</span><span class="v gain">${fx(tg,d)}</span><span class="n">${fp(tpV)} · ${dist(st.pair,P,tg-P)}</span></div>
        <div class="fact"><span class="k">Relación R:R</span><span class="v">1 : ${(tpV/slV).toFixed(2)}</span><span class="n">target ÷ stop</span></div>
      </div>
      <div class="mk-lad"><i class="loss" style="left:${ps(stop)}%"></i><i class="ent" style="left:${ps(P)}%"></i><i class="gain" style="left:${ps(tg)}%"></i>
        <span style="left:${ps(stop)}%">STOP</span><span style="left:${ps(P)}%">ENTRADA</span><span style="left:${ps(tg)}%">TARGET</span></div>`;
    };
    const out=`<div id="mkCalc">${calcOut()}</div>`;
    el.innerHTML=`<p class="cap">Por ${TF.bar} · ${unitLabel(st.pair)} sobre el último cierre de ${esc(st.pair)} (${fx(px,priceDec(st.pair,px))}).</p>
      <div class="lv-grid">
        ${box('Stop Loss · retorno C-C','percentil',grp(sl,R.levels.sl.map(x=>fp(x[0],0))),'loss')}
        ${box('Take Profit · rango H-L','prob. de alcanzar',grp(tp,R.levels.tp.map(x=>fp(x[0],0))),'gain')}
        ${box('Rango H-L · desviaciones','media + kσ',grp(sd,['Media','1σ','2σ','3σ']))}
      </div>
      <div class="lv-box"><div class="mk-h"><span>Calculadora de niveles</span><span>Stop = P×(1∓SL%) · Target = P×(1±TP%)</span></div>
        <div class="rp-form">
          <label>Precio de entrada<input type="number" step="any" id="mkPrice" value="${esc(st.price)}"></label>
          <label>Dirección<div class="filters" id="mkDir"></div></label>
          <label>Stop (prob.)<select class="gsel" id="mkSl">${R.levels.sl.map((x,i)=>`<option value="${i}"${i===slI?' selected':''}>${fp(x[0],0)} → ${fp(Math.abs(x[1]))}</option>`).join('')}</select></label>
          <label>Target (prob.)<select class="gsel" id="mkTp">${R.levels.tp.map((x,i)=>`<option value="${i}"${i===tpI?' selected':''}>${fp(x[0],0)} → ${fp(x[1])}</option>`).join('')}</select></label>
        </div>
        ${out}
      </div>
      <p class="cap">SL = percentiles 15/20/25 del retorno cierre-a-cierre: la probabilidad de que una vela cierre por debajo de ese nivel. TP = percentiles 40/35/30 del rango H-L, es decir 60/65/70% de probabilidad de que el rango de la vela lo alcance. Son estadísticas de la serie, no una recomendación de operación.</p>`;
    const upd=()=>{$('mkCalc').innerHTML=calcOut();};
    const ip=$('mkPrice');
    ip.oninput=()=>{st.price=ip.value;save();upd();};
    chipset($('mkDir'),[{id:'L',label:'Largo'},{id:'S',label:'Corto'}],st.dir,id=>{st.dir=id;save();
      $('mkDir').querySelectorAll('.chip').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent==='Largo'?id==='L':id==='S')));upd();},'chip sm');
    $('mkSl').onchange=e=>{st.slI=+e.target.value;save();upd();};
    $('mkTp').onchange=e=>{st.tpI=+e.target.value;save();upd();};
  }

  /* ---------- ATRP ---------- */
  function renderAtrp(R){
    const el=$('mk-atrp');
    if(!R){el.innerHTML='<p class="note">Sin datos para este instrumento y temporalidad.</p>';return;}
    const TF=VE.TF[st.tf],sumH=TF.sum,px=R.last[4],k=kind(st.pair);
    const amax=Math.max(...R.atrp.map(a=>a.value))||1;
    const unit=k==='F'?'Pips':k==='I'?'Puntos':'USD';
    el.innerHTML=`<p class="cap">Promedio del TR% ${st.tf==='D'?'diario':st.tf==='W'?'semanal':'mensual'} por horizonte.</p>
      <div class="scroll"><table><thead><tr><th>Horizonte</th><th>${TF.label}</th><th class="num">ATRP</th><th class="num">${unit}</th></tr></thead><tbody>`+
      R.atrp.map(a=>{const sm=sumH.indexOf(a.bars)>=0;
        return `<tr${a.full?'':' class="info"'} title="${a.bars} velas${a.full?'':' (solo hay '+a.used+')'}"><td${sm?' style="font-weight:700"':''}>${a.label}</td>
          <td><div class="lv-t"><i style="width:${(a.value/amax*100).toFixed(1)}%"></i></div></td>
          <td class="num"${sm?' style="font-weight:700"':''}>${fp(a.value)}</td>
          <td class="num">${dist(st.pair,px,a.value*px).replace(/ (pips|pts)$/,'')}</td></tr>`;}).join('')+
      `</tbody></table></div>
      <p class="cap">TR% = máx(H−L, |H−C<sub>ant</sub>|, |C<sub>ant</sub>−L|) ÷ Apertura. En negrita, los horizontes que alimentan la Matriz. Filas sombreadas: el histórico no alcanza el horizonte y se promedia con lo disponible.</p>`;
  }

  /* ---------- histogramas DoR ---------- */
  function renderHist(R,kindK,id){
    const el=$(id);
    if(!R){el.innerHTML='<p class="note">Sin datos para este instrumento y temporalidad.</p>';return;}
    const D=R[kindK],stt=D.stats;
    const sub=kindK==='cc'?`(C<sub>t</sub> − C<sub>t−1</sub>) ÷ C<sub>t−1</sub> · ${stt.count.toLocaleString('es-MX')} retornos`
                          :`(H − L) ÷ L · ${stt.count.toLocaleString('es-MX')} velas`;
    const statRows=[['Media',fp(stt.mean,3)],['Error estándar',fp(stt.se,3)],['Mediana',fp(stt.median,3)],['Moda',fp(stt.mode,3)],
      ['Desviación estándar',fp(stt.sd,3)],['Varianza',stt.variance.toExponential(3)],['Curtosis',stt.kurt.toFixed(3)],['Asimetría',stt.skew.toFixed(3)],
      ['Rango',fp(stt.range,3)],['Mínimo',fp(stt.min,3)],['Máximo',fp(stt.max,3)],['Suma',fp(stt.sum,2)],['Conteo',stt.count.toLocaleString('es-MX')]];
    const mx=Math.max(...D.bins.map(b=>b.prob))||1;
    const pn=[['Positivos',D.pn.pos,'gain'],['Negativos',D.pn.neg,'loss'],['Cero',D.pn.zero,'']];
    el.innerHTML=`<p class="cap">${sub}</p>
      <div class="split">
        <div style="display:grid;gap:20px;align-content:start">
          <div class="chart" style="height:300px"><canvas id="${id}-c"></canvas></div>
          <div class="scroll"><table><thead><tr><th>Rango</th><th class="num">Frec.</th><th class="num">Prob.</th><th class="num">Acum.</th></tr></thead><tbody>`+
            D.bins.map(b=>`<tr><td>${b.label}</td><td class="num">${b.count.toLocaleString('es-MX')}</td>
              <td class="num"><span class="fbar" style="width:${(b.prob/mx*54).toFixed(1)}px"></span> ${fp(b.prob)}</td><td class="num">${fp(b.cum)}</td></tr>`).join('')+
          `</tbody></table></div>
        </div>
        <div class="scroll"><table><thead><tr><th>Estadística descriptiva</th><th class="num">Valor</th></tr></thead><tbody>`+
          statRows.map(r=>`<tr><td>${r[0]}</td><td class="num">${r[1]}</td></tr>`).join('')+`</tbody></table></div>
      </div>
      <div class="twocol">
        <div class="scroll"><table><thead><tr><th></th><th class="num">Ret. prom.</th><th class="num">Conteo</th><th class="num">Frec.</th><th class="num">Ajust. frec.</th></tr></thead><tbody>`+
          pn.map(([l,o,c])=>`<tr><td class="${c}">${l}</td><td class="num">${fp(o.avg,3)}</td><td class="num">${o.count.toLocaleString('es-MX')}</td><td class="num">${fp(o.freq,1)}</td><td class="num">${fp(o.adj,3)}</td></tr>`).join('')+
        `</tbody></table></div>
        <div class="scroll"><table><thead><tr><th>σ</th><th class="num">Superior</th><th class="num">Inferior</th><th class="num">Real</th><th class="num">Normal</th></tr></thead><tbody>`+
          D.bands.map(b=>{const d=b.pct-b.normal;
            return `<tr><td>${b.k}σ</td><td class="num">${fp(b.upper)}</td><td class="num">${fp(b.lower)}</td>
              <td class="num">${fp(b.pct,1)} <span class="${d>0?'gain':'loss'}">${(d>0?'+':'')+(d*100).toFixed(1)}</span></td><td class="num">${fp(b.normal,2)}</td></tr>`;}).join('')+
        `</tbody></table></div>
      </div>
      <p class="cap">${kindK==='cc'
        ? 'Intervalos centrados en la media, en pasos de 0.6 desviaciones estándar. Si el % real supera al normal en ±1σ y queda por debajo en ±3σ, la serie tiene colas gruesas.'
        : 'Intervalos en múltiplos de 0.4 veces la mediana del rango, igual que en los libros DoR.'}</p>`;
    const line=css('--line'),muted=css('--muted'),acc=css('--accent'),gain=css('--gain'),loss=css('--loss');
    const colr=b=>kindK==='cc'?((b.lo<0&&b.hi>0)?muted:(b.hi<=0?loss:gain)):acc;
    const labs=D.bins.map((b,i)=>i===0?'≤'+fp(b.hi,1):i===D.bins.length-1?'>'+fp(b.lo,1):fp(b.hi,1));
    if(window.Chart){
      const c=mkCharts[id];if(c)c.destroy();
      mkCharts[id]=new Chart($(id+'-c'),{type:'bar',
        data:{labels:labs,datasets:[{data:D.bins.map(b=>b.prob*100),backgroundColor:D.bins.map(colr),borderRadius:2,barPercentage:.94,categoryPercentage:.96}]},
        options:{responsive:true,maintainAspectRatio:false,animation:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{title:t=>D.bins[t[0].dataIndex].label,label:t=>D.bins[t.dataIndex].count.toLocaleString('es-MX')+' velas · '+t.raw.toFixed(1)+'%'}}},
          scales:{x:{grid:{display:false},ticks:{color:muted,maxRotation:60,minRotation:0,autoSkip:true,maxTicksLimit:12}},
                  y:{grid:{color:line},ticks:{color:muted,callback:x=>x+'%'},title:{display:true,text:'% de velas',color:muted}}}}});
    }
  }

  /* ---------- percentiles ---------- */
  function renderPct(R){
    const el=$('mk-pct');
    if(!R){el.innerHTML='<p class="note">Sin datos para este instrumento y temporalidad.</p>';return;}
    const hits={0.15:1,0.2:1,0.25:1,0.3:1,0.35:1,0.4:1},cc=R.cc.pct,hl=R.hl.pct,third=Math.ceil(cc.length/3);
    const cols=[0,1,2].map(c=>{
      const rows=cc.slice(c*third,(c+1)*third).map((x,j)=>{const i=c*third+j,h=hits[x[0]];
        return `<tr${h?' class="here"':''}><td${h?' style="font-weight:700"':''}>${Math.round(x[0]*100)}%</td><td class="num${x[1]<0?' loss':''}">${fp(x[1])}</td><td class="num">${fp(hl[i][1])}</td></tr>`;}).join('');
      return `<div class="scroll"><table><thead><tr><th>Percentil</th><th class="num">C-C</th><th class="num">H-L</th></tr></thead><tbody>${rows}</tbody></table></div>`;});
    el.innerHTML=`<p class="cap">PERCENTILE.INC sobre toda la serie de ${esc(st.pair)} ${VE.TF[st.tf].label.toLowerCase()}.</p>
      <div class="pcols">${cols.join('')}</div>
      <p class="cap">Resaltados, los percentiles que alimentan los niveles: SL = C-C 15/20/25 · TP = H-L 40/35/30 (60/65/70% de probabilidad de que el rango los supere).</p>`;
  }

  /* ---------- matriz / pips ---------- */
  function buildAll(){
    const TF=VE.TF[st.tf],sumH=TF.sum;
    const labs=TF.h.filter(h=>sumH.indexOf(h[0])>=0).map(h=>h[1]);
    const HDR=['SL 15%','SL 20%','SL 25%','TP 60%','TP 65%','TP 70%','H-L media'].concat(labs.map(l=>'ATRP '+l));
    const all=allPairs().map(p=>{
      const r=comp(p,st.tf,st.ex),g=grpOf(p);
      if(!r)return {p,r:null,g};
      const v=r.levels.sl.map(a=>a[1]).concat(r.levels.tp.map(a=>a[1]),[r.levels.mean],r.atrp.filter(a=>sumH.indexOf(a.bars)>=0).map(a=>a.value));
      const px=r.last[4],pip=pipSize(p,px);
      return {p,r,g,v,pv:v.map(y=>Math.abs(y)*px/pip)};
    });
    return {HDR,all,TF};
  }
  function applyF(all,f,key){
    const col=f.col,sg=f.dir==='desc'?-1:1;
    return all.filter(x=>f.grp==='all'||x.g===f.grp).sort((a,b)=>{
      if(col==='name')return sg*a.p.localeCompare(b.p);
      if(!a.r)return 1;if(!b.r)return -1;
      return sg*(Math.abs(a[key][+col])-Math.abs(b[key][+col]));});
  }
  function fbar(key,all,HDR,el,redraw){
    const f=st[key];
    el.innerHTML=`<div class="filters mk-grps">`+GRPS.map(([g,l])=>{
      const n=g==='all'?all.length:all.filter(x=>x.g===g).length;
      return `<button type="button" class="chip sm" data-g="${g}" aria-pressed="${f.grp===g}">${l} <span class="num">${n}</span></button>`;}).join('')+`</div>
      <div class="mk-sortbar"><label class="mk-sortl">Ordenar por
        <select class="gsel" data-col>${[{v:'name',l:'Instrumento'}].concat(HDR.map((l,i)=>({v:String(i),l}))).map(o=>`<option value="${o.v}"${o.v===f.col?' selected':''}>${esc(o.l)}</option>`).join('')}</select></label>
      <div class="filters"><button type="button" class="chip sm" data-d="desc" aria-pressed="${f.dir==='desc'}">Mayor a menor</button><button type="button" class="chip sm" data-d="asc" aria-pressed="${f.dir==='asc'}">Menor a mayor</button></div></div>`;
    el.querySelectorAll('[data-g]').forEach(b=>{b.onclick=()=>{st[key]=Object.assign({},f,{grp:b.dataset.g});save();redraw();};});
    el.querySelectorAll('[data-d]').forEach(b=>{b.onclick=()=>{st[key]=Object.assign({},f,{dir:b.dataset.d});save();redraw();};});
    el.querySelector('[data-col]').onchange=e=>{st[key]=Object.assign({},f,{col:e.target.value});save();redraw();};
  }
  function hcell(key,col,l){
    const f=st[key],on=f.col===col;
    return `<th class="mk-sh${on?' on':''}" data-h="${col}" role="button" tabindex="0">${esc(l)}${on?(f.dir==='desc'?' ↓':' ↑'):''}</th>`;
  }
  function wireH(key,tbl,redraw){
    tbl.querySelectorAll('[data-h]').forEach(th=>{
      const go=()=>{const f=st[key],col=th.dataset.h,on=f.col===col;
        st[key]=on?Object.assign({},f,{dir:f.dir==='desc'?'asc':'desc'}):Object.assign({},f,{col,dir:col==='name'?'asc':'desc'});save();redraw();};
      th.onclick=go;th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
  }
  function renderMatriz(){
    const {HDR,all,TF}=buildAll(),el=$('mk-matriz');
    const list=applyF(all,st.fmx,'v'),mxCol=st.fmx.col==='name'?-1:+st.fmx.col;
    const cols=[];list.forEach(x=>{if(x.r)x.v.forEach((y,i)=>{cols[i]=Math.max(cols[i]||0,Math.abs(y));});});
    el.innerHTML=`<p class="cap">${TF.label} · clic en una fila para abrir el instrumento.</p>
      <div id="mkFmx" class="mk-fbar"></div>
      <div class="scroll"><table class="mk-tbl" id="mkMxT"><thead><tr>${hcell('fmx','name','Instrumento')}<th>Último dato</th>${HDR.map((l,i)=>hcell('fmx',String(i),l)).join('')}</tr></thead><tbody>`+
      (list.length?list.map(x=>{
        const sel=x.p===st.pair;
        if(!x.r)return `<tr class="pick${sel?' sel':''}" data-p="${esc(x.p)}"><td><b>${esc(x.p)}</b></td><td class="num">Sin datos</td>${HDR.map(()=>'<td class="num">—</td>').join('')}</tr>`;
        const stale=ageDays(x.r.last[0])>TF.staleDays;
        return `<tr class="pick${sel?' sel':''}" data-p="${esc(x.p)}"><td><b>${esc(x.p)}</b></td><td class="num ${stale?'loss':'gain'}">${fdate(x.r.last[0])}</td>`+
          x.v.map((y,i)=>{const a=(0.06+0.34*Math.abs(y)/(cols[i]||1)).toFixed(3),t=i<3?'r':i<6?'g':'b';
            const bg=t==='r'?`color-mix(in srgb,var(--loss) ${(a*100).toFixed(0)}%,transparent)`:t==='g'?`color-mix(in srgb,var(--gain) ${(a*100).toFixed(0)}%,transparent)`:`color-mix(in srgb,var(--accent) ${(a*100).toFixed(0)}%,transparent)`;
            return `<td class="num ${t==='r'?'loss':t==='g'?'gain':''}" style="background:${bg};font-weight:${i===mxCol?700:500}">${fp(y)}</td>`;}).join('')+'</tr>';
      }).join(''):`<tr><td colspan="${HDR.length+2}">Sin instrumentos en este filtro.</td></tr>`)+
      `</tbody></table></div>
      <p class="cap">Intensidad del fondo = magnitud relativa dentro de cada columna. Clic en un encabezado para ordenar por esa columna.</p>`;
    fbar('fmx',all,HDR,$('mkFmx'),renderMatriz);
    wireH('fmx',$('mkMxT'),renderMatriz);
    $('mkMxT').querySelectorAll('tr.pick').forEach(tr=>{tr.onclick=()=>{st.pair=tr.dataset.p;save();render();};});
  }
  function renderPips(){
    const {HDR,all,TF}=buildAll(),el=$('mk-pips');
    const list=applyF(all,st.fpp,'pv'),ppCol=st.fpp.col==='name'?-1:+st.fpp.col;
    const nA=HDR.length-7;
    el.innerHTML=`<p class="cap">${TF.label} · distancia sobre el último cierre.</p>
      <div id="mkFpp" class="mk-fbar"></div>
      <div class="scroll"><table class="mk-tbl" id="mkPpT"><thead>
        <tr><th colspan="3"></th><th colspan="3">DoR · Stop C-C</th><th colspan="3">DoR · Target H-L</th><th colspan="${nA+1}">Rango y ATRP</th></tr>
        <tr>${hcell('fpp','name','Instrumento')}<th>Tipo</th><th>Unidad</th>${HDR.map((l,i)=>hcell('fpp',String(i),l)).join('')}</tr></thead><tbody>`+
      (list.length?list.map(x=>{
        const sel=x.p===st.pair,k=kind(x.p);
        if(!x.r)return `<tr class="pick${sel?' sel':''}" data-p="${esc(x.p)}"><td><b>${esc(x.p)}</b></td><td>Sin datos</td><td></td>${HDR.map(()=>'<td class="num">—</td>').join('')}</tr>`;
        return `<tr class="pick${sel?' sel':''}" data-p="${esc(x.p)}"><td><b>${esc(x.p)}</b></td><td>${GRPL[x.g]}</td><td>${k==='F'?'pips':k==='I'?'puntos':'USD'}</td>`+
          x.pv.map((y,i)=>`<td class="num ${i<3?'loss':i<6?'gain':''}" style="font-weight:${i===ppCol?700:500}${i===ppCol?';background:var(--accent-soft)':''}">${k==='C'?'$'+y.toFixed(y<10?2:1):Math.round(y).toLocaleString('es-MX')}</td>`).join('')+'</tr>';
      }).join(''):`<tr><td colspan="${HDR.length+3}">Sin instrumentos en este filtro.</td></tr>`)+
      `</tbody></table></div>
      <p class="cap">Distancias absolutas sobre el último cierre: SL = percentiles C-C 15/20/25 · TP = H-L con 60/65/70% de probabilidad · ATRP en los horizontes de la matriz. La columna resaltada es la que ordena la tabla.</p>`;
    fbar('fpp',all,HDR,$('mkFpp'),renderPips);
    wireH('fpp',$('mkPpT'),renderPips);
    $('mkPpT').querySelectorAll('tr.pick').forEach(tr=>{tr.onclick=()=>{st.pair=tr.dataset.p;save();render();};});
  }

  /* ---------- actualizar datos ---------- */
  function parseNum(v){
    if(typeof v==='number')return v;
    if(v==null)return NaN;
    let s=String(v).trim().replace(/[^\d,.\-]/g,'');
    if(!s)return NaN;
    if(s.indexOf(',')>=0&&s.indexOf('.')>=0){s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');}
    else if(s.indexOf(',')>=0)s=s.replace(',','.');
    return parseFloat(s);
  }
  const ymdOf=dt=>dt.getFullYear()*1e4+(dt.getMonth()+1)*100+dt.getDate();
  function parseDates(vals){
    let order=null;const re=/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/;
    vals.forEach(v=>{if(typeof v==='string'){const m=v.trim().match(re);if(m){if(+m[1]>12)order='DMY';else if(+m[2]>12&&!order)order='MDY';}}});
    order=order||'DMY';
    return vals.map(v=>{
      if(v instanceof Date&&!isNaN(v))return ymdOf(v);
      if(typeof v==='number'&&v>20000&&v<80000)return ymdOf(new Date(Math.round((v-25569)*864e5)+new Date().getTimezoneOffset()*6e4));
      if(typeof v==='number'&&v>19000000)return v;
      const s=String(v==null?'':v).trim();let m;
      if((m=s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/)))return +m[1]*1e4+ +m[2]*100+ +m[3];
      if((m=s.match(re))){let y=+m[3];if(y<100)y+=y>50?1900:2000;const a=+m[1],b=+m[2];return order==='DMY'?y*1e4+b*100+a:y*1e4+a*100+b;}
      const t=Date.parse(s);return isNaN(t)?null:ymdOf(new Date(t));});
  }
  function fromTable(aoa){
    for(let hr=0;hr<Math.min(aoa.length,15);hr++){
      const hd=(aoa[hr]||[]).map(x=>String(x==null?'':x).trim().toLowerCase());
      const find=(re,not)=>{for(let i=0;i<hd.length;i++)if(re.test(hd[i])&&!(not&&not.test(hd[i])))return i;return -1;};
      const cD=find(/date|fecha|time|^dia|^día/),cO=find(/^open|apertura|^abr/),cH=find(/^high|m[aá]x/),cL=find(/^low|m[ií]n/);
      let cC=find(/^(close|cierre|[uú]ltimo|price|precio)/,/adj/);if(cC<0)cC=find(/close|cierre/);
      if([cD,cO,cH,cL,cC].every(c=>c>=0)){
        const body=aoa.slice(hr+1).filter(r=>r&&r[cD]!=null&&r[cD]!=='');
        const ds=parseDates(body.map(r=>r[cD]));let out=[];
        body.forEach((r,i)=>{const o=parseNum(r[cO]),h=parseNum(r[cH]),l=parseNum(r[cL]),c=parseNum(r[cC]);
          if(ds[i]&&o>0&&h>0&&l>0&&c>0)out.push([ds[i],o,h,l,c]);});
        const seen=new Set();
        return out.filter(r=>{if(seen.has(r[0]))return false;seen.add(r[0]);return true;}).sort((a,b)=>b[0]-a[0]);
      }
    }
    return null;
  }
  function parseCSV(text){
    const first=text.split(/\r?\n/,1)[0];
    const delim=[';','\t',','].map(d=>[d,first.split(d).length]).sort((a,b)=>b[1]-a[1])[0][0];
    const rows=[];let row=[],f='',q=false;
    for(let i=0;i<text.length;i++){const ch=text[i];
      if(q){if(ch==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=ch;}
      else if(ch==='"')q=true;
      else if(ch===delim){row.push(f);f='';}
      else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f='';}
      else f+=ch;}
    if(f||row.length){row.push(f);rows.push(row);}
    return rows;
  }
  function handleFile(file){
    if(!file)return;
    up=Object.assign({},up,{pending:null,msg:'Leyendo '+file.name+'…',warn:false});renderDatos();
    const rd=new FileReader(),isX=/\.xlsx?$/i.test(file.name);
    if(isX&&!ensureXLSX()){loadXLSX().then(ok=>{if(ok)handleFile(file);else{up=Object.assign({},up,{msg:'No cargó el lector de Excel. Guarda el archivo como CSV y súbelo de nuevo.',warn:true});renderDatos();}});return;}
    rd.onerror=()=>{up=Object.assign({},up,{msg:'No se pudo leer el archivo. Vuelve a intentarlo.',warn:true});renderDatos();};
    rd.onload=()=>{
      let rows=null;
      try{
        if(isX){
          if(!ensureXLSX()){up=Object.assign({},up,{msg:'No cargó el lector de Excel. Guarda el archivo como CSV y súbelo de nuevo.',warn:true});renderDatos();return;}
          const wb=XLSX.read(new Uint8Array(rd.result),{type:'array',cellDates:true});
          for(let s=0;s<wb.SheetNames.length&&!rows;s++)rows=fromTable(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[s]],{header:1,raw:true}));
        }else rows=fromTable(parseCSV(rd.result));
      }catch(e){rows=null;}
      if(!rows||rows.length<10){
        up=Object.assign({},up,{msg:'No encontré columnas de Fecha, Apertura, Máximo, Mínimo y Cierre (o hay menos de 10 velas válidas). Revisa que la primera fila tenga esos encabezados.',warn:true});renderDatos();return;}
      const p={pending:rows,warn:false};
      const g=/([A-Z]{6})/.exec(file.name.toUpperCase());
      if(g&&allPairs().indexOf(g[1])>=0)p.pair=g[1];else if(g){p.pair='__new';p.newT=g[1];}
      const span=rows.length>1?Math.abs(ageDays(rows[0][0])-ageDays(rows[1][0])):0;
      p.tf=span>=25?'M':span>=5?'W':'DX';
      p.msg=rows.length.toLocaleString('es-MX')+' velas válidas del '+fdate(rows[rows.length-1][0])+' al '+fdate(rows[0][0])+'. Revisa instrumento y temporalidad, y pulsa Aplicar.';
      up=Object.assign({},up,p);renderDatos();
    };
    isX?rd.readAsArrayBuffer(file):rd.readAsText(file);
  }
  function applyUp(){
    if(!up.pending)return;
    let p=up.pair||st.pair;
    if(p==='__new'){p=(up.newT||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
      if(!p){up=Object.assign({},up,{msg:'Escribe el ticker del nuevo instrumento.',warn:true});renderDatos();return;}}
    const t=up.tf;ovr=Object.assign({},ovr);ovr[p]=Object.assign({},ovr[p]||{});
    if(t==='DX'){ovr[p].D=up.pending;ovr[p].W=VE.resample(up.pending,'W');ovr[p].M=VE.resample(up.pending,'M');}
    else ovr[p][t]=up.pending;
    let saved=true;try{store.set('mktovr',ovr);if(store.get('mktovr',null)===null)saved=false;}catch(e){saved=false;}
    memo={};ovrVer++;st.pair=p;if(t!=='DX')st.tf=t;save();
    up=Object.assign({},up,{pending:null,pair:p,
      msg:'Listo: '+p+' actualizado ('+(t==='DX'?'diario, semanal y mensual':VE.TF[t].label.toLowerCase())+').'+(saved?' Queda guardado en este navegador.':' No se pudo guardar en el navegador; se perderá al recargar.'),warn:false});
    render();
  }
  function resetUp(){
    const p=up.pair||st.pair;
    if(!ovr[p]){up=Object.assign({},up,{msg:'Este instrumento ya usa los datos originales.',warn:false});renderDatos();return;}
    ovr=Object.assign({},ovr);delete ovr[p];store.set('mktovr',ovr);memo={};ovrVer++;
    const orig=MKSEED.has(p,'D')||MKSEED.has(p,'W')||MKSEED.has(p,'M');
    if(!orig&&st.pair===p)st.pair=MKSEED.pairs()[0];
    save();
    up=Object.assign({},up,{msg:p+' volvió a los datos originales'+(orig?'.':' (era un instrumento nuevo, se eliminó).'),warn:false});
    render();
  }
  function renderDatos(){
    const el=$('mk-datos'),ps=allPairs(),cur=up.pair||st.pair;
    el.innerHTML=`<p class="cap">Solo cuando quieras refrescar un instrumento. Los datos que cargues se guardan únicamente en este navegador y no se envían a ningún servidor.</p>
      <div class="mk-drop" id="mkDrop" role="button" tabindex="0">
        <b>Arrastra tu archivo aquí</b>
        <span>CSV o Excel con Fecha, Apertura, Máximo, Mínimo y Cierre, o haz clic para elegir el archivo</span>
        <input type="file" id="mkFile" accept=".csv,.txt,.xlsx,.xls" hidden>
      </div>
      <div class="rp-form">
        <label>Instrumento<select class="gsel" id="mkUpPair">${ps.map(p=>`<option value="${esc(p)}"${p===cur?' selected':''}>${esc(p)}</option>`).join('')}<option value="__new"${cur==='__new'?' selected':''}>Nuevo instrumento…</option></select></label>
        ${cur==='__new'?`<label>Nuevo ticker<input type="text" id="mkUpNew" maxlength="12" placeholder="Ej. USDJPY, GER40, XPTUSD" value="${esc(up.newT)}"></label>`:''}
        <label>Los datos son<select class="gsel" id="mkUpTf">
          <option value="DX"${up.tf==='DX'?' selected':''}>Diarios → generar también semanal y mensual</option>
          <option value="D"${up.tf==='D'?' selected':''}>Diarios</option>
          <option value="W"${up.tf==='W'?' selected':''}>Semanales</option>
          <option value="M"${up.tf==='M'?' selected':''}>Mensuales</option></select></label>
      </div>
      <div class="filters"><button type="button" class="chip primary" id="mkApply"${up.pending?'':' disabled style="opacity:.4;cursor:not-allowed"'}>Aplicar</button><button type="button" class="chip" id="mkReset">Restaurar originales</button></div>
      <p class="note" ${up.warn?'style="color:var(--hot)"':''}>${esc(up.msg)}</p>
      <details class="mk-det"><summary>Incidencias detectadas en los archivos originales</summary><ul class="notes">${INCID.map(x=>`<li>${x}</li>`).join('')}</ul></details>`;
    const drop=$('mkDrop'),fi=$('mkFile');
    drop.onclick=()=>fi.click();
    drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fi.click();}};
    ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
    ['dragleave','dragend'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
    drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');handleFile(e.dataTransfer.files[0]);});
    fi.onchange=e=>{handleFile(e.target.files[0]);e.target.value='';};
    $('mkUpPair').onchange=e=>{up=Object.assign({},up,{pair:e.target.value});renderDatos();};
    const nw=$('mkUpNew');if(nw)nw.oninput=e=>{up.newT=e.target.value;};
    $('mkUpTf').onchange=e=>{up=Object.assign({},up,{tf:e.target.value});};
    $('mkApply').onclick=applyUp;
    $('mkReset').onclick=resetUp;
  }

  /* ---------- orquestador ---------- */
  function render(){
    if(allPairs().indexOf(st.pair)<0)st.pair=MKSEED.pairs()[0];
    renderControls();
    const R=comp(st.pair,st.tf,st.ex);
    renderHero(R);
    $('mkTabs').innerHTML=TABS.map(([id,l])=>`<button class="tab" role="tab" type="button" id="mktab-${id}" aria-selected="${st.tab===id}">${l}</button>`).join('');
    TABS.forEach(([id])=>{$('mktab-'+id).onclick=()=>{st.tab=id;save();render();};$('mk-'+id).hidden=st.tab!==id;});
    const T=st.tab;
    if(T==='niveles')renderNiveles(R);
    else if(T==='atrp')renderAtrp(R);
    else if(T==='cc')renderHist(R,'cc','mk-cc');
    else if(T==='hl')renderHist(R,'hl','mk-hl');
    else if(T==='pct')renderPct(R);
    else if(T==='matriz')renderMatriz();
    else if(T==='pips')renderPips();
    else if(T==='datos')renderDatos();
  }
  return {render,state:()=>st};
})();

let dorMode=store.get('dormode','macro');
function renderDorSec(){
  chipset($('fDorMode'),[{id:'macro',label:'Datos macroeconómicos'},{id:'mercados',label:'Mercados'}],dorMode,id=>{dorMode=id;store.set('dormode',id);renderDorSec();});
  $('dorMacro').classList.toggle('on',dorMode==='macro');
  $('dorMkt').classList.toggle('on',dorMode==='mercados');
  if(dorMode==='macro')renderDor();else MK.render();
}

// ---------- Navegación por secciones ----------
const VIEWS={resumen:renderSummary,cuantitativo:renderScore,ciclo:renderCycle,catalizador:renderCatalyst,modelos:renderModels,distribucion:renderDorSec,graficos:renderCharts,carry:renderCarry,vol:renderVol,estacional:renderSeas,posicion:renderPos,tv:renderTV};
let view=null;
function show(id,hash=true){
  if(!VIEWS[id])id='resumen';
  view=id;store.set('view',id);
  document.querySelectorAll('main>section').forEach(s=>{const on=s.id===id;s.classList.toggle('view',on);s.classList.toggle('on',on);});
  document.querySelectorAll('nav.menu a').forEach(a=>{const on=a.getAttribute('href')==='#'+id;a.classList.toggle('on',on);if(on)a.scrollIntoView({block:'nearest',inline:'center'});});
  if(hash){try{history.replaceState(null,'','#'+id);}catch(e){}}
  try{VIEWS[id]();}catch(e){console.error(e);}
  try{window.scrollTo(0,0);}catch(e){}
}
function wireNav(){
  document.querySelectorAll('nav.menu a').forEach(a=>{a.onclick=e=>{e.preventDefault();show(a.getAttribute('href').slice(1));};});
  window.addEventListener('hashchange',()=>show((location.hash||'').slice(1),false));
  const top=$('top'),prog=$('prog'),totop=$('totop');
  const onScroll=()=>{const h=document.documentElement,max=h.scrollHeight-h.clientHeight,y=h.scrollTop;prog.style.width=(max>0?y/max*100:0)+'%';top.classList.toggle('scrolled',y>8);totop.classList.toggle('away',y<600);};
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  totop.onclick=()=>window.scrollTo({top:0});
  document.addEventListener('pointermove',e=>{const p=e.target.closest&&e.target.closest('.panel');if(!p)return;const r=p.getBoundingClientRect();p.style.setProperty('--mx',(e.clientX-r.left)+'px');p.style.setProperty('--my',(e.clientY-r.top)+'px');},{passive:true});
}
function renderAll(){show(view||(location.hash||'').slice(1)||store.get('view','resumen'),false);}
renderAll();wireNav();setInterval(()=>{if(view==='catalizador')renderCatalyst();},60000);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',renderAll);
new MutationObserver(renderAll).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
