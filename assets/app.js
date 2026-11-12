
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
  const cp=S.cycproj,des=(cp.acc<0?cp.h['3'].dist2.DES:cp.h['3'].dist.DES)||0;
  const t=(k,v,n,cls='')=>`<div class="st"><span class="k">${k}</span><b class="${cls}">${v}</b><span class="n">${n}</span></div>`;
  $('idea').innerHTML=`<span class="tag">Sesgo TFX</span><div class="sesgo">`+
    t('Régimen proyectado',projLab(sb.lead),`Líderes ${sg(sb.lead)} · catalizadores ${sg(sb.coin)}: ${dir}. Ciclo: ${Math.round(des*100)}% de pasar a desaceleración en 3 meses.`)+
    t('Sentimiento',fedSent(c),`Proyectado: ${fedSent(sb.lead).toLowerCase()}.`)+
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
  const row=(r,tag)=>`<tr><td><b>${r.name}</b>${tag?`<span class="side L" style="margin-left:8px">${r.block}</span>`:''}<span class="sub">${r.what}</span></td><td class="num">${r.val}<span class="sub">${r.date}${staleTag(r)}</span></td>
    <td class="rule"><span class="th0">Estable</span> ${r.stable}<br><span class="th1">Calienta</span> ${r.hot}<br><span class="th2">Enfría</span> ${r.cold}</td><td class="num"><span class="pts ${ptsCls(r.pts)}">${ptsTxt(r.pts)}</span></td></tr>`;
  const bs=B.filter(b=>SD[b]===fScore),rows=S.rows.filter(r=>bs.includes(r.block)),sv=fScore==='Rezagado'?null:S.sub[fScore==='Líder'?'lead':'coin'];
  const STL={hot:'Calienta',cold:'Enfría',flat:'Estable'},GI={'Componentes ISM':'Componentes ISM · informativos: el PMI y el NMI ya los incluyen','Empleo':'Empleo · informativo: ADP no tiene tabla TFX','PIB':'PIB · rezagado: confirma el ciclo, no suma al puntaje'};
  const irow=r=>`<tr class="info"><td><b>${r.name}</b><span class="side C">${r.pts!=null?'no pondera':'informativo'}</span><span class="sub">${r.what}</span></td><td class="num">${r.val}<span class="sub">${r.prev} · ${r.date}${staleTag(r)}</span></td>
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
  const cp=S.cycproj,per=p=>p?' · '+refLab(p):'';
  $('cycleFacts').innerHTML=f('OECD CLI · '+last.d,cy.vals.at(-1).toFixed(2),`${last.y>=0?'Sube':'Baja'} ${Math.abs(last.y).toFixed(3)} pts/mes. ${cp.acc<0?'El impulso se modera.':'El impulso se acelera.'}`)+
    f('Fase actual',`${cy.run} meses`,`Duración promedio de la ${PHN[cy.phase].toLowerCase()}: ${cy.avgdur[cy.phase].toFixed(1)} meses.`)+
    f('LEI Conference Board · 6m',`${sg(cy.lei_6m,1)}%`,cy.lei_6m_prev!=null?`Previo ${sg(cy.lei_6m_prev,1)}%${per(cy.lei_periodo)}.`:`Dato${per(cy.lei_periodo)}.`)+
    (cy.cei_6m!=null?f('Índice coincidente · 6m',`${sg(cy.cei_6m,1)}%`,`La actividad actual ${cy.cei_6m>=0?'crece':'se contrae'}${per(cy.cei_periodo)}.`):'');
  const cols={EXP:'var(--hot)',DES:'var(--accent)',CON:'var(--cool)',REC:'var(--muted)'};
  $('phases').innerHTML=['EXP','DES','CON','REC'].map(p=>`<div class="ph ${p===cy.phase?'cur':''}"><span>${PHN[p]}${p===cy.phase?' · actual':''}</span><div class="b"><i style="width:${(cy.freq[p]*100/0.35).toFixed(0)}%;background:${cols[p]}"></i></div><span class="t">${pct(cy.freq[p])} · ${cy.avgdur[p].toFixed(1)}m</span></div>`).join('');
  // Sentimiento, Dólar y Régimen (S.regime_mkt) stay hidden until the market-regime rules are defined (docs/decisions.md).
  const [pp,ppv]=projPhase();
  const it=(k,v,n)=>`<div><span class="k">${k}</span><b>${v}</b><i>${n}</i></div>`;
  $('cycProj').innerHTML=it('Proyección',PHN[pp],`${Math.round(ppv*100)}% · 3 meses`)
    +(cp.rem_med!=null?it('Tiempo',`~${cp.rem_med.toFixed(0)} meses`,`rango ${cp.rem_q[0].toFixed(0)}–${cp.rem_q[1].toFixed(0)}`):'');
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
    $('cpiCtx').textContent=nm?`${CATN[nm.key]} ${nm.ref} · ${fDate(nm.t)}, ${fTime(nm.t)} ${TZN()}. ${S.nc_asof?'El modelo de este dato se calcula al publicarse el dato previo.':'El nowcast de este dato todavía no se recalcula solo; la agenda, el consenso y los resultados sí se actualizan.'}`:'Sin catalizadores con modelo en el calendario.';
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
// Projections are hidden until their rules are defined with the owner (docs/decisions.md); S.proj is kept but unused.
const PRJ={},ROLES=['Líder','Coincidente','Rezagado'];
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
    // proyección oculta (ver PRJ)
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
let po=Object.assign({p:'EURUSD',w:'5',nb:52,tf:'D',ix:52,tab:'rel',cmp:'mapa',cc:'b'},store.get('po',{})),poC={};
const POIX=[[26,'26 sem'],[52,'52 sem'],[156,'3 años']];
const POW=[['1','1 año'],['3','3 años'],['5','5 años'],['10','10 años'],['all','Todo']];
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
// Pestañas del gráfico principal y de la comparación entre divisas.
const POTABS=[['rel','Posición vs precio'],['ix','Índice COT'],['fl','Flujo semanal'],['am','Fondos vs gestores'],['ls','Largo / corto'],['net','Neto / OI'],['px','Precio'],['div','Fondos vs cuentas pequeñas']];
const POCMP=[['mapa','Mapa de saturación'],['tabla','Todas las divisas'],['fw','Después de extremos']];
let poOpen={main:false,cmp:false,guide:false};
// Zoom y desplazamiento: rueda solo con Ctrl para no secuestrar el scroll de la página.
function poZoom(mode){
  const lim={x:{min:'original',max:'original'}};if(mode==='xy')lim.y={min:'original',max:'original'};
  return {zoom:{wheel:{enabled:true,modifierKey:'ctrl'},pinch:{enabled:true},mode},pan:{enabled:true,mode},limits:lim};
}
// Mini gráfico de línea en SVG (últimos informes), con la línea de cero si cae dentro del rango.
function poSpark(v){
  const W=140,H=36,a=v.filter(x=>x!=null);if(a.length<2)return '';
  const mn=Math.min(...a,0),mx=Math.max(...a,0),r=mx-mn||1,X=i=>(i/(v.length-1)*W).toFixed(1),Y=x=>(H-2-(x-mn)/r*(H-4)).toFixed(1);
  const d=v.map((x,i)=>`${i?'L':'M'}${X(i)} ${Y(x)}`).join(' '),last=v[v.length-1];
  return `<svg class="po-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" class="z"></line>`
    +`<path d="${d}" class="${last>=0?'up':'dn'}"></path><circle cx="${X(v.length-1)}" cy="${Y(last)}" r="2.6" class="${last>=0?'up':'dn'}"></circle></svg>`;
}
// Barra partida largo/corto.
const poSplit=(lab,shL)=>`<div class="po-srow"><span class="po-sc">${lab}</span><div class="po-split" role="img" aria-label="${lab}: ${shL.toFixed(0)}% largo, ${(100-shL).toFixed(0)}% corto"><i class="l" style="width:${shL.toFixed(1)}%"></i><i class="s"></i></div><span class="po-sp"><b class="gain">${shL.toFixed(0)}%</b> / <b class="loss">${(100-shL).toFixed(0)}%</b></span></div>`;
// Medidor 0–100 con zonas de saturación.
const poGauge=v=>`<div class="po-gauge" role="img" aria-label="Índice ${v==null?'sin dato':Math.round(v)} de 100"><i class="zl"></i><i class="zh"></i>${v==null?'':`<b style="left:${Math.max(0,Math.min(100,v))}%"></b>`}</div><div class="po-gl"><span>0</span><span>20</span><span>80</span><span>100</span></div>`;
function poInfoWire(btn,box,key,html){
  const b=$(btn),x=$(box);x.innerHTML=html;x.hidden=!poOpen[key];b.setAttribute('aria-expanded',String(poOpen[key]));
  b.onclick=()=>{poOpen[key]=!poOpen[key];x.hidden=!poOpen[key];b.setAttribute('aria-expanded',String(poOpen[key]));};
}
function renderPos(){
  const Z=S.pos;if(!Z)return;
  const C=Z.ccy,sv=()=>store.set('po',po),PL=poPairs(),pro=isPro();
  if(!PL.length)return;
  if(PL.indexOf(po.p)<0)po.p=PL.indexOf('EURUSD')>=0?'EURUSD':PL[0];
  if(!POIX.some(x=>x[0]===po.ix))po.ix=52;
  if(!POTABS.some(t=>t[0]===po.tab))po.tab='rel';
  if(!POCMP.some(t=>t[0]===po.cmp))po.cmp='mapa';
  if(po.cc!=='q')po.cc='b';
  const b=po.p.slice(0,3),q=po.p.slice(3),B=C[b],Q=C[q],re=()=>{sv();renderPos();};
  const pickCcy=c=>{const hit=PL.find(p=>p.slice(0,3)===c&&p.slice(3)==='USD')||PL.find(p=>p.slice(0,3)===c)||PL.find(p=>p.slice(3)===c);if(hit){po.p=hit;re();}};
  // El informe es del martes y se publica el viernes; tras un viernes sin publicar (+ margen de festivo) se marca.
  const Zm=Z.meta||{},age=Math.floor((Date.now()-Date.parse(Z.asof+'T00:00:00Z'))/864e5);
  $('poStamp').innerHTML=`Informe del ${Z.asof}`+(Zm.next_publish_est?` · próximo ≈ ${Zm.next_publish_est}`:'')
    +(age>13?' · <b style="color:var(--loss)">desactualizado</b>':'');
  $('poPair').innerHTML=PL.map(p=>`<option value="${p}"${p===po.p?' selected':''}>${p}</option>`).join('');
  $('poPair').onchange=e=>{po.p=e.target.value;re();};
  chipset($('poQuick'),['EURUSD','GBPUSD','AUDUSD','USDJPY','EURJPY','EURGBP'].filter(x=>PL.indexOf(x)>=0).map(x=>({id:x,label:x})),po.p,id=>{po.p=id;re();},'chip sm');
  chipset($('poWin'),POW.map(([k,l])=>({id:k,label:l})),po.w,id=>{po.w=id;re();},'chip sm');

  const g=css('--gain'),l=css('--loss'),mu=css('--muted'),ac=css('--accent'),ln=css('--line'),ink=css('--ink');
  Object.values(poC).forEach(c=>c&&c.destroy());poC={};

  // ---- cálculos del par ----
  const A=poAlign(B,Q),nA=A.d.length,ix=poIndex(A.rel,po.ix),ixw=POIX.find(x=>x[0]===po.ix)[1],P=poPx(po.p);
  const relNow=A.rel[nA-1],ixNow=ix[nA-1],fl4=+(relNow-A.rel[nA-5]).toFixed(2),fl1=+(relNow-A.rel[nA-2]).toFixed(2);
  const zone=ixNow>=80?'hi':ixNow<=20?'lo':'mid';
  const read=zone==='hi'?(fl4<0?['lo','Compra saturada y saliendo',`Los fondos venden ${b} desde un extremo comprador: los cierres pueden acelerar una caída del par.`]
                                :['md','Compra saturada, aún comprando','La tendencia sigue alimentada, pero queda poco comprador nuevo: si gira, suele ser brusco. Tamaño menor.'])
    :zone==='lo'?(fl4>0?['hi','Venta saturada y cubriendo',`Los fondos recompran ${b} desde un extremo vendedor: la cobertura de cortos puede impulsar al par.`]
                        :['md','Venta saturada, aún vendiendo','La presión vendedora sigue, pero queda poco vendedor nuevo: cuidado con rebotes violentos. Tamaño menor.'])
    :['md','Sin extremo','El posicionamiento no limita al par en ninguna dirección: manda el flujo y el resto del análisis macro.'];
  const fav=v=>v>0?b:v<0?q:'nadie',wl=(POW.find(w=>w[0]===po.w)||['','5 años'])[1].toLowerCase(),wlab=po.w==='all'?'toda la muestra':wl;
  const sgp=(v,d=1)=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(d);

  // ---- resumen en 10 segundos ----
  const amNow=A.am[nA-1],hasAm=amNow!=null;
  const t4=hasAm
    ?(()=>{const same=Math.sign(amNow)===Math.sign(relNow)&&relNow!==0;
      return `<div class="po-tile"><span class="po-tk">¿Fondos y gestores coinciden?</span><div class="po-tv ${same?'':'warm'}">${same?'Coinciden':'Divergen'}</div>`
        +`<div class="po-vs"><span><i class="dot ac"></i>Fondos rápidos → <b>${fav(relNow)}</b></span><span><i class="dot mu"></i>Gestores de largo plazo → <b>${fav(amNow)}</b></span></div>`
        +`<span class="po-tn">${same?'Ambos empujan hacia el mismo lado.':'Cada grupo apuesta a un lado distinto.'}</span></div>`;})()
    :(()=>{const d=B.now.shL-B.now.nshL;
      return `<div class="po-tile"><span class="po-tk">Fondos vs cuentas pequeñas · ${b}</span><div class="po-tv">${sgp(d,0)} pts</div>`
        +poSplit('Fondos',B.now.shL)+poSplit('Peq.',B.now.nshL)+`<span class="po-tn">Diferencia en % largo.</span></div>`;})();
  const sp=A.rel.slice(Math.max(0,nA-13));
  $('poHero').innerHTML=
    `<div class="po-verdict"><span class="poex ${read[0]}">${read[1]}</span><p><b>${po.p}.</b> ${read[2]}</p>`
    +`<button type="button" class="po-ib" id="poGuideBtn" aria-expanded="false" aria-controls="poGuide"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7h.01"></path></svg><span>¿Qué es el COT?</span></button></div>`
    +`<div class="po-info" id="poGuide" hidden></div>`
    +`<div class="po-tiles">`
    +`<div class="po-tile"><span class="po-tk">¿A qué apuestan los fondos?</span><div class="po-tv ${relNow>0?'gain':relNow<0?'loss':''}">${fav(relNow)}</div>`
      +poSplit(b,B.now.shL)+poSplit(q,Q.now.shL)+`<span class="po-tn">% de contratos largos / cortos de cada divisa.</span></div>`
    +`<div class="po-tile"><span class="po-tk">¿Qué tan extremo? · ${ixw}</span><div class="po-tv">${ixNow==null?'—':Math.round(ixNow)}<small>/100</small></div>${poGauge(ixNow)}`
      +`<span class="po-tn">${zone==='hi'?'Compra saturada (≥ 80).':zone==='lo'?'Venta saturada (≤ 20).':'Dentro del rango normal (20–80).'}</span></div>`
    +`<div class="po-tile"><span class="po-tk">¿Entran o salen? · 4 semanas</span><div class="po-tv ${fl4>0?'gain':fl4<0?'loss':''}">${fl4>0?'▲':fl4<0?'▼':'■'} ${sgp(fl4,2)}<small> pp</small></div>${poSpark(sp)}`
      +`<span class="po-tn">${fl4>0?`Entran compras de ${b}`:fl4<0?`Entran ventas de ${b}`:'Sin cambio'} · última semana ${sgp(fl1,2)} pp.</span></div>`
    +t4+`</div>`;
  poInfoWire('poGuideBtn','poGuide','guide',
    `<ul><li><b>Qué es.</b> El informe COT de la CFTC: cuántos contratos de futuros tiene cada tipo de participante. Posiciones del martes, publicadas el viernes 15:30 (Nueva York).</li>`
    +`<li><b>A quién seguimos.</b> <i>Leveraged Funds</i>: hedge funds y CTA, el dinero especulativo.</li>`
    +`<li><b>Cómo se mide.</b> Neto (largos − cortos) ÷ contratos abiertos, para comparar divisas de distinto tamaño. El dólar usa el contrato USD Index.</li>`
    +`<li><b>Cómo usarlo.</b> Un extremo no es una señal de entrada: avisa que queda poco combustible de ese lado. Cambia el tamaño de la posición, no la dirección.</li></ul>`);

  // ---- gráfico principal en pestañas ----
  $('poTabs').innerHTML=POTABS.map(([id,lb])=>`<button class="tab" role="tab" type="button" data-t="${id}" aria-selected="${po.tab===id}"${id==='am'&&!hasAm?' disabled title="Sin datos de Asset Managers"':''}>${lb}</button>`).join('');
  $('poTabs').querySelectorAll('[data-t]').forEach(x=>x.onclick=()=>{po.tab=x.dataset.t;re();});
  const yrsW=po.w==='all'?0:+po.w,kW=yrsW?Math.min(yrsW*52,nA):nA,w0=nA-kW,lbW=A.d.slice(w0).map(poFmtD);
  const X=po.cc==='q'?Q:B,cc=X.ccy,ccOpts=()=>chipset($('poOpts'),[{id:'b',label:b},{id:'q',label:q}],po.cc,id=>{po.cc=id;re();},'chip sm');
  const xs={grid:{display:false},ticks:{color:mu,maxTicksLimit:9,autoSkip:true,maxRotation:0}};
  const opt=(o,mode='x')=>Object.assign({responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false}},o,
    {plugins:Object.assign({legend:{labels:{color:mu,boxWidth:12}}},o.plugins||{},{zoom:poZoom(mode)})});
  $('poOpts').innerHTML='';$('poExtra').innerHTML='';
  let T='',Sb='',I='',cfg=null;
  switch(po.tab){
    case 'rel':{
      const pxW=A.d.slice(w0).map(d=>{if(!P)return null;const e=P.at(poMs(d));return e<0||P.t[e]-poMs(d)>4*864e5?null:P.px[e][4];});
      const rv=A.rel.slice(w0);
      T='Posición de los fondos vs precio';Sb=`${po.p} · ${wlab} · hoy ${sgp(relNow,2)} pp a favor de ${fav(relNow)}`;
      I=`<p><b>Barras verdes:</b> los fondos apuestan a favor de ${b}. <b>Rojas:</b> a favor de ${q}. La línea es el precio (eje derecho).</p>`
        +`<p><b>Lo que buscas:</b> barras que se estiran mientras el precio ya no avanza. Suele anticipar agotamiento.</p>`
        +(A.mode==='cross'?`<p class="po-mut">En cruces es la diferencia: neto/OI de ${b} menos el de ${q}.</p>`:A.mode==='quote'?`<p class="po-mut">Usa el contrato de ${q} con el signo invertido para leerlo en el sentido del par.</p>`:'');
      cfg={type:'bar',data:{labels:lbW,datasets:[
        {type:'bar',label:poRelLab(A,b,q),data:rv,backgroundColor:rv.map(x=>x>=0?g:l),borderWidth:0,barPercentage:1,categoryPercentage:.92,yAxisID:'y',order:2},
        {type:'line',label:po.p,data:pxW,borderColor:ink,borderWidth:1.6,pointRadius:0,spanGaps:true,yAxisID:'y2',order:1}]},
        options:opt({plugins:{tooltip:{callbacks:{label:i=>i.dataset.type==='bar'?`${i.dataset.label} ${i.raw>0?'+':''}${i.raw} pp`:`${po.p} ${i.raw}`}}},
          scales:{x:xs,y:{grid:{color:ln},ticks:{color:mu,callback:v=>v+' pp'}},y2:{position:'right',grid:{display:false},ticks:{color:mu}}}})};
      if(!P)Sb+=' · sin serie de precios';
      break;}
    case 'ix':{
      chipset($('poOpts'),POIX.map(([k,lb])=>({id:String(k),label:'Ventana '+lb})),String(po.ix),id=>{po.ix=+id;re();},'chip sm');
      T='Índice COT (0–100)';Sb=`${po.p} · ventana ${ixw} · hoy ${ixNow==null?'—':Math.round(ixNow)}`;
      I=`<p>Ubica la posición de hoy dentro de su rango de la ventana elegida: 0 = la más vendida, 100 = la más comprada.</p>`
        +`<p><b>Zona verde (≥ 80):</b> compra saturada. <b>Zona roja (≤ 20):</b> venta saturada. Un extremo no da el momento: avisa que queda poco combustible de ese lado.</p>`;
      cfg={type:'line',data:{labels:lbW,datasets:[{label:'Índice COT',data:ix.slice(w0),borderColor:ac,borderWidth:1.8,pointRadius:0,fill:false,spanGaps:false}]},
        plugins:[POBANDS],options:opt({plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`Índice COT ${i.raw}`}}},
          scales:{x:xs,y:{min:0,max:100,grid:{color:ln},ticks:{color:mu,stepSize:20}}}})};
      break;}
    case 'fl':{
      const k0=Math.max(5,w0),fd=[],fs=[];
      for(let j=k0;j<nA;j++){fd.push(+(A.rel[j]-A.rel[j-1]).toFixed(2));fs.push(+(A.rel[j]-A.rel[j-4]).toFixed(2));}
      T='Flujo semanal';Sb=`${po.p} · ${wlab} · 4 semanas ${sgp(fl4,2)} pp`;
      I=`<p><b>Barras:</b> cuánto cambió la posición cada semana (verde = compran ${b}, rojo = venden).</p>`
        +`<p><b>Línea:</b> suma de 4 semanas, la tendencia del flujo. Importa la dirección reciente, no una semana suelta.</p>`;
      cfg={type:'bar',data:{labels:A.d.slice(k0).map(poFmtD),datasets:[
        {type:'bar',label:'Cambio semanal',data:fd,backgroundColor:fd.map(x=>x>=0?g:l),borderWidth:0,order:2},
        {type:'line',label:'Acumulado 4 semanas',data:fs,borderColor:ink,borderWidth:1.6,pointRadius:0,order:1}]},
        options:opt({plugins:{tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw>0?'+':''}${i.raw} pp`}}},
          scales:{x:xs,y:{grid:{color:ln},ticks:{color:mu,callback:v=>v+' pp'}}}})};
      break;}
    case 'am':{
      T='Fondos rápidos vs gestores de largo plazo';Sb=`${po.p} · ${wlab}`;
      I=`<p><b>Leveraged Funds</b> (hedge funds, CTA): dinero rápido. <b>Asset Managers</b> (fondos de inversión, pensiones): dinero de largo plazo.</p>`
        +`<p>Si las dos líneas van hacia el mismo lado, el flujo es más amplio. Arriba de cero = a favor de ${b}.</p>`;
      if(hasAm)cfg={type:'line',data:{labels:lbW,datasets:[
        {label:'Leveraged Funds',data:A.rel.slice(w0),borderColor:ac,borderWidth:1.8,pointRadius:0,fill:false},
        {label:'Asset Managers',data:A.am.slice(w0),borderColor:mu,borderWidth:1.6,borderDash:[5,3],pointRadius:0,fill:false}]},
        options:opt({plugins:{tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw>0?'+':''}${i.raw} pp`}}},
          scales:{x:xs,y:{grid:{color:ln},ticks:{color:mu,callback:v=>v+' pp'}}}})};
      else Sb='Sin datos de Asset Managers en este archivo.';
      break;}
    case 'ls':{
      ccOpts();
      const k=Math.min(kW,X.d.length),i0=X.d.length-k,sl=X.shL.slice(i0);
      T=`Largos vs cortos · ${cc}`;Sb=`${X.name} · ${wlab} · hoy ${X.now.shL.toFixed(0)}% largo`;
      I=`<p>Cada barra suma 100%: <b>verde</b> = % de contratos largos, <b>rojo</b> = cortos. La línea punteada marca el 50%.</p>`
        +`<p>Mientras más lejos del 50%, más cargado está un lado.</p>`;
      cfg={type:'bar',data:{labels:X.d.slice(i0).map(poFmtD),datasets:[
        {label:'Largo',data:sl,backgroundColor:g,borderWidth:0,stack:'a',barPercentage:1,categoryPercentage:1},
        {label:'Corto',data:sl.map(v=>+(100-v).toFixed(2)),backgroundColor:l,borderWidth:0,stack:'a',barPercentage:1,categoryPercentage:1}]},
        plugins:[PO50],options:opt({plugins:{tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw.toFixed(1)}%`}}},
          scales:{x:Object.assign({stacked:true},xs),y:{stacked:true,min:0,max:100,grid:{color:ln},ticks:{color:mu,callback:v=>v+'%'}}}})};
      break;}
    case 'net':{
      ccOpts();
      const k=Math.min(kW,X.d.length),i0=X.d.length-k,v=X.npoi.slice(i0),st=X.st[po.w]||X.st['5'];
      T=`Neto sobre interés abierto · ${cc}`;Sb=`${X.name} · ${wlab} · mín ${st.mn}% · máx ${st.mx}% · hoy ${sgp(X.now.npoi,1)}%`;
      I=`<p>Neto (largos − cortos) dividido entre todos los contratos abiertos. Permite comparar divisas de distinto tamaño.</p>`
        +`<p><b>Positivo:</b> los fondos apuestan a que ${cc} sube. <b>Negativo:</b> a que baja.</p>`;
      cfg={type:'bar',data:{labels:X.d.slice(i0).map(poFmtD),datasets:[{label:'Neto / OI',data:v,backgroundColor:v.map(x=>x>=0?g:l),borderWidth:0,barPercentage:1,categoryPercentage:.92}]},
        options:opt({plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`${i.raw>0?'+':''}${i.raw}% del interés abierto`}}},
          scales:{x:xs,y:{grid:{color:ln},ticks:{color:mu,callback:x=>x+'%'}}}})};
      break;}
    case 'px':{
      const tfs=POTF.filter(([k])=>typeof MKSEED!=='undefined'&&MKSEED.has(po.p,k));
      if(tfs.length&&!tfs.some(t=>t[0]===po.tf))po.tf=tfs[0][0];
      chipset($('poOpts'),tfs.map(([k,lb])=>({id:k,label:lb})),po.tf,id=>{po.tf=id;re();},'chip sm');
      const raw=(typeof MKSEED!=='undefined'&&MKSEED.get(po.p,po.tf))||null,rows=raw?raw.slice().reverse():null;
      T=`Precio · ${po.p}`;
      I=`<p>Cierre del par en el mismo horizonte que el posicionamiento.</p><p>Compáralo con <b>Posición vs precio</b>: ¿el precio confirma lo que hacen los fondos?</p>`;
      if(rows&&rows.length){
        const lim=yrsW?{D:yrsW*260,W:yrsW*52,M:yrsW*12}[po.tf]:rows.length,r=rows.slice(Math.max(0,rows.length-lim)),a=r[0][4],z=r[r.length-1][4];
        Sb=`${poFmtD(r[0][0])} a ${poFmtD(r[r.length-1][0])} · ${a} → ${z} (${sgp((z/a-1)*100,1)}%)`;
        cfg={type:'line',data:{labels:r.map(x=>poFmtD(x[0])),datasets:[{label:po.p,data:r.map(x=>x[4]),borderColor:ac,borderWidth:1.8,pointRadius:0,fill:false,tension:.02}]},
          options:opt({plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`${po.p} ${i.raw}`}}},
            scales:{x:xs,y:{position:'right',grid:{color:ln},ticks:{color:mu}}}})};
      }else Sb=`No hay serie de precios cargada para ${po.p}.`;
      break;}
    case 'div':{
      const kk=Math.min(kW,B.d.length),j0=B.d.length-kk,dv=B.now.shL-B.now.nshL;
      T=`Fondos vs cuentas pequeñas · ${b}`;Sb=`Hoy: fondos ${B.now.shL.toFixed(0)}% largos · cuentas pequeñas ${B.now.nshL.toFixed(0)}% · diferencia ${sgp(dv,0)} pts`;
      I=`<p><b>Cuentas pequeñas:</b> las que quedan bajo el umbral de reporte de la CFTC. No es el sentimiento de un bróker, pero es lo más cercano al trader minorista dentro del informe.</p>`
        +`<p>Una separación grande indica que cada grupo apuesta a un lado distinto.</p>`;
      cfg={type:'line',data:{labels:B.d.slice(j0).map(poFmtD),datasets:[
        {label:`Leveraged Funds · % largo`,data:B.shL.slice(j0),borderColor:ac,borderWidth:2,pointRadius:0,fill:false},
        {label:`Cuentas pequeñas · % largo`,data:B.nshL.slice(j0),borderColor:mu,borderWidth:1.6,borderDash:[5,3],pointRadius:0,fill:false}]},
        plugins:[PO50],options:opt({plugins:{tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw.toFixed(1)}%`}}},
          scales:{x:xs,y:{grid:{color:ln},ticks:{color:mu,callback:v=>v+'%'}}}})};
      const row=(n,L,S2,sh,net,npoi,dn)=>`<tr><td><b>${n}</b></td>${pro?`<td class="num pop">${L.toLocaleString('es-MX')}</td><td class="num pop">${S2.toLocaleString('es-MX')}</td>`:''}<td class="num pop">${sh.toFixed(1)}%</td>`
        +`${pro?`<td class="num pop ${net>0?'gain':'loss'}">${net.toLocaleString('es-MX')}</td>`:''}<td class="num pop ${npoi>0?'gain':'loss'}">${npoi.toFixed(2)}%</td><td class="num pop">${poSg(dn)}</td></tr>`;
      $('poExtra').innerHTML=`<div class="scroll"><table id="poDivT"><thead><tr><th>${b} · categoría</th>${pro?'<th class="num">Largos</th><th class="num">Cortos</th>':''}<th class="num">% largo</th>${pro?'<th class="num">Neto</th>':''}<th class="num">Neto / OI</th><th class="num">Cambio semanal</th></tr></thead><tbody>`
        +row('Leveraged Funds',B.now.L,B.now.S,B.now.shL,B.now.net,B.now.npoi,B.now.dnet)
        +row('Cuentas pequeñas',B.now.nL,B.now.nS,B.now.nshL,B.now.nnet,B.now.nnpoi,B.now.dnnet)+'</tbody></table></div>';
      break;}
  }
  $('poChT').textContent=T;$('poChS').textContent=Sb;
  poInfoWire('poInfoBtn','poInfo','main',I);
  const big=$('poCv').parentNode;big.hidden=!cfg;
  if(cfg&&window.Chart)poC.main=new Chart($('poCv'),cfg);
  const zb=(f)=>()=>{const c=poC.main;if(c&&c.zoom)f(c);};
  $('poZin').onclick=zb(c=>c.zoom(1.3));$('poZout').onclick=zb(c=>{
    // Con todo el rango a la vista, alejar amplía la ventana de tiempo.
    const wi=POW.findIndex(w=>w[0]===po.w);
    if(!(c.isZoomedOrPanned&&c.isZoomedOrPanned())&&wi>=0&&wi<POW.length-1){po.w=POW[wi+1][0];re();}else c.zoom(0.77);});$('poZreset').onclick=zb(c=>c.resetZoom());
  ['poZin','poZout','poZreset'].forEach(id=>$(id).disabled=!cfg);

  // ---- comparar divisas ----
  $('poCmpTabs').innerHTML=POCMP.map(([id,lb])=>`<button class="tab" role="tab" type="button" data-t="${id}" aria-selected="${po.cmp===id}">${lb}</button>`).join('');
  $('poCmpTabs').querySelectorAll('[data-t]').forEach(x=>x.onclick=()=>{po.cmp=x.dataset.t;re();});
  const body=$('poCmpBody');let CT='',CS='',CI='';
  if(po.cmp==='mapa'){
    CT='Mapa de saturación';CS=`${Object.keys(C).length} divisas · índice COT de 3 años · toca un punto para abrir esa divisa`;
    CI=`<p>Cada punto es una divisa. <b>Derecha:</b> compra saturada. <b>Izquierda:</b> venta saturada.</p>`
      +`<p><b>Arriba:</b> los fondos compraron en las últimas 4 semanas. <b>Abajo:</b> vendieron. Las esquinas (extremo + flujo en contra) son las más interesantes.</p>`;
    body.innerHTML=`<div class="po-zoom po-zoom-r" role="group" aria-label="Zoom del mapa"><button type="button" id="poMzo" aria-label="Alejar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg></button><button type="button" id="poMzi" aria-label="Acercar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg></button><button type="button" id="poMzr" aria-label="Restablecer vista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"></path></svg></button></div>`
      +`<div class="chart po-big"><canvas id="poCr"></canvas></div><div class="po-qlab"><span class="loss">← Venta saturada</span><span class="gain">Compra saturada →</span></div>`;
    const pts=Object.values(C).map(Y=>{const iv=poIndex(Y.npoi,156);return {x:iv[iv.length-1],y:Y.now.d4,c:Y.ccy};});
    if(window.Chart){
      poC.cr=new Chart($('poCr'),{type:'scatter',data:{datasets:[{data:pts,pointRadius:pts.map(p=>p.c===b||p.c===q?9:6),pointHoverRadius:10,
        backgroundColor:pts.map(p=>p.x>=80?g:p.x<=20?l:mu),borderColor:pts.map(p=>p.c===b||p.c===q?ink:'transparent'),borderWidth:2}]},plugins:[POQUAD],
        options:{responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{right:24}},
          onClick:(e,els)=>{if(els.length)pickCcy(pts[els[0].index].c);},
          onHover:(e,els)=>{e.native.target.style.cursor=els.length?'pointer':'default';},
          plugins:{legend:{display:false},zoom:poZoom('xy'),tooltip:{callbacks:{label:i=>`${i.raw.c}: índice ${Math.round(i.raw.x)} · 4 sem ${i.raw.y>0?'+':''}${i.raw.y} pp`}}},
          scales:{x:{min:0,max:100,grid:{color:ln},ticks:{color:mu,stepSize:20},title:{display:true,text:'Índice COT 3 años',color:mu}},
            y:{grid:{color:ln},ticks:{color:mu,callback:v=>v+' pp'},title:{display:true,text:'Flujo 4 semanas',color:mu}}}}});
      const mz=f=>()=>{const c=poC.cr;if(c&&c.zoom)f(c);};
      $('poMzi').onclick=mz(c=>c.zoom(1.3));$('poMzo').onclick=mz(c=>c.zoom(0.77));$('poMzr').onclick=mz(c=>c.resetZoom());
    }
  }else if(po.cmp==='tabla'){
    CT='Todas las divisas';CS='De la más comprada a la más vendida (percentil de 5 años) · toca una fila para abrirla';
    CI=`<p><b>Fondos:</b> % largo / corto de cada divisa. <b>Extremo:</b> dónde está hoy el neto frente a los últimos 5 años (0 = lo más vendido, 100 = lo más comprado).</p>`
      +`<p>Las etiquetas marcan los extremos: arriba de 90 o debajo de 10.</p>`;
    const all=Object.values(C).sort((a,c2)=>c2.st['5'].pct-a.st['5'].pct);
    body.innerHTML=`<div class="scroll"><table id="poMap"><thead><tr><th>Divisa</th><th>Fondos · largo / corto</th><th class="num">Neto / OI</th><th>Extremo · 5 años</th><th class="num">Semana</th><th>Lectura</th>`
      +(pro?'<th class="num">Largos</th><th class="num">Cortos</th><th class="num">z 5a</th>':'')+`</tr></thead><tbody>`
      +all.map(x=>{const p5=x.st['5'],lec=x.now.net>=0
          ?(p5.pct>=90?['lo','Largo extremo']:p5.pct>=75?['md','Largo cargado']:['','Largo en rango'])
          :(p5.pct<=10?['lo','Corto extremo']:p5.pct<=25?['md','Corto cargado']:['','Corto en rango']);
        return `<tr data-c="${x.ccy}"${x.ccy===b||x.ccy===q?' class="sel"':''}><td><b>${x.ccy}</b><span class="po-cn">${x.name}</span></td>`
          +`<td><div class="po-split sm"><i class="l" style="width:${x.now.shL.toFixed(1)}%"></i><i class="s"></i></div><span class="po-sp"><b class="gain">${x.now.shL.toFixed(0)}%</b> / <b class="loss">${(100-x.now.shL).toFixed(0)}%</b></span></td>`
          +`<td class="num pop ${x.now.npoi>0?'gain':'loss'}"><b>${x.now.npoi>0?'+':''}${x.now.npoi.toFixed(1)}%</b></td>`
          +`<td><div class="po-gauge sm"><i class="zl"></i><i class="zh"></i><b style="left:${p5.pct}%"></b></div><span class="po-sp">${Math.round(p5.pct)}</span></td>`
          +`<td class="num pop ${x.now.dnet>0?'gain':x.now.dnet<0?'loss':''}">${x.now.dnet>0?'▲':x.now.dnet<0?'▼':''} ${poK(Math.abs(x.now.dnet))}</td>`
          +`<td><span class="poex ${lec[0]||'md'}">${lec[1]}</span></td>`
          +(pro?`<td class="num pop">${x.now.L.toLocaleString('es-MX')}</td><td class="num pop">${x.now.S.toLocaleString('es-MX')}</td><td class="num pop">${p5.z>0?'+':''}${p5.z}</td>`:'')+`</tr>`;}).join('')+'</tbody></table></div>';
    body.querySelectorAll('tbody tr').forEach(tr=>tr.onclick=()=>pickCcy(tr.dataset.c));
  }else{
    const FW=poForward(A,ix,P);
    CT=`Qué hizo ${po.p} después de un extremo`;CS=`Índice COT ${ixw} · retorno desde el viernes de publicación`;
    CI=`<p>Retorno promedio del par 4, 8 y 13 semanas después, según dónde estaba el índice COT. La fila resaltada es la situación de hoy.</p>`
      +`<p>Compárala con <b>Todas las semanas</b>: si se parecen, el extremo no dio ventaja en este par. Es historia, no una señal.</p>`;
    if(FW&&FW.G.all[4].length){
      const st=a=>a.length?{n:a.length,m:a.reduce((x,y)=>x+y,0)/a.length,up:a.filter(x=>x>0).length/a.length}:null;
      const cell=a=>{const s=st(a);return s?`<td class="num pop ${s.m>0?'gain':'loss'}"><b>${s.m>0?'+':''}${s.m.toFixed(2)}%</b></td><td class="num pop">${Math.round(s.up*100)}%</td>${pro?`<td class="num pop">${s.n}</td>`:''}`
        :`<td class="num">—</td><td class="num">—</td>${pro?'<td class="num">0</td>':''}`;};
      const lab={hi:'Compra saturada (≥ 80)',lo:'Venta saturada (≤ 20)',all:'Todas las semanas'};
      body.innerHTML=`<div class="scroll"><table id="poFw"><thead><tr><th rowspan="2">Situación</th>${FW.H.map(h=>`<th colspan="${pro?3:2}" class="num">${h} semanas</th>`).join('')}</tr>`
        +`<tr>${FW.H.map(()=>`<th class="num">Promedio</th><th class="num">Veces al alza</th>${pro?'<th class="num">n</th>':''}`).join('')}</tr></thead><tbody>`
        +['hi','lo','all'].map(gk=>`<tr${gk===zone?' class="sel"':''}><td><b>${lab[gk]}</b>${gk===zone?' <span class="poex md">hoy</span>':''}</td>${FW.H.map(h=>cell(FW.G[gk][h])).join('')}</tr>`).join('')+'</tbody></table></div>'
        +(pro?`<p class="po-mut">Las semanas consecutivas se solapan: n exagera el número de episodios independientes.</p>`:'');
    }else body.innerHTML=`<p class="po-mut">No hay serie diaria de precios para ${po.p}, así que no se puede medir qué pasó después.</p>`;
  }
  $('poCmpT').textContent=CT;$('poCmpS').textContent=CS;
  poInfoWire('poCmpInfoBtn','poCmpInfo','cmp',CI);
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
function renderCarry(){
  const C=S.carry;if(!C||!C.pairs){$('cyPairs').innerHTML='';return;}
  const f2=x=>x.toFixed(2);
  const grp=g=>C.pairs.filter(x=>x.grupo===g).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff));
  const row=x=>{const d=x.diff>0?'buy':x.diff<0?'sell':'none';
    return `<tr><td><b>${x.p}</b><span class="sub">${x.base} / ${x.quote}</span></td>
      <td class="num">${f2(x.rb)}%</td><td class="num">${f2(x.rq)}%</td>
      <td class="num ${x.diff>0?'gain':x.diff<0?'loss':''}"><b>${sg(x.diff)} pp</b></td>
      <td><span class="cydir ${d}">${x.diff>0?'Comprar':x.diff<0?'Vender':'Ninguna'}</span></td></tr>`;};
  const sec=(lab,L)=>`<tr class="grp"><td colspan="5">${lab}</td></tr>`+L.map(row).join('');
  $('cyPairs').innerHTML=`<thead><tr><th>Par</th><th class="num">Tasa base</th><th class="num">Tasa cotizada</th><th class="num">Diferencial</th><th>Swap positivo</th></tr></thead><tbody>`
    +sec('Mayores · contra el dólar',grp('Mayor'))+sec('Menores · cruces',grp('Menor'))+'</tbody>';
  $('cyNote').innerHTML=`<b>Cómo leerla.</b> Si la tasa de política de la moneda base supera a la de la cotizada, el swap es positivo al <b>comprar</b>; si manda la cotizada, al <b>vender</b>. Es el diferencial bruto entre bancos centrales: tu bróker aplica margen, y un diferencial pequeño puede cobrar negativo en ambos sentidos. Confirma la tabla de swaps del símbolo antes de dimensionar.`;
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
    return rows;
  }
  // Live daily candles (data/mkt-live.json, Yahoo Finance) extend the stored history after its last date.
  // D: appended. W (weeks dated on Sunday) and M (dated on the 1st): the last stored candle absorbs the live days
  // of its period (open kept, high/low widened, close updated) and later periods are built from the live days.
  const LIVE=(typeof MKT_LIVE!=='undefined'&&MKT_LIVE&&MKT_LIVE.live)||{};
  const ymdOf=t=>{const d=new Date(t);return d.getUTCFullYear()*10000+(d.getUTCMonth()+1)*100+d.getUTCDate();};
  const tOf=y=>Date.UTC(Math.floor(y/10000),Math.floor(y/100)%100-1,y%100);
  const keyOf={W:y=>{const t=tOf(y);return ymdOf(t-new Date(t).getUTCDay()*864e5);},M:y=>Math.floor(y/100)*100+1};
  function extend(rows,tf,live){
    if(!live||!live.length||!rows.length)return rows;
    const last=rows[rows.length-1];
    if(tf==='D')return rows.concat(live.filter(r=>r[0]>last[0]));
    const kf=keyOf[tf];if(!kf)return rows;
    const out=rows.slice(0,-1),g=new Map([[last[0],last.slice()]]);
    for(const r of live){
      if(r[0]<last[0])continue;
      const k=kf(r[0]),c=g.get(k);
      if(!c)g.set(k,[k,r[1],r[2],r[3],r[4]]);
      else{c[2]=Math.max(c[2],r[2]);c[3]=Math.min(c[3],r[3]);c[4]=r[4];}
    }
    return out.concat([...g.values()].filter(c=>c[0]>=last[0]).sort((a,b)=>a[0]-b[0]));
  }
  return {
    pairs(){return Object.keys(E);},
    has(p,tf){return !!(E[p]&&E[p][tf]);},
    get(p,tf){
      if(!E[p]||!E[p][tf])return null;
      const k=p+tf;
      return cache[k]||(cache[k]=extend(dec(E[p][tf]),tf,LIVE[p]).reverse());
    },
    liveAsof(){return (typeof MKT_LIVE!=='undefined'&&MKT_LIVE&&MKT_LIVE.asof)||null;}
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
    'FX (18 cruces EUR, AUD y GBP), XAUUSD, XAGUSD, WTI, US30, NAS100 y SPX500 exportados de Investing.com con datos al 12-10-2026 (VIX y SPX500 diario al 16-10-2026).',
    'Desde esa fecha las velas se extienden solas cada día hábil con Yahoo Finance. Índices y VIX coinciden exactamente con Investing.com; FX difiere ~0.1 % en el cierre (otro corte horario) y WTI, oro y plata ~0.3-0.6 % (Yahoo usa futuros continuos, no spot).',
    'US30 diario: el archivo de Investing.com terminaba el 31-10-2025; el hueco hasta hoy lo cubre Yahoo Finance.',
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
  if(typeof freshBadges==='function'&&document.querySelector('#distribucion > .sh .fresh'))freshBadges();
}

