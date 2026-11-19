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
  const shape = new THREE.TetrahedronGeometry(.19);
  const edge = new THREE.EdgesGeometry(shape);
  return Array.from({length:5}, (_, index) => {
    const object = new THREE.Group();
    mesh(THREE, shape, colors[index % 3], .21, object);
    const outline = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({
      color: colors[index % 3], opacity:.38, transparent:true, depthWrite:false,
    }));
    object.add(outline);
    accents.add(object);
    return object;
  });
}

export function buildCinemaStage(THREE, texture, name) {
  const group = new THREE.Group();
  const {model,colors} = chapters[name] || chapters.home;
  const accents = accentObjects(THREE, texture, colors, model, group);
  const amount = 28;
  const cloud = pointCloud(THREE, texture, colors, amount);
  const points = cloud.geometry.attributes.position;
  group.add(cloud);
  const seeds = Array.from({length:amount}, () => [Math.random(), Math.random(), Math.random()]);

  function draw(frame) {
    const {width, height, time, entrance, activity} = frame;
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
      points.setXYZ(index, w * (posX + Math.sin(time * (.45 + z) + z * 31) * .016),
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
      } else {
        object.position.set(offset * w * (.39 + Math.sin(time * .38 + rand) * .037),
          h * (-.35 + index * .16 + Math.cos(time * .71 + rand) * .05), .05 * index);
        object.rotation.set(time * (.32 + index*.1), time * .41 + index + activity*.45, breath*.1 + rand);
        object.scale.setScalar(scalar * .67);
      }
    });
  }
  return {group, draw, colors};
}
