const chapters = {
  home: {model: 'lanterns', colors: [0xffad56, 0xffe0a3, 0x9ecfde]},
  map: {model: 'lanterns', colors: [0xffb87b, 0xffd896, 0x93bdc9]},
  play: {model: 'lanterns', colors: [0xffb269, 0xffedc2, 0xafe7cf]},
  arcade: {model: 'lanterns', colors: [0xe5b674, 0xffeabc, 0x7cb1df]},
  finished: {model: 'lanterns', colors: [0xffb752, 0xffe0a1, 0xdbe9b5]},
  words: {model: 'leaves', colors: [0x7aced2, 0xa4e2d2, 0xf6cb8e]},
  detail: {model: 'leaves', colors: [0x92d2b2, 0xceedb3, 0xf4ad81]},
  reader: {model: 'leaves', colors: [0x7fa8d4, 0xbccaef, 0x8ce0d0]},
  review: {model: 'leaves', colors: [0x88e6cb, 0xc5f0b5, 0xfad791]},
  progress: {model: 'leaves', colors: [0xabd0ff, 0xbee2fb, 0xe5c49d]},
  settings: {model: 'leaves', colors: [0x7aabc7, 0x9bdbd9, 0xf3cc95]},
  pinyin: {model: 'constellation', colors: [0x60cfff, 0xe6f5ff, 0x97a8ff]},
  lights: {model: 'pond', colors: [0xbade72, 0xf1ffae, 0x85cbb9]},
  wind: {model: 'wind', colors: [0xffc279, 0xffeac0, 0x7ecfff]},
  echo: {model: 'echo', colors: [0x35dbbf, 0xb3ffde, 0x68cde7]},
  riddle: {model: 'lock', colors: [0xffae5e, 0xffe49d, 0xef9883]},
  strokes: {model: 'ink', colors: [0xf59a79, 0xffdfaa, 0xbd87de]},
  pairs: {model: 'pairs', colors: [0xf8a2d5, 0xffe0ec, 0xac9fee]},
  flow: {model: 'river', colors: [0x81ddaf, 0xd4f0ac, 0x70cbdb]},
};

function material(THREE, color, opacity = 1) {
  return new THREE.MeshBasicMaterial({color, transparent: opacity < 1, opacity, depthWrite: false});
}

function mesh(THREE, geometry, color, opacity, group) {
  const result = new THREE.Mesh(geometry, material(THREE, color, opacity));
  group.add(result);
  return result;
}

function glow(THREE, texture, color, opacity, scale, group) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    color, map: texture, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sprite.scale.setScalar(scale);
  group.add(sprite);
  return sprite;
}

function line(THREE, points, color, opacity, group) {
  const g = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point)));
  const m = new THREE.LineBasicMaterial({color, transparent: true, opacity, depthWrite: false});
  const trail = new THREE.Line(g, m);
  group.add(trail);
  return trail;
}

function ring(THREE, radius, color, alpha, group) {
  return mesh(THREE, new THREE.TorusGeometry(radius, .013, 5, 48), color, alpha, group);
}

function lantern(THREE, texture, colors) {
  const [bodyColor, gold, stringColor] = colors;
  const group = new THREE.Group();
  const shell = new THREE.LatheGeometry([
    new THREE.Vector2(.1, -.24), new THREE.Vector2(.212, -.195), new THREE.Vector2(.275, -.08),
    new THREE.Vector2(.274, .115), new THREE.Vector2(.212, .207), new THREE.Vector2(.103, .236),
  ], 8);
  const vertexColors = new Float32Array(shell.attributes.position.count * 3);
  const shadow = new THREE.Color(bodyColor).multiplyScalar(.55);
  const bright = new THREE.Color(gold);
  const shade = new THREE.Color();
  for (let i = 0; i < shell.attributes.position.count; i++) {
    const face = Math.floor(i / 6);
    const light = Math.max(0, Math.sin(face / 8 * Math.PI * 2 + .5)) * .64;
    shade.copy(shadow).lerp(bright, .06 + light + (.24 - shell.attributes.position.getY(i)) * .31);
    shade.toArray(vertexColors, i * 3);
  }
  shell.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
  const paper = mesh(THREE, shell, 0xffffff, .86, group);
  paper.material.vertexColors = true;
  paper.renderOrder = 2;
  const ribs = new THREE.EdgesGeometry(shell, 24);
  const frame = new THREE.LineSegments(ribs, new THREE.LineBasicMaterial({color:gold, transparent:true, opacity:.55, depthWrite:false}));
  frame.renderOrder = 3;
  group.add(frame);
  for (const y of [-.244, .24]) {
    const cap = mesh(THREE, new THREE.CylinderGeometry(.116, .116, .038, 8), 0x612e28, .87, group);
    cap.position.y = y;
    cap.renderOrder = 4;
  }
  const tassel = mesh(THREE, new THREE.CylinderGeometry(.024, .045, .132, 5), bodyColor, .8, group);
  tassel.position.y = -.37;
  line(THREE, [[0, -.258, 0], [0, -.38, 0]], stringColor, .65, group);
  line(THREE, [[0, .25, 0], [0, .43, 0]], gold, .53, group);
  const halo = glow(THREE, texture, bodyColor, .39, 1.77, group);
  halo.position.z = -.26;
  return group;
}

