const palettes = {
  wind: [0x236872, 0x7ac9ab, 0xffaf63],
  echo: [0x514379, 0xad9af4, 0xffc76d],
  riddle: [0x744731, 0xe8a257, 0xffdc87],
  lights: [0x245667, 0x72d3ad, 0xf4da7d],
  pinyin: [0x3b447e, 0x9f9df6, 0xffc76d],
  strokes: [0x813f43, 0xf39483, 0xffd4a1],
  pairs: [0x704054, 0xf6a0b7, 0xffd389],
  flow: [0x235671, 0x71c4e1, 0xffca81],
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const approach = (value, goal, rate, dt) => goal + (value - goal) * Math.exp(-rate * dt);
const tau = Math.PI * 2;

export function createGameSet(T, name) {
  const [stone, accent, light] = palettes[name] || palettes.wind;
  const root = new T.Group();
  const terrain = new T.Group();
  const props = new T.Group();
  root.add(terrain, props);
  const shades = new Map();
  const pivot = (parent, x = 0, y = 0, z = 0) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const material = (color, glow = false) => {
    const key = color + (glow ? 0x1000000 : 0);
    if (!shades.has(key)) {
      shades.set(key, new T.MeshStandardMaterial({
        color, roughness: .72, flatShading: true,
        emissive: glow ? color : 0, emissiveIntensity: glow ? .55 : 0,
      }));
    }
    return shades.get(key);
  };
  const mesh = (geo, color, parent, x, y, z, glow = false) => {
    const obj = new T.Mesh(geo, material(color, glow));
    obj.position.set(x, y, z);
    obj.castShadow = !glow;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  };
  const box = (parent, color, x, y, z, w, h, d, glow = false) =>
    mesh(new T.BoxGeometry(w, h, d), color, parent, x, y, z, glow);
  const drum = (parent, color, x, y, z, r, h, n = 16, bottom = r, glow = false) =>
    mesh(new T.CylinderGeometry(r, bottom, h, n), color, parent, x, y, z, glow);
  const gem = (parent, color, x, y, z, r, glow = false) =>
    mesh(new T.OctahedronGeometry(r), color, parent, x, y, z, glow);
  const ring = (parent, color, x, y, z, r, tube, glow = false) =>
    mesh(new T.TorusGeometry(r, tube, 5, 28), color, parent, x, y, z, glow);
  const beam = (parent, color, a, b, width, glow = false) => {
    const start = new T.Vector3(...a);
    const vector = new T.Vector3(...b).sub(start);
    const center = start.addScaledVector(vector, .5);
    const rod = drum(parent, color, center.x, center.y, center.z, width, vector.length(), 5, width, glow);
    rod.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vector.normalize());
    return rod;
  };
  const rounded = (p, color, x, y, z, w, d, depth, shadow = true) => {
    const slab = drum(p, color, x, y, z, 1, depth, 8);
    slab.scale.set(w, 1, d);
    slab.rotation.y = Math.PI / 8;
    slab.castShadow = shadow;
    return slab;
  };

  rounded(terrain, 0x151b37, 0, -.75, 0, 4.8, 2.6, .65, false);
  rounded(terrain, stone, 0, -.36, 0, 4.68, 2.5, .25, false);
  rounded(terrain, new T.Color(stone).lerp(new T.Color(0xFFFFFF), .12).getHex(),
    0, -.2, 0, 4.52, 2.34, .12, false);
  // Distant silhouettes sit behind the tabletop so the props keep their depth.
  const silhouette = new T.Color(stone).lerp(new T.Color(0x17172e), .64).getHex();
  for (const [x, y, z, radius, height] of [[-4.65,.24,-2.62,.85,2.65], [-3.44,.06,-3.12,.59,2.05],
    [3.86,.18,-3.03,.77,2.49], [4.78,.32,-2.5,.99,2.99]]) {
    const crag = drum(terrain, silhouette, x, y, z, .08, height, 5, radius);
    crag.rotation.z = x < 0 ? -.22 : .2;
    crag.castShadow = false;
  }
  const moon = gem(terrain, 0xffdda4, -3.29, 3.3, -2.98, .28, true);
  moon.scale.z = .55;
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 1.36;
    const y = .17 + .12 * Math.sin(i * 3);
    rounded(terrain, i % 2 ? accent : stone, x, -.05, 1.47 + (2 - Math.abs(i - 2)) * .15, .63, .32, .18);
    const peak = gem(terrain, stone, i < 2 ? -4.05 + i * .53 : 3.54 + (i - 2) * .32, y, -1.36 + .2 * i, .44);
    peak.scale.set(1, 1.45, .7);
    peak.rotation.y = i * 2.3;
  }
  for (const x of [-3.15, 3.15]) {
    drum(terrain, 0x20253a, x, .1, .63, .21, .42, 6, .33);
    box(terrain, light, x, .41, .63, .22, .42, .22, true);
    drum(terrain, stone, x, .66, .63, .16, .13, 6, .3);
  }
  const motes = Array.from({length:9}, (_, i) =>
    gem(root, i % 3 === 0 ? light : accent, 0, 0, 0, i % 3 === 0 ? .043 : .026, true));
  const fragments = Array.from({length:12}, (_, i) =>
    gem(root, i % 2 ? light : accent, 0, 0, 0, .055 + (i % 3) * .018, true));
  const target = new T.Vector3(0, .73, 0);
  let elapsed = 8;
  let action = '';
  let detail = {};
  let lane = 1;
  let strength = 1;
  let beats = 0;
  let step = false;
  const positive = new Set(['hit', 'cross', 'listen', 'unlock', 'collect', 'connect', 'seal', 'match', 'sail', 'reward', 'complete', 'success']);
  const last = type => action === type;

  function wind() {
    for (const x of [-2.06, 0, 2.06]) {
      const gate = pivot(props, x, 0, -.32);
      for (const side of [-1, 1]) {
        box(gate, 0x364d67, side * .65, .65, 0, .21, 1.55, .28);
        box(gate, accent, side * .65, .08, 0, .29, .32, .39);
      }
      box(gate, stone, 0, 1.35, 0, 1.65, .22, .41);
      box(gate, accent, 0, 1.69, -.03, 1.87, .24, .58);
      for (const side of [-1, 1]) {
        const roof = box(gate, accent, side * .93, 1.72, -.03, .27, .15, .52);
        roof.rotation.z = side * .3;
      }
      box(gate, light, 0, 1.44, .18, .35, .29, .15, true);
    }
    const kite = pivot(props, 0, 1.71, .95);
    const top = [0, 1, 0], right = [.69, .13, 0], bottom = [0, -.56, 0], left = [-.69, .13, 0], hub = [0, .13, .16];
    const sections = [[hub,right,top], [hub,top,left], [hub,left,bottom], [hub,bottom,right]];
    sections.forEach((vertices, i) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(vertices.flat(), 3));
      g.computeVertexNormals();
      const fabric = mesh(g, [light, 0xff825d, accent, 0xf8c993][i], kite, 0, 0, 0);
      fabric.material.side = T.DoubleSide;
    });
    [top,right,bottom,left].forEach(point => beam(kite, 0x784838, point, hub, .024));
    const ribbons = Array.from({length:5}, (_, i) =>
      box(kite, i % 2 ? 0xff9860 : light, 0, -.66 - i * .13, 0, .16 - i * .014, .14, .05));
    return (dt, time, energy) => {
      kite.position.x = approach(kite.position.x, (lane - 1) * 2.05, 8, dt);
      kite.position.y = 1.74 + Math.sin(time * 2.4) * .11 + (last('cross') ? energy * .64 : 0);
      kite.position.z = 1.03 - (last('cross') ? Math.sin(clamp(elapsed) * Math.PI) * 1.72 : 0);
      kite.rotation.set(.14 + Math.sin(time * 1.7) * .2, -.14, -(lane - 1) * .32 + Math.sin(time * 3) * .1);
      ribbons.forEach((ribbon, i) => {
        ribbon.position.x = Math.sin(time * 6 - i * .85) * .08 * (1 + i * .54);
        ribbon.rotation.z = Math.cos(time * 6 - i * .83) * .55;
      });
    };
  }

  function echo() {
    const radio = pivot(props, .05, 0, -.15);
    box(radio, 0x28233e, 0, .2, 0, 3.04, .48, 1.44);
    box(radio, accent, 0, 1.02, 0, 3.16, 1.66, 1.35);
    box(radio, stone, 0, 1.05, .69, 2.97, 1.39, .18);
    const speaker = drum(radio, 0x211c36, -.75, 1.04, .81, .55, .18, 24);
    speaker.rotation.x = Math.PI / 2;
    const cone = drum(radio, light, -.75, 1.04, .91, .28, .095, 18);
    cone.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) box(radio, 0x2c263e, -.75, .75 + i * .14, .97, .83, .046, .052);
    const dial = pivot(radio, .68, .88, .88);
    drum(dial, 0x24223e, 0, 0, 0, .34, .21).rotation.x = Math.PI / 2;
    box(dial, light, 0, .15, .13, .06, .21, .045, true);
    const leds = Array.from({length:7}, (_, i) =>
      box(radio, i < 4 ? accent : light, .22 + .16 * i, 1.53, .84, .09, .16, .05, true));
    beam(radio, accent, [.68,1.8,0], [1.38,3.14,-.17], .052);
    gem(radio, light, 1.38,3.14,-.17, .15, true);
    const waves = Array.from({length:3}, () => ring(radio, accent, 1.38, 3.12, -.17, 1, .023, true));
    return (dt, time, energy) => {
      const signal = strength;
      dial.rotation.z = approach(dial.rotation.z, 1.5 - signal * 1.1, 8, dt);
      cone.scale.setScalar(1 + Math.sin(time * 16) * energy * .24);
      leds.forEach((led, i) => { led.scale.y = .24 + .76 * +(i < 2 + signal * 2 || last('listen') && energy > .4); });
      waves.forEach((wave, i) => {
        const phase = (time * (.48 + energy) + i * .333) % 1;
        wave.scale.setScalar(.08 + phase * (.76 + signal * .18));
        wave.visible = phase < .8;
        wave.rotation.y = .45;
      });
    };
  }

  function riddle() {
    const safe = pivot(props, 0, 0, -.22);
    box(safe, 0x392a3b, 0, .14, 0, 3.54, .38, 1.86);
    box(safe, stone, 0, 1.25, 0, 3.16, 2.2, 1.37);
    const door = pivot(safe, -1.41, 1.25, .78);
    box(door, accent, 1.39, 0, .06, 2.81, 1.96, .21);
    box(door, 0x413047, 1.39, 0, .19, 2.55, 1.69, .07);
    const dials = [0,1,2].map((n) => {
      const rotor = pivot(door, .61 + n * .78, .02, .29);
      drum(rotor, n === 1 ? light : accent, 0, 0, 0, .35, .20, 16).rotation.x = Math.PI / 2;
      ring(rotor, stone, 0, 0, .12, .23, .044);
      [0,1,2,3,4,5,6,7].forEach(i => {
        const angle = i * tau / 8;
        box(rotor, i === 0 ? light : stone, Math.sin(angle) * .26, Math.cos(angle) * .26,
          .12, .045, .09, .045, i === 0).rotation.z = -angle;
      });
      return rotor;
    });
    const treasure = gem(safe, light, .23, 1.28, .82, .42, true);
    const position = [0, 0, 0];
    return (dt, time, energy) => {
      if (step && last('dial')) position[({onset:0,rime:1,tone:2})[detail.part] ?? beats % 3] += Math.PI * .48 * (detail.direction || 1);
      door.rotation.y = approach(door.rotation.y, last('unlock') || last('success') ? -.99 : 0, 6, dt);
      treasure.rotation.y = time * 1.4;
      treasure.visible = door.rotation.y < -.27;
      dials.forEach((dial, i) => {
        if (step && last('unlock')) position[i] += tau * .68;
        dial.rotation.z = approach(dial.rotation.z, position[i] + Math.sin(time * 2.4 + i) * energy * .08, 7, dt);
      });
    };
  }

  function lights() {
    const pool = rounded(props, 0x18818b, 0, -.04, .05, 3.4, 1.75, .15);
    pool.material.roughness = .31;
    const flowers = Array.from({length:5}, (_, i) => {
      const plant = pivot(props, ((i % 3)-1)*1.9 + (i > 2 ? .88 : 0), .05, i > 2 ? -.86 : .72);
      drum(plant, accent, 0, .01, 0, .49, .14, 7);
      for (let j = 0; j < 5; j++) {
        const theta = j * tau / 5;
        const petal = gem(plant, i % 2 ? light : 0xe48fa9, Math.sin(theta) * .24, .36, Math.cos(theta) * .24, .27);
        petal.scale.set(.65, 1.46, .62);
        petal.rotation.set(Math.cos(theta) * .52, 0, -Math.sin(theta) * .52);
      }
      const core = gem(plant, light, 0, .61, 0, .23, true);
      const ripple = ring(plant, accent, 0, .08, 0, .74, .023, true);
      ripple.rotation.x = -Math.PI / 2;
      return {plant, core, ripple};
    });
    return (dt, time, energy) => {
      flowers.forEach(({plant, core, ripple}, i) => {
        const picked = i === (detail.index ?? beats) % flowers.length && energy > .01;
        plant.position.y = .11 + Math.sin(time * 2.1 + i) * .045;
        core.position.y = approach(core.position.y, .63 + (picked ? energy * .95 : 0), 9, dt);
        core.rotation.y = time * 1.2 + i;
        ripple.scale.setScalar(.5 + ((time * .25 + i * .2) % 1) * .38 + (picked ? energy * .41 : 0));
      });
    };
  }

  function pinyin() {
    rounded(props, stone, 0, .09, .2, 1.47, 1.44, .35);
    drum(props, light, 0, .3, .2, .7, .3, 8, .88);
    const armillary = pivot(props, 0, 1.12, .27);
    ring(armillary, accent, 0, .57, 0, 1.08, .055).rotation.y = .29;
    ring(armillary, light, 0, .57, 0, .98, .04, true).rotation.x = 1.12;
    const tube = pivot(armillary, -.1, .48, .08);
    drum(tube, stone, 0, 0, 0, .32, 1.57, 12, .25);
    drum(tube, light, 0, .67, 0, .375, .18, 12);
    drum(tube, 0x89d7ff, 0, .78, 0, .27, .05, 16, .28, true);
    tube.rotation.z = -.68;
    const stars = Array.from({length:5}, (_, i) => gem(props, i % 2 ? accent : light,
      (i - 2) * 1.2, 2.12 + (i % 2) * .67, -1.15, .16, true));
    const bolt = gem(props, light, 0, 0, 0, .15, true);
    return (dt, time, energy) => {
      tube.rotation.z = approach(tube.rotation.z, -.56 - (beats % 5 - 2) * .25 + energy * .25, 7, dt);
      armillary.rotation.y = -.22 + Math.sin(time * .7) * .45;
      stars.forEach((star, i) => {
        star.position.y = 2.14 + (i % 2) * .67 + Math.sin(time * 2 + i) * .15;
        star.rotation.set(time * 1.4, i + time * 1.8, 0);
        star.scale.setScalar(1 + (i === beats % 5 ? energy * 1.7 : 0));
      });
      bolt.visible = (last('launch') || last('hit')) && elapsed < .63;
      if (bolt.visible) {
        bolt.position.set(0, 1.9, .34).lerp(stars[(detail.index ?? beats) % 5].position, clamp(elapsed / .62));
        bolt.scale.set(.55, 2.2, .55);
      }
    };
  }

  function strokes() {
    box(props, 0x39223c, -.15, .13, 0, 4.5, .62, 2.68);
    box(props, 0xb46c61, -.15, .47, 0, 4.42, .16, 2.69);
    box(props, 0xf8dcb3, -.15, .57, .04, 2.45, .07, 2.03);
    for (let i = 0; i < 5; i++) {
      box(props, 0xc9ad98, -.96 + i * .41, .609, .04, .014, .01, 1.76);
      box(props, 0xc9ad98, -.15, .609, -.77 + i * .41, 2.11, .01, .014);
    }
    const ink = new T.Group();
    props.add(ink);
    let character = '';
    let inkCount = 0;
    let inkX = .5;
    let inkY = .5;
    function refreshPaper(glyph) {
      for (const stroke of [...ink.children]) {
        stroke.geometry.dispose();
        stroke.removeFromParent();
      }
      character = glyph;
      const medians = window.HSK_STROKE_DATA?.[glyph]?.medians || [];
      for (const path of medians) {
        const points = path.map(([x,y]) => new T.Vector3(-1.19 + x / 1024 * 2.08, .635, -.84 + y / 1024 * 1.76));
        if (points.length < 2) continue;
        const line = new T.CatmullRomCurve3(points);
        mesh(new T.TubeGeometry(line, Math.max(4, points.length * 2), .027, 5, false), 0x4c2d4b, ink, 0, 0, 0);
      }
    }
    box(props, 0x322837, 1.48, .66, -.47, .65, .24, .72);
    drum(props, 0x482944, 1.48, .796, -.47, .23, .02);
    const brush = pivot(props, 1.43, 1.35, -.24);
    drum(brush, stone, 0, .54, 0, .082, 1.43, 9);
    drum(brush, light, 0, -.25, 0, .10, .21, 9);
    drum(brush, 0x34263b, 0, -.49, 0, .10, .31, 9, .009);
    const stamp = box(props, 0xe5735a, .69, .66, .78, .27, .09, .27, true);
    return (dt, time, energy) => {
      if (step) {
        if (detail.glyph && detail.glyph !== character) refreshPaper(detail.glyph);
        if (last('round') || last('enterGame') || last('collect')) inkCount = 0;
        if (last('ink')) inkCount = detail.index;
        if (last('seal')) inkCount = ink.children.length;
        if (Number.isFinite(detail.x)) inkX = clamp(detail.x);
        if (Number.isFinite(detail.y)) inkY = clamp(detail.y);
      }
      ink.children.forEach((stroke, i) => { stroke.visible = i < inkCount; });
      stamp.visible = last('seal') || last('reward');
      const writing = (last('ink') || last('seal')) && energy > .08;
      brush.position.x = approach(brush.position.x, writing ? -1.19 + inkX * 2.08 : 1.43, 9, dt);
      brush.position.y = approach(brush.position.y, writing ? 1.07 : 1.54 + Math.sin(time * 2) * .13, 10, dt);
      brush.position.z = approach(brush.position.z, writing ? -.84 + inkY * 1.76 : -.24, 9, dt);
      brush.rotation.z = -.38 + energy * .43;
      brush.rotation.x = -.24;
    };
  }

  function pairs() {
    const tiles = Array.from({length:4}, (_, i) => {
      const x = (i % 2) * 1.47 - .75;
      const z = i >= 2 ? -.7 : .77;
      box(props, 0x38273e, x, .1, z, 1.23, .46, .88);
      const object = pivot(props, x, .81, z);
      box(object, stone, 0, 0, 0, 1.08, 1.13, .21);
      box(object, i % 2 ? accent : light, 0, 0, .13, .9, .95, .08);
      gem(object, light, 0, 0, -.16, .28, true).scale.z = .31;
      box(object, light, 0, -.31, -.13, .66, .042, .057, true);
      ring(object, stone, 0, 0, .19, .23, .056).rotation.z = Math.PI / 4;
      return object;
    });
    return (dt, time, energy) => {
      tiles.forEach((tile, i) => {
        const paired = last('match') || last('reward');
        const turned = last('flip') && (detail.index ?? beats) % 4 === i;
        tile.rotation.y = approach(tile.rotation.y, paired || turned ? Math.PI : 0, 8, dt);
        const hop = paired || turned ? Math.sin(clamp(elapsed * 1.9) * Math.PI) * .42 : 0;
        tile.position.y = .81 + hop + Math.sin(time * 2.2 + i) * .048 + energy * .03;
      });
    };
  }

  function flow() {
    const water = rounded(props, 0x247c9f, -.45, -.024, -.15, 3.73, 1.65, .17);
    water.material.roughness = .31;
    const ripples = Array.from({length:9}, (_, i) => box(props, i % 3 ? 0x58afc3 : accent,
      (i % 3 - 1) * 1.4, .087, Math.floor(i / 3) * .7 - .86, .42 + ((i + 2) % 3) * .29, .01, .032, true));
    const dock = pivot(props, 2.31, .04, -.7);
    for (let i = 0; i < 5; i++) box(dock, i % 2 ? 0x986451 : 0xaf7a54,
      -.47 + i * .24, .33, .15, .21, .21, 1.85);
    for (const x of [-.53, .55]) box(dock, stone, x, .35, .89, .2, .9, .23);
    const boats = Array.from({length:3}, (_, i) => {
      const boat = pivot(props, -1.94 + i * 1.42, .17, .75 - i * .71);
      const hull = drum(boat, i ? accent : 0xff845c, 0,.07,0,.63,.25,6,.43);
      hull.scale.set(1, 1, .48);
      box(boat, 0x3f2e4e, -.07, .58, 0, .075, .96, .076);
      const sail = mesh(new T.CircleGeometry(.45, 3), i ? accent : light, boat, .14, .63, .025);
      sail.material.side = T.DoubleSide;
      sail.rotation.z = -.18;
      sail.scale.set(.95, 1.24, 1);
      return boat;
    });
    return (dt, time, energy) => {
      boats.forEach((boat, i) => {
        const sailing = last('sail') ? Math.sin(clamp(elapsed * 1.26) * Math.PI / 2) * 2.23 : 0;
        boat.position.x = -2.22 + i * 1.46 + sailing + Math.sin(time * .9 + i) * .19;
        boat.position.y = .15 + Math.sin(time * 3 + i) * .065 + (last('boat') && i === beats % 3 ? energy * .24 : 0);
        boat.rotation.z = Math.sin(time * 1.7 + i) * .095 - energy * .07;
      });
      ripples.forEach((ripple, i) => {
        ripple.position.x = ((time * .53 + i * 1.027) % 6) - 3;
        ripple.scale.x = .48 + Math.sin(time * 1.7 + i) ** 2 * .7;
      });
    };
  }

  const rig = {wind, echo, riddle, lights, pinyin, strokes, pairs, flow}[name]();
  return {
    root, target,
    cue(type, eventDetail) {
      action = type;
      detail = eventDetail;
      if (Number.isFinite(detail.lane)) lane = clamp(detail.lane, 0, 2);
      if (Number.isFinite(detail.signal)) strength = clamp(detail.signal, 0, 3);
      if (type !== 'steer') beats++;
      if (type === 'enterGame' || type === 'enter') {
        beats = 0;
        lane = 1;
        strength = 1;
      }
      elapsed = 0;
      step = true;
    },
    update(dt, time) {
      elapsed += dt;
      const energy = (1 - clamp(elapsed / .95)) ** 2;
      rig(dt, time, energy);
      motes.forEach((particle, i) => {
        const phase = time * (.23 + (i % 4) * .085) + i * 2.39;
        particle.position.set(Math.cos(phase) * (3.18 + i % 4 * .36),
          .32 + (i * .27 + time * .19) % 2.61, Math.sin(phase) * 1.77);
        particle.rotation.y = time + i;
      });
      const burst = positive.has(action) && detail.correct !== false && elapsed < 1.05;
      fragments.forEach((piece, i) => {
        piece.visible = burst;
        if (burst) {
          const f = elapsed / 1.05;
          const radius = (.28 + .095 * (i % 6)) * (1 + f * 5);
          const angle = i * 2.39;
          piece.position.set(Math.cos(angle) * radius, 1.62 + f * (2.8 - 2.6 * f) + (i % 3) * .21,
            Math.sin(angle) * radius * .62);
          piece.rotation.set(f * 8 + i, f * 9, i);
          piece.scale.setScalar(1 - f);
        }
      });
      step = false;
    },
  };
}
