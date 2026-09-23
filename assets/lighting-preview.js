'use strict';

// Visual comparison only: fixture shape and falloff are deliberately schematic.
window.LightingPreview = (() => {
  const types = new Set(['downlight', 'pendant', 'ceiling_light']);
  const isFixture = point => types.has(point.type);
  const settings = (data, point) => ({...(data.lighting_preview?.fixture_types?.[point.type] || {}), ...(point.fixture_visual || {})});
  const isOn = (state, point) => state.lightingGroups?.[point.control_group_id] !== false;
  const ambient = (state, data) => Math.max(0, Math.min(100, Number(state.lightingAmbient ?? data.lighting_preview?.default_ambient_percent ?? 65)));
  const ambientBrightness = value => (.19 + .81 * value / 100).toFixed(3);

  // Approximate black-body color for visual preview; actual lamp spectrum is unknown.
  function kelvinColor(kelvin) {
    const k = Math.max(1000, Math.min(12000, Number(kelvin) || 4000)) / 100;
    const red = k <= 66 ? 255 : 329.698727446 * Math.pow(k - 60, -0.1332047592);
    const green = k <= 66 ? 99.4708025861 * Math.log(k) - 161.1195681661 : 288.1221695283 * Math.pow(k - 60, -0.0755148492);
    const blue = k >= 66 ? 255 : k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
    return '#' + [red, green, blue].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  function svgWash(data, floor, state) {
    if (state.lightingPreviewEnabled === false) return '';
    const fixtures = data.points.filter(isFixture).filter(point => isOn(state, point));
    const clips = floor.rooms.map((room, i) => `<clipPath id="lighting-room-${i}"><polygon points="${room.polygon.map(p => p.join(',')).join(' ')}"/></clipPath>`).join('');
    const gradients = ['downlight','pendant','ceiling_light'].map(type => {
      const color = kelvinColor(data.lighting_preview?.fixture_types?.[type]?.color_temperature_k);
      return `<radialGradient id="lighting-wash-${type}"><stop offset="0" stop-color="${color}" stop-opacity=".8"/><stop offset=".48" stop-color="${color}" stop-opacity=".36"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
    }).join('');
    const circles = fixtures.map(point => {
      const roomIndex = floor.rooms.findIndex(room => room.id === point.space_id);
      if (roomIndex < 0) return '';
      const [x, y] = point.position, radius = Number(settings(data, point).beam_radius_cm) || 95;
      return `<circle cx="${x}" cy="${y}" r="${radius}" fill="url(#lighting-wash-${point.type})" clip-path="url(#lighting-room-${roomIndex})"/>`;
    }).join('');
    return `<defs>${clips}${gradients}</defs><g class="lighting-washes" aria-hidden="true">${circles}</g>`;
  }

  function svgFixture(data, point, state, esc) {
    const on = isOn(state, point) && state.lightingPreviewEnabled !== false;
    const config = settings(data, point), color = kelvinColor(config.color_temperature_k);
    const radius = Math.max(8, Math.min(23, Number(config.diameter_cm || 22) / 2));
    let shape;
    if (point.type === 'downlight') {
      shape = `<circle r="${radius + 3}" fill="#55625e" stroke="#eef3ef" stroke-width="2"/><circle r="${radius}" fill="${on ? color : '#aeb9b5'}" stroke="#394b45" stroke-width="1.5"/><circle r="3" fill="${on ? '#fffbe5' : '#7d8984'}"/>`;
    } else if (point.type === 'pendant') {
      shape = `<circle r="${radius + 3}" fill="#c4aa85" stroke="#fff8ea" stroke-width="2"/><circle r="${radius - 1}" fill="${on ? color : '#868681'}" stroke="#75624b" stroke-width="2"/><circle r="5" fill="#5a5347"/><path d="M 0 ${-radius - 8} v 7" stroke="#50443a" stroke-width="2"/>`;
    } else {
      shape = `<circle r="${radius + 2}" fill="#68716a" stroke="#fff" stroke-width="2"/><circle r="${radius - 2}" fill="${on ? color : '#bdc3bf'}" stroke="#c9c4b5" stroke-width="2"/><circle r="${radius - 7}" fill="none" stroke="#fff8" stroke-width="2"/>`;
    }
    return `<g class="lighting-fixture ${on ? 'is-lit' : 'is-off'}" data-point-id="${esc(point.id)}" tabindex="0" role="button" aria-label="${esc(point.id + ' ' + (data.point_types[point.type]?.label || point.type) + (on ? ' 已開啟' : ' 已關閉'))}" transform="translate(${point.position[0]} ${point.position[1]})"><title>${esc(data.point_types[point.type]?.label || point.type)} · ${on ? '開' : '關'} · ${Number(config.color_temperature_k) || 4000}K</title>${shape}</g>`;
  }

  function add3D(scene, data, floor, visible, state, THREE) {
    const selectable = [], active = state.lightingPreviewEnabled !== false;
    const roomCounts = new Map();
    for (const point of data.points.filter(isFixture)) if (active && isOn(state, point)) roomCounts.set(point.space_id, (roomCounts.get(point.space_id) || 0) + 1);
    const poolMaterial = new THREE.ShaderMaterial({
      uniforms: {tint:{value:new THREE.Color('#fff0c7')}, opacity:{value:.38}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform vec3 tint; uniform float opacity; varying vec2 vUv; void main(){float d=length(vUv-vec2(.5))*2.0; float falloff=pow(max(0.0,1.0-d),2.0); gl_FragColor=vec4(tint,falloff*opacity);}',
      transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending
    });
    for (const point of data.points.filter(isFixture)) {
      if (!active || !isOn(state, point)) continue;
      const config = settings(data,point), radius = Math.max(30, Number(config.beam_radius_cm) || 95);
      const material = poolMaterial.clone();material.uniforms.tint.value = new THREE.Color(kelvinColor(config.color_temperature_k));
      material.uniforms.opacity.value = point.type === 'ceiling_light' ? .43 : point.type === 'pendant' ? .34 : .26;
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), material);
      pool.rotation.x = -Math.PI/2;pool.position.set(point.position[0],1,point.position[1]);pool.renderOrder=1;scene.add(pool);
    }
    poolMaterial.dispose();
    for (const point of visible.filter(isFixture)) {
      const config = settings(data,point), on = active && isOn(state,point), color = new THREE.Color(kelvinColor(config.color_temperature_k));
      const x=point.position[0], z=point.position[1], ceiling=floor.ceiling_height || 280;
      const diameter=Math.max(10,Number(config.diameter_cm)||18), radius=diameter/2;
      const group = new THREE.Group();group.position.set(x,0,z);group.userData.pointId=point.id;
      const metal=new THREE.MeshStandardMaterial({color:0x646b62,metalness:.35,roughness:.6});
      const diffuser=new THREE.MeshStandardMaterial({color:on?0xfff5d9:0xb5bab6,emissive:color,emissiveIntensity:on?.88:0,roughness:.68,side:THREE.DoubleSide});
      const piece=(geometry,material,y)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.y=y;mesh.userData.pointId=point.id;group.add(mesh);selectable.push(mesh);return mesh;};
      if (point.type === 'downlight') {
        piece(new THREE.CylinderGeometry(radius+2,radius+2,2,20),metal,ceiling-2);
        piece(new THREE.CylinderGeometry(radius-1,radius-1,1.5,20),diffuser,ceiling-4);
      } else if (point.type === 'pendant') {
        const shadeY=Math.min(ceiling-14,Number(point.position[2])||ceiling-30);
        piece(new THREE.CylinderGeometry(6,6,2,16),metal,ceiling-2);
        const cord=piece(new THREE.CylinderGeometry(.9,.9,Math.max(2,ceiling-shadeY-7),8),metal,(ceiling+shadeY)/2);
        cord.rotation.y=0;
        piece(new THREE.CylinderGeometry(radius*.32,radius,11,20,1,true),metal,shadeY);
        piece(new THREE.CylinderGeometry(radius*.78,radius*.78,2,20),diffuser,shadeY-5.5);
      } else {
        piece(new THREE.CylinderGeometry(radius+2,radius+2,3,24),metal,ceiling-4);
        piece(new THREE.CylinderGeometry(radius,radius,6,24),diffuser,ceiling-8);
      }
      scene.add(group);
    }
    for (const room of floor.rooms) {
      const count=roomCounts.get(room.id)||0;if(!count)continue;
      const x=room.polygon.reduce((sum,p)=>sum+p[0],0)/room.polygon.length;
      const z=room.polygon.reduce((sum,p)=>sum+p[1],0)/room.polygon.length;
      const roomLight=new THREE.PointLight(0xffe6bf,Math.min(1.05,.25+count*.08),Math.min(360,180+count*11),2);
      roomLight.position.set(x,Math.max(160,(floor.ceiling_height||280)-45),z);scene.add(roomLight);
    }
    return selectable;
  }

  return {isFixture,isOn,settings,ambient,ambientBrightness,kelvinColor,svgFixture,svgWash,add3D};
})();