// ---------- Hoy · portada del trader ----------
// One screen in the order a trader reads it: the macro picture in plain words, the next release that moves the
// market (consensus vs TFX model, probabilities, scenarios), what changed this week, a checklist for the chosen pair
// and what history says on CPI days. Simple shows plain language; Pro adds the numbers behind it.
const isPro=()=>document.documentElement.dataset.nivel==='pro';
const hesc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const IC={
  up:'<svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><path d="M12 19V5M5 12l7-7 7 7"></path></svg>',
  dn:'<svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><path d="M12 5v14M5 12l7 7 7-7"></path></svg>',
  flat:'<svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><path d="M5 12h14"></path></svg>',
  warn:'<svg viewBox="0 0 24 24" role="img" aria-label="Atención" class="ic"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 17h.01"></path></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2.5M9 2h6"></path></svg>'};
const BLOQ={'Inflación':'la inflación','Empleo':'el empleo','Actividad':'la actividad','Precios y expectativas':'los precios y las expectativas','Tasas y liquidez':'las tasas y la liquidez'};
const NIV=['Alivio claro','Alivio','Neutral','Restrictivo','Restrictivo fuerte'];
const nivelDe=c=>c>=1?4:c>=0.4?3:c>-0.4?2:c>-1?1:0;
function hoyLink(id,txt){return `<a class="hoylink" href="#${id}" data-go="${id}">${txt}</a>`;}

