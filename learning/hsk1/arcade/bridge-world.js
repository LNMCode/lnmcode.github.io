import * as T from './vendor/three.module.min.js';
import {createTraveler} from './story-world.js';

const RIVER_Y = -.76;
const DECK_Y = .48;
const BRIDGE_HALF = 2.78;
const FOX_START = -3.85;
const FOX_END = 3.85;
const CROSS_TIME = 1760;

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => value * value * (3 - 2 * value);
const slotX = (index, count) => -BRIDGE_HALF + ((index + .5) / count) * BRIDGE_HALF * 2;

export function buildBridgeWorld(canvas, {reduced = false} = {}) {
  const host = canvas.parentElement;
  let renderer;
  try {
    const context = canvas.getContext('webgl2', {alpha:false, antialias:true, powerPreference:'low-power'});
    if (!context) return null;
    renderer = new T.WebGLRenderer({canvas, context, antialias:true, powerPreference:'low-power'});
  } catch {
    return null;
  }

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x192840, .031);
  const camera = new T.OrthographicCamera(-6, 6, 4, -4, .05, 70);
  camera.position.set(0, 7.7, 12.3);
  camera.lookAt(0, .98, .67);
  renderer.setClearColor(0x182139);
  const materials = new Set();
  const geometries = new Set();
  const own = (entries, object) => { entries.add(object); return object; };
  const material = (color, options = {}) => own(materials,
    new T.MeshStandardMaterial({color, roughness:.89, flatShading:true, ...options}));
  const basic = (color, options = {}) => own(materials, new T.MeshBasicMaterial({color, ...options}));
  const mesh = (geometry, shade, x, y, z, parent = scene) => {
    const object = new T.Mesh(own(geometries, geometry), shade);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  const box = (width, height, depth, shade, x, y, z, parent) =>
    mesh(new T.BoxGeometry(width, height, depth), shade, x, y, z, parent);
  const gem = (size, shade, x, y, z, parent) =>
    mesh(new T.IcosahedronGeometry(size, 0), shade, x, y, z, parent);
  const darkRidge = material(0x374462);
  const softRidge = material(0x4a5978);
  const warm = material(0xffc77e, {emissive:0xffa842, emissiveIntensity:.36});
  const leftWood = material(0x805f58);
  const darkWood = material(0x413b50);
  const moss = material(0x527569);
  const lurid = basic(0xd5ecd6);
  scene.add(new T.HemisphereLight(0xffe8ce, 0x4e689f, 1.98));
  const moonlight = new T.DirectionalLight(0xbdd5ff, 1.54);
  moonlight.position.set(2, 5.8, -3.6);
  const lanternLight = new T.DirectionalLight(0xffd8ae, 2.15);
  lanternLight.position.set(-3.7, 6.5, 5.3);
  scene.add(moonlight, lanternLight);

  const moon = mesh(new T.CircleGeometry(.57, 42), basic(0xffe5bd, {fog:false}), -4.1, 3.5, -8.7);
  moon.rotation.x = -.43;
  for (let i = 0; i < 25; i++) {
    const x = Math.sin(i * 2.4) * 9;
    const y = 1.8 + ((i * 13) % 41) / 9;
    const z = -8.7 - ((i * 11) % 10) * .2;
    const star = gem(i % 6 ? .035 : .061, i % 4 ? lurid : warm, x, y, z);
    star.scale.y = i % 6 ? 1 : 1.8;
  }
  for (let i = 0; i < 11; i++) {
    const x = (i - 5) * 1.5;
    const height = 1.3 + (i * 11 % 7) * .29;
    const ridge = mesh(new T.ConeGeometry(.74 + (i % 3) * .35, height, 4), i % 2 ? darkRidge : softRidge,
      x, height / 2 - .57, -5.8 - (i % 3) * .84);
    ridge.scale.z = 1.64;
    ridge.rotation.y = i * .78;
  }

  const water = own(materials, new T.ShaderMaterial({
    uniforms: {time:{value:0}},
    vertexShader:`
      varying vec2 riverUv;
      void main() {
        riverUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader:`
      uniform float time;
      varying vec2 riverUv;
      void main() {
        vec2 v = riverUv;
        float ripples = sin(v.y * 87.0 + sin(v.x * 24.0 + time * 0.85) * 1.3 - time * 0.8);
        float glimmer = max(0.0, sin(v.x * 36.0 - v.y * 12.0 + time * 0.81));
        float foam = smoothstep(0.88, 0.99, ripples) * (0.26 + glimmer * 0.50);
        vec3 hue = mix(vec3(0.035, 0.155, 0.246), vec3(0.095, 0.345, 0.38), v.y);
        hue += foam * vec3(0.17, 0.27, 0.27);
        gl_FragColor = vec4(mix(hue, vec3(0.10, 0.15, 0.24), smoothstep(0.68, 1.0, v.y)), 1.0);
      }`,
  }));
  mesh(new T.PlaneGeometry(28, 22), water, 0, RIVER_Y, 0).rotation.x = -Math.PI / 2;

  const rockSide = material(0x4f4c67);
  const rockShade = material(0x363e58);
  for (const side of [-1, 1]) {
    const silhouette = new T.Shape();
    const outline = [[2.68,.12],[2.88,-1.08],[3.42,-2.38],[4.91,-3.01],[7.45,-2.89],[8.1,-.18],[8.03,3.47],[6.15,4.2],[4.15,3.27],[3.34,2.42],[2.92,1.15]];
    outline.forEach(([x,z], index) => {
      if (index) silhouette.lineTo(side * x, -z);
      else silhouette.moveTo(side * x, -z);
    });
    silhouette.closePath();
    const wall = mesh(new T.ExtrudeGeometry(silhouette, {
      steps:1, depth:1.17, bevelEnabled:true, bevelThickness:.14, bevelSize:.13, bevelSegments:1,
    }), rockSide, 0, -.88, 0);
    wall.rotation.x = -Math.PI / 2;
    const cover = mesh(new T.ShapeGeometry(silhouette), moss, 0, .434, 0);
    cover.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const x = side * (2.98 + (i * 17 % 13) * .27);
      const z = -1.93 + i * 1.09;
      const stone = gem(.17 + .028 * i, i % 2 ? rockShade : softRidge, x, .48, z);
      stone.scale.set(1.4,.56,.83);
    }
    for (let i = 0; i < 4; i++) {
      const x = side * (4.32 + i * .91);
      const z = -.84 - (i % 2) * 1.21;
      box(.13,.69,.13,leftWood,x,.73,z);
      for (let a = 0; a < 3; a++) {
        const needles = material([0x345a58,0x4a7470,0x648e85][a]);
        mesh(new T.ConeGeometry((.55 - a * .091) * (1 + i * .05), .72 - a * .07, 5),
          needles,x,1.14 + a * .38,z).rotation.y = i * .74 + a * .49;
      }
    }
    const lightX = side * 2.83;
    for (const z of [-.53,.59]) {
      box(.14,.72,.14,darkWood,lightX,.79,z);
      box(.23,.26,.22,warm,lightX,1.15,z);
      mesh(new T.ConeGeometry(.211,.18,4), leftWood, lightX, 1.37, z).rotation.y = Math.PI / 4;
    }
  }

  const rung = material(0xc49b6b);
  const bamboo = material(0xf1d3a4);
  const cedar = material(0x6e534d);
  const gaps = material(0x2a5061, {transparent:true, opacity:.62});
  const mint = material(0xb2dca1, {emissive:0x314b61, emissiveIntensity:.22});
  const ember = material(0xf6a77b, {emissive:0xa83b32, emissiveIntensity:.48});
  for (const side of [-1, 1]) {
    box(.34,.15,1.18,leftWood,side * 2.74,.31,0);
    box(.21,.09,1.12,rung,side * 2.95,.45,0);
  }
  const cableGeometry = own(geometries, new T.CylinderGeometry(.04,.04,BRIDGE_HALF * 2,8));
  for (const z of [-.56,.56]) {
    const cable = new T.Mesh(cableGeometry, cedar);
    cable.rotation.z = Math.PI / 2;
    cable.position.set(0,.28,z);
    scene.add(cable);
  }

  const slots = Array.from({length:7}, () => {
    const base = new T.Group();
    scene.add(base);
    const body = box(1,.18,1.02,rung,0,-.08,0,base);
    const face = box(1,.06,.99,bamboo,0,.016,0,base);
    const seam = box(1,.025,.046,cedar,0,.051,.415,base);
    return {base, body, face, seam, flight:null};
  });

  const actor = createTraveler(T);
  actor.root.position.set(FOX_START, DECK_Y, 0);
  actor.root.scale.setScalar(.85);
  scene.add(actor.root);

  const vector = new T.Vector3();
  const ray = new T.Raycaster();
  const plane = new T.Plane(new T.Vector3(0,1,0), -DECK_Y);
  let state;
  let frame = 0;
  let last = 0;
  let canView = true;
  let lost = false;
  let removed = false;
  let crossAt = 0;
  let wrongAt = 0;
  let actionAt = 0;
  let time = 0;
  let phase = '';
  const controller = new AbortController();
  const options = {signal:controller.signal};
  const pins = new Set();

  function pinLabel(slot, count, x, y, z) {
    vector.set(x, y + .08, z + .055).project(camera);
    slot.style.setProperty('--river-x', `${(vector.x + 1) * 50}%`);
    slot.style.setProperty('--river-y', `${(1 - vector.y) * 50}%`);
    slot.style.setProperty('--river-slot', `${100 * (BRIDGE_HALF * 2 / count) / (camera.right - camera.left)}%`);
  }

  function settleLabels() {
    if (!state) return;
    const count = state.slots.length;
    pins.clear();
    state.slots.forEach((slot, index) => {
      pinLabel(slot, count, slotX(index, count), DECK_Y, 0);
      pins.add(slot);
    });
  }

  function fit() {
    if (removed || lost) return;
    const {clientWidth:width, clientHeight:height} = host;
    if (!width || !height) return;
    const aspect = width / height;
    const viewWidth = Math.max(9.25, 5.05 * aspect);
    const viewHeight = viewWidth / aspect;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderer.setPixelRatio(Math.max(1, Math.min(1.5, window.devicePixelRatio || 1, Math.sqrt(720000 / (width * height)))));
    renderer.setSize(width, height, false);
    settleLabels();
    schedule();
  }

  function schedule() {
    if (!frame && canView && !document.hidden && !removed && !lost) frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    if (!canView || document.hidden || lost || removed) return;
    const active = now - actionAt < 2300;
    if (now - last < (active ? 14 : 29)) {
      schedule();
      return;
    }
    const dt = clamp((now - last) / 1000, .001, .09);
    last = now;
    time += reduced ? 0 : dt;
    water.uniforms.time.value = time;
    const count = state?.slots.length || 0;
    const across = phase === 'landed' || reduced && phase === 'crossing' ? 1 :
      phase === 'crossing' ? clamp((now - crossAt) / CROSS_TIME) : 0;
    const retreat = phase === 'wrong' ? Math.sin(Math.PI * .5 * clamp((now - wrongAt) / 710)) : 0;
    const lastCorrect = (state?.wrong || 0) > 0 ? slotX(state.wrong - 1, count) : FOX_START + .58;
    if (phase === 'wrong') {
      actor.root.position.x = FOX_START + (lastCorrect - FOX_START) * retreat;
    } else {
      actor.root.position.x = FOX_START + (FOX_END - FOX_START) * smooth(across);
    }
    actor.update(dt, time, {moving:(across > 0 && across < 1) || retreat > 0 && retreat < .99 ? .93 : 0, reducedMotion:reduced});

    slots.forEach(({base, body, face, seam, flight}, index) => {
      const shown = index < count;
      base.visible = shown;
      if (!shown) return;
      const width = BRIDGE_HALF * 2 / count * .95;
      base.position.set(slotX(index, count), DECK_Y, 0);
      base.rotation.set(0,0,0);
      const hasTile = Boolean(state.sequence[index]);
      face.visible = hasTile;
      seam.visible = hasTile;
      body.material = hasTile ? rung : gaps;
      face.material = phase === 'wrong' && index === state.wrong ? ember :
        phase === 'crossing' || phase === 'landed' ? mint : bamboo;
      body.scale.set(width,hasTile ? 1 : .2,1);
      face.scale.x = seam.scale.x = width;
      if (flight && hasTile) {
        const progress = reduced ? 1 : clamp((now - flight.at) / 416);
        if (progress >= 1) {
          slots[index].flight = null;
        } else {
          base.position.lerp(flight.from, 1 - smooth(progress));
          base.position.y += Math.sin(progress * Math.PI) * 1.05;
          base.rotation.x = (1 - progress) * -.81;
          base.rotation.z = Math.sin(Math.PI * progress) * .26;
        }
        const {x,y,z} = base.position;
        pinLabel(state.slots[index], count, x, y, z);
      }
      if (phase === 'wrong' && index === state.wrong && !reduced) {
        base.rotation.z += Math.sin((now - wrongAt) / 38) * .13 * (1 - clamp((now - wrongAt) / 620));
      }
    });
    renderer.render(scene, camera);
    if (!reduced) schedule();
  }

  function sync(next) {
    state = next;
    if (phase !== next.phase) {
      actionAt = performance.now();
      if (next.phase === 'crossing') crossAt = actionAt;
      if (next.phase === 'wrong') {
        wrongAt = actionAt;
        actor.cue('surprise');
      }
      if (next.phase === 'landed') actor.cue('celebrate');
      phase = next.phase;
    }
    slots.forEach((slot, index) => { if (!state.sequence[index]) slot.flight = null; });
    settleLabels();
    schedule();
  }

  function place(index, button, still) {
    if (removed || lost || still || !slots[index]) return false;
    const arena = host.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const pointer = new T.Vector2(
      (rect.left + rect.width / 2 - arena.left) / arena.width * 2 - 1,
      1 - (rect.top + rect.height / 2 - arena.top) / arena.height * 2,
    );
    ray.setFromCamera(pointer, camera);
    const from = new T.Vector3();
    if (!ray.ray.intersectPlane(plane, from)) return false;
    actionAt = performance.now();
    slots[index].flight = {from, at:actionAt};
    schedule();
    return true;
  }

  function reset() {
    slots.forEach(slot => { slot.flight = null; });
    actor.cue('wave');
  }

  const size = new ResizeObserver(fit);
  const onScreen = new IntersectionObserver(([item]) => {
    canView = item.isIntersecting;
    if (canView) schedule();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  size.observe(host);
  onScreen.observe(host);
  document.addEventListener('visibilitychange', schedule, options);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    host.dataset.world = '2d';
  }, options);
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    host.dataset.world = '3d';
    fit();
  }, options);
  host.dataset.world = '3d';
  fit();

  return {
    sync, place, reset,
    setReduced(value) {
      reduced = value;
      schedule();
    },
    dispose() {
      removed = true;
      cancelAnimationFrame(frame);
      size.disconnect();
      onScreen.disconnect();
      controller.abort();
      scene.remove(actor.root);
      materials.forEach(shade => shade.dispose());
      geometries.forEach(shape => shape.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      delete host.dataset.world;
      for (const slot of pins) ['--river-x','--river-y','--river-slot'].forEach(name => slot.style.removeProperty(name));
    },
  };
}
