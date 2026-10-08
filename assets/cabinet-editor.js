'use strict';
(async()=>{
 const $=id=>document.getElementById(id),core=window.CabinetDesigner;
 const plan=window.jsyaml.load(await (await fetch('./floorplan.yaml')).text());
 const fields=['name','floor','room','width','depth','height','modules','panel','doors','x','y','z','rotation'];
 let active=null,mode='elevation',renderer=null,scene=null,camera=null;
 const floors=plan.floors;
 $('floor').innerHTML=floors.map(f=>'<option value="'+f.id+'">'+f.name+'</option>').join('');
 const rooms=()=>{$('room').innerHTML=(floors.find(f=>f.id===$('floor').value)?.rooms||[]).map(r=>'<option value="'+r.id+'">'+r.name+'</option>').join('')};
 $('floor').addEventListener('change',()=>{rooms();draw()});
 const val=id=>Number($(id).value);
 const current=()=>({id:active||'CAB-'+Date.now(),name:$('name').value||'未命名系統櫃',floor_id:$('floor').value,room_id:$('room').value,position:[val('x'),val('y'),val('z')],size:[val('width'),val('depth'),val('height')],rotation_deg:val('rotation'),modules:val('modules'),panel_cm:val('panel'),doors:$('doors').value});
 const fill=c=>{active=c.id;$('name').value=c.name;$('floor').value=c.floor_id;rooms();$('room').value=c.room_id;$('width').value=c.size[0];$('depth').value=c.size[1];$('height').value=c.size[2];$('modules').value=c.modules;$('panel').value=c.panel_cm||1.8;$('doors').value=c.doors||'open';['x','y','z'].forEach((k,i)=>$(k).value=c.position[i]);$('rotation').value=c.rotation_deg||0;draw()};
 const fresh=()=>{const floor=floors.find(f=>f.id==='4F')||floors[0],room=floor.rooms.find(r=>r.category==='bedroom')||floor.rooms[0];const xs=room.polygon.map(p=>p[0]),ys=room.polygon.map(p=>p[1]);fill({id:'CAB-'+Date.now(),name:'新系統櫃',floor_id:floor.id,room_id:room.id,position:[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2,0],size:[240,60,240],rotation_deg:0,modules:3,panel_cm:1.8,doors:'open'})};
 const list=()=>{$('existing').innerHTML='<option value="">選擇設計…</option>'+core.read().map(c=>'<option value="'+c.id+'">'+c.name.replaceAll('<','&lt;')+'</option>').join('');$('existing').value=core.read().some(c=>c.id===active)?active:''};
 function draw(){
  const c=current(),[w,d,h]=c.size,n=c.modules,t=c.panel_cm;
  $('stats').textContent='每模組外寬 '+(w/n).toFixed(1)+' cm · 內部淨寬約 '+(w/n-2*t).toFixed(1)+' cm（獨立箱體假設）';
  if(mode==='3d'){draw3d(c);return}
  $('three').style.display='none';$('drawing').style.display='block';
  const svg=$('drawing');svg.innerHTML='';
  const ns='http://www.w3.org/2000/svg',make=(tag,attrs)=>{const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));svg.append(e);return e};
  const scale=Math.min(490/w,340/(mode==='plan'?d:h)),left=55,top=45,hh=(mode==='plan'?d:h)*scale,ww=w*scale;
  make('rect',{x:left,y:top,width:ww,height:hh,fill:'#e7d7bd',stroke:'#7c6348','stroke-width':2});
  for(let i=1;i<n;i++)make('rect',{x:left+i*ww/n-t*scale/2,y:top,width:t*scale,height:hh,fill:'#b9966f'});
  if(mode==='elevation'){make('rect',{x:left,y:top,width:ww,height:t*scale,fill:'#b9966f'});make('rect',{x:left,y:top+hh-t*scale,width:ww,height:t*scale,fill:'#b9966f'});if(c.doors==='hinged')for(let i=0;i<n;i++)make('rect',{x:left+i*ww/n+2,y:top+2,width:ww/n-4,height:hh-4,fill:'#c6a47b',stroke:'#927351'})}
  make('text',{x:left+ww/2,y:top+hh+22,'text-anchor':'middle',fill:'#39372f','font-size':14}).textContent=w+' cm';
  make('text',{x:left-14,y:top+hh/2,'text-anchor':'middle',fill:'#39372f','font-size':13,transform:'rotate(-90 '+(left-14)+' '+(top+hh/2)+')'}).textContent=(mode==='plan'?d:h)+' cm';
 }
 function draw3d(c){
  $('drawing').style.display='none';const host=$('three');host.style.display='block';host.innerHTML='';
  const THREE=window.THREE,width=host.clientWidth||600,height=490;
  renderer?.dispose();renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(width,height);host.append(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color(0xedeae2);camera=new THREE.PerspectiveCamera(40,width/height,1,3000);
  const [w,d,h]=c.size,n=c.modules,t=c.panel_cm,mat=new THREE.MeshStandardMaterial({color:0xc7a782,roughness:.8}),back=new THREE.MeshStandardMaterial({color:0xe4d4bb});
  function box(a,b,e,x,y,z,m=mat){const o=new THREE.Mesh(new THREE.BoxGeometry(a,b,e),m);o.position.set(x,y,z);scene.add(o)}
  box(t,h,d,-w/2+t/2,h/2,0);box(t,h,d,w/2-t/2,h/2,0);box(w-2*t,t,d,0,t/2,0);box(w-2*t,t,d,0,h-t/2,0);box(w-2*t,h-2*t,Math.min(t,1),0,h/2,-d/2,back);
  for(let i=1;i<n;i++)box(t,h-2*t,d,-w/2+i*w/n,h/2,0);
  if(c.doors==='hinged')for(let i=0;i<n;i++)box(w/n-1,h-2,1,-w/2+(i+.5)*w/n,h/2,d/2+1);
  scene.add(new THREE.HemisphereLight(0xffffff,0x776b58,2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(300,500,450);scene.add(light);
  const max=Math.max(w,h,d);camera.position.set(max*.9,max*.8,max*1.4);camera.lookAt(0,h/2,0);renderer.render(scene,camera);
 }
 fields.forEach(id=>$(id).addEventListener('input',draw));
 $('existing').addEventListener('change',()=>{const c=core.read().find(v=>v.id===$('existing').value);if(c)fill(c)});
 $('new').onclick=()=>{fresh();list()};
 $('save').onclick=()=>{try{const c=current();core.save(c);active=c.id;list();$('message').textContent='已加入住宅空間。返回 2D／3D 平面圖即可查看。'}catch(e){$('message').textContent=e.message}};
 $('delete').onclick=()=>{if(active){core.remove(active);fresh();list();$('message').textContent='已刪除設計'}};
 $('download').onclick=()=>{const blob=new Blob([core.exportYaml()],{type:'text/yaml'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cabinets.yaml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 ['elevation','plan','view3d'].forEach(id=>$(id).onclick=()=>{mode=id==='view3d'?'3d':id;draw()});
 fresh();list();
})().catch(e=>{document.getElementById('message').textContent='載入失敗：'+e.message;console.error(e)});