function hoyRegimen(){
  const c=S.composite,n=nivelDe(c),sb=S.sub,b=S.breadth,cy=S.cycle||{};
  const sgn=c>=0?1:-1,motor=Object.keys(S.blocks).sort((x,y)=>S.blocks[y]*S.weights[y]*sgn-S.blocks[x]*S.weights[x]*sgn)[0];
  const head=n>=3?`La economía se calienta y ${BLOQ[motor]} es el motor.`:n<=1?`La economía se enfría y ${BLOQ[motor]} es lo que más pesa.`:'La economía está en equilibrio: ningún bloque domina.';
  const sub=n>=3?'Por eso la Fed no tiene prisa por bajar tasas. En este régimen el dólar suele estar del lado fuerte, pero solo si los próximos datos lo confirman.'
    :n<=1?'Eso abre espacio a que la Fed relaje su política. En este régimen el dólar suele debilitarse, si los próximos datos lo confirman.'
    :'Sin un sesgo macro claro, cada dato nuevo pesa más que el régimen: opera los catalizadores con sorpresa clara.';
  const y2=S.rows.find(r=>r.name==='UST 2 años · cambio 6m');
  const imp=[c>=0.4?[IC.up,'Dólar: sesgo alcista condicional']:c<=-0.4?[IC.dn,'Dólar: sesgo bajista condicional']:[IC.flat,'Dólar: sin sesgo macro'],
    y2&&y2.pts>0?[IC.up,'Tasa 2 años: presión al alza']:y2&&y2.pts<0?[IC.dn,'Tasa 2 años: presión a la baja']:[IC.flat,'Tasa 2 años: estable'],
    [IC.flat,`Ciclo: ${(PHN[cy.phase]||'—').toLowerCase()} · ${cy.run||'—'} meses`]];
  const [pp,ppv]=projPhase();
  $('hoyReg').innerHTML=`<span class="k">1 · El panorama macro de EE.UU.</span>
    <h2 class="hoy-h2">${head}</h2><p class="hoy-p">${sub}</p>
    <div class="lvl5" role="img" aria-label="Régimen: ${NIV[n]}">${NIV.map((x,i)=>`<i class="l${i}${i===n?' on':''}"></i>`).join('')}</div>
    <div class="lvl5 lab">${NIV.map((x,i)=>`<span class="${i===n?'on':''}">${x}${i===n?' · hoy':''}</span>`).join('')}</div>
    <div class="imps-w"><span class="hoy-small">Qué suele implicar (tendencia condicional, no una señal)</span>
    <div class="imps">${imp.map(([i,t])=>`<span class="imp">${i}${t}</span>`).join('')}</div></div>
    ${isPro()?`<div class="prow"><div><span>Compuesto</span><b>${sg(c)} de ±2</b></div><div><span>Líderes · catalizadores</span><b>${sg(sb.lead)} · ${sg(sb.coin)}</b></div><div><span>Calientan</span><b>${b.hot} de ${b.n}</b></div><div><span>Fase en 3 meses</span><b>${PHN[pp]} ${pct(ppv)}</b></div></div>`:''}
    ${hoyLink('resumen','Ver el detalle en Contexto')}`;
}

