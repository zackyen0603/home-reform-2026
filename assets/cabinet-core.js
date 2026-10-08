'use strict';
window.CabinetDesigner=(()=>{
 const KEY='home-reform:designed-cabinets:v1';
 const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}};
 const write=items=>{localStorage.setItem(KEY,JSON.stringify(items));window.dispatchEvent(new Event('cabinet-designer:changed'));};
 const validate=c=>{if(!c.id||!c.room_id||!Array.isArray(c.position)||c.position.length!==3||!Array.isArray(c.size)||c.size.length!==3||c.size.some(n=>!Number.isFinite(n)||n<=0)||!Number.isInteger(c.modules)||c.modules<1||c.modules>12)throw Error('櫃體尺寸、位置或模組數不正確');return c};
 const toFurniture=c=>({...c,kind:'designed_cabinet',procurement_status:'自行設計',dimension_basis:'cabinet-designer',cabinet_modules:c.modules,cabinet_panel_cm:c.panel_cm||1.8});
 const forFloor=floor=>read().filter(c=>c.floor_id===floor).map(toFurniture);
 const save=c=>{validate(c);const all=read(),i=all.findIndex(v=>v.id===c.id);if(i<0)all.push(c);else all[i]=c;write(all)};
 const remove=id=>write(read().filter(c=>c.id!==id));
 const exportYaml=()=>window.jsyaml.dump({schema_version:'1.0.0',metadata:{dataset:'cabinet-designer',units:'cm'},items:read()},{noRefs:true});
 return {read,write,save,remove,forFloor,exportYaml,validate};
})();