'use strict';

// Room finishes and fitted objects share floorplan.yaml's centimetre coordinates.
window.RoomInteriors = (() => {
  const materials = data => data?.materials || {};
  const roomStyle = (data,id) => (data?.rooms || []).find(room=>room.room_id===id);
  const color = (data,id,fallback='#d9d2c5') => materials(data)[id]?.color || fallback;
  const opacity = (data,id) => Number(materials(data)[id]?.opacity ?? 1);
  const objects = (data,floorId) => {const items=(data?.rooms||[]).filter(r=>r.floor_id===floorId).flatMap(r=>(r.objects||[]).map(o=>({...o,room_id:r.room_id})));return window.FurnitureView?.applyOverrides?window.FurnitureView.applyOverrides(items):items;};
  const footprint = o => {const [w,d]=o.size,rotated=Math.abs(o.rotation_deg||0)%180===90;return [rotated?d:w,rotated?w:d];};
  const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function svgOpenings(floor) {
    return (floor.openings||[]).map(o=>{
      const [x,y]=o.center,vertical=o.orientation==='vertical'||['west','east','bedroom-living','living-service','living-entry'].includes(o.boundary),dx=vertical?0:o.width/2,dy=vertical?o.width/2:0;
      if(o.type==='passage')return `<g><title>無門開口 ${o.width} cm</title><line x1="${x-dx}" y1="${y-dy}" x2="${x+dx}" y2="${y+dy}" stroke="#799889" stroke-width="1" stroke-dasharray="4 4"/></g>`;
      if(o.type==='door'&&o.hinge&&o.open_leaf_end){
        const [hx,hy]=o.hinge,[ex,ey]=o.open_leaf_end,cx=2*x-hx,cy=2*y-hy,sweep=(cx-hx)*(ey-hy)-(cy-hy)*(ex-hx)>0?1:0;
        return `<g fill="none" stroke="#926e4d"><title>門 ${o.width} cm</title><line x1="${hx}" y1="${hy}" x2="${ex}" y2="${ey}" stroke-width="3"/><path d="M ${cx} ${cy} A ${o.width} ${o.width} 0 0 ${sweep} ${ex} ${ey}" stroke-width="1.2" stroke-dasharray="5 3"/></g>`;
      }
      return `<line x1="${x-dx}" y1="${y-dy}" x2="${x+dx}" y2="${y+dy}" stroke="${o.type==='window'?'#6f98a0':'#a27b57'}" stroke-width="5"/>`;
    }).join('');
  }

  function svgDimensions(floor) {
    if(!floor.measurement?.dimension_chains)return '';
    const w=floor.bounds.width,d=floor.bounds.depth;
    return `<g fill="#56655a" stroke="#879187" stroke-width=".7"><path d="M0 -12 V-26 M0 -20 H${w} M${w} -12 V-26 M-12 0 H-28 M-20 0 V${d} M-12 ${d} H-28"/><text x="${w/2}" y="-24" text-anchor="middle" font-size="11" stroke="none">${w} cm</text><text transform="translate(-25 ${d/2}) rotate(-90)" text-anchor="middle" font-size="11" stroke="none">${d} cm</text></g>`;
  }

  // Single source for every 2D floor canvas: room polygons, furniture, finishes,
  // wall segments, dimensions, doors, windows and open passages.
  function svgBase(floor,options={}) {
    const pad=options.pad??35,b=floor.bounds,rooms=(floor.rooms||[]).map(room=>{
      const points=room.polygon.map(p=>p.join(',')).join(' '),xs=room.polygon.map(p=>p[0]),ys=room.polygon.map(p=>p[1]),area=room.polygon.reduce((sum,p,i)=>sum+p[0]*room.polygon[(i+1)%room.polygon.length][1]-room.polygon[(i+1)%room.polygon.length][0]*p[1],0);
      const cx=xs.reduce((a,v)=>a+v,0)/xs.length,cy=ys.reduce((a,v)=>a+v,0)/ys.length,fill=color(options.interiors,roomStyle(options.interiors,room.id)?.surfaces?.floor,'')||options.roomColor?.(room.category)||'#ded5c6';
      const label=options.labels?`<text class="${esc(options.labelClass||'floor-room-label')}" x="${cx}" y="${cy-3}" text-anchor="middle">${esc(room.name)}${options.areaLabels?`<tspan x="${cx}" dy="14">${(Math.abs(area)/20000).toFixed(1)} m²</tspan>`:''}</text>`:'';
      const select=options.selectRooms?`<g class="room-shape-select ${options.selectedRoomId===room.id?'is-selected':''}" data-room-id="${esc(room.id)}" tabindex="0" role="button" aria-label="選擇${esc(room.name)}立面圖">`:'';
      return `${select}<polygon points="${points}" fill="${fill}" ${options.selectRooms?'class="room-shape"':''}/>${label}${options.selectRooms?'</g>':''}`;
    }).join('');
    const walls=(floor.walls||[]).map(w=>`<line class="wall-line" x1="${w.start[0]}" y1="${w.start[1]}" x2="${w.end[0]}" y2="${w.end[1]}" stroke="#535850" stroke-width="${w.thickness||10}"/>`).join('');
    const furniture=options.showFurniture===false?'':(window.FurnitureView?.svg(window.FurnitureView.itemsForFloor(options.furniture||{items:[]},floor.id),esc)||'');
    const fixtures=options.showFurniture===false?'':svgObjects(floor,options.interiors);
    const zones=svgFloorZones(floor,options.interiors);
    const roomLabels=options.labels?rooms.replace(/<polygon[^>]*\/>/g,''):'';
    return `<svg viewBox="${-pad} ${-pad} ${b.width+pad*2} ${b.depth+pad*2}" role="img" aria-label="${esc(options.ariaLabel||floor.name||'樓層平面圖')}" ${options.preserveAspectRatio?'preserveAspectRatio="xMidYMid meet"':''}><rect x="${-pad}" y="${-pad}" width="${b.width+pad*2}" height="${b.depth+pad*2}" fill="${options.background||'#f4f0e7'}"/><g${options.sceneClass?` class="${esc(options.sceneClass)}"`:''}>${rooms}<g style="pointer-events:none">${zones}</g>${furniture}<g style="pointer-events:none">${fixtures}</g>${walls}${svgOpenings(floor)}${roomLabels}${svgDimensions(floor)}</g>${options.children||''}</svg>`;
  }

  function validate(data,plan) {
    if(!data || !Array.isArray(data.rooms) || !data.materials)throw new Error('室內配置缺少 rooms 或 materials');
    const known=new Set(plan.floors.flatMap(f=>f.rooms.map(r=>`${f.id}/${r.id}`))), ids=new Set();
    for(const r of data.rooms){
      if(!known.has(`${r.floor_id}/${r.room_id}`))throw new Error(`室內配置的空間不存在：${r.room_id}`);
      const refs=[r.surfaces?.floor,r.surfaces?.ceiling,r.surfaces?.walls?.default?.upper,r.surfaces?.walls?.default?.lower,...Object.values(r.surfaces?.walls||{}).flatMap(w=>[w?.upper,w?.lower]),...(r.surfaces?.floor_zones||[]).map(z=>z.material)];
      for(const o of r.objects||[]){
        if(!o.id||ids.has(o.id)||!Array.isArray(o.position)||o.position.length!==3||!Array.isArray(o.size)||o.size.length!==3||![...o.position,...o.size].every(Number.isFinite)||o.size.some(n=>n<=0))throw new Error(`室內物件資料有誤：${o.id||'(無 ID)'}`);
        ids.add(o.id);refs.push(o.material,o.frame_material);
      }
      for(const ref of refs.filter(Boolean))if(!materials(data)[ref])throw new Error(`找不到室內材質：${ref}`);
    }
    return true;
  }

  function svgFloorZones(floor,data) {
    return (data?.rooms||[]).filter(r=>r.floor_id===floor.id).flatMap(r=>(r.surfaces?.floor_zones||[]).map(z=>`<polygon points="${z.polygon.map(p=>p.join(',')).join(' ')}" fill="${color(data,z.material)}" stroke="#f5f0e7" stroke-width="1"/>`)).join('');
  }
  function svgObjects(floor,data) {
    return objects(data,floor.id).map(o=>{
      const [x,y]=o.position,[w,d]=o.size,t=o.kind,fill=color(data,o.material);
      const shape=t==='glass_partition'?`<rect x="${-w/2}" y="${-d/2-1}" width="${w}" height="${d+2}" fill="${fill}" fill-opacity=".48" stroke="${color(data,o.frame_material,'#555854')}" stroke-width="2"/>`
        :t==='toilet'?`<ellipse cx="0" cy="0" rx="${w*.37}" ry="${d*.37}" fill="${fill}" stroke="#887f74"/><rect x="${-w*.35}" y="${-d*.48}" width="${w*.7}" height="${d*.14}" rx="2" fill="${fill}" stroke="#887f74"/>`
        :t==='vanity'?`<rect x="${-w/2}" y="${-d/2}" width="${w}" height="${d}" rx="2" fill="${fill}" stroke="#8b796b" stroke-width="2"/><ellipse cx="0" cy="0" rx="${w*.29}" ry="${d*.27}" fill="#cad5d2" stroke="#9ca5a0"/>`
        :t==='mirror_cabinet'?`<rect x="${-w/2}" y="${-d/2}" width="${w}" height="${d}" fill="${fill}" stroke="#7e8986" stroke-width="2"/><line x1="0" y1="${-d/2}" x2="0" y2="${d/2}" stroke="#fff"/>`
        :`<rect x="${-w/2}" y="${-d/2}" width="${w}" height="${d}" rx="2" fill="${fill}" stroke="#5d625c" stroke-width="1.5"/>`;
      return `<g class="interior-object kind-${esc(t)}" data-interior-id="${esc(o.id)}" data-furniture-id="${esc(o.id)}" tabindex="0" role="button" aria-label="${esc(o.name)}" transform="translate(${x} ${y}) rotate(${o.rotation_deg||0})"><title>${esc(o.name)} · ${o.size.join(' × ')} cm</title>${shape}</g>`;
    }).join('');
  }

  function box(parent,THREE,w,h,d,x,y,z,material,id) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.userData.interiorId=id;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  const textureCache=new Map();
  function surfaceTexture(THREE,finish,scaleCm=1,repeat=[1,1]){
    if(!['woodgrain','matte-stone','matte-anti-slip-tile','vertical-fluted-tile','fabric','plaster'].includes(finish))return null;
    const key=`${finish}/${scaleCm}/${repeat.join('/')}`;if(textureCache.has(key))return textureCache.get(key);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)return null;
    ctx.fillStyle='#f5f3ef';ctx.fillRect(0,0,128,128);
    let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<420;i++){const v=Math.floor(random()*90);ctx.fillStyle=`rgba(${v},${v},${v},${finish==='fabric'?.035:.025})`;ctx.fillRect(random()*128,random()*128,random()*3+1,random()*3+1);}
    if(finish==='woodgrain'){for(let i=0;i<27;i++){const x=i*5+random()*4;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x-3,42,x+5,86,x+random()*5,128);ctx.strokeStyle=`rgba(65,43,24,${.035+random()*.085})`;ctx.lineWidth=random()*1.5+.4;ctx.stroke();}}
    if(finish==='matte-stone'||finish==='matte-anti-slip-tile'){for(let i=0;i<48;i++){ctx.beginPath();ctx.ellipse(random()*128,random()*128,random()*18+3,random()*7+2,random()*6,0,Math.PI*2);ctx.fillStyle=`rgba(84,78,72,${random()*.025})`;ctx.fill();}}
    if(finish==='matte-anti-slip-tile'){ctx.strokeStyle='rgba(94,87,80,.26)';ctx.lineWidth=2;ctx.strokeRect(1,1,126,126);}
    if(finish==='vertical-fluted-tile'){for(let x=0;x<128;x+=16){ctx.fillStyle='rgba(25,25,25,.13)';ctx.fillRect(x,0,2,128);ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(x+3,0,2,128);}}
    if(finish==='fabric'){for(let i=0;i<128;i+=4){ctx.fillStyle='rgba(62,55,49,.045)';ctx.fillRect(i,0,1,128);ctx.fillRect(0,i,128,1);}}
    const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeat[0]/scaleCm,repeat[1]/scaleCm);texture.anisotropy=4;textureCache.set(key,texture);return texture;
  }
  function surfaceMaterial(THREE,spec={}){
    const finish=spec.finish||'plaster',texture=surfaceTexture(THREE,finish,spec.scaleCm||1,spec.repeat||[1,1]);
    const style={color:spec.color??'#d9d2c5',map:texture,roughness:spec.roughness??({woodgrain:.76,'matte-stone':.85,'matte-anti-slip-tile':.91,'vertical-fluted-tile':.83,reflective:.12,'clear-glass':.08,'brushed-metal':.37,satin:.46,fabric:.96,plaster:.9}[finish]||.82),metalness:spec.metalness??({reflective:.68,'brushed-metal':.68}[finish]||0),transparent:Number(spec.opacity??1)<1,opacity:Number(spec.opacity??1),depthWrite:Number(spec.opacity??1)>=1,side:THREE.DoubleSide};
    if(finish==='satin'||finish==='matte-stone'||finish==='matte-anti-slip-tile')return new THREE.MeshPhysicalMaterial({...style,clearcoat:finish==='satin'?.38:.08,clearcoatRoughness:.32});
    return new THREE.MeshStandardMaterial(style);
  }
  const material3D=(THREE,data,id,options={})=>surfaceMaterial(THREE,{color:color(data,id),finish:materials(data)[id]?.finish,opacity:opacity(data,id),...options});

  function add3D(parent,floor,data,THREE) {
    const selectable=[];
    for(const r of (data?.rooms||[]).filter(r=>r.floor_id===floor.id))for(const zone of r.surfaces?.floor_zones||[]){
      const shape=new THREE.Shape();zone.polygon.forEach((p,i)=>i?shape.lineTo(...p):shape.moveTo(...p));
      const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material3D(THREE,data,zone.material,{scaleCm:60}));mesh.rotation.x=Math.PI/2;mesh.position.y=1;mesh.receiveShadow=true;parent.add(mesh);
    }
    for(const o of objects(data,floor.id)){
      const [w,d,h]=o.size,[x,z,base]=o.position,group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=-(o.rotation_deg||0)*Math.PI/180;group.userData.interiorId=o.id;group.userData.furnitureId=o.id;parent.add(group);
      const main=material3D(THREE,data,o.material),frame=material3D(THREE,data,o.frame_material||o.material);
      const part=(bw,bh,bd,bx,by,bz,mat=main)=>{const mesh=box(group,THREE,bw,bh,bd,bx,by,bz,mat,o.id);selectable.push(mesh);return mesh;};
      switch(o.kind){
        case 'vanity':
          part(w,h-10,d,0,base+(h-10)/2,0);part(w+2,4,d+3,0,base+h-2,0);
          part(w*.65,2,d*.53,0,base+h+1,0,main);
          break;
        case 'mirror_cabinet':
          part(w,h,d,0,base+h/2,0);part(1,h,1,0,base+h/2,d/2+1,frame);
          break;
        case 'toilet': {
          const bowl=new THREE.Mesh(new THREE.CylinderGeometry(w*.37,w*.41,37,24),main);bowl.position.set(0,base+30,d*.06);bowl.userData.interiorId=o.id;group.add(bowl);selectable.push(bowl);
          part(w*.75,5,d*.67,0,base+51,d*.06);part(w*.78,37,d*.19,0,base+39,-d*.42);break;
        }
        case 'glass_partition':
          part(w,h,d,0,base+h/2,0);
          for(const edge of [-1,1])part(2,h,3,edge*w/2,base+h/2,0,frame);
          part(w,2,3,0,base+h,0,frame);break;
        case 'shower':
          part(2,h*.8,2,0,base+h*.4,0);part(w,2,d,0,base+h*.83,0);part(w*.8,2,d*.8,0,base+h*.9,0);break;
        case 'towel_bar':
          part(w,2,2,0,base+h/2,0);for(const edge of [-1,1])part(2,6,6,edge*w/2,base+h/2,0);break;
        default:part(w,h,d,0,base+h/2,0);
      }
    }
    return selectable;
  }

  // Returns cut wall blocks and finish panels for any room with a surfaces entry.
  function addWalls3D(parent,floor,data,THREE) {
    for(const wall of floor.walls){
      const [ax,az]=wall.start,[bx,bz]=wall.end,dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len,thick=wall.thickness||10,height=wall.height||floor.ceiling_height||280;
      const normal=[-uz,ux],angle=-Math.atan2(dz,dx);
      const relevant=(floor.openings||[]).filter(o=>{
        if(!o.center)return false;const vx=o.center[0]-ax,vz=o.center[1]-az,t=vx*ux+vz*uz,perp=Math.abs(vx*normal[0]+vz*normal[1]);return perp<thick/2+6 && t+o.width/2>0 && t-o.width/2<len;
      }).map(o=>({a:Math.max(0,Math.min(len,(o.center[0]-ax)*ux+(o.center[1]-az)*uz-o.width/2)),b:Math.max(0,Math.min(len,(o.center[0]-ax)*ux+(o.center[1]-az)*uz+o.width/2)),bottom:Number(o.sill_height)||0,top:Math.min(height,(Number(o.sill_height)||0)+(Number(o.height)||210)),type:o.type})).filter(o=>o.b>o.a);
      const adjacent=(data?.rooms||[]).filter(r=>r.floor_id===floor.id).map(r=>({style:r,room:floor.rooms.find(room=>room.id===r.room_id)})).filter(v=>v.room).flatMap(v=>{
        const p=v.room.polygon,xs=p.map(a=>a[0]),zs=p.map(a=>a[1]),bounds={west:Math.min(...xs),east:Math.max(...xs),north:Math.min(...zs),south:Math.max(...zs)};
        return Object.entries(bounds).filter(([side,pos])=>Math.abs((side==='west'||side==='east'?ax:az)-pos)<16 && Math.abs((side==='west'||side==='east'?bx:bz)-pos)<16).map(([side])=>({...v,side,bounds,center:[(bounds.west+bounds.east)/2,(bounds.north+bounds.south)/2]}));
      });
      const stops=[0,len,...relevant.flatMap(o=>[o.a,o.b]),...adjacent.flatMap(v=>v.side==='west'||v.side==='east'?[v.bounds.north,v.bounds.south].map(z=>(z-az)*uz):[v.bounds.west,v.bounds.east].map(x=>(x-ax)*ux)).filter(t=>t>0&&t<len)].sort((a,b)=>a-b).filter((v,i,all)=>i===0||v-all[i-1]>.01);
      for(let i=0;i<stops.length-1;i++){
        const a=stops[i],b=stops[i+1],mid=(a+b)/2;if(b-a<.1)continue;
        const opening=relevant.find(o=>o.a<=mid&&o.b>=mid),bands=opening?[[0,opening.bottom],[opening.top,height]]:[[0,height]];
        for(const [lo,hi] of bands){if(hi-lo<.1)continue;
          const cx=ax+ux*mid,cz=az+uz*mid;
          const block=box(parent,THREE,b-a,hi-lo,thick,cx,(lo+hi)/2,cz,new THREE.MeshStandardMaterial({color:wall.exterior?0x53564f:0x808079,roughness:.88}));block.rotation.y=angle;
          for(const v of adjacent){
            const along=v.side==='west'||v.side==='east'?cz:cx;
            if(along<(v.side==='west'||v.side==='east'?v.bounds.north:v.bounds.west)-1||along>(v.side==='west'||v.side==='east'?v.bounds.south:v.bounds.east)+1)continue;
            const surfaces=v.style.surfaces?.walls?.[v.side]||v.style.surfaces?.walls?.default;if(!surfaces)continue;
            const sign=Math.sign((v.center[0]-cx)*normal[0]+(v.center[1]-cz)*normal[1])||1;
            const inset=thick/2+.4;
            const split=Math.max(0,Number(surfaces.lower_height_cm)||0);
            for(const [start,end,mat] of [[lo,Math.min(hi,split),surfaces.lower],[Math.max(lo,split),hi,surfaces.upper]]){
              if(end-start<.1||!mat)continue;
              const mesh=box(parent,THREE,b-a,end-start,.7,cx+normal[0]*inset*sign,(start+end)/2,cz+normal[1]*inset*sign,material3D(THREE,data,mat,{repeat:[Math.max(1,(b-a)/60),Math.max(1,(end-start)/60)]}));mesh.rotation.y=angle;
              const spacing=Number(materials(data)[mat]?.stripe_spacing_cm)||0;
              if(spacing && end>start){for(let t=a+spacing;t<b;t+=spacing){const stripe=box(parent,THREE,.6,end-start,.9,ax+ux*t+normal[0]*(inset+.6)*sign,(start+end)/2,az+uz*t+normal[1]*(inset+.6)*sign,new THREE.MeshStandardMaterial({color:0x4b4b49}));stripe.rotation.y=angle;}}
            }
          }
        }
      }
    }
    for(const o of floor.openings||[]){
      if(o.type!=='door'||!o.hinge||!o.open_leaf_end)continue;
      const [hx,hz]=o.hinge,[ex,ez]=o.open_leaf_end;
      const leaf=box(parent,THREE,Math.hypot(ex-hx,ez-hz),o.height||220,3,(hx+ex)/2,(o.height||220)/2,(hz+ez)/2,new THREE.MeshStandardMaterial({color:0xb29a7e,roughness:.85}));leaf.rotation.y=-Math.atan2(ez-hz,ex-hx);
    }
    // Some doors and windows are already represented by a gap between wall segments.
    for(const o of floor.openings||[]){
      if(o.type!=='window'||!o.center)continue;
      const vertical=o.orientation==='vertical'||o.boundary==='east'||o.boundary==='west',glass=box(parent,THREE,o.width,o.height||120,1.4,o.center[0],(Number(o.sill_height)||0)+(o.height||120)/2,o.center[1],new THREE.MeshStandardMaterial({color:0xb8d2d6,transparent:true,opacity:.34,metalness:.1,roughness:.16,side:THREE.DoubleSide}));
      if(vertical)glass.rotation.y=Math.PI/2;
    }
  }
  function sidebar(data,roomId){const style=roomStyle(data,roomId);if(!style)return '';
    const surface=style.surfaces||{},wall=surface.walls?.default||{},names={north:'北牆',east:'東牆',south:'南牆',west:'西牆'};
    const finishes=[['地面',surface.floor],['一般牆面',wall.upper],['腰牆',wall.lower],...Object.entries(surface.walls||{}).filter(([side])=>side!=='default').flatMap(([side,value])=>[[`${names[side]||side}上部`,value.upper],[`${names[side]||side}下部`,value.lower]])];
    return `<div class="interior-sidebar"><h4>室內材質與設備</h4><div class="interior-materials">${finishes.filter(([,id])=>id).map(([title,id])=>`<div><i style="background:${color(data,id)}"></i>${esc(title)}：${esc(materials(data)[id]?.name||id)}</div>`).join('')}</div>${(style.objects||[]).map(o=>`<div class="interior-entry">${esc(o.name)}<small>${o.size.join(' × ')} cm</small></div>`).join('')}<p class="micro">${esc(style.reference_view?.note||'設備位置為規劃示意，請依現場確認。')}</p></div>`;
  }
  return {validate,roomStyle,objects,color,footprint,svgFloorZones,svgObjects,svgOpenings,svgDimensions,svgBase,add3D,addWalls3D,surfaceMaterial,sidebar};
})();