function hoyProximo(){
  const el=$('hoyNext'),nx=nextCat();
  if(!nx){el.innerHTML='<span class="hk">2 · El próximo dato que mueve el mercado</span><p class="hoy-p">No hay datos de alto impacto en la agenda cargada.</p>';return;}
  const nm=nextModeled(),tg=nm&&nm.t===nx.t&&nm.key===nx.key?evTargets(nm):[];
  const refFull=MABR[nx.ref]?MESL[MABR[nx.ref]-1]:nx.ref;
  const when=`${fShort(nx.t)} · ${fTime(nx.t)} ${TZN()}`;
  let body='';
  if(tg.length){
    const t=tg[0],N=S.nowcast[t],M=N.mc,k=isK(t),ref=N.refv,step=k?10:0.1;
    const fr=v=>k?sg(v,0)+'k':sg(v,1)+'%';
    const d=N.cons!=null?N.pred-N.cons:null,tol=k?10:0.05;
    const verb=d==null?'':d>tol?(k?'más fuerte':'más caliente'):d<-tol?(k?'más débil':'más frío'):'en línea con';
    const lead=d==null?`Aún no hay consenso publicado: las probabilidades se miden contra el dato previo (${fr(ref)}).`
      :verb==='en línea con'?'El modelo TFX espera un dato en línea con el consenso.':`El modelo TFX espera un dato ${verb} que el consenso.`;
    const R=SCN[t]||['','',''];
    body=`<p class="hoy-p">${lead}</p>
      <div class="figs"><div class="fig"><span>Consenso</span><b>${N.cons==null?'—':fr(N.cons)}</b></div><div class="fig m"><span>Modelo TFX</span><b>${fx(t,N.pred)}</b></div><div class="fig"><span>Dato previo</span><b>${fr(N.prev)}</b></div></div>
      <div class="pw"><span class="hoy-small">Probabilidad frente al ${N.consKind} (20,000 escenarios)</span>
      <div class="pbar" role="img" aria-label="Arriba ${pct(M.above)}, en línea ${pct(M.inline)}, abajo ${pct(M.below)}"><i class="hot" style="flex:${M.above} 1 0"></i><i class="mid" style="flex:${M.inline} 1 0"></i><i class="cold" style="flex:${M.below} 1 0"></i></div>
      <div class="plab"><span><b class="warm">▲ ${pct(M.above)} arriba</b> (${k?'>':'≥'} ${fr(ref+step)})</span><span class="c"><b>${pct(M.inline)} en línea</b></span><span class="r"><b class="coolc">▼ ${pct(M.below)} abajo</b> (${k?'<':'≤'} ${fr(ref-step)})</span></div></div>
      <div class="scn"><div><b class="warm">Si sale arriba</b><span>${R[0]}</span></div><div><b>Si sale en línea</b><span>${R[1]}</span></div><div><b class="coolc">Si sale abajo</b><span>${R[2]}</span></div></div>
      ${isPro()?`<p class="hoy-mono">Rango 90%: ${fx(t,M.p5)} a ${fx(t,M.p95)} · central: ${{reg:'regresión',arima:'ARIMA',ens:'ensamble'}[N.central]}${tg.slice(1).map(t2=>{const N2=S.nowcast[t2];return ` · ${NCN[t2]}: modelo ${fx(t2,N2.pred)} vs ${N2.consKind} ${isK(t2)?sg(N2.refv,0)+'k':sg(N2.refv,1)+'%'}`;}).join('')}</p>`:''}`;
  }else{
    body=`<div class="figs"><div class="fig"><span>Consenso</span><b>${hesc(nx.cons||'—')}</b></div><div class="fig"><span>Dato previo</span><b>${hesc(nx.prev||'—')}</b></div></div>
      <p class="hoy-p">Este dato no tiene modelo TFX: se compara contra el consenso cuando se publica.</p>`;
  }
  el.innerHTML=`<div class="hoy-top"><span class="hk">2 · El próximo dato que mueve el mercado</span><span class="hoy-mono">${when}</span></div>
    <h2 class="hoy-h2">${CATN[nx.key]||nx.name} de ${refFull}</h2>${body}${hoyLink('catalizador','Ver agenda y escenarios')}`;
}