function kite(THREE, colors) {
  const group = new THREE.Group();
  const plane = new THREE.OctahedronGeometry(.5);
  plane.scale(.68, 1, .3);
  const shape = mesh(THREE, plane, colors[0], .46, group);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(plane),
    new THREE.LineBasicMaterial({color:colors[1], transparent:true, opacity:.7, depthWrite:false}));
  shape.renderOrder = 1;
  group.add(edges);
  line(THREE, [[0,-.46,0],[.08,-.63,0],[-.025,-.79,0],[.13,-.97,0],[.07,-1.11,0]], colors[2], .7, group);
  return group;
}

function pointCloud(THREE, texture, colors, amount) {
  const g = new THREE.BufferGeometry();
  const centers = Float32Array.from({length: amount * 3}, () => 0);
  g.setAttribute('position', new THREE.BufferAttribute(centers, 3));
  const pointColors = new Float32Array(amount * 3);
  const shades = colors.map(color => new THREE.Color(color));
  for (let i = 0; i < amount; i++) shades[i % shades.length].toArray(pointColors, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
  const field = new THREE.Points(g, new THREE.PointsMaterial({
    vertexColors: true, size:.21, map:texture, blending:THREE.AdditiveBlending,
    opacity:.73, transparent:true, depthWrite:false,
  }));
  field.frustumCulled = false;
  return field;
}

function accentObjects(THREE, texture, colors, model, stage) {
  const accents = new THREE.Group();
  stage.add(accents);
  if (model === 'lanterns') {
    return [0,1,2,3].map(index => {
      const object = lantern(THREE, texture, index % 2 ? colors : [colors[2], colors[1], colors[0]]);
      accents.add(object);
      return object;
    });
  }
  if (model === 'wind') {
    return [0,1,2].map(() => {
      const object = kite(THREE, colors);
      accents.add(object);
      return object;
    });
  }
  if (model === 'echo') {
    return Array.from({length:17}, (_, i) => {
      const object = mesh(THREE, new THREE.BoxGeometry(.055, .35, .055),
        colors[i % colors.length], .32, accents);
      return object;
    });
  }
  if (model === 'lock') {
    return [
      ring(THREE, .735, colors[0], .55, accents),
      ring(THREE, .845, colors[1], .45, accents),
      ring(THREE, .992, colors[2], .34, accents),
    ];
  }
  if (model === 'river' || model === 'pond') {
    return Array.from({length:4}, (_, index) =>
      ring(THREE, .66 + index * .25, colors[index % 3], .28, accents));
  }
  const count = model === 'ink' ? 4 : 5;
  const shape = model === 'pairs' ? new THREE.BoxGeometry(.38,.45,.08) :
    model === 'leaves' ? new THREE.TetrahedronGeometry(.19) : new THREE.OctahedronGeometry(.36);
  const edge = new THREE.EdgesGeometry(shape);
  const objects = Array.from({length:count}, (_, index) => {
    const object = new THREE.Group();
    if (model === 'pairs' || model === 'leaves') mesh(THREE, shape, colors[index % 3], .21, object);
    const outline = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({
      color: colors[index % 3], opacity:.38, transparent:true, depthWrite:false,
    }));
    object.add(outline);
    accents.add(object);
    return object;
  });
  if (model !== 'pairs' && model !== 'leaves') shape.dispose();
  return objects;
}

