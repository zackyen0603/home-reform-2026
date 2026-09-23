'use strict';

// This view reads electrical.yaml and floorplan.yaml; it never stores a second copy
// of either the positions or the circuit assignments.
window.renderElectricalExperience = function renderElectricalExperience(state) {
  if (state.electricalCleanup) state.electricalCleanup();
  const electrical = state.electrical;
  const floor = state.plan.floors.find(item => item.id === (electrical.coordinate_system?.floor_id || '4F'));
  const target = document.getElementById('electrical');
  if (!floor) {
    target.innerHTML = '<div class="error-box">找不到四樓平面圖。</div>';
    return;
  }

  const typeLabels = electrical.point_types || {};
  const lighting = window.LightingPreview;
  const rooms = new Map(floor.rooms.map(room => [room.id, room]));
  const circuits = new Map(electrical.circuits.map(circuit => [circuit.id, circuit]));
  const points = electrical.points;
  const typeOf = point => ['downlight', 'pendant', 'ceiling_light'].includes(point.type) ? 'lighting' : 'outlets';
  const titleOf = point => typeLabels[point.type]?.label || point.type;
  const colorOf = point => typeLabels[point.type]?.render_color || '#85755f';
  const symbolOf = point => ({general_outlet:'S', optional_outlet:'S?', high_level_outlet:'U', planned_220v:'V', downlight:'D', pendant:'P', ceiling_light:'C'})[point.type] || '•';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const selectedId = state.electricalSelectedId || points[0]?.id;
  const view = state.electricalView || '2d';
  const selectedCircuitId = state.selectedCircuitId || 'all';
  const routeFilter = state.electricalRouteFilter || 'all';
  const routeRoom = state.electricalRouteRoom || 'all';
  const showRoutes = Boolean(state.electricalShowRoutes);
  const roomFilter = state.electricalRoom || 'all';
  const kindFilter = state.electricalKind || 'all';
  const search = state.electricalSearch || '';
  const matching = point => view === 'circuits' ? selectedCircuitId === 'all' ? typeOf(point)==='outlets' : point.circuit_id === selectedCircuitId : (roomFilter === 'all' || point.space_id === roomFilter)
    && (kindFilter === 'all' || typeOf(point) === kindFilter || point.type === kindFilter)
    && (!state.electricalSearch || [point.id, titleOf(point), rooms.get(point.space_id)?.name, circuits.get(point.circuit_id)?.name]
      .some(value => String(value || '').toLocaleLowerCase().includes(state.electricalSearch.toLocaleLowerCase())));
  const visible = points.filter(matching);
  const lightingGroups = (electrical.control_groups || []).filter(group => group.point_ids.some(id => points.some(point => point.id === id && (roomFilter === 'all' || point.space_id === roomFilter))));
  const ambientPercent = lighting.ambient(state,electrical);
  const lightingEnabled = state.lightingPreviewEnabled !== false;
  const lightingGroupLabel = group => {
    const point=points.find(item=>group.point_ids.includes(item.id));
    return `${rooms.get(point?.space_id)?.name || '四樓'} · ${typeLabels[point?.type]?.label || '燈具'}`;
  };

  const roomOptions = floor.rooms.map(room => `<option value="${escapeHtml(room.id)}">${escapeHtml(room.name)}</option>`).join('');
  const routeRoomOptions = floor.rooms.filter(room => points.some(point => point.space_id === room.id))
    .map(room => `<option value="${escapeHtml(room.id)}">${escapeHtml(room.name)}</option>`).join('');
  const routeRoomName = rooms.get(routeRoom)?.name || '全室';
  const stats = ['general_outlet', 'optional_outlet', 'high_level_outlet', 'planned_220v', 'downlight', 'pendant', 'ceiling_light']
    .map(type => `<span><b>${points.filter(point => point.type === type).length}</b> ${escapeHtml(typeLabels[type]?.label || type)}</span>`).join('');
  target.innerHTML = `
    <div class="section-heading"><div><h2>四樓燈具與插座</h2><p>按空間與種類查找；點選平面圖或清單可查看點位、回路與高度。</p></div></div>
    <div class="electrical-summary" aria-label="各類點位數量">${stats}</div>
    <div class="electrical-toolbar">
      ${view === 'circuits' ? `<label>預覽迴路<select id="electricalCircuit"><option value="all" ${selectedCircuitId==='all'?'selected':''}>全室插座總覽</option>${electrical.circuits.map(c=>`<option value="${escapeHtml(c.id)}" ${c.id===selectedCircuitId?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select></label>` : `<label>空間<select id="electricalRoom"><option value="all">全部空間</option>${roomOptions}</select></label>
      <label>種類<select id="electricalKind"><option value="all">全部點位</option><option value="outlets">全部插座</option><option value="general_outlet">一般插座</option><option value="optional_outlet">選配插座</option><option value="high_level_outlet">高位插座</option><option value="planned_220v">220V 規劃</option><option value="lighting">全部燈具</option><option value="downlight">崁燈</option><option value="pendant">吊燈</option><option value="ceiling_light">吸頂燈</option></select></label>
      <label>搜尋點位<input id="electricalSearch" type="search" placeholder="ID、空間或回路" value="${escapeHtml(search)}"></label>`}
      <label class="furniture-toggle"><input id="electricalFurnitureToggle" type="checkbox" ${state.showFurniture ? 'checked' : ''}> 顯示家具</label>
      ${view !== 'circuits' ? `<label class="route-toggle"><input id="electricalRoutesToggle" type="checkbox" ${showRoutes?'checked':''}> 顯示迴路佈線</label><label class="route-room">佈線房間<select id="electricalRouteRoom"><option value="all">全室</option>${routeRoomOptions}</select></label><label class="route-filter">佈線範圍<select id="electricalRouteFilter"><option value="all">插座與燈具</option><option value="outlets">僅插座／220V</option><option value="lighting">僅電燈</option>${electrical.circuits.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}</select></label>` : ''}
      <div class="electrical-view-switch" role="group" aria-label="視圖模式">
        <button type="button" data-electrical-view="2d" aria-pressed="${view === '2d'}">2D</button>
        <button type="button" data-electrical-view="3d" aria-pressed="${view === '3d'}">3D 俯瞰</button>
        <button type="button" data-electrical-view="walk" aria-pressed="${view === 'walk'}">第一人稱</button>
        <button type="button" data-electrical-view="circuits" aria-pressed="${view === 'circuits'}">迴路拓樸</button>
      </div>
    </div>
    ${view !== 'circuits' ? `<section class="lighting-preview-panel" aria-label="燈光情境預覽">
      <div class="lighting-preview-heading"><div><h3>燈光情境預覽</h3><p>依 40 個圖面燈具與 13 組開關模擬，外形及照射範圍可從 electrical.yaml 調整。</p></div><label class="lighting-enable"><input id="lightingPreviewEnabled" type="checkbox" ${lightingEnabled?'checked':''}> 啟用光照</label></div>
      <div class="lighting-preview-actions"><label class="lighting-ambient">環境亮度 <input id="lightingAmbient" type="range" min="0" max="100" step="5" value="${ambientPercent}"><output id="lightingAmbientValue">${ambientPercent}%</output></label><div class="lighting-presets" role="group" aria-label="環境亮度情境"><button type="button" data-light-preset="85">白天</button><button type="button" data-light-preset="45">傍晚</button><button type="button" data-light-preset="10">夜間</button></div><button type="button" data-light-bulk="on">${roomFilter==='all'?'全部':'此空間'}開燈</button><button type="button" data-light-bulk="off">${roomFilter==='all'?'全部':'此空間'}關燈</button></div>
      <details class="lighting-groups" ${state.lightingGroupsOpen===false?'':'open'}><summary>燈具開關群組（${lightingGroups.length} 組）</summary><div class="lighting-group-grid">${lightingGroups.map(group=>`<label><input type="checkbox" data-light-group="${escapeHtml(group.id)}" ${state.lightingGroups?.[group.id]===false?'':'checked'}><span>${escapeHtml(lightingGroupLabel(group))}<small>${group.point_ids.length} 盞 · ${escapeHtml(group.id)}</small></span></label>`).join('')}</div></details>
      <p class="lighting-disclaimer">亮度與光暈為配置比較示意，未包含燈具光通量、配光曲線、反射率或日照，不能當作照度驗收結果。牆上開關仍只規劃開／關。</p>
    </section>` : ''}
    <div class="electrical-workspace">
      <div class="electrical-map-wrap">
        <div id="electricalCanvas" class="electrical-canvas" aria-label="四樓電力配置圖"></div>
        <div class="electrical-map-help">${view === 'circuits' ? '全室總覽先顯示插座；選擇迴路查看從主臥電箱計算的平面通達示意。' : view === 'walk' ? '桌面：WASD／方向鍵移動，拖曳轉向；手機：左側方向鍵移動、右半畫面拖曳轉向。點選標記查看資料。' : view === '3d' ? '拖曳旋轉；滾輪或右側 ＋／－ 按鈕縮放。點選標記查看資料。' : '點選標記查看資料；手機可左右滑動平面圖。座標為規劃示意，非施工放樣。'}${view !== 'circuits' && showRoutes ? ` <span class="route-legend"><i class="route-key-outlet"></i>插座／220V <i class="route-key-light"></i>電燈</span> 目前顯示${escapeHtml(routeRoomName)}的端點連線；路徑從主臥電箱出發，可能經過其他房間。僅供示意，非實際配管。` : ''}</div>
      </div>
      <aside class="electrical-inspector"><div id="electricalDetails" aria-live="polite"></div>
        ${view === 'circuits' ? '<div id="circuitTopology"></div>' : ''}
        <h3>點位清單 <small>${visible.length}／${points.length}</small></h3>
        <div class="electrical-point-list" id="electricalPointList">${visible.map(point => `<button type="button" class="electrical-list-item" data-point-id="${escapeHtml(point.id)}"><i style="background:${escapeHtml(colorOf(point))}"></i><span><b>${escapeHtml(point.id)}</b><small>${escapeHtml(rooms.get(point.space_id)?.name || point.space_id)} · ${escapeHtml(titleOf(point))}</small></span></button>`).join('') || '<p class="micro">此篩選條件沒有點位。</p>'}</div>
      </aside>
    </div>
    <p class="electrical-caveat">${escapeHtml(electrical.metadata?.warning || '點位需現場覆核。')} 一般插座圖例為 26 點，辨識結果為 27 點，仍待逐點核對。</p>
    <details class="electrical-circuit-details"><summary>查看回路資料（${circuits.size} 組）</summary><div class="table-wrap"><table><thead><tr><th>回路</th><th>電壓</th><th>線徑</th><th>狀態</th></tr></thead><tbody>${electrical.circuits.map(circuit => `<tr><td>${escapeHtml(circuit.name)}<br><small>${escapeHtml(circuit.id)}</small></td><td>${escapeHtml(circuit.voltage)} V</td><td>${escapeHtml(circuit.conductor_mm2)} mm²</td><td>${escapeHtml(circuit.status)}</td></tr>`).join('')}</tbody></table></div></details>`;

  const canvas = target.querySelector('#electricalCanvas');
  const details = target.querySelector('#electricalDetails');
  const list = target.querySelector('#electricalPointList');
  const teardown = [];
  function selectPoint(id) {
    const point = points.find(item => item.id === id);
    if (!point) return;
    state.electricalSelectedId = id;
    const circuit = circuits.get(point.circuit_id);
    const height = Number(point.position[2]);
    details.innerHTML = `<div class="electrical-detail-heading"><span class="electrical-dot" style="background:${escapeHtml(colorOf(point))}"></span><div><small>${escapeHtml(point.id)}</small><h3>${escapeHtml(titleOf(point))}</h3></div></div>
      <dl><div><dt>空間</dt><dd>${escapeHtml(rooms.get(point.space_id)?.name || point.space_id)}</dd></div><div><dt>回路</dt><dd>${escapeHtml(circuit?.name || point.circuit_id)}<small>${escapeHtml(point.circuit_id)}</small></dd></div><div><dt>電壓</dt><dd>${escapeHtml(circuit?.voltage || typeLabels[point.type]?.voltage || '待確認')} V</dd></div><div><dt>安裝高度</dt><dd>${Number.isFinite(height) ? height + ' cm' : '待確認'}</dd></div><div><dt>平面座標</dt><dd>${escapeHtml(point.position[0])}, ${escapeHtml(point.position[1])} cm</dd></div><div><dt>狀態</dt><dd>${escapeHtml(point.status)}</dd></div>${point.control_group_id ? `<div><dt>燈控群組</dt><dd>${escapeHtml(point.control_group_id)}</dd></div>` : ''}${lighting.isFixture(point) ? `<div><dt>模型示意</dt><dd>${escapeHtml(lighting.settings(electrical,point).diameter_cm)} cm · ${escapeHtml(lighting.settings(electrical,point).color_temperature_k)}K<br><small>${lighting.isOn(state,point)?'開燈':'關燈'}</small></dd></div>` : ''}${point.intended_load ? `<div><dt>預定負載</dt><dd>${escapeHtml(point.intended_load)}</dd></div>` : ''}</dl>`;
    target.querySelectorAll('[data-point-id]').forEach(el => el.classList.toggle('is-selected', el.dataset.pointId === id));
    list.querySelector(`[data-point-id="${CSS.escape(id)}"]`)?.scrollIntoView({block:'nearest'});
  }
  function selectFurniture(id) {
    const item = window.FurnitureView.itemsForFloor(state.furniture,floor.id).find(value=>value.id===id);
    if (!item) return;
    details.innerHTML = `<div class="furniture-detail"><small>家具配置</small><br>${window.FurnitureView.detailHtml(item,escapeHtml)}</div>`;
    target.querySelectorAll('[data-point-id]').forEach(el=>el.classList.remove('is-selected'));
    target.querySelectorAll('[data-furniture-id]').forEach(el=>el.classList.toggle('is-selected',el.dataset.furnitureId===id));
  }
  if (view === 'circuits') target.querySelector('#electricalCircuit').addEventListener('change',event=>{state.selectedCircuitId=event.target.value;window.renderElectricalExperience(state);});
  else {
    target.querySelector('#electricalRoom').value = roomFilter;
    target.querySelector('#electricalKind').value = kindFilter;
    target.querySelector('#electricalRoom').addEventListener('change', event => {state.electricalRoom = event.target.value; window.renderElectricalExperience(state);});
    target.querySelector('#electricalKind').addEventListener('change', event => {state.electricalKind = event.target.value; window.renderElectricalExperience(state);});
  }
  if(view !== 'circuits') {
    target.querySelector('#electricalRouteFilter').value=routeFilter;
    target.querySelector('#electricalRouteRoom').value=routeRoom;
    target.querySelector('#electricalRoutesToggle').addEventListener('change',event=>{state.electricalShowRoutes=event.target.checked;window.renderElectricalExperience(state);});
    target.querySelector('#electricalRouteFilter').addEventListener('change',event=>{state.electricalRouteFilter=event.target.value;state.electricalShowRoutes=true;window.renderElectricalExperience(state);});
    target.querySelector('#electricalRouteRoom').addEventListener('change',event=>{state.electricalRouteRoom=event.target.value;state.electricalShowRoutes=true;window.renderElectricalExperience(state);});
  }
  if(view !== 'circuits') {
    const panel=target.querySelector('.lighting-preview-panel');
    const rerender=()=>window.renderElectricalExperience(state);
    panel.querySelector('#lightingPreviewEnabled').addEventListener('change',event=>{state.lightingPreviewEnabled=event.target.checked;rerender();});
    panel.querySelector('#lightingAmbient').addEventListener('input',event=>{
      state.lightingAmbient=Number(event.target.value);
      panel.querySelector('#lightingAmbientValue').textContent=event.target.value+'%';
      state.electricalLightingController?.(state.lightingAmbient);
    });
    panel.querySelectorAll('[data-light-preset]').forEach(button=>button.addEventListener('click',()=>{
      state.lightingAmbient=Number(button.dataset.lightPreset);panel.querySelector('#lightingAmbient').value=state.lightingAmbient;
      panel.querySelector('#lightingAmbientValue').textContent=state.lightingAmbient+'%';
      state.electricalLightingController?.(state.lightingAmbient);
    }));
    panel.querySelectorAll('[data-light-bulk]').forEach(button=>button.addEventListener('click',()=>{
      state.lightingGroups ??={};
      lightingGroups.forEach(group=>{state.lightingGroups[group.id]=button.dataset.lightBulk==='on';});
      rerender();
    }));
    panel.querySelectorAll('[data-light-group]').forEach(input=>input.addEventListener('change',()=>{
      state.lightingGroups ??={};state.lightingGroups[input.dataset.lightGroup]=input.checked;rerender();
    }));
    panel.querySelector('.lighting-groups').addEventListener('toggle',event=>{state.lightingGroupsOpen=event.target.open;});
  }
  target.querySelector('#electricalFurnitureToggle').addEventListener('change', event => {state.showFurniture = event.target.checked; window.renderElectricalExperience(state); if (typeof renderFloorplan === 'function') renderFloorplan();});
  target.querySelector('#electricalSearch')?.addEventListener('input', event => {
    state.electricalSearch = event.target.value;
    // Keep the map and list in sync without stealing focus from the search box.
    const cursor = event.target.selectionStart;
    window.renderElectricalExperience(state);
    const field = document.getElementById('electricalSearch');field.focus();field.setSelectionRange(cursor,cursor);
  });
  target.querySelectorAll('[data-electrical-view]').forEach(button => button.addEventListener('click', () => {
    if (state.electricalView === button.dataset.electricalView) return;
    state.electricalView = button.dataset.electricalView;
    window.renderElectricalExperience(state);
  }));
  list.addEventListener('click', event => {const button = event.target.closest('[data-point-id]'); if (button) selectPoint(button.dataset.pointId);});

  if (view === 'circuits') window.ElectricalCircuitView.render(state,floor,canvas,target,selectPoint);
  else if (view === '2d') render2D();
  else render3D(view === 'walk');
  if (view !== 'circuits') selectPoint(visible.some(point => point.id === selectedId) ? selectedId : visible[0]?.id);
  state.electricalCleanup = () => {state.electricalLightingController=null;teardown.splice(0).forEach(dispose => dispose());};

  function render2D() {
    const pad = 35, b = floor.bounds;
    const routeItems=showRoutes?window.ElectricalCircuitView.previewRoutes(electrical,floor,routeFilter,routeRoom):[];
    const routeSvg=routeItems.map(({route,kind})=>route?`<polyline class="circuit-route electrical-route-${kind}" points="${route.path.map(p=>p.join(',')).join(' ')}"/>`:'').join('');
    const fixtureSvg=visible.map(point=>lighting.isFixture(point)
      ? lighting.svgFixture(electrical,point,state,escapeHtml)
      : `<g class="electrical-marker" data-point-id="${escapeHtml(point.id)}" tabindex="0" role="button" aria-label="${escapeHtml(point.id + ' ' + titleOf(point))}" transform="translate(${point.position[0]} ${point.position[1]})"><circle r="13" fill="${escapeHtml(colorOf(point))}"/><text y=".5">${escapeHtml(symbolOf(point))}</text></g>`).join('');
    canvas.classList.add('is-2d');
    canvas.innerHTML = `<svg viewBox="${-pad} ${-pad} ${b.width + 2*pad} ${b.depth + 2*pad}" role="img" aria-label="四樓插座與燈具平面圖">
      <g class="electrical-scene-base" style="filter:brightness(${lightingEnabled?lighting.ambientBrightness(ambientPercent):1})">
      <rect x="${-pad}" y="${-pad}" width="${b.width + 2*pad}" height="${b.depth + 2*pad}" fill="#f4f0e7"/>
      ${floor.rooms.map(room => `<polygon points="${room.polygon.map(pair => pair.join(',')).join(' ')}" fill="${roomColor(room.category)}" opacity=".75"/>`).join('')}
      ${floor.walls.map(wall => `<line x1="${wall.start[0]}" y1="${wall.start[1]}" x2="${wall.end[0]}" y2="${wall.end[1]}" stroke="#515750" stroke-width="${wall.thickness || 10}"/>`).join('')}
      ${state.showFurniture ? window.FurnitureView.svg(window.FurnitureView.itemsForFloor(state.furniture,floor.id),escapeHtml) : ''}
      </g>
      ${lighting.svgWash(electrical,floor,state)}
      ${routeSvg}
      ${showRoutes ? `<g class="circuit-panel" transform="translate(${electrical.distribution_panel.position[0]} ${electrical.distribution_panel.position[1]})"><rect x="-17" y="-18" width="34" height="36" rx="5"/><text y="5">盤</text></g>` : ''}
      ${floor.rooms.map(room => {const [x,y] = centroid(room.polygon); return `<text class="electrical-room-name" x="${x}" y="${y}">${escapeHtml(room.name)}</text>`;}).join('')}
      ${fixtureSvg}
    </svg>`;
    state.electricalLightingController=value=>{const base=canvas.querySelector('.electrical-scene-base');if(base)base.style.filter=`brightness(${lightingEnabled?lighting.ambientBrightness(value):1})`;};
    canvas.addEventListener('click', event => {const marker=event.target.closest('[data-point-id]');const furniture=event.target.closest('[data-furniture-id]');if(marker)selectPoint(marker.dataset.pointId);else if(furniture)selectFurniture(furniture.dataset.furnitureId);});
    canvas.addEventListener('keydown', event => {const node=event.target.closest('[data-point-id],[data-furniture-id]');if(node && ['Enter',' '].includes(event.key)){event.preventDefault();if(node.dataset.pointId)selectPoint(node.dataset.pointId);else selectFurniture(node.dataset.furnitureId);}});
  }

  function render3D(walk) {
    if (!window.THREE) {canvas.innerHTML = '<p class="error-box">3D 函式庫未載入，請確認網路後重試。</p>';return;}
    const THREE = window.THREE;
    let renderer;
    try {renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'low-power'});}
    catch (error) {canvas.innerHTML = '<p class="error-box">此瀏覽器目前無法啟用 WebGL；仍可使用 2D 檢視。</p>';return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.domElement.style.touchAction = 'none';
    canvas.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const hemi=new THREE.HemisphereLight(0xffffff,0x777866,1.65);scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff,.65);sun.position.set(200,550,100);scene.add(sun);
    state.electricalLightingController=value=>{
      const fraction=lightingEnabled?Math.max(0,Math.min(1,value/100)):1;
      hemi.intensity=.18+1.47*fraction;sun.intensity=.05+.6*fraction;
      scene.background=new THREE.Color('#ece8df').multiplyScalar(.23+.77*fraction);
    };
    state.electricalLightingController(ambientPercent);
    const camera = new THREE.PerspectiveCamera(walk ? 76 : 48,canvas.clientWidth/canvas.clientHeight,.5,4000);
    const floorMeshes = [];
    floor.rooms.forEach(room => {
      const shape = new THREE.Shape();room.polygon.forEach((p,i) => i ? shape.lineTo(p[0],p[1]) : shape.moveTo(p[0],p[1]));
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshLambertMaterial({color:roomColor(room.category),side:THREE.DoubleSide}));
      mesh.rotation.x = -Math.PI/2;mesh.position.y = -.5;scene.add(mesh);floorMeshes.push(mesh);
    });
    floor.walls.forEach(wall => {
      const dx=wall.end[0]-wall.start[0], dz=wall.end[1]-wall.start[1], length=Math.hypot(dx,dz), height=wall.height || floor.ceiling_height || 280;
      const material=new THREE.MeshLambertMaterial({color:wall.exterior?0x72776e:0xa7a79d,side:THREE.DoubleSide,transparent:walk,opacity:walk?.86:1});
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(length,height,wall.thickness||10),material);
      mesh.position.set((wall.start[0]+wall.end[0])/2,height/2,(wall.start[1]+wall.end[1])/2);
      mesh.rotation.y=-Math.atan2(dz,dx);scene.add(mesh);
    });
    const furnitureItems = state.showFurniture ? window.FurnitureView.itemsForFloor(state.furniture,floor.id) : [];
    const furnitureGroups=window.FurnitureView.add3D(scene,furnitureItems,THREE);
    if(showRoutes) {
      const routeItems=window.ElectricalCircuitView.previewRoutes(electrical,floor,routeFilter,routeRoom);
      const routeGroup=new THREE.Group();routeGroup.name='electrical-route-preview';
      const outletSegments=[],lightSegments=[];
      routeItems.forEach(({point,route,kind})=>{
        if(!route)return;
        const height=kind==='lighting'?floor.ceiling_height-17:Math.min(210,floor.ceiling_height-55);
        const segments=kind==='lighting'?lightSegments:outletSegments;
        const path=route.path;
        for(let i=1;i<path.length;i++)segments.push(path[i-1][0],height,path[i-1][1],path[i][0],height,path[i][1]);
        segments.push(point.position[0],height,point.position[1],point.position[0],Math.max(10,Math.min(Number(point.position[2])||height,floor.ceiling_height-5)),point.position[1]);
        segments.push(electrical.distribution_panel.position[0],electrical.distribution_panel.position[2],electrical.distribution_panel.position[1],electrical.distribution_panel.position[0],height,electrical.distribution_panel.position[1]);
      });
      [[outletSegments,0x32877b],[lightSegments,0xd89b35]].forEach(([segments,color])=>{
        if(!segments.length)return;
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));
        routeGroup.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.68,depthTest:false})));
      });
      routeGroup.renderOrder=1;scene.add(routeGroup);
      const panel=electrical.distribution_panel;
      const panelMarker=new THREE.Mesh(new THREE.BoxGeometry(18,25,7),new THREE.MeshBasicMaterial({color:0x263e37,depthTest:false}));
      panelMarker.position.set(panel.position[0],panel.position[2],panel.position[1]);panelMarker.renderOrder=2;scene.add(panelMarker);
    }
    const markerMeshes=lighting.add3D(scene,electrical,floor,visible,state,THREE);
    visible.filter(point=>!lighting.isFixture(point)).forEach(point => {
      const color=new THREE.Color(colorOf(point));
      const [x,z,rawHeight]=point.position;
      const height=Number(rawHeight);
      const y=Number.isFinite(height)?height:105;
      const sphere=new THREE.Mesh(new THREE.SphereGeometry(9,12,8),new THREE.MeshBasicMaterial({color,depthTest:false}));
      sphere.position.set(x,Math.max(10,Math.min(y,floor.ceiling_height-5)),z);sphere.renderOrder=2;sphere.userData.pointId=point.id;scene.add(sphere);markerMeshes.push(sphere);
      const halo=new THREE.Mesh(new THREE.RingGeometry(12,15,16),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,depthTest:false}));
      halo.position.copy(sphere.position);halo.lookAt(walk?camera.position:new THREE.Vector3(x,900,z));halo.renderOrder=2;halo.userData.pointId=point.id;scene.add(halo);markerMeshes.push(halo);
    });
    const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
    const focusRoom=rooms.get(roomFilter);
    const boundsOfFocus=focusRoom ? {width:Math.max(...focusRoom.polygon.map(p=>p[0]))-Math.min(...focusRoom.polygon.map(p=>p[0])),depth:Math.max(...focusRoom.polygon.map(p=>p[1]))-Math.min(...focusRoom.polygon.map(p=>p[1]))} : floor.bounds;
    let yaw=0,pitch=0,radius=Math.max(boundsOfFocus.width,boundsOfFocus.depth)*(focusRoom?1.65:1.1),orbitPhi=.85;
    const focus=focusRoom?centroid(focusRoom.polygon):[floor.bounds.width/2,floor.bounds.depth/2];
    const center=new THREE.Vector3(focus[0],80,focus[1]);
    const spawn=focusRoom || floor.rooms.find(room=>room.id==='4f-living-dining') || floor.rooms[0];
    const spawnPoint=centroid(spawn.polygon);
    if (walk) camera.position.set(spawnPoint[0],155,spawnPoint[1]);
    function updateCamera() {
      if(walk) camera.rotation.set(pitch,yaw,0,'YXZ');
      else {camera.position.set(center.x+radius*Math.sin(orbitPhi)*Math.cos(yaw),center.y+radius*Math.cos(orbitPhi),center.z+radius*Math.sin(orbitPhi)*Math.sin(yaw));camera.lookAt(center);}
    }
    if (walk) yaw=Math.PI;updateCamera();
    const keys=new Set();let touching=false,px=0,py=0,downX=0,downY=0,moveX=0,moveY=0,lookPointer=null;
    const onKeyDown=event=>{if(!walk||document.activeElement?.matches('input,select,textarea'))return; if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){keys.add(event.code);event.preventDefault();}};
    const onKeyUp=event=>keys.delete(event.code);
    window.addEventListener('keydown',onKeyDown);window.addEventListener('keyup',onKeyUp);
    teardown.push(()=>{window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);});
    const move=event=>{if(!touching||event.pointerId!==lookPointer)return;const dx=event.clientX-px,dy=event.clientY-py;px=event.clientX;py=event.clientY;
      yaw-=dx*.006;if(walk)pitch=Math.max(-1.3,Math.min(1.3,pitch-dy*.006));else orbitPhi=Math.max(.28,Math.min(1.48,orbitPhi+dy*.006));updateCamera();};
    const down=event=>{if(event.pointerType==='touch'&&walk&&event.clientX<canvas.getBoundingClientRect().left+canvas.clientWidth*.35)return;touching=true;lookPointer=event.pointerId;px=downX=event.clientX;py=downY=event.clientY;renderer.domElement.setPointerCapture(event.pointerId);};
    const up=event=>{if(event.pointerId!==lookPointer)return;touching=false;lookPointer=null;
      if(Math.hypot(event.clientX-downX,event.clientY-downY)<8){const rect=renderer.domElement.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);raycaster.params.Mesh.threshold=8;const hit=raycaster.intersectObjects(markerMeshes)[0];if(hit)selectPoint(hit.object.userData.pointId);else {const furniture=raycaster.intersectObjects(furnitureGroups,true)[0];if(furniture)selectFurniture(furniture.object.userData.furnitureId);}}};
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
    const onWheel=event=>{if(walk)return;event.preventDefault();radius=Math.max(280,Math.min(2300,radius*(1+event.deltaY*.001)));updateCamera();};
    renderer.domElement.addEventListener('wheel',onWheel,{passive:false});
    teardown.push(()=>{renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',up);renderer.domElement.removeEventListener('wheel',onWheel);});
    // Wall collision and the exterior bounds leave door openings passable, even
    // where adjacent room polygons have a small drafting gap between them.
    const wallDistance=(x,z,w)=>{const ax=w.start[0],az=w.start[1],dx=w.end[0]-ax,dz=w.end[1]-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-ax-t*dx,z-az-t*dz);};
    const canWalk=(x,z)=>x>12&&z>12&&x<floor.bounds.width-12&&z<floor.bounds.depth-12&&floor.walls.every(w=>wallDistance(x,z,w)>Math.max(12,(w.thickness||10)/2+9))&&furnitureItems.every(item=>{const b=window.FurnitureView.footprint(item);return x<b.left-12||x>b.right+12||z<b.top-12||z>b.bottom+12;});
    if(walk){
      const pad=document.createElement('div');pad.className='electrical-dpad';pad.setAttribute('aria-label','移動控制');
      pad.innerHTML='<button type="button" data-move="forward" aria-label="前進">▲</button><button type="button" data-move="left" aria-label="向左">◀</button><button type="button" data-move="backward" aria-label="後退">▼</button><button type="button" data-move="right" aria-label="向右">▶</button>';
      canvas.appendChild(pad);
      pad.querySelectorAll('button').forEach(button=>{const direction=button.dataset.move;
        const start=event=>{event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(direction);};
        const end=event=>{event.preventDefault();keys.delete(direction);};
        button.addEventListener('pointerdown',start);button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);button.addEventListener('lostpointercapture',end);
      });
    } else {
      const zoom=document.createElement('div');zoom.className='electrical-zoom';
      zoom.innerHTML='<button type="button" data-zoom="in" aria-label="放大 3D 視圖">＋</button><button type="button" data-zoom="out" aria-label="縮小 3D 視圖">－</button>';
      canvas.appendChild(zoom);
      zoom.addEventListener('click',event=>{const button=event.target.closest('[data-zoom]');if(!button)return;radius=Math.max(280,Math.min(2300,radius*(button.dataset.zoom==='in'?.8:1.25)));updateCamera();});
    }
    let frame,previous=performance.now();
    function animate(now){frame=requestAnimationFrame(animate);const dt=Math.min(.05,(now-previous)/1000);previous=now;
      if(walk){const forward=Number(keys.has('KeyW')||keys.has('ArrowUp')||keys.has('forward'))-Number(keys.has('KeyS')||keys.has('ArrowDown')||keys.has('backward'));
        const strafe=Number(keys.has('KeyD')||keys.has('ArrowRight')||keys.has('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||keys.has('left'));
        if(forward||strafe){const speed=150*dt/Math.hypot(forward,strafe),dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*strafe)*speed;
          if(canWalk(camera.position.x+dx,camera.position.z))camera.position.x+=dx;
          if(canWalk(camera.position.x,camera.position.z+dz))camera.position.z+=dz;}}
      markerMeshes.forEach(mesh=>{if(mesh.geometry.type==='RingGeometry')mesh.lookAt(camera.position);});
      renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(animate);
    const resize=new ResizeObserver(()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});resize.observe(canvas);
    teardown.push(()=>{cancelAnimationFrame(frame);resize.disconnect();scene.traverse(node=>{node.geometry?.dispose();const mats=Array.isArray(node.material)?node.material:[node.material];mats.forEach(material=>material?.dispose());});renderer.dispose();renderer.domElement.remove();});
  }
};