function hoyCambio(){
  const now=Date.now(),from=now-10*864e5,skip=/ a\/a$/;
  const ev=S.calendar.filter(e=>e.actual&&Date.parse(e.t)<=now&&Date.parse(e.t)>=from&&!skip.test(e.name)).sort((a,b)=>Date.parse(b.t)-Date.parse(a.t)).slice(0,6);
  const inv=k=>k==='un'||k==='claims';
  const rows=ev.map(e=>{
    const a=numOf(e.actual),hasC=numOf(e.cons)!=null,r=hasC?numOf(e.cons):numOf(e.prev),k=/k$/i.test(e.actual);
    let cls='flat',txt='sin referencia';
    if(a!=null&&r!=null){const d=a-r,tol=k?(e.key==='claims'?3:10):0.05;
      if(Math.abs(d)<=tol){cls='flat';txt=hasC?'en línea':'sin cambio';}
      else{const hot=(d>0)!==inv(e.key);cls=hot?'hot':'cold';txt=`${hot?'▲ más caliente':'▼ más frío'} (${k?sg(d,0)+'k':sg(d,1)})`;}}
    const refTxt=hasC?`vs ${hesc(e.cons)} esperado`:(e.prev?`previo ${hesc(e.prev)}`:'');
    return `<div class="chg"><span class="d">${fShort(e.t)}</span><span><b>${hesc(e.name)} ${hesc(e.ref)}</b> ${hesc(e.actual)} ${refTxt}</span><span class="badge ${cls}">${txt}</span></div>`;});
  const H=S.hist,pc=H&&H.v.length?H.v[H.v.length-1]:null,pd=H&&H.d.length?H.d[H.d.length-1]:null;
  const concl=pc==null?'':regime(pc)===regime(S.composite)
    ?`El régimen no cambió: el compuesto pasó de ${sg(pc)} (${MESL[+pd.slice(5,7)-1]}) a ${sg(S.composite)} hoy.`
    :`El régimen cambió de ${regime(pc).toLowerCase()} a ${regime(S.composite).toLowerCase()} (compuesto ${sg(pc)} → ${sg(S.composite)}).`;
  $('hoyCambio').innerHTML=`<span class="hk">3 · Qué cambió en los últimos 10 días</span>
    <div class="chgs">${rows.join('')||'<p class="hoy-p">Sin datos publicados en los últimos 10 días.</p>'}</div>
    <p class="hoy-p small">${concl} Sorpresa: contra el consenso cuando existe, si no contra el dato previo. En desempleo y solicitudes, un dato más alto enfría.</p>`;
}

