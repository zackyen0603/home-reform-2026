'use strict';

// Rendering helpers only. All identities, dimensions and placement live in furniture.yaml.
window.FurnitureView = (() => {
  const itemsForFloor = (data, floorId) => floorId === data?.metadata?.floor_id ? data.items || [] : [];
  const footprint = item => {
    const [x, y] = item.position;
    const [width, depth] = item.size;
    const swap = Math.abs(item.rotation_deg || 0) % 180 === 90;
    const w = swap ? depth : width, d = swap ? width : depth;
    return {left:x-w/2, top:y-d/2, right:x+w/2, bottom:y+d/2};
  };
  const svg = (items, escapeHtml) => items.map(item => {
    const [x,y] = item.position, [w,d] = item.size;
    const stripe = ['bed','sofa'].includes(item.kind)
      ? `<rect x="${-w*.42}" y="${-d*.36}" width="${w*.84}" height="${d*.21}" rx="5" fill="#fbf8ed" opacity=".8"/>`
      : ['kitchen_base','kitchen_wall'].includes(item.kind)
        ? `<line x1="${-w/2+w*.32}" y1="${-d/2}" x2="${-w/2+w*.32}" y2="${d/2}" stroke="#8a6a4b" stroke-width="2"/><line x1="${w/2-w*.32}" y1="${-d/2}" x2="${w/2-w*.32}" y2="${d/2}" stroke="#8a6a4b" stroke-width="2"/>`
        : ['kitchen_sink','kitchen_dishwasher'].includes(item.kind)
          ? `<rect x="${-w*.35}" y="${-d*.28}" width="${w*.7}" height="${d*.56}" rx="3" fill="${item.kind==='kitchen_sink'?'#91a5a8':'#c5a77e'}" opacity=".9"/><line x1="${-w*.35}" y1="0" x2="${w*.35}" y2="0" stroke="#fff" stroke-width="2"/>`
          : item.kind === 'kitchen_cooktop'
            ? `<rect x="${-w*.43}" y="${-d*.38}" width="${w*.86}" height="${d*.76}" rx="3" fill="#202325"/><circle cx="${-w*.2}" cy="0" r="${Math.min(w,d)*.16}" fill="none" stroke="#aeb2b0" stroke-width="2"/><circle cx="${w*.2}" cy="0" r="${Math.min(w,d)*.16}" fill="none" stroke="#aeb2b0" stroke-width="2"/>`
            : item.kind === 'kitchen_fridge'
              ? `<line x1="0" y1="${-d/2}" x2="0" y2="${d/2}" stroke="#555" stroke-width="2"/><line x1="${-w/2}" y1="${-d*.08}" x2="${w/2}" y2="${-d*.08}" stroke="#555" stroke-width="2"/>`
      : ['wardrobe','sideboard','entry_cabinet','media_console','shelf'].includes(item.kind)
        ? `<line x1="0" y1="${-d/2}" x2="0" y2="${d/2}" stroke="#846a4e" stroke-width="2"/>`
        : `<rect x="${-w*.33}" y="${-d*.3}" width="${w*.66}" height="${d*.6}" rx="3" fill="none" stroke="#846a4e" stroke-width="2"/>`;
    return `<g class="furniture-item" tabindex="0" role="button" aria-label="${escapeHtml(item.name)}" data-furniture-id="${escapeHtml(item.id)}" transform="translate(${x} ${y}) rotate(${item.rotation_deg || 0})"><title>${escapeHtml(item.name)} · ${w} × ${d} cm · ${escapeHtml(item.procurement_status)}</title><rect x="${-w/2}" y="${-d/2}" width="${w}" height="${d}" rx="${item.kind === 'sofa' ? 11 : 3}"/>${stripe}</g>`;
  }).join('');
  function add3D(parent, items, THREE) {
    const placed = [];
    items.forEach(item => {
      const [w,d,h] = item.size;
      const group = new THREE.Group();
      group.name = item.name;
      group.userData.furnitureId = item.id;
      group.position.set(item.position[0], item.position[2] || 0, item.position[1]);
      group.rotation.y = -(item.rotation_deg || 0) * Math.PI / 180;
      parent.add(group);
      const wood = 0xad8563, pale = 0xe6d9be, linen = 0xb4aaa0, dark = 0x6f604f;
      const box = (bw,bh,bd,bx,by,bz,color=wood) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),new THREE.MeshStandardMaterial({color,roughness:.86}));
        mesh.position.set(bx,by,bz);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.furnitureId=item.id;group.add(mesh);
      };
      const legs = (top, offset=9) => {for(const a of [-1,1])for(const b of [-1,1])box(5,top,5,a*(w/2-offset),top/2,b*(d/2-offset),dark);};
      switch(item.kind) {
        case 'bed':
          box(w,16,d,0,18,0);box(w-7,17,d-13,0,35,0,linen);
          box(w-15,27,8,0,49,-d/2+4,wood);
          for(const side of [-1,1])box(w*.36,7,35,side*w*.22,47,-d*.3,pale);
          break;
        case 'sofa':
          box(w,19,d-10,0,39,-3,linen);box(w,45,12,0,58,d/2-6,linen);
          box(12,56,d,-w/2+6,42,0,linen);box(12,56,d,w/2-6,42,0,linen);
          break;
        case 'dining_table':case 'coffee_table':case 'desk':case 'island':
          box(w,Math.min(h*.13,11),d,0,h-5,0,item.kind==='island'?pale:wood);
          if(item.kind==='island')box(w-9,h-10,d-9,0,(h-10)/2,0,wood);else legs(Math.max(10,h-10));
          break;
        case 'chair':
          box(w-5,7,d-5,0,43,0,wood);box(w-6,43,7,0,66,d/2-6,wood);legs(40,12);
          break;
        case 'wardrobe':
          box(w,h,d,0,h/2,0,pale);
          for(const part of [-1,0,1])box(2,h-7,2,part*w/3,h/2,d/2+1,dark);
          break;
        case 'kitchen_base':
          box(w,Math.min(h,90),d,0,Math.min(h,90)/2,0,wood);
          box(w+2,4,d+2,0,Math.min(h,90)+2,0,pale);
          for(const part of [-1,0,1])box(2,Math.min(h,90)-10,2,part*w/3,Math.min(h,90)/2,d/2+1,dark);
          break;
        case 'kitchen_wall':
          box(w,h,d,0,h/2,0,pale);
          for(const part of [-1,0,1])box(1,h-5,1,part*w/3,h/2,d/2+1,dark);
          break;
        case 'kitchen_sink':
          box(w,3,d,0,91,0,pale);box(w*.72,2,d*.56,0,94,0,0x889a9b);
          box(3,26,3,w*.28,106,0,0x9ca9a5);box(3,3,18,w*.28,119,8,0x9ca9a5);
          break;
        case 'kitchen_dishwasher':
          box(w,86,d,0,43,0,wood);box(w*.82,55,2,0,48,d/2+1,0x9d7a55);box(8,2,2,0,77,d/2+3,dark);
          break;
        case 'kitchen_cooktop':
          box(w,3,d,0,91,0,pale);box(w*.88,1.5,d*.72,0,94,0,0x202325);
          for(const side of [-1,1])box(Math.min(w,d)*.26,1,Math.min(w,d)*.26,side*w*.22,95,0,0x929796);
          break;
        case 'kitchen_hood':
          box(w,8,d,0,h-8,0,dark);box(w*.78,22,d*.55,0,h-23,0,dark);box(w*.35,75,d*.28,0,h-65,0,dark);
          break;
        case 'kitchen_fridge':
          box(w,h,d,0,h/2,0,0xe9e7df);box(3,h*.42,2,-w*.08,h*.28,d/2+1,dark);box(3,h*.42,2,-w*.08,h*.76,d/2+1,dark);
          break;
        case 'shelf':
          for(const side of [-1,1])box(4,h,d,side*(w/2-2),h/2,0,wood);
          for(let level=0;level<5;level++)box(w,4,d,0,4+level*(h-8)/4,0,wood);
          break;
        default:
          box(w,h,d,0,h/2,0,wood);box(w-6,Math.min(h*.2,14),d-6,0,h-7,0,pale);
          if(['sideboard','entry_cabinet','media_console'].includes(item.kind))
            box(2,h-12,2,0,h/2,d/2+1,dark);
      }
      placed.push(group);
    });
    return placed;
  }
  const sidebar = (items, state, escapeHtml) => !items.length ? '' : `<div class="furniture-sidebar"><h4>家具配置 <small>${items.length} 件</small></h4><p class="micro">位置為規劃示意；點選家具查看尺寸與採購資訊。</p><div id="furnitureDetail" class="furniture-detail"></div><div class="furniture-list">${items.map(item => `<button type="button" data-furniture-id="${escapeHtml(item.id)}" class="furniture-list-button"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.procurement_status)}</small></button>`).join('')}</div></div>`;
  const detailHtml = (item,escape) => {const [w,d,h]=item.size;return `<strong>${escape(item.name)}</strong><dl><div><dt>尺寸</dt><dd>${w} × ${d} × ${h} cm</dd></div><div><dt>採購</dt><dd>${escape(item.procurement_status)}</dd></div><div><dt>品牌</dt><dd>${escape(item.brand)}</dd></div><div><dt>預算</dt><dd>NT$ ${Number(item.budget_twd || 0).toLocaleString()}</dd></div><div><dt>座標</dt><dd>${item.position.join(', ')} cm；旋轉 ${item.rotation_deg || 0}°</dd></div><div><dt>尺寸依據</dt><dd>${escape(item.dimension_basis)}</dd></div><div><dt>來源</dt><dd>家具購買規劃總表，第 ${item.source_row} 列</dd></div></dl>${item.note ? `<p>${escape(item.note)}</p>` : ''}`;};
  function bind(state, root) {
    const select = id => {
      const item = itemsForFloor(state.furniture, state.floorId).find(value => value.id === id);
      if (!item) return;
      state.selectedFurnitureId = id;
      const escape = value => String(value ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
      const detail = root.querySelector('#furnitureDetail');
      if (detail) detail.innerHTML = detailHtml(item,escape);
      root.querySelectorAll('[data-furniture-id]').forEach(node => node.classList.toggle('is-selected',node.dataset.furnitureId === id));
    };
    root.addEventListener('click',event => {const node = event.target.closest('[data-furniture-id]');if(node)select(node.dataset.furnitureId);});
    root.addEventListener('keydown',event => {const node=event.target.closest('svg[data-furniture-id],svg [data-furniture-id]');if(node && ['Enter',' '].includes(event.key)){event.preventDefault();select(node.dataset.furnitureId);}});
    if (state.selectedFurnitureId) select(state.selectedFurnitureId);
    return select;
  }
  return {itemsForFloor,footprint,svg,add3D,sidebar,bind,detailHtml};
})();