export function buildCinemaStage(THREE, texture, name) {
  const group = new THREE.Group();
  const {model,colors} = chapters[name] || chapters.home;
  const accents = accentObjects(THREE, texture, colors, model, group);
  const amount = model === 'constellation' || model === 'pond' ? 46 : 28;
  const cloud = pointCloud(THREE, texture, colors, amount);
  const points = cloud.geometry.attributes.position;
  group.add(cloud);
  const seeds = Array.from({length:amount}, () => [Math.random(), Math.random(), Math.random()]);

  function draw(frame) {
    const {width, height, time, entrance, activity, lane, signal, flight} = frame;
    const scalar = Math.min(height * .36, width * .24);
    const breath = Math.sin(time * 1.4);
    const w = width * entrance;
    const h = height * entrance;
    group.visible = w > 0 && h > 0;
    cloud.material.size = Math.max(.09, scalar * .095 + activity * .02);
    cloud.material.opacity = (.46 + .2 * Math.min(1, activity)) * entrance;
    seeds.forEach(([x,y,z], index) => {
      let posX = x - .5;
      const posY = (y + time * (.023 + z * .019)) % 1 - .5;
      if (model === 'leaves') posX = (x < .5 ? -1 : 1) * (.33 + (x % .5) * .31);
      const sway = model === 'wind' ? .08 : .016;
      points.setXYZ(index, w * (posX + Math.sin(time * (.45 + z) + z * 31) * sway),
        h * posY, -1 + z);
    });
    points.needsUpdate = true;
    accents.forEach((object, index) => {
      const offset = (index % 2 ? 1 : -1);
      const rand = index * 2.312;
      object.scale.setScalar(scalar);
      if (model === 'lanterns') {
        const places = [[-.33,.28],[.35,-.13],[.17,.31],[-.39,-.25]];
        const [x,y] = places[index];
        const bump = index === 1 ? activity * .13 : 0;
        object.position.set(w * x, h * (y + Math.sin(time * .85 + rand) * .055 + bump), .1 + index * .09);
        object.rotation.set(Math.sin(time * .7 + rand) * .17, time * .42 + rand, Math.sin(time + index) * .2);
        object.scale.setScalar(scalar * [.84,1.12,.43,.52][index]);
        if (index === 1) object.scale.multiplyScalar(1 + activity * .2);
      } else if (model === 'wind') {
        const steer = index === 0 ? (lane - 1) * .33 : offset * (.37 + .03 * index);
        object.position.set(w * steer, h * (index === 0 ? -.25 + activity * .37 * flight : .15 + index * .1), .1);
        object.scale.setScalar(scalar * (index === 0 ? .86 : .45));
        object.rotation.set(.1 + breath*.13, Math.sin(time + index) * .37,
          (index === 0 ? lane - 1 + Math.min(0, flight) * activity * 2 : offset) * .22 + breath*.14);
      } else if (model === 'echo') {
        const x = index / (accents.length - 1) - .5;
        object.position.set(w * x * .94, h * -.14, -.1);
        object.rotation.set(time * .24, index * .14, 0);
        object.scale.set(scalar * .76, (scalar * (.66 + Math.abs(Math.sin(time*3.35 + index * .42)) * (signal + activity * 3))) * .56, scalar);
      } else if (model === 'lock') {
        object.position.set(0, h * .025, -.02 + index * .04);
        object.rotation.set(Math.sin(time * (.28 + index * .09) + index) * .24 + activity * .18, index * .18 + activity * .32, time * (.3 + index * .12));
        object.scale.setScalar(scalar * (1.1 + index * .11 + activity * .2));
      } else if (model === 'river' || model === 'pond') {
        object.position.set(offset * w * (.21 + (index%3) * .1), h * (-.2 + index * .12), -.1);
        object.rotation.set(1.03, 0, time*.07);
        const pulse = (time * .29 + index * .24) % 1;
        object.scale.setScalar(scalar * (.19 + pulse * .85));
        object.material.opacity = (1 - pulse) * (.38 + activity*.12);
      } else {
        const edgeOffset = model === 'leaves' ? .39 : .29;
        object.position.set(offset * w * (edgeOffset + Math.sin(time * .38 + rand) * .037),
          h * (-.35 + index * .16 + Math.cos(time * .71 + rand) * .05), .05 * index);
        object.rotation.set(time * (.32 + index*.1), time * .41 + index + activity*.45, breath*.1 + rand);
        object.scale.setScalar(scalar * (model === 'leaves' ? .67 : .93));
      }
    });
  }
  return {group, draw, colors};
}