const HOY_PARES=['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','USDCHF','NZDUSD'];
let hoyPar=store.get('hoypar','EURUSD');
function hoyCheck(){
  const pares=HOY_PARES.filter(p=>(S.carry&&S.carry.pairs||[]).some(x=>x.p===p));
  if(!pares.includes(hoyPar))hoyPar=pares[0];
  const P=S.carry.pairs.find(x=>x.p===hoyPar);if(!P){$('hoyCheck').innerHTML='';return;}
  const usdBase=P.base==='USD',other=usdBase?P.quote:P.base,c=S.composite,items=[];
  // 1. Macro de EE.UU.
  if(Math.abs(c)>=0.4){const usdUp=c>0,dir=usdUp===usdBase?'compra':'venta';items.push({k:dir,t:`Macro EE.UU.: dólar ${usdUp?'fuerte':'débil'} condicional`,s:`Favorece la ${dir} de ${hoyPar} mientras los datos sigan ${usdUp?'calientes':'fríos'}.`});}
  else items.push({k:'info',t:'Macro EE.UU.: sin sesgo claro',s:'El régimen no favorece ninguna dirección en este par.'});
  // 2. Carry
  if(Math.abs(P.diff)>=0.25)items.push({k:P.dir,t:`Carry: ${P.base} ${P.rb.toFixed(2)}% vs ${P.quote} ${P.rq.toFixed(2)}%`,s:`El swap paga por estar ${P.dir==='venta'?'vendido':'comprado'} en ${hoyPar}.`});
  else items.push({k:'info',t:'Carry casi nulo',s:`Tasas de ${P.base} y ${P.quote} a menos de 0.25 pp.`});
  // 3. Posicionamiento (CFTC, percentil del neto a 5 años)
  const C=S.pos&&S.pos.ccy&&S.pos.ccy[other];
  if(C&&C.st&&C.st['5']){const p5=C.st['5'].pct,np=C.now.npoi;
    if(p5<=10||p5>=90){const corto=p5<=10;items.push({k:'warn',t:`Posicionamiento extremo: especuladores muy ${corto?'cortos':'largos'} en ${other}`,s:`Neto ${sg(np,2)}% del interés abierto, percentil ${Math.round(p5)} a 5 años: si un dato sorprende al revés, el movimiento contrario puede ser brusco.`});}
    else items.push({k:'info',t:`Posicionamiento en ${other} sin extremos`,s:`Percentil ${Math.round(p5)} a 5 años (neto ${sg(np,2)}% del interés abierto).`});}
  // 4. Catalizador próximo
  const nx=nextCat();
  if(nx&&Date.parse(nx.t)-Date.now()<48*36e5)items.push({k:'warn',t:'Dato de alto impacto en menos de 48 h',s:`${CATN[nx.key]||nx.name}, ${fShort(nx.t)} ${fTime(nx.t)}: considera el tamaño de la posición o esperar a la publicación.`});
  else items.push({k:'info',t:'Sin datos de alto impacto en 48 h',s:nx?`El siguiente: ${CATN[nx.key]||nx.name}, ${fShort(nx.t)}.`:''});
  // 5. Volatilidad
  if(S.vol&&S.vol.vix!=null){const v=S.vol.vix,cl=v<20?'tranquila':v<25?'elevada':'alta',B=(S.vol.buckets||[]).find(x=>{const m=/^(\d+)-(\d+)$/.exec(x.lab);return m?v>=+m[1]&&v<+m[2]:x.lab[0]==='<'?v<+x.lab.slice(1):v>=+x.lab.slice(1);});
    items.push({k:v>=25?'warn':'info',t:`Volatilidad ${cl}: VIX ${v.toFixed(1)}`,s:isPro()&&B?`Movimiento diario típico del S&P 500 en este tramo: ${B.med.toFixed(2)}% (p90 ${B.p90.toFixed(2)}%).`:v>=25?'Movimientos amplios: stops más holgados o posiciones más chicas.':'Condiciones normales de volatilidad.'});}
  const ico=k=>k==='venta'?IC.dn:k==='compra'?IC.up:k==='warn'?IC.warn:IC.flat;
  const lab=k=>k==='venta'?'Favorece vender':k==='compra'?'Favorece comprar':k==='warn'?'Atención':'Contexto';
  const nv=items.filter(i=>i.k==='venta').length,nc=items.filter(i=>i.k==='compra').length,nw=items.filter(i=>i.k==='warn').length;
  $('hoyCheck').innerHTML=`<span class="hk">4 · Antes de operar · mi par</span>
    <div class="filters" role="group" aria-label="Mi par">${pares.map(p=>`<button type="button" class="chip sm" data-par="${p}" aria-pressed="${p===hoyPar}">${p}</button>`).join('')}</div>
    <div class="cks">${items.map(i=>`<div class="ck ${i.k}">${ico(i.k)}<div><b>${i.t}</b><span>${i.s}</span><em>${lab(i.k)}</em></div></div>`).join('')}</div>
    <p class="hoy-p small">${nv} a favor de vender · ${nc} a favor de comprar · ${nw} de atención. No es una señal de entrada: es una lista para revisar tu idea.</p>`;
  $('hoyCheck').querySelectorAll('[data-par]').forEach(b=>b.onclick=()=>{hoyPar=b.dataset.par;store.set('hoypar',hoyPar);hoyCheck();});
}

