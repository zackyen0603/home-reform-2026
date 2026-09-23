'use strict';

// A planar reachability preview. Paths are computed from wall gaps; they are not
// conduit positions, wiring diagrams, cable lengths or electrical approval.
window.ElectricalCircuitView = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const distanceToWall = (x,y,w) => {const [ax,ay]=w.start,dx=w.end[0]-ax,dy=w.end[1]-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);};
  const inRoom = (x,y,room) => {if(!room)return false;let inside=false,p=room.polygon;for(let i=0,j=p.length-1;i<p.length;j=i++){let a=p[i],b=p[j];if(((a[1]>y)!==(b[1]>y))&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};

  function router(floor, panel) {
    const step=12, nx=Math.floor(floor.bounds.width/step)+1, ny=Math.floor(floor.bounds.depth/step)+1, count=nx*ny;
    const xOf=i=>(i%nx)*step, yOf=i=>Math.floor(i/nx)*step;
    const passable=(x,y)=>x>8&&y>8&&x<floor.bounds.width-8&&y<floor.bounds.depth-8&&floor.walls.every(w=>distanceToWall(x,y,w)>(w.thickness||10)/2+3);
    const open=new Uint8Array(count);for(let i=0;i<count;i++)open[i]=Number(passable(xOf(i),yOf(i)));
    const nearest=(x,y,room,limit=65)=>{let best=-1,score=Infinity;for(let i=0;i<count;i++){if(!open[i])continue;const dx=xOf(i)-x,dy=yOf(i)-y,d=dx*dx+dy*dy;if(d<score&&(!room||inRoom(xOf(i),yOf(i),room))){best=i;score=d;}}return score<=limit*limit?best:-1;};
    const start=nearest(panel.position[0],panel.position[1],floor.rooms.find(r=>r.id===panel.room_id));
    const parent=new Int32Array(count);parent.fill(-2);
    if(start<0)return {route:()=>null,gridCount:count};
    const queue=new Int32Array(count);let front=0,back=0;queue[back++]=start;parent[start]=-1;
    while(front<back){const i=queue[front++],x=xOf(i),y=yOf(i);for(const j of [i-nx,i+nx,i-1,i+1]){
      if(j<0||j>=count||Math.abs(xOf(j)-x)+Math.abs(yOf(j)-y)!==step||!open[j]||parent[j]!==-2)continue;
      if(!passable((x+xOf(j))/2,(y+yOf(j))/2))continue;
      parent[j]=i;queue[back++]=j;
    }}
    const route=(position,roomId)=>{const room=floor.rooms.find(r=>r.id===roomId);let target=nearest(position[0],position[1],room);if(target<0||parent[target]===-2)return null;
      let indices=[];for(let i=target;i>=0;i=parent[i])indices.push(i);indices.reverse();
      const path=[panel.position.slice(0,2)];for(const i of indices)path.push([xOf(i),yOf(i)]);path.push(position.slice(0,2));
      const compact=path.filter((p,i)=>i===0||i===path.length-1||i===1||i===path.length-2||Math.abs((p[0]-path[i-1][0])*(path[i+1][1]-p[1])-(p[1]-path[i-1][1])*(path[i+1][0]-p[0]))>.01);
      let length=0;for(let i=1;i<path.length;i++)length+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);return {path:compact,lengthCm:length,straightCm:Math.hypot(position[0]-panel.position[0],position[1]-panel.position[1])};
    };
    return {route,gridCount:count};
  }

  // One route source for the topology map and the 2D/3D overlays.
  function previewRoutes(data,floor,filter='all') {
    const circuits=new Map(data.circuits.map(c=>[c.id,c]));
    const isLighting=p=>['downlight','pendant','ceiling_light'].includes(p.type);
    const selected=p=>filter==='all'||(filter==='outlets'&&!isLighting(p))||(filter==='lighting'&&isLighting(p))||p.circuit_id===filter;
    const finder=router(floor,data.distribution_panel);
    return data.points.filter(selected).map(point=>({point,circuit:circuits.get(point.circuit_id),route:finder.route(point.position,point.space_id),kind:isLighting(point)?'lighting':'outlets'}));
  }

  function renderOverview(state,floor,canvas,target,selectPoint) {
    const data=state.electrical,panel=data.distribution_panel,pad=35,b=floor.bounds;
    const outlets=data.points.filter(p=>!['downlight','pendant','ceiling_light'].includes(p.type));
    const rooms=new Map(floor.rooms.map(r=>[r.id,r]));
    const roomNames=floor.rooms.map(r=>{const x=r.polygon.reduce((n,p)=>n+p[0],0)/r.polygon.length,y=r.polygon.reduce((n,p)=>n+p[1],0)/r.polygon.length;return `<text x="${x}" y="${y}" class="circuit-room">${esc(r.name)}</text>`;}).join('');
    canvas.classList.add('is-2d','is-circuit');
    canvas.innerHTML=`<svg viewBox="${-pad} ${-pad} ${b.width+2*pad} ${b.depth+2*pad}" role="img" aria-label="四樓全室插座總覽"><rect x="${-pad}" y="${-pad}" width="${b.width+2*pad}" height="${b.depth+2*pad}" fill="#f4f0e7"/>${floor.rooms.map(r=>`<polygon points="${r.polygon.map(p=>p.join(',')).join(' ')}" fill="${roomColor(r.category)}" opacity=".7"/>`).join('')}${state.showFurniture?window.FurnitureView.svg(window.FurnitureView.itemsForFloor(state.furniture,floor.id),esc):''}${floor.walls.map(w=>`<line x1="${w.start[0]}" y1="${w.start[1]}" x2="${w.end[0]}" y2="${w.end[1]}" stroke="#535850" stroke-width="${w.thickness||10}"/>`).join('')}${roomNames}${outlets.map(p=>`<g class="circuit-terminal" data-point-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.id)} ${esc(rooms.get(p.space_id)?.name)}" transform="translate(${p.position[0]} ${p.position[1]})"><circle r="13" fill="${esc(data.point_types[p.type]?.render_color||'#4a7b74')}"/><text y="4">${esc(data.point_types[p.type]?.symbol||'S')}</text></g>`).join('')}<g class="circuit-panel" transform="translate(${panel.position[0]} ${panel.position[1]})"><rect x="-17" y="-18" width="34" height="36" rx="5"/><text y="5">盤</text></g></svg>`;
    target.querySelector('#circuitTopology').innerHTML=`<div class="circuit-title"><b>全室插座總覽</b><span>${outlets.length} 個圖面插座／220V 點位 · ${new Set(outlets.map(p=>p.space_id)).size} 個有點位的空間</span></div><p class="micro">圖面依原始插座配置分布。選擇下方迴路可查看各點和電箱的示意連線；燈具可在 2D／3D 開啟佈線或選擇照明迴路。</p><div class="circuit-picker-overview">${data.circuits.map(c=>`<button type="button" data-circuit-id="${esc(c.id)}">${esc(c.name)} <small>${data.points.filter(p=>p.circuit_id===c.id).length} 點</small></button>`).join('')}</div>`;
    const pick=e=>{const button=e.target.closest('[data-circuit-id]');if(button){state.selectedCircuitId=button.dataset.circuitId;window.renderElectricalExperience(state);}};
    target.querySelector('#circuitTopology').addEventListener('click',pick);
    canvas.addEventListener('click',e=>{const point=e.target.closest('[data-point-id]');if(point)selectPoint(point.dataset.pointId);});
    canvas.addEventListener('keydown',e=>{const point=e.target.closest('[data-point-id]');if(point&&['Enter',' '].includes(e.key)){e.preventDefault();selectPoint(point.dataset.pointId);}});
    target.querySelector('#electricalDetails').innerHTML='<h3>全室插座配置</h3><p>先顯示所有房間的插座位置；選擇迴路後可查看拓樸及走線檢查。</p>';
  }

  function render(state,floor,canvas,target,selectPoint) {
    if(state.selectedCircuitId==='all'||!state.selectedCircuitId){renderOverview(state,floor,canvas,target,selectPoint);return;}
    const data=state.electrical,circuit=data.circuits.find(c=>c.id===state.selectedCircuitId)||data.circuits[0];
    const panel=data.distribution_panel,points=data.points.filter(p=>p.circuit_id===circuit.id),loads=(data.appliance_connections||[]).filter(a=>a.circuit_id===circuit.id);
    const rooms=new Map(floor.rooms.map(r=>[r.id,r])),linked=new Map();for(const load of loads)if(load.point_id){const a=linked.get(load.point_id)||[];a.push(load);linked.set(load.point_id,a);}
    const unlinked=loads.filter(a=>!a.point_id),ends=[...points.map(p=>({id:p.id,position:p.position,room_id:p.space_id,type:'point'})),...unlinked.filter(a=>a.position).map(a=>({id:a.id,position:a.position,room_id:a.room_id,type:'load'}))];
    const finder=router(floor,panel),routes=new Map(ends.map(e=>[e.id,finder.route(e.position,e.room_id)]));
    const color=circuit.category==='lighting'?'#bb7e38':circuit.voltage===220?'#b55753':'#4a7b74';
    const routeSvg=ends.map(e=>{const r=routes.get(e.id);return r?`<polyline class="circuit-route ${e.type==='load'?'is-provisional':''}" points="${r.path.map(p=>p.join(',')).join(' ')}" stroke="${color}"/>`:'';}).join('');
    const roomNames=floor.rooms.map(r=>{const x=r.polygon.reduce((n,p)=>n+p[0],0)/r.polygon.length,y=r.polygon.reduce((n,p)=>n+p[1],0)/r.polygon.length;return `<text x="${x}" y="${y}" class="circuit-room">${esc(r.name)}</text>`;}).join('');
    const pointSvg=points.map(p=>`<g class="circuit-terminal" data-point-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.id)}" transform="translate(${p.position[0]} ${p.position[1]})"><circle r="13" fill="${color}"/><text y="4">${data.point_types[p.type]?.symbol||'•'}</text></g>`).join('');
    const loadsSvg=unlinked.filter(a=>a.position).map(a=>`<g class="circuit-load" data-load-id="${esc(a.id)}" tabindex="0" role="button" aria-label="${esc(a.name)}" transform="translate(${a.position[0]} ${a.position[1]})"><rect x="-14" y="-14" width="28" height="28" rx="5" fill="#e3b97b"/><text y="4">電</text></g>`).join('');
    const pad=35,b=floor.bounds;
    canvas.classList.add('is-2d','is-circuit');
    canvas.innerHTML=`<svg viewBox="${-pad} ${-pad} ${b.width+2*pad} ${b.depth+2*pad}" role="img" aria-label="${esc(circuit.name)}示意路徑"><rect x="${-pad}" y="${-pad}" width="${b.width+2*pad}" height="${b.depth+2*pad}" fill="#f4f0e7"/>${floor.rooms.map(r=>`<polygon points="${r.polygon.map(p=>p.join(',')).join(' ')}" fill="${roomColor(r.category)}" opacity=".7"/>`).join('')}${state.showFurniture?window.FurnitureView.svg(window.FurnitureView.itemsForFloor(state.furniture,floor.id),esc):''}${floor.walls.map(w=>`<line x1="${w.start[0]}" y1="${w.start[1]}" x2="${w.end[0]}" y2="${w.end[1]}" stroke="#535850" stroke-width="${w.thickness||10}"/>`).join('')}${routeSvg}${roomNames}${pointSvg}${loadsSvg}<g class="circuit-panel" transform="translate(${panel.position[0]} ${panel.position[1]})"><rect x="-17" y="-18" width="34" height="36" rx="5"/><text y="5">盤</text></g></svg>`;
    const topology=target.querySelector('#circuitTopology');
    const grouped=new Map();for(const p of points){const a=grouped.get(p.space_id)||[];a.push(p);grouped.set(p.space_id,a);}
    const reached=[...routes.values()].filter(Boolean),distance=reached.length?`${(Math.max(...reached.map(r=>r.lengthCm))/100).toFixed(1)} m`:'無法估計';
    const unreachable=ends.filter(e=>!routes.get(e.id));
    const checks=[];
    if(circuit.breaker_a==='to-confirm'||circuit.breaker_a==null)checks.push('斷路器額定未確認，無法核對負載與導線保護。');
    if(circuit.conductor_mm2==='to-confirm'||circuit.conductor_mm2==null)checks.push('導線截面積未確認。');
    if(Number(circuit.conductor_mm2)===2)checks.push('資料寫作 2.0 mm²；應核對原報價是否指單線直徑 2.0 mm，並依實際線型、配管與斷路器重新選線。');
    if(circuit.id.startsWith('C-220-WATER-HEATER')&&circuit.rcd_required==null)checks.push('熱水器迴路的漏電保護、接地與手動隔離方式尚未記錄。');
    if(['C-OUT-4F-02','C-OUT-4F-03'].includes(circuit.id))checks.push('請核對廚房／餐廳小型電器插座的專用分路與額定；目前僅標示一般插座，斷路器尚未定案。');
    if(circuit.id==='C-220-IH')checks.push('IH 型號 KZ-J1H6AST 的銘牌電壓、額定電流與規劃 220V 迴路相容性，須依原廠資料及現場供電確認。');
    if(circuit.id==='C-220-AC-BEDROOMS')checks.push('一對二冷氣目前列兩個 220V 點位；應依室外機供電方式確認是否都需要獨立出線。');
    if(unlinked.length)checks.push(`${unlinked.length} 件電器尚未對應實際插座／出線口；圖上的方形僅是預定位置。`);
    if(unreachable.length)checks.push(`${unreachable.length} 個端點在已建模門洞之間無法求得通路，應核對牆線、門洞與端點位置。`);
    const detours=ends.filter(e=>{const r=routes.get(e.id);return r&&r.straightCm>100&&r.lengthCm/r.straightCm>2.5;});
    if(detours.length)checks.push(`${detours.length} 個端點的圖面繞行超過直線距離 2.5 倍，請核對實際管路。`);
    if(circuit.category==='lighting'&&grouped.size>2)checks.push(`此照明分路跨 ${grouped.size} 個空間，需確認分線盒、開關控制與維修標示。`);
    if(circuit.category==='lighting')checks.push(data.metadata.lighting_reconciliation_note);
    if(!points.length&&!loads.length)checks.push('此迴路沒有任何出線點或電器負載。');
    const badVoltage=points.filter(p=>Number(data.point_types[p.type]?.voltage)!==Number(circuit.voltage));if(badVoltage.length)checks.push(`${badVoltage.length} 個點位與迴路標稱電壓不一致。`);
    const controlGroups=(data.control_groups||[]).filter(g=>g.point_ids.some(id=>points.some(p=>p.id===id)));
    topology.innerHTML=`<div class="circuit-title"><b>${esc(panel.name)} → ${esc(circuit.name)}</b><span>${esc(circuit.voltage)} V · ${typeof circuit.conductor_mm2==='number'?`${esc(circuit.conductor_mm2)} mm²`:'線徑待確認'}</span></div><p class="micro">${points.length} 個圖面點位 · ${loads.length} 件電器 · 最遠圖面路徑：${distance}</p>
      <div class="circuit-tree"><div class="tree-root">配電箱 ${esc(panel.id)}<small>主臥床左側，座標待量測</small></div><div class="tree-branch">分路 ${esc(circuit.id)}<small>${esc(circuit.status)} · ${typeof circuit.breaker_a==='number'?`斷路器 ${esc(circuit.breaker_a)} A`:'斷路器待確認'}</small></div>${[...grouped].map(([roomId,pp])=>`<details open><summary>${esc(rooms.get(roomId)?.name||roomId)} · ${pp.length} 點</summary>${pp.map(p=>`<button type="button" data-point-id="${esc(p.id)}">${esc(p.id)} · ${esc(data.point_types[p.type]?.label||p.type)}${linked.has(p.id)?`<small>→ ${esc(linked.get(p.id).map(a=>a.name).join('、'))}（圖面推定）</small>`:''}</button>`).join('')}</details>`).join('')}${unlinked.length?`<details open><summary>尚無實際出線點 · ${unlinked.length} 件</summary>${unlinked.map(a=>`<button type="button" data-load-id="${esc(a.id)}">${esc(a.name)}<small>${esc(a.link_status)}</small></button>`).join('')}</details>`:''}${controlGroups.length?`<details><summary>燈控群組 · ${controlGroups.length} 組</summary>${controlGroups.map(g=>`<div class="tree-control">${esc(g.id)} · ${g.point_ids.filter(id=>points.some(p=>p.id===id)).length} 燈</div>`).join('')}</details>`:''}</div>
      <div class="circuit-audit"><h4>走線檢查</h4><p class="micro">${esc(data.route_preview.note)}</p>${checks.length?`<ul>${checks.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p>資料未發現可自動判定的缺口，仍須按實際管路與負載覆核。</p>'}<p>電箱及未定點位先依示意座標標示。線徑、壓降、漏電與斷路器匹配均需現場資料才能審核。參考：<a href="https://law.moea.gov.tw/LawContent.aspx?id=FL011045" target="_blank" rel="noopener noreferrer">經濟部用戶用電設備裝置規則</a>。</p></div>
      <details class="circuit-picker"><summary>切換其他迴路（共 ${data.circuits.length} 組）</summary><button type="button" data-circuit-id="all">全室插座總覽</button>${data.circuits.map(c=>`<button type="button" data-circuit-id="${esc(c.id)}" class="${c.id===circuit.id?'is-current':''}">${esc(c.name)} <small>${data.points.filter(p=>p.circuit_id===c.id).length} 點</small></button>`).join('')}</details>`;
    const showLoad=id=>{const a=loads.find(v=>v.id===id);if(!a)return;target.querySelector('#electricalDetails').innerHTML=`<h3>${esc(a.name)}</h3><dl><div><dt>迴路</dt><dd>${esc(circuit.name)}</dd></div><div><dt>定位</dt><dd>${esc(a.link_status)}</dd></div><div><dt>點位</dt><dd>${esc(a.point_id||'尚未對應')}</dd></div><div><dt>來源</dt><dd>${esc(a.source)}</dd></div></dl>`;};
    canvas.addEventListener('click',e=>{const point=e.target.closest('[data-point-id]'),load=e.target.closest('[data-load-id]');if(point)selectPoint(point.dataset.pointId);else if(load)showLoad(load.dataset.loadId);});
    canvas.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;const node=e.target.closest('[data-point-id],[data-load-id]');if(node){e.preventDefault();if(node.dataset.pointId)selectPoint(node.dataset.pointId);else showLoad(node.dataset.loadId);}});
    topology.addEventListener('click',e=>{const circuitButton=e.target.closest('[data-circuit-id]'),point=e.target.closest('[data-point-id]'),load=e.target.closest('[data-load-id]');if(circuitButton){state.selectedCircuitId=circuitButton.dataset.circuitId;window.renderElectricalExperience(state);}else if(point)selectPoint(point.dataset.pointId);else if(load)showLoad(load.dataset.loadId);});
    target.querySelector('#electricalDetails').innerHTML=`<h3>迴路拓樸</h3><p>${esc(circuit.name)}由 ${esc(panel.name)} 出線。點選圖面端點、下方點位或負載查看詳情。</p>`;
  }
  return {render,router,previewRoutes};
})();
