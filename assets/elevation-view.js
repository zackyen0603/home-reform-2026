'use strict';

// All measurements are derived from the active floorplan, furniture and electrical data.
window.ElevationView = (() => {
  const directions = {north:'北牆',east:'東牆',south:'南牆',west:'西牆'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const bounds = room => ({left:Math.min(...room.polygon.map(p=>p[0])),right:Math.max(...room.polygon.map(p=>p[0])),top:Math.min(...room.polygon.map(p=>p[1])),bottom:Math.max(...room.polygon.map(p=>p[1]))});
  const axis = (b, direction) => {
    const vertical = direction === 'east' || direction === 'west';
    const length = vertical ? b.bottom-b.top : b.right-b.left;
    const at = p => vertical ? (direction === 'east' ? p[1]-b.top : b.bottom-p[1]) : (direction === 'north' ? p[0]-b.left : b.right-p[0]);
    const distance = p => direction === 'north' ? Math.abs(p[1]-b.top) : direction === 'south' ? Math.abs(p[1]-b.bottom) : direction === 'east' ? Math.abs(p[0]-b.right) : Math.abs(p[0]-b.left);
    return {length,at,distance,vertical};
  };
  const fmt = value => Number(value.toFixed(1));
  function draw(floor, room, direction, items=[], electrical=null, showFurniture=true, interiors=null) {
    if (!directions[direction]) direction='north';
    const b=bounds(room), side=axis(b,direction), height=Number(floor.ceiling_height)||280;
    const pad=58, width=side.length+pad*2, totalHeight=height+pad*2;
    const x=n=>fmt(pad+n), y=z=>fmt(pad+height-z);
    const ticks=Array.from({length:Math.floor(side.length/100)+1},(_,i)=>`<line x1="${x(i*100)}" y1="${y(0)}" x2="${x(i*100)}" y2="${y(height)}" stroke="#dce0d8" stroke-width=".8"/>`).join('');
    const segments=(floor.walls||[]).filter(w=>{
      const a=w.start,c=w.end;
      return side.distance(a)<16 && side.distance(c)<16 && Math.abs(side.at(a)-side.at(c))>1;
    }).map(w=>{
      const a=Math.max(0,Math.min(side.at(w.start),side.at(w.end)));
      const c=Math.min(side.length,Math.max(side.at(w.start),side.at(w.end)));
      return {start:a,end:c,height:Math.min(height,Number(w.height)||height)};
    }).filter(s=>s.end>s.start);
    const style=window.RoomInteriors?.roomStyle(interiors,room.id);
    const finish=style?.surfaces?.walls?.[direction]||style?.surfaces?.walls?.default;
    const wall=segments.map(s=>{
      const base=`<rect x="${x(s.start)}" y="${y(s.height)}" width="${fmt(s.end-s.start)}" height="${s.height}" fill="${finish?window.RoomInteriors.color(interiors,finish.upper):'#e4e0d6'}" stroke="#989b91" stroke-width="1"/>`;
      if(!finish?.lower||!finish.lower_height_cm)return base;
      const lower=Math.min(s.height,finish.lower_height_cm),mat=interiors.materials[finish.lower];
      const panel=`<rect x="${x(s.start)}" y="${y(lower)}" width="${fmt(s.end-s.start)}" height="${lower}" fill="${mat.color}"/>`;
      const stripes=mat.stripe_spacing_cm?Array.from({length:Math.floor((s.end-s.start)/mat.stripe_spacing_cm)},(_,i)=>`<line x1="${x(s.start+(i+1)*mat.stripe_spacing_cm)}" x2="${x(s.start+(i+1)*mat.stripe_spacing_cm)}" y1="${y(lower)}" y2="${y(0)}" stroke="#4b4b49" stroke-width=".7"/>`).join(''):'';
      return base+panel+stripes;
    }).join('');
    const openings=(floor.openings||[]).filter(o=>o.center && side.distance(o.center)<16 && side.at(o.center)+o.width/2>0 && side.at(o.center)-o.width/2<side.length).map(o=>{
      const left=Math.max(0,side.at(o.center)-o.width/2), right=Math.min(side.length,side.at(o.center)+o.width/2);
      const sill=Math.max(0,Number(o.sill_height)||0), h=Math.max(1,Math.min(height-sill,Number(o.height)||210));
      const window=o.type==='window', stroke=window?'#698b95':'#9b765a';
      return `<g><title>${escape(o.id)} · ${fmt(right-left)} × ${h} cm</title><rect x="${x(left)}" y="${y(sill+h)}" width="${fmt(right-left)}" height="${h}" fill="${window?'#c6d9d9':'#fffdf8'}" stroke="${stroke}" stroke-width="2"/>${window?`<line x1="${x((left+right)/2)}" y1="${y(sill)}" x2="${x((left+right)/2)}" y2="${y(sill+h)}" stroke="${stroke}"/>`:''}<text x="${x((left+right)/2)}" y="${y(sill+h/2)}" text-anchor="middle" class="elevation-label">${window?'窗':'門'}</text></g>`;
    }).join('');
    const allItems=[...items,...(window.RoomInteriors?.objects(interiors,floor.id)||[])];
    const furniture=showFurniture?allItems.filter(item=>item.room_id===room.id).map(item=>{
      const [px,py,pz=0]=item.position, [w,d,h]=item.size, rotated=Math.abs(item.rotation_deg||0)%180===90;
      const halfX=(rotated?d:w)/2, halfY=(rotated?w:d)/2;
      const nearest=direction==='north'?py-halfY-b.top:direction==='south'?b.bottom-(py+halfY):direction==='east'?b.right-(px+halfX):px-halfX-b.left;
      if(nearest>125 || nearest < -22) return '';
      const half=side.vertical?halfY:halfX;
      const left=Math.max(0,side.at(item.position)-half),right=Math.min(side.length,side.at(item.position)+half);
      if(right<=left) return '';
      const base=item.kind==='kitchen_wall'?175:item.kind==='kitchen_hood'?165:Number(pz)||0;
      const color=item.material?window.RoomInteriors.color(interiors,item.material):item.kind==='kitchen_wall'?'#f2eee5':item.kind==='kitchen_fridge'?'#e5e3dc':item.kind==='kitchen_hood'||item.kind==='kitchen_cooktop'?'#404341':item.kind==='kitchen_sink'?'#b4c6c6':item.kind==='bed'||item.kind==='sofa'?'#bdb2a6':'#c7a47c';
      const label=item.name.length>10?item.name.slice(0,9)+'…':item.name;
      const visibleHeight=Math.min(item.kind==='kitchen_hood'?55:h,Math.max(0,height-base));
      return `<g><title>${escape(item.name)} · ${w} × ${d} × ${h} cm</title><rect x="${x(left)}" y="${y(base+visibleHeight)}" width="${fmt(right-left)}" height="${fmt(visibleHeight)}" fill="${color}" stroke="#716e61" stroke-width="1.5" fill-opacity="${item.material?(interiors.materials[item.material]?.opacity??.93):.93}"/>${right-left>42?`<text x="${x((left+right)/2)}" y="${y(base+visibleHeight/2)}" text-anchor="middle" class="elevation-label">${escape(label)}</text>`:''}</g>`;
    }).join(''):'';
    const points=(electrical?.points||[]).filter(p=>p.space_id===room.id && Array.isArray(p.position) && /outlet|220v/.test(p.type) && side.distance(p.position)<48).map(p=>{
      const z=Number(p.position[2]); const at=side.at(p.position);
      if(at<0||at>side.length)return '';
      return `<g><title>${escape(p.id)} · ${escape(p.type)}</title><circle cx="${x(at)}" cy="${y(Number.isFinite(z)?z:30)}" r="6" fill="#bd7858" stroke="#fff" stroke-width="2"/></g>`;
    }).join('');
    const furnitureCount=allItems.filter(item=>item.room_id===room.id).length;
    const descriptor=`${floor.name} · ${room.name} · ${directions[direction]} · ${fmt(side.length)} × ${height} cm`;
    const svg=`<svg class="elevation-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(width)} ${fmt(totalHeight)}" role="img" aria-label="${escape(descriptor)}"><title>${escape(descriptor)}</title><style>.elevation-label{font:10px sans-serif;fill:#26342d;paint-order:stroke;stroke:#fffdf8;stroke-width:2px}.elevation-dimension{font:11px sans-serif;fill:#56655a}</style><rect width="100%" height="100%" fill="#fffdf8"/><rect x="${pad}" y="${pad}" width="${fmt(side.length)}" height="${height}" fill="#f8f7f2" stroke="#4d5d50" stroke-width="2"/>${ticks}${wall}${openings}${furniture}${points}<line x1="${pad}" y1="${y(0)+22}" x2="${x(side.length)}" y2="${y(0)+22}" stroke="#6c756c"/><line x1="${pad}" y1="${y(0)+16}" x2="${pad}" y2="${y(0)+28}" stroke="#6c756c"/><line x1="${x(side.length)}" y1="${y(0)+16}" x2="${x(side.length)}" y2="${y(0)+28}" stroke="#6c756c"/><text x="${x(side.length/2)}" y="${y(0)+42}" text-anchor="middle" class="elevation-dimension">${fmt(side.length)} cm</text><text x="${pad-8}" y="${y(height/2)}" text-anchor="end" class="elevation-dimension">${height} cm</text></svg>`;
    return {svg,descriptor,hasModeledWall:segments.length>0,furnitureCount};
  }
  function download(svg, filename) {
    const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return {directions,draw,download};
})();