function hoyHistoria(){
  const E=S.evt&&S.evt.assets;if(!E){$('hoyHist').innerHTML='';return;}
  const NM={dxy:'Dólar (índice amplio Fed)',d2:'Tasa 2 años',spx:'S&P 500',xau:'Oro'};
  const f=(a,v)=>E[a].unit==='pb'?`${sg(v,1)} pb`:`${sg(v,2)}%`,T=a=>E[a].surp.cpi_surp.terc;
  const simple=E.dxy&&E.spx?`<p class="hoy-p">Cuando el CPI sale <b class="warm">más caliente</b> que el modelo, el día del dato el dólar se movió en promedio ${f('dxy',T('dxy').caliente.mean)} y el S&amp;P 500 ${f('spx',T('spx').caliente.mean)}. Cuando sale <b class="coolc">más frío</b>: dólar ${f('dxy',T('dxy').fria.mean)}, S&amp;P 500 ${f('spx',T('spx').fria.mean)}. Son promedios: el dólar subió solo el ${pct(T('dxy').caliente.up)} de los días calientes.</p>`:'';
  const tbl=`<div class="scroll"><table><thead><tr><th>Activo</th><th class="num">CPI más frío</th><th class="num">En línea</th><th class="num">CPI más caliente</th></tr></thead><tbody>${Object.keys(NM).filter(a=>E[a]).map(a=>`<tr><td>${NM[a]}</td>${['fria','media','caliente'].map(t=>`<td class="num">${f(a,T(a)[t].mean)}<span class="sub">sube ${pct(T(a)[t].up)} de los días</span></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('hoyHist').innerHTML=`<span class="hk">5 · Lo que dice la historia · día del CPI desde 2016</span>${isPro()?tbl:simple}${hoyLink('catalizador','Ver escenarios por dato')}`;
}

function renderHoy(){
  try{$('hoyFecha').textContent=new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',timeZone:TZ});}catch(e){}
  for(const f of [hoyRegimen,hoyProximo,hoyCambio,hoyCheck,hoyHistoria]){try{f();}catch(e){console.error(e);}}
  document.querySelectorAll('#hoy [data-go]').forEach(a=>a.onclick=ev=>{ev.preventDefault();show(a.dataset.go);});
}

// Next high-impact release, always visible in the header.
function nextPill(){
  const el=$('nextPill');if(!el||!S.calendar)return;
  const nx=nextCat();if(!nx){el.hidden=true;return;}
  const ms=Date.parse(nx.t)-Date.now(),d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
  el.hidden=false;el.innerHTML=`${IC.clock}<span>${CATN[nx.key]||nx.name} en ${d?`${d} d ${h} h`:h?`${h} h ${m} min`:`${m} min`}</span>`;
  el.title=`${nx.name} · ${fDate(nx.t)}, ${fTime(nx.t)} ${TZN()}`;
}

// ---------- Navegación por secciones ----------
const VIEWS={hoy:renderHoy,resumen:renderSummary,cuantitativo:renderScore,ciclo:renderCycle,catalizador:renderCatalyst,modelos:renderModels,distribucion:renderDorSec,graficos:renderCharts,carry:renderCarry,vol:renderVol,estacional:renderSeas,posicion:renderPos,tv:renderTV};
let view=null;
// Five groups in the header; the module bar below shows only the modules of the active group.
const GROUPS={hoy:['hoy'],contexto:['resumen','cuantitativo','ciclo','graficos'],catalizadores:['catalizador','modelos'],mercado:['distribucion','posicion','carry','vol','estacional'],tv:['tv']};
const groupOf=id=>Object.keys(GROUPS).find(g=>GROUPS[g].includes(id))||'hoy';
const lastIn=store.get('lastin',{});
function syncGroups(id){
  const g=groupOf(id);lastIn[g]=id;store.set('lastin',lastIn);
  document.querySelectorAll('#groups [data-g]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.g===g)));
  const menu=$('menu');menu.classList.toggle('solo',GROUPS[g].length<2);
  menu.querySelectorAll('a').forEach(a=>{a.hidden=!GROUPS[g].includes(a.getAttribute('href').slice(1));});
}
function setNivel(n){
  document.documentElement.dataset.nivel=n;store.set('nivel',n);
  document.querySelectorAll('#lvl [data-lvl]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lvl===n)));
}
function show(id,hash=true){
  if(!VIEWS[id])id='hoy';
  view=id;store.set('view2',id);syncGroups(id);
  document.querySelectorAll('main>section').forEach(s=>{const on=s.id===id;s.classList.toggle('view',on);s.classList.toggle('on',on);});
  document.querySelectorAll('nav.menu a').forEach(a=>{const on=a.getAttribute('href')==='#'+id;a.classList.toggle('on',on);if(on)a.scrollIntoView({block:'nearest',inline:'center'});});
  if(hash){try{history.replaceState(null,'','#'+id);}catch(e){}}
  try{VIEWS[id]();}catch(e){console.error(e);}
  try{window.scrollTo(0,0);}catch(e){}
}
function wireNav(){
  document.querySelectorAll('nav.menu a').forEach(a=>{a.onclick=e=>{e.preventDefault();show(a.getAttribute('href').slice(1));};});
  document.querySelectorAll('#groups [data-g]').forEach(b=>{b.onclick=()=>{const g=b.dataset.g;show(GROUPS[g].includes(lastIn[g])?lastIn[g]:GROUPS[g][0]);};});
  document.querySelectorAll('#lvl [data-lvl]').forEach(b=>{b.onclick=()=>{setNivel(b.dataset.lvl);if(VIEWS[view])try{VIEWS[view]();}catch(e){console.error(e);}};});
  const np=$('nextPill');if(np)np.onclick=e=>{e.preventDefault();show('catalizador');};
  nextPill();setInterval(nextPill,60000);
  window.addEventListener('hashchange',()=>show((location.hash||'').slice(1),false));
  const top=$('top'),prog=$('prog'),totop=$('totop');
  const onScroll=()=>{const h=document.documentElement,max=h.scrollHeight-h.clientHeight,y=h.scrollTop;prog.style.width=(max>0?y/max*100:0)+'%';top.classList.toggle('scrolled',y>8);totop.classList.toggle('away',y<600);};
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  totop.onclick=()=>window.scrollTo({top:0});
  document.addEventListener('pointermove',e=>{const p=e.target.closest&&e.target.closest('.panel');if(!p)return;const r=p.getBoundingClientRect();p.style.setProperty('--mx',(e.clientX-r.left)+'px');p.style.setProperty('--my',(e.clientY-r.top)+'px');},{passive:true});
}
// ---------- Antigüedad de los datos ----------
// Every panel says whether its data updates itself or is loaded by hand, and how old it is.
const FMES={ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};
function freshDate(s){
  let m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');if(m)return Date.UTC(+m[1],+m[2]-1,+m[3]);
  m=/^(\d{1,2})-([a-z]{3})-(\d{4})$/.exec(s||'');return m&&FMES[m[2]]!=null?Date.UTC(+m[3],FMES[m[2]],+m[1]):null;
}
const freshLab=t=>{const d=new Date(t);return `${String(d.getUTCDate()).padStart(2,'0')}-${Object.keys(FMES)[d.getUTCMonth()]}-${d.getUTCFullYear()}`;};
// max = days after which the panel is flagged (weekends, holidays and each source's publication lag included).
function freshSources(){
  const mac={auto:true,src:'FRED',date:S.asof_iso,max:5},man={auto:false,date:S.asof_manual,max:7};
  return {hoy:mac,resumen:mac,cuantitativo:mac,
    posicion:{auto:true,src:'CFTC',date:S.pos&&S.pos.asof,max:13,lab:'informe del'},
    carry:{auto:true,src:'BIS',date:S.carry&&S.carry.datos,max:14},
    graficos:{auto:true,src:'FRED',date:S.charts_asof,max:5},
    ciclo:mac,modelos:S.nc_asof?{auto:true,src:'FRED',date:S.nc_asof,max:4}:man,
    // Catalizador: the agenda updates itself; the model and scenario tabs still use the hand-loaded nowcast (Modelos).
    catalizador:S.cal_asof?{auto:true,src:'FRED + ForexFactory',date:S.cal_asof.slice(0,10),max:4}:man,
    // Distribución: the Mercados view reads the Yahoo candles; the macro view is rebuilt from FRED with the scorecard.
    distribucion:dorMode==='mercados'?{auto:true,src:'Yahoo Finance',date:S.seas&&S.seas.asof,max:6}:{auto:true,src:'FRED',date:S.dist_asof,max:5},
    vol:{auto:true,src:'Yahoo Finance',date:S.vol&&S.vol.asof,max:6},
    estacional:{auto:true,src:'Yahoo Finance',date:S.seas&&S.seas.asof,max:6}};
}
// Each input against its usual release calendar: an input is late when the next period should already be out
// (end of the following month + publication lag in days + 4 days of margin). Daily and weekly series by age.
const LAG=[[/^Core CPI|^Tasa real/,15],[/PPI/,16],[/Desempleo|NFP/,10],[/ISM Manufactura/,3],[/ISM Servicios/,5],[/OECD CLI/,20],
  [/LEI|Índice coincidente/,25],[/Permisos/,20],[/M2/,28],[/Ventas minoristas/,17],[/ADP/,5],[/PIB/,30]];
function staleInfo(name,date,now=Date.now()){
  let m=/^(\d{1,2})-([a-z]{3})-(\d{4})$/.exec(date||'');
  if(m){const age=(now-Date.UTC(+m[3],FMES[m[2]],+m[1]))/864e5,max=/Solicitudes/.test(name)?13:10;return age>max?`dato del ${date}`:null;}
  const prel=/\(prel\.\)/.test(date||'');
  m=/^([a-z]{3})-(\d{4})/.exec(date||'');let mo,y;
  if(m){mo=FMES[m[1]];y=+m[2];}else if((m=/^T([1-4])-(\d{4})$/.exec(date||''))){mo=+m[1]*3-1;y=+m[2];}else if((m=/^(\d{4})-(\d{2})$/.exec(date||''))){mo=+m[2]-1;y=+m[1];}else return null;
  const quarter=/^T/.test(date);
  // UMich: the preliminary reading is replaced by the final one at the end of the same month.
  const due=prel?Date.UTC(y,mo+1,0)+4*864e5:Date.UTC(y,mo+(quarter?4:2),0)+((LAG.find(([re])=>re.test(name))||[0,20])[1]+4)*864e5;
  return now>due?(prel?'falta la lectura final':'ya debió publicarse el siguiente dato'):null;
}
const staleTag=r=>staleInfo(r.name,r.date)?' · <b style="color:var(--accent)">atrasado</b>':'';
function staleInputs(id){
  const L=[],seen=new Set();const add=(n,d)=>{const k=n.replace(/[ ,·].*$/,'');if(seen.has(k)&&/^(LEI|Índice)/.test(n))return;seen.add(k);const w=staleInfo(n,d);if(w)L.push(`${n} (${d}): ${w}`);};
  if(['hoy','resumen','cuantitativo'].includes(id)){(S.rows||[]).forEach(r=>add(r.name,r.date));(S.info||[]).forEach(r=>add(r.name,r.date));}
  if(id==='hoy'||id==='resumen'||id==='ciclo'){const c=S.cycle||{};if(c.lei_periodo)add('LEI Conference Board, 6m',c.lei_periodo);if(c.cei_periodo)add('Índice coincidente, 6m',c.cei_periodo);}
  if(id==='cuantitativo'&&S.curve&&S.curve.date)add('Curva del Tesoro',S.curve.date.slice(8)+'-'+Object.keys(FMES)[+S.curve.date.slice(5,7)-1]+'-'+S.curve.date.slice(0,4));
  return [...new Set(L)];
}
function freshBadges(){
  for(const [id,f] of Object.entries(freshSources())){
    const sh=document.querySelector(`#${id} > .sh`);if(!sh)continue;
    let b=sh.querySelector('.fresh');if(!b){b=document.createElement('span');sh.appendChild(b);}
    const t=freshDate(f.date),age=t==null?null:Math.floor((Date.now()-t)/864e5),old=age==null||age>f.max;
    const when=t==null?'sin fecha':`${f.lab||'datos al'} ${freshLab(t)}`;
    const late=f.auto&&!old?staleInputs(id):[];
    b.className='fresh '+(f.auto?(old?'old':late.length?'manold':'ok'):(old?'manold':'man'));
    b.innerHTML=`<i></i>${f.auto?(old?'Sin actualizar':'Automático · '+f.src):'Manual'} · ${when}${old&&age!=null?` · hace ${age} días`:''}${late.length?` · ${late.length} ${late.length===1?'insumo atrasado':'insumos atrasados'}`:''}`;
    b.title=f.auto?(old?`La actualización automática desde ${f.src} no trae datos nuevos desde hace ${age} días. Se muestra el último dato válido.`:`Se actualiza solo desde ${f.src}.`+(late.length?`\nAtrasados frente a su calendario habitual:\n- ${late.join('\n- ')}`:''))
      :`Estos datos se cargan a mano.${old?` Tienen más de ${f.max} días.`:''}`;
  }
}
setNivel(store.get('nivel','simple'));chartTheme();
// Tema común de los gráficos: tipografía, rejilla, leyendas con punto y tooltip oscuro. Se recalcula al cambiar de tema.
function chartTheme(){
  if(!window.Chart)return;const d=Chart.defaults,dark=getComputedStyle(document.documentElement).colorScheme==='dark';
  d.font.family='"Inter",system-ui,sans-serif';d.font.size=11.5;d.color=css('--muted');d.borderColor=css('--line');
  d.elements.line.borderJoinStyle='round';d.elements.line.borderCapStyle='round';
  d.elements.point.hoverRadius=5;d.elements.point.hoverBorderWidth=2;d.elements.bar.borderRadius=2;
  const L=d.plugins.legend.labels;L.usePointStyle=true;L.pointStyle='circle';L.boxHeight=7;L.padding=16;L.font={size:12,weight:'500'};
  Object.assign(d.plugins.tooltip,{backgroundColor:dark?'rgba(20,26,37,.96)':'rgba(11,15,23,.94)',titleColor:'#FFFFFF',bodyColor:'#C9CFD9',footerColor:'#C9CFD9',
    borderColor:dark?'rgba(242,201,76,.28)':'rgba(255,255,255,.08)',borderWidth:1,padding:12,cornerRadius:10,caretSize:6,boxPadding:6,usePointStyle:true,
    titleFont:{family:'"Inter Tight",system-ui,sans-serif',size:12.5,weight:'600'},bodyFont:{family:'"IBM Plex Mono",monospace',size:11.5}});
}
function renderAll(){chartTheme();show(view||(location.hash||'').slice(1)||store.get('view2','hoy'),false);}
renderAll();wireNav();freshBadges();setInterval(()=>{if(view==='catalizador')renderCatalyst();},60000);
autoRefresh();

// ---------- Actualización automática de la página abierta ----------
// The data processes publish several times a day. Every 5 minutes (only while the tab is visible) the small data
// files are compared with the ones loaded; if any changed, the page reloads itself keeping the section and scroll.
function autoRefresh(){
  const T=window.TFX_DATA;if(!T||!window.fetch)return;
  const SMALL=['macro','carry','vol','mkt-live','calendar','nowcast'],ALL=[...SMALL,'cot'];
  const hash=s=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return s.length+':'+h;};
  const sig=async fs=>{const o={};for(const f of fs){try{o[f]=hash(JSON.stringify(await T.get('data/'+f+'.json')));}catch(e){o[f]=null;}}return o;};
  try{const y=sessionStorage.getItem('tfx-scroll');if(y!=null){sessionStorage.removeItem('tfx-scroll');setTimeout(()=>scrollTo(0,+y),300);}}catch(e){}
  let base=null,n=0,pending=false;
  async function check(){
    if(pending||document.hidden)return;
    const fs=n++%6===0?ALL:SMALL,now=await sig(fs);   // the COT (640 KB, weekly) only every 30 minutes
    if(!base){base=now;return;}
    const changed=fs.filter(f=>now[f]&&base[f]!==undefined&&base[f]!==null&&now[f]!==base[f]);
    fs.forEach(f=>{if(base[f]==null)base[f]=now[f];});
    if(changed.length)announce();
  }
  function announce(){
    pending=true;
    const b=document.createElement('div');b.setAttribute('role','status');
    b.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99;display:flex;gap:12px;align-items:center;padding:10px 14px;border-radius:8px;background:var(--panel);color:var(--ink);border:1px solid var(--accent);font:13px var(--f-body);box-shadow:0 6px 24px rgba(0,0,0,.25)';
    let s=30;b.innerHTML=`<span>Hay datos nuevos. La terminal se actualiza en <b id="arS">${s}</b> s.</span>`;
    const go=()=>{try{sessionStorage.setItem('tfx-scroll',String(scrollY));}catch(e){}location.reload();};
    const now=document.createElement('button');now.type='button';now.className='chip sm';now.textContent='Actualizar ahora';now.onclick=go;
    const no=document.createElement('button');no.type='button';no.className='chip sm';no.textContent='Más tarde';no.onclick=()=>{clearInterval(t);b.remove();setTimeout(()=>{pending=false;},10*60000);};   // asks again in 10 minutes
    b.append(now,no);document.body.appendChild(b);
    const t=setInterval(()=>{s--;const e=document.getElementById('arS');if(e)e.textContent=s;if(s<=0){clearInterval(t);go();}},1000);
  }
  setTimeout(check,5000);setInterval(check,5*60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',renderAll);
new MutationObserver(renderAll).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
