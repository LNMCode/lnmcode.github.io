const STEP = 4.42;
const palettes = [
  {stone:0x526ea5, edge:0x91c3ff, glow:0x90edff, dye:0x267fbe},
  {stone:0x516ba4, edge:0xb7aaff, glow:0xd9bdff, dye:0x765cbe},
  {stone:0x93664f, edge:0xf1bd71, glow:0xffdf96, dye:0xca7b47},
  {stone:0x3f7875, edge:0x81ccab, glow:0xa9ffd9, dye:0x419d8a},
  {stone:0x655e9b, edge:0xabb1ff, glow:0xe3cbff, dye:0x696dc5},
  {stone:0x8f5972, edge:0xf39ca6, glow:0xffb0a4, dye:0xbd536e},
  {stone:0x526d7f, edge:0x91b9e6, glow:0xffdb96, dye:0xa75f67},
  {stone:0x386e83, edge:0x8bdcd6, glow:0xaaf7ef, dye:0x468daf},
];
const arcadeGlyphs = [...'风声锁萤音笔双舟'];
const mapGlyphs = [...'学友家饭书字园问街数十时钟向买食日雨话语'];
const pathZ = index => Math.sin(index * 1.31) * .53;
const ease = value => value * value * (3 - 2 * value);
const clamp = value => Math.max(0, Math.min(1, value));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

const workshops = new WeakMap();

function useWorkshop(T) {
  if (workshops.has(T)) return workshops.get(T);
  const materials = new Map();
  const signs = new Map();
  const night = {wood:0x292944, trim:0x56415e, cream:0xffddb0, copper:0xd09150, jade:0x42978f};
  const shapes = {
    box:new T.BoxGeometry(1, 1, 1),
    ball:new T.SphereGeometry(.5, 14, 10),
    gem:new T.IcosahedronGeometry(.5, 0),
    oct:new T.OctahedronGeometry(.5),
    cylinder:new T.CylinderGeometry(.5, .5, 1, 12, 1),
    rock:new T.CylinderGeometry(.49, .32, 1, 7, 1),
    tree:new T.ConeGeometry(.5, 1, 6, 1),
    plane:new T.PlaneGeometry(1, 1),
    ring:new T.TorusGeometry(.5, .045, 7, 28),
  };
  const rounding = .15;
  const cushion = new T.Shape();
  cushion.moveTo(-.5 + rounding, -.5);
  cushion.lineTo(.5 - rounding, -.5);
  cushion.quadraticCurveTo(.5, -.5, .5, -.5 + rounding);
  cushion.lineTo(.5, .5 - rounding);
  cushion.quadraticCurveTo(.5, .5, .5 - rounding, .5);
  cushion.lineTo(-.5 + rounding, .5);
  cushion.quadraticCurveTo(-.5, .5, -.5, .5 - rounding);
  cushion.lineTo(-.5, -.5 + rounding);
  cushion.quadraticCurveTo(-.5, -.5, -.5 + rounding, -.5);
  shapes.soft = new T.ExtrudeGeometry(cushion, {
    depth:.82, bevelEnabled:true, bevelThickness:.09, bevelSize:.09, bevelSegments:2, curveSegments:4,
  });
  shapes.soft.center();
  const radiant = document.createElement('canvas');
  radiant.width = radiant.height = 64;
  const brush = radiant.getContext('2d');
  const haloBrush = brush.createRadialGradient(32, 32, 0, 32, 32, 31);
  haloBrush.addColorStop(0, '#ffffff');
  haloBrush.addColorStop(.3, '#ffffff83');
  haloBrush.addColorStop(.65, '#ffffff27');
  haloBrush.addColorStop(1, '#ffffff00');
  brush.fillStyle = haloBrush;
  brush.fillRect(0, 0, 64, 64);
  const haloTex = new T.CanvasTexture(radiant);
  const shadowMat = new T.MeshBasicMaterial({
    map:haloTex, color:0x0a0a24, transparent:true, depthWrite:false, opacity:.64,
  });

  function mat(color, light = false) {
    const key = `${color}:${light}`;
    if (!materials.has(key)) materials.set(key, light
      ? new T.MeshBasicMaterial({color, toneMapped:false})
      : new T.MeshStandardMaterial({color, roughness:.82, metalness:.03, flatShading:true}));
    return materials.get(key);
  }

  function solid(parent, form, color, x, y, z, width, height, depth, angle = 0, light = false) {
    const object = new T.Mesh(shapes[form], mat(color, light));
    object.position.set(x, y, z);
    object.scale.set(width, height, depth);
    object.rotation.z = angle;
    object.castShadow = true;
    object.receiveShadow = !light;
    parent.add(object);
    return object;
  }

  function group(parent, x = 0, y = 0, z = 0) {
    const object = new T.Group();
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }

  function line(parent, color, a, b, thick, light = false) {
    const start = new T.Vector3(...a);
    const stop = new T.Vector3(...b);
    const direction = stop.clone().sub(start);
    const middle = start.addScaledVector(direction, .5);
    const stroke = solid(parent, 'cylinder', color, middle.x, middle.y, middle.z, thick, direction.length(), thick, 0, light);
    stroke.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
    return stroke;
  }

  function shadow(parent, x, y, z, width, depth) {
    const object = new T.Mesh(shapes.plane, shadowMat);
    object.position.set(x, y, z);
    object.scale.set(width, depth, 1);
    object.rotation.x = -Math.PI / 2;
    parent.add(object);
    return object;
  }

  function halo(parent, color, x, y, z, size) {
    const glow = new T.Sprite(new T.SpriteMaterial({
      map:haloTex, color, blending:T.AdditiveBlending, transparent:true, opacity:.72, depthWrite:false, toneMapped:false,
    }));
    glow.position.set(x, y, z);
    glow.scale.setScalar(size);
    parent.add(glow);
    return glow;
  }

  function sign(parent, text, x, y, z, width, height, tint = '#fff1cf') {
    const signKey = text + tint;
    if (!signs.has(signKey)) {
      const ink = document.createElement('canvas');
      ink.width = 128;
      ink.height = 128;
      const pen = ink.getContext('2d');
      pen.fillStyle = tint;
      pen.textAlign = 'center';
      pen.textBaseline = 'middle';
      pen.font = '700 84px "PingFang SC", "Hiragino Sans GB", Arial, sans-serif';
      pen.fillText(text, 64, 66, 115);
      const map = new T.CanvasTexture(ink);
      map.colorSpace = T.SRGBColorSpace;
      signs.set(signKey, new T.MeshBasicMaterial({
        map, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, toneMapped:false,
      }));
    }
    const result = new T.Mesh(shapes.plane, signs.get(signKey));
    result.position.set(x, y, z);
    result.scale.set(width, height, 1);
    parent.add(result);
    return result;
  }

  function lantern(parent, color, x, y, z, size, glyph) {
    const lamp = group(parent, x, y, z);
    lamp.scale.setScalar(size);
    solid(lamp, 'cylinder', night.wood, 0, .77, 0, .073, .25, .073);
    halo(lamp, color, 0, .45, 0, 2.1);
    solid(lamp, 'soft', night.wood, 0, .15, 0, .46, .13, .41);
    solid(lamp, 'soft', color, 0, .44, 0, .37, .45, .34, 0, true);
    solid(lamp, 'soft', night.copper, 0, .7, 0, .49, .11, .44);
    [-.191,.191].forEach(side => {
      solid(lamp, 'box', night.wood, side, .415, .155, .028, .46, .032);
      solid(lamp, 'box', night.wood, side, .415, -.155, .028, .46, .032);
    });
    solid(lamp, 'box', night.copper, 0, .034, 0, .06, .16, .06);
    if (glyph) sign(lamp, glyph, 0, .446, .21, .31, .31, '#86432e');
    return lamp;
  }

  function pine(parent, x, y, z, height, warm = false) {
    const tree = group(parent, x, y, z);
    tree.scale.setScalar(height);
    solid(tree, 'cylinder', 0x49344c, 0, .28, 0, .1, .6, .1);
    const needles = warm ? [0x995341,0xbb6e45,0xe48e54] : [0x264856,0x35656c,0x47827d];
    needles.forEach((color, layer) => {
      const branch = solid(tree, 'tree', color, 0, .47 + layer * .16, 0, .63 - layer * .12, .57 - layer * .065, .55 - layer * .12);
      branch.rotation.y = layer * .34;
    });
  }

  function rock(parent, x, y, z, size, color, turn) {
    const object = solid(parent, 'rock', color, x, y, z, size, size * .74, size * .86);
    object.rotation.y = turn;
    return object;
  }

  function petals(parent, color, x, y, z, size) {
    const flower = group(parent, x, y, z);
    flower.scale.setScalar(size);
    solid(flower, 'gem', 0x46897e, 0, .2, 0, .13, .41, .12, -.26);
    solid(flower, 'gem', 0xa9cb78, -.14, .18, 0, .23, .09, .05, .31);
    for (let side = 0; side < 4; side++) {
      const azimuth = side * TAU / 4;
      solid(flower, 'oct', color, Math.sin(azimuth) * .12, .42, Math.cos(azimuth) * .12, .18, .14, .18, azimuth);
    }
    solid(flower, 'ball', 0xffdf87, 0, .48, 0, .1, .07, .1, 0, true);
    return flower;
  }

  function roofSegment(parent, x, y, z, width, depth, color) {
    const fascia = new T.Shape();
    fascia.moveTo(-.5, .12);
    fascia.quadraticCurveTo(-.34, .015, 0, .48);
    fascia.quadraticCurveTo(.34, .015, .5, .12);
    fascia.lineTo(.47, -.005);
    fascia.quadraticCurveTo(.2, .005, 0, .33);
    fascia.quadraticCurveTo(-.2, .005, -.47, -.005);
    fascia.closePath();
    const tiles = new T.Mesh(new T.ExtrudeGeometry(fascia, {depth:1, steps:1, bevelEnabled:false, curveSegments:10}), mat(color));
    tiles.position.set(x, y, z - depth * .5);
    tiles.scale.set(width, width * .55, depth);
    tiles.castShadow = true;
    parent.add(tiles);
    const lip = solid(parent, 'soft', night.copper, x, y + .02, z + depth / 2 + .014, width * .91, .065, .06);
    return {tiles, lip};
  }

  function gate(parent, color, x, y, z, size, home) {
    const building = group(parent, x, y, z);
    building.scale.setScalar(size);
    solid(building, 'soft', 0x3e476b, 0, .095, 0, 2.07, .21, 1.24);
    solid(building, 'soft', 0x6378a0, 0, .218, .37, 2, .085, .66);
    [-.78,.78].forEach(side => {
      solid(building, 'soft', 0xa3acc4, side, .36, 0, .31, .35, .57);
      solid(building, 'soft', night.wood, side, 1.16, 0, .21, 1.65, .35);
      solid(building, 'soft', 0xaf6372, side, 1.31, .17, .15, 1.38, .075);
      solid(building, 'soft', night.copper, side, 1.79, 0, .36, .14, .57);
    });
    solid(building, 'soft', night.wood, 0, 1.88, 0, 1.92, .21, .61);
    solid(building, 'soft', 0x895b69, 0, 1.635, 0, 1.67, .12, .26);
    roofSegment(building, 0, 1.96, 0, 2.42, 1, 0x3c406d);
    roofSegment(building, 0, 2.2, 0, 1.78, .71, 0x5e5b95);
    const tablet = solid(building, 'soft', 0x593d58, 0, 1.79, .39, .64, .31, .113);
    sign(building, home ? '旅' : '门', 0, 1.79, .475, .35, .33);
    const left = group(building, -.51, .69, .085);
    const right = group(building, .51, .69, .085);
    [left, right].forEach((door, i) => {
      const side = i === 0 ? 1 : -1;
      solid(door, 'soft', 0x976070, side * .23, .235, 0, .43, .92, .07);
      solid(door, 'soft', 0x493457, side * .23, .25, .045, .36, .74, .025);
      for (let rung = 0; rung < 3; rung++) {
        solid(door, 'box', 0xcd9a70, side * .23, .24 + (rung - 1) * .176, .064, .34, .023, .035);
      }
    });
    const lamps = [-1.06,1.06].map(side => lantern(building, color, side, .89, .31, .7));
    tablet.castShadow = false;
    return {building, left, right, lamps};
  }

  function tile(parent, x, y, z, width, depth, palette, stretch = 1) {
    const surface = solid(parent, 'rock', palette.stone, x, y, z, width, .28, depth);
    surface.rotation.y = Math.PI / 14;
    const slab = solid(parent, 'rock', 0x253451, x, y - .33, z, width * .99, .59, depth);
    slab.rotation.y = surface.rotation.y;
    const lower = solid(parent, 'rock', 0x171e3d, x, y - .79 * stretch, z, width * .81, .98 * stretch, depth * .83);
    lower.rotation.y = .54;
    const gloss = solid(parent, 'cylinder', palette.edge, x, y + .145, z, width * .7, .025, depth * .68);
    gloss.rotation.y = .14;
    const floor = solid(parent, 'cylinder', palette.stone, x, y + .165, z, width * .672, .027, depth * .653);
    floor.rotation.y = .14;
    return floor;
  }

  function pennant(parent, x, y, z, glyph, palette) {
    const post = group(parent, x, y, z);
    solid(post, 'soft', night.wood, 0, .69, 0, .088, 1.38, .085);
    solid(post, 'oct', palette.edge, 0, 1.44, 0, .158, .2, .158, 0, true);
    const flag = group(post, .015, 1.13, 0);
    solid(flag, 'soft', palette.dye, .31, 0, 0, .61, .47, .08);
    solid(flag, 'soft', palette.edge, .31, -.196, .047, .59, .026, .035, 0, true);
    solid(flag, 'soft', palette.edge, .31, .196, .047, .59, .026, .035, 0, true);
    sign(flag, glyph, .31, 0, .065, .35, .37);
    return flag;
  }

  // Static pieces in each island share meshes. Keep the animated props separate from the instance batches.
  function mergeScenery(container, allowUnlit = false) {
    container.updateMatrixWorld(true);
    const batches = new Map();
    const inverse = container.matrixWorld.clone().invert();
    const movable = [];
    container.traverse(piece => {
      if (!piece.isMesh || (!piece.castShadow && !allowUnlit)) return;
      const key = `${piece.geometry.id}:${piece.material.id}:${piece.castShadow}`;
      const batch = batches.get(key) || [];
      batch.push(piece);
      batches.set(key, batch);
    });
    batches.forEach(batch => {
      if (batch.length < 3) return;
      const first = batch[0];
      const cluster = new T.InstancedMesh(first.geometry, first.material, batch.length);
      cluster.castShadow = first.castShadow;
      cluster.receiveShadow = first.receiveShadow;
      batch.forEach((piece, index) => {
        cluster.setMatrixAt(index, new T.Matrix4().multiplyMatrices(inverse, piece.matrixWorld));
        movable.push(piece);
      });
      container.add(cluster);
    });
    movable.forEach(piece => piece.removeFromParent());
  }

  function fox(traveler) {
    const shadowPlane = shadow(traveler, 0, .019, .02, 1.68, 1.13);
    const puppet = group(traveler);
    const coat = 0xf49466;
    const fur = 0xffdfb9;
    const dark = 0x492d40;
    const rose = 0xc95b55;
    const legs = [-1,1].map(side => {
      const limb = group(puppet, .21 * side, .4, -.027);
      solid(limb, 'soft', 0xae564b, 0, -.127, 0, .22, .27, .28);
      solid(limb, 'soft', dark, 0, -.284, .062, .233, .15, .31);
      return limb;
    });
    const tail = group(puppet, -.18, .44, -.3);
    const tailBase = solid(tail, 'ball', rose, -.29, .04, -.12, .72, .22, .31, .35);
    tailBase.rotation.y = -.37;
    const tailBody = solid(tail, 'soft', coat, -.63, .22, -.22, .69, .38, .37, .52);
    tailBody.rotation.y = -.28;
    const tailTip = solid(tail, 'soft', fur, -.889, .35, -.274, .29, .325, .3, .51);
    tailTip.rotation.y = -.25;
    solid(puppet, 'soft', coat, 0, .52, 0, .64, .58, .48, -.025);
    solid(puppet, 'soft', fur, 0, .51, .235, .33, .4, .12);
    const leftArm = group(puppet, -.31, .62, .02);
    solid(leftArm, 'soft', coat, -.037, -.12, 0, .18, .34, .2, -.23);
    solid(leftArm, 'soft', dark, -.077, -.271, .028, .155, .14, .18, -.23);
    const rightArm = group(puppet, .31, .62, .09);
    solid(rightArm, 'soft', coat, .103, -.04, .095, .307, .15, .173, -.31);
    solid(rightArm, 'soft', dark, .237, -.068, .13, .174, .14, .15, .16);
    const carried = lantern(rightArm, 0xffc16c, .258, -.423, .155, .54);
    const scarf = solid(puppet, 'soft', 0x53ac9f, 0, .806, 0, .68, .17, .49);
    scarf.rotation.y = -.09;
    const scarfTail = group(puppet, -.24, .78, .018);
    solid(scarfTail, 'soft', 0x469488, -.13, -.19, .096, .188, .47, .061, -.48);
    solid(scarfTail, 'soft', 0x7ad4bd, -.215, -.337, .104, .177, .033, .061, -.48);
    solid(puppet, 'oct', 0xffcc85, .19, .805, .252, .111, .115, .064, .18, true);
    const head = group(puppet, 0, 1.05, .06);
    solid(head, 'soft', coat, 0, .023, 0, .87, .615, .62);
    solid(head, 'soft', 0xe7755c, 0, -.093, -.15, .84, .37, .34);
    const ears = [-1,1].map(side => {
      const ear = group(head, side * .315, .326, -.025);
      const outside = solid(ear, 'tree', coat, 0, .1, 0, .399, .558, .33, -.24 * side);
      outside.rotation.y = .25;
      const inside = solid(ear, 'tree', 0xf9bb9e, 0, .113, .11, .244, .33, .123, -.24 * side);
      inside.rotation.y = .19;
      solid(ear, 'soft', rose, 0, -.021, .052, .29, .15, .27);
      return ear;
    });
    const eyes = [-1,1].map(side => {
      solid(head, 'ball', fur, .246 * side, -.109, .289, .382, .192, .178, .21 * side);
      solid(head, 'soft', rose, .311 * side, -.078, .359, .097, .039, .015, .16 * side);
      solid(head, 'soft', fur, .214 * side, .204, .301, .154, .035, .021, -.21 * side);
      const eye = group(head, .211 * side, .103, .323);
      solid(eye, 'ball', fur, 0, 0, 0, .149, .143, .051);
      solid(eye, 'ball', dark, .023, .006, .027, .095, .106, .036);
      solid(eye, 'ball', 0xfff1da, .039, .034, .045, .027, .027, .014, 0, true);
      return eye;
    });
    solid(head, 'ball', fur, 0, -.12, .383, .37, .202, .211);
    solid(head, 'soft', dark, 0, -.083, .49, .119, .071, .048);
    solid(head, 'soft', dark, 0, -.179, .465, .114, .023, .019, -.035);
    return {puppet, shadowPlane, legs, tail, leftArm, rightArm, carried, scarfTail, head, ears, eyes};
  }

  const workshop = {solid, group, line, shadow, halo, sign, lantern, pine, rock, petals, roofSegment, gate, tile, pennant, mergeScenery, fox};
  workshops.set(T, workshop);
  return workshop;
}

export function createTraveler(T) {
  const root = new T.Group();
  root.name = 'Lantern Fox';
  const mascot = useWorkshop(T).fox(root);
  let lean = 0;
  let speed = 0;
  let queuedEmotion = '';
  let elapsedEmotion = 1.1;

  function cue(emotion) {
    queuedEmotion = emotion;
    elapsedEmotion = 0;
  }

  function update(delta, time, {moving = 0, direction = 1, emotion = queuedEmotion, stride = elapsedEmotion / 1.05, reducedMotion = false} = {}) {
    const {
      puppet, tail, head, ears, leftArm, rightArm, carried, shadowPlane, scarfTail, legs, eyes,
    } = mascot;
    elapsedEmotion += delta;
    if (reducedMotion) time = 0;
    const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * 14);
    speed += (clamp(moving) - speed) * damping;
    const turn = reducedMotion ? .2 : .2 + speed * .94 * Math.sign(direction);
    lean += (turn - lean) * damping;
    const swing = Math.sin(time * 16) * speed;
    const blink = time % 4.8;
    const emotionProgress = clamp(stride);
    const performing = emotion && emotionProgress < 1 && !reducedMotion;
    const jump = performing && emotion === 'celebrate' ? Math.sin(emotionProgress * Math.PI) : 0;
    const wave = performing && emotion === 'wave' ? Math.sin(emotionProgress * Math.PI) : 0;
    const surprise = performing && emotion === 'surprise' ? Math.sin(emotionProgress * Math.PI) : 0;
    const peak = performing && emotion === 'peek' ? Math.sin(emotionProgress * Math.PI) : 0;
    const air = Math.abs(swing) * .12 + jump * .56;

    puppet.rotation.set(-.13 * speed + surprise * .13, lean, -.1 * speed * direction + wave * .115);
    puppet.position.y = reducedMotion ? 0 : air + .013 * Math.sin(time * 3.2);
    puppet.scale.set(1 + .075 * surprise, 1 - .08 * surprise + .08 * jump, 1 + .04 * surprise);
    head.rotation.set(.035 * Math.sin(time * 2) + .34 * peak, .06 * Math.sin(time * 1.34) - speed * direction * .15, -.085 + wave * .25);
    tail.rotation.set(.22 * Math.sin(time * 2.9) - .23 * speed, .21 * Math.sin(time * 3.1) + speed * .35, .13 * swing);
    leftArm.rotation.set(swing * .79, -.08, -.1 - wave * (2.12 + Math.sin(time * 15) * .25));
    rightArm.rotation.x = -.12 - swing * .73 - jump * .39;
    carried.rotation.z = .09 * Math.sin(time * 3.6) - swing * .37;
    carried.rotation.x = swing * .24;
    scarfTail.rotation.x = -.11 + .1 * Math.sin(time * 6.1) + speed * .71;
    legs.forEach((leg, index) => leg.rotation.x = swing * (index * 2 - 1) * 1.12 - jump * .43);
    ears.forEach((ear, index) => ear.rotation.z = (index * 2 - 1) * (.05 * Math.sin(time * 3) + .25 * surprise));
    eyes.forEach(eye => eye.scale.y = reducedMotion || blink > .2 ? 1 : .14 + Math.abs(blink - .1) * 8.6);
    shadowPlane.scale.set(1.65 - air, 1.12 - air * .69, 1);
  }

  return {root, update, cue};
}

export function createStoryWorld(T, actor = createTraveler(T)) {
  const {solid, group, line, shadow, halo, sign, lantern, pine, rock, petals, roofSegment, gate, tile, pennant, mergeScenery} = useWorkshop(T);
  const root = new T.Group();
  root.name = 'Lantern Crossing';
  const sky = group(root);
  const terrain = group(root);
  const target = new T.Vector3();
  const cameraTarget = new T.Vector3();
  const floats = [];

  const gold = {stone:0x72698b, edge:0xffcb8d, glow:0xffca74, dye:0xb56a6b};
  const wood = 0x4f3655;
  const darkStone = 0x293354;

  function gem(parent, color, x, y, z, size) {
    const crystal = solid(parent, 'oct', color, x, y, z, size, size * 1.44, size);
    crystal.rotation.y = .29;
    return crystal;
  }

  function foldedBook(parent, x, y, z, palette) {
    const book = group(parent, x, y, z);
    book.rotation.set(-.67, -.23, .06);
    [-1,1].forEach(side => {
      const cover = group(book);
      cover.rotation.y = side * .255;
      solid(cover, 'soft', palette.dye, side * .32, 0, 0, .73, .896, .105);
      solid(cover, 'soft', 0xf8d6a5, side * .32, .03, .064, .648, .78, .052);
      for (let lineIndex = 0; lineIndex < 4; lineIndex++) {
        solid(cover, 'box', 0xd7a685, side * .32, .2 - lineIndex * .126, .105, .39 - (lineIndex % 2) * .09, .021, .018);
      }
    });
    solid(book, 'soft', 0xffc27a, 0, .01, .112, .044, .74, .035, 0, true);
    return book;
  }

  function kite(parent, palette) {
    const plate = group(parent, 0, .77, 0);
    const bamboo = 0xffd78e;
    const sail = solid(plate, 'oct', palette.edge, 0, .55, 0, 1.1, 1.44, .125);
    sail.rotation.y = .145;
    const face = solid(plate, 'oct', palette.dye, 0, .56, .081, .82, 1.13, .1);
    face.rotation.y = .145;
    line(plate, bamboo, [-.481,.53,.08], [.481,.53,.08], .039, true);
    line(plate, bamboo, [0,-.12,.08], [0,1.18,.08], .036, true);
    gem(plate, palette.glow, 0, .53, .15, .19);
    const ties = Array.from({length:4}, (_, i) => {
      const joint = group(plate, 0, -.26 - .135 * i, .06 - .03 * i);
      solid(joint, 'soft', i % 2 ? palette.edge : bamboo, 0, .09, 0, .244 - .028 * i, .065, .033, i % 2 ? -.36 : .36);
      return joint;
    });
    return (time, reveal) => {
      plate.rotation.set(.03 + Math.sin(time * 1.9) * .115, -.18 + Math.cos(time * 1.7) * .15, .19 * Math.sin(time * 2.13) - .13);
      plate.position.y = .84 + .17 * Math.sin(time * 2.3) + .19 * reveal;
      ties.forEach((tie, i) => {
        tie.position.x = (.05 + i * .045) * Math.sin(time * 4.2 - i * .7);
        tie.rotation.z = Math.sin(time * 3 - i * .65) * .27;
      });
    };
  }

  function radio(parent, palette) {
    const set = group(parent, 0, .51, 0);
    solid(set, 'soft', 0x66517b, 0, 0, 0, 1.38, .98, .63);
    solid(set, 'soft', palette.dye, 0, -.025, .31, 1.24, .8, .095);
    solid(set, 'soft', 0x27233d, -.075, .12, .376, .812, .3, .03);
    solid(set, 'soft', 0x292341, .43, -.1, .373, .252, .441, .031);
    const bands = Array.from({length:8}, (_, i) =>
      solid(set, 'soft', palette.glow, -.395 + i * .083, .11, .402, .044, .18, .022, 0, true));
    const dial = solid(set, 'cylinder', 0xffbc82, -.35, -.223, .405, .235, .093, .235);
    dial.rotation.x = Math.PI / 2;
    const pointer = solid(set, 'box', 0xffebbc, -.35, -.166, .444, .025, .075, .02, -.44, true);
    for (let i = 0; i < 5; i++) solid(set, 'box', 0xac8cac, .431, -.23 + i * .073, .396, .157, .019, .025);
    const aerial = group(set, .445, .41, -.14);
    line(aerial, 0xd7b3d1, [0,0,0], [.25,.84,0], .046);
    gem(aerial, palette.edge, .25, .86, 0, .139);
    return (time, reveal) => {
      aerial.rotation.z = Math.sin(time * 2.2) * .13;
      set.rotation.y = -.08 + Math.sin(time * 1.6) * .1;
      pointer.rotation.z = Math.sin(time * 2.25) * .71 - .42;
      bands.forEach((band, i) => band.scale.y = (.082 + (Math.sin(time * 7 + i * .68) + 1) * .079) * (1 + reveal * .35));
    };
  }

  function lock(parent, palette) {
    const core = group(parent, 0, .84, 0);
    solid(core, 'soft', palette.dye, 0, -.207, 0, 1.14, .79, .55);
    solid(core, 'soft', 0xf7c685, 0, -.207, .267, .926, .61, .08);
    const shackle = solid(core, 'ring', 0xffd798, 0, .29, -.06, .81, 1.09, 2.5);
    const wheels = [-1,0,1].map(slot => {
      const wheel = group(core, slot * .294, -.19, .32);
      const rim = solid(wheel, 'cylinder', slot ? 0x8f5674 : palette.dye, 0, 0, 0, .267, .348, .267);
      rim.rotation.z = Math.PI / 2;
      for (let i=0;i<4;i++) {
        const face = group(wheel);
        face.rotation.x = TAU * i / 4;
        solid(face, 'soft', palette.glow, 0, 0, .147, .087, .064, .028, 0, true);
      }
      return wheel;
    });
    return (time, reveal) => {
      core.rotation.z = Math.sin(time * 2) * .045;
      shackle.position.y = .29 + reveal * .2;
      shackle.rotation.y = reveal * .53 + .09 * Math.sin(time * 2.4);
      wheels.forEach((wheel,index) => wheel.rotation.x = Math.sin(time * 1.9 + index * .9) * .46 + reveal * 1.18);
    };
  }

  function pond(parent, palette) {
    const water = solid(parent, 'cylinder', 0x2f7482, 0, .044, 0, 1.77, .09, 1.43);
    solid(parent, 'cylinder', 0x4d536e, 0, -.029, 0, 1.85, .12, 1.5);
    const pads = [[-.54,.08],[.06,.37],[.39,-.2]].map(([x,z],i) => {
      const leaf = group(parent,x,.115,z);
      solid(leaf, 'rock', 0x539b75, 0, 0, 0, .42, .065, .33);
      petals(leaf, i ? 0xffae9c : 0xffd18b, 0, .03, 0, .58);
      return leaf;
    });
    const bugs = Array.from({length:5}, (_, i) => {
      const mote = group(parent);
      gem(mote, palette.glow, 0, 0, 0, .117 - i * .01);
      halo(mote, palette.glow, 0, 0, 0, .5);
      return mote;
    });
    return (time, reveal) => {
      water.scale.y = .09 + .015 * Math.sin(time * 2);
      pads.forEach((leaf,i) => {
        leaf.position.y = .12 + .036 * Math.sin(time * 2.8 + i);
        leaf.rotation.x = .07 * Math.cos(time * 2.8 + i);
      });
      bugs.forEach((bug,i) => {
        const angle = time * (.9 + i * .1) + i * 1.28;
        bug.position.set(Math.cos(angle) * (.6 + reveal * .24), .43 + .1 * i + .16 * Math.sin(time * 2 + i), Math.sin(angle) * .59);
        bug.scale.setScalar(.76 + .24 * Math.cos(time * 5 + i));
      });
    };
  }

  function stars(parent, palette) {
    const constellation = group(parent, 0, .83, -.03);
    const arms = [[-.62,.07,.04],[-.22,.55,.15],[.27,.27,0],[.55,.67,-.16],[.71,.12,.05]];
    const points = arms.map(([x,y,z], i) => {
      if (i > 0) line(constellation, palette.edge, arms[i - 1], [x,y,z], .025, true);
      return gem(constellation, i % 2 ? palette.edge : palette.glow, x, y, z, .221);
    });
    const rings = Array.from({length:2}, (_, i) =>
      solid(parent, 'ring', 0x8968a6, 0, .365 + i * .08, 0, 1.6 - i * .3, 1.6 - i * .3, .65, 0, true));
    rings.forEach(ring => ring.rotation.x = Math.PI / 2);
    solid(parent, 'cylinder', 0x635278, 0, .08, 0, 1.25, .16, .96);
    return (time, reveal) => {
      constellation.rotation.y = .22 * Math.sin(time * 1.6);
      constellation.position.y = .7 + .12 * Math.sin(time * 1.65) + reveal * .25;
      points.forEach((point,i) => {
        point.rotation.y = time * (.5 + i * .18);
        point.rotation.z = Math.sin(time * 2 + i) * .31;
      });
      rings.forEach((ring, i) => {
        ring.rotation.y = (i ? -1 : 1) * (.22 + .21 * Math.sin(time * 1.8));
        ring.rotation.z = time * 1.1;
      });
    };
  }

  function ink(parent, palette) {
    const desk = group(parent);
    solid(desk, 'soft', wood, 0, .26, 0, 1.43, .41, .91);
    solid(desk, 'soft', palette.dye, 0, .48, 0, 1.53, .163, 1.02);
    const paper = group(desk, -.15, .58, .05);
    paper.rotation.x = -Math.PI / 2;
    solid(paper, 'soft', 0xffdab4, 0, 0, .014, .84, .68, .045);
    sign(paper, '笔', 0, .02, .046, .54, .56, '#9f4f71');
    const pot = solid(desk, 'cylinder', 0x4a3c61, .49, .628, -.23, .29, .22, .24);
    pot.rotation.z = .12;
    solid(desk, 'cylinder', 0x262945, .49, .752, -.23, .174, .024, .152);
    const brush = group(desk, .14, .86, .06);
    solid(brush, 'cylinder', 0xffb176, 0, .39, 0, .12, 1.22, .12);
    solid(brush, 'cylinder', palette.edge, 0, -.205, 0, .145, .16, .154);
    solid(brush, 'tree', 0x462e47, 0, -.34, 0, .156, .233, .145, Math.PI);
    return (time, reveal) => {
      brush.position.x = .06 + .32 * Math.sin(time * 1.8);
      brush.position.y = .94 + Math.cos(time * 3.6) * .07 + reveal * .37;
      brush.rotation.set(-.23, .08, .6 + .35 * Math.cos(time * 1.8));
    };
  }

  function twinned(parent, palette) {
    const lamps = [-1,1].map((side,i) => lantern(parent, i ? 0xffb1bc : palette.glow, side * .49, .36, -.03, 1.12, i ? '友' : '好'));
    solid(parent, 'cylinder', 0x604569, 0, .079, 0, 1.51, .17, .86);
    const thread = solid(parent, 'ring', palette.edge, 0, .73, -.17, 1.24, .78, .59, 0,true);
    return (time, reveal) => {
      lamps.forEach((lamp, i) => {
        lamp.rotation.z = Math.sin(time * 2.1 + i * Math.PI) * .24;
        lamp.rotation.y = Math.sin(time * 2 + i * .81) * .26;
        lamp.position.y = .35 + .12 * (1 + Math.sin(time * 2.1 + i * Math.PI)) + reveal * .34;
      });
      thread.rotation.y = .29 * Math.sin(time * 1.4);
      thread.rotation.z = time * .68;
    };
  }

  function boat(parent, palette) {
    solid(parent, 'cylinder', 0x318499, 0, .055, 0, 1.94, .08, 1.53);
    const vessel = group(parent, 0, .222, .11);
    solid(vessel, 'soft', 0x8c574d, 0, .06, 0, 1.28, .235, .5);
    solid(vessel, 'oct', 0xcf916a, -.61, .06, 0, .42, .26, .48);
    solid(vessel, 'oct', 0xcf916a, .6, .06, 0, .42, .26, .48);
    solid(vessel, 'soft', 0xffba79, 0, .184, 0, 1.25, .06, .48);
    solid(vessel, 'cylinder', wood, .09, .595, -.005, .048, 1.034, .048);
    const sail = solid(vessel, 'tree', 0xf9d3a6, -.199, .644, 0, .708, .786, .147, -.35);
    sign(vessel, '舟', -.161, .651, .112, .29, .31, '#a6635b');
    gem(vessel, palette.glow, .08, 1.141, 0, .13);
    return (time, reveal) => {
      vessel.position.set(Math.sin(time * 1.42) * .21 + reveal * .34, .223 + Math.sin(time * 2.7) * .072, .11);
      vessel.rotation.z = Math.sin(time * 1.85) * .11;
      vessel.rotation.y = .12 * Math.sin(time * 1.14);
      sail.rotation.x = Math.sin(time * 3.2) * .115;
    };
  }

  function tower(parent, palette, upper) {
    const shaft = group(parent);
    const steps = [1.23, 1.02, .79, .53];
    steps.forEach((width, i) => {
      solid(shaft, 'soft', i % 2 ? palette.stone : palette.dye, 0, i * .295 + .16, 0, width, .307, width * .83, Math.sin(i) * .04);
      solid(shaft, 'soft', palette.edge, 0, i * .295 + .29, 0, width * 1.05, .058, width * .87, 0, true);
      sign(shaft, String(upper ? (i + 1) * 10 : i + 1), 0, i * .295 + .148, width * .42 + .018, width * .59, .258);
    });
    const cap = gem(shaft, palette.glow, 0, 1.45, 0, .31);
    return (time, reveal) => {
      shaft.rotation.y = .125 * Math.cos(time * 1.66);
      cap.position.y = 1.51 + .135 * Math.sin(time * 2.22) + .18 * reveal;
      cap.rotation.y = time * .83;
    };
  }

  function clock(parent, palette, instant) {
    const timer = group(parent, 0, .85, -.016);
    solid(timer, 'soft', wood, 0, -.18, 0, 1.31, 1.3, .52);
    solid(timer, 'soft', palette.dye, 0, -.218, .27, 1.16, 1.15, .092);
    roofSegment(timer, 0, .42, -.036, 1.42, .676, palette.stone);
    const face = solid(timer, 'cylinder', 0xffdcac, 0, -.07, .348, .786, .068, .786);
    face.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const angle = i * TAU / 12;
      solid(timer, 'box', wood, Math.sin(angle) * .304, -.07 + Math.cos(angle) * .304, .387, .026, i % 3 === 0 ? .064 : .034, .014, -angle);
    }
    const hands = [.28, .21].map((length,i) => {
      const hand = group(timer, 0, -.07, .393 + i * .02);
      solid(hand, 'soft', i ? palette.dye : wood, 0, length * .48, 0, .032, length, .018);
      return hand;
    });
    solid(timer, 'ball', palette.glow, 0, -.07, .426, .069, .069, .028, 0, true);
    const pendulum = group(timer, 0, -.445, .346);
    line(pendulum, 0xf2c282, [0,0,0], [0,-.28,0], .024, true);
    gem(pendulum, palette.glow, 0, -.29, 0, .132);
    return (time, reveal) => {
      hands[0].rotation.z = -(instant ? .5 : .14) - time * (.8 + .2 * reveal);
      hands[1].rotation.z = -(instant ? .93 : .19) - time * .117;
      pendulum.rotation.z = Math.sin(time * 4.2) * .41;
    };
  }

  function compass(parent, palette) {
    const pivot = group(parent, 0, .57, 0);
    pivot.rotation.x = -.78;
    const back = solid(pivot, 'cylinder', 0xa0786e, 0, 0, 0, 1.53, .2, 1.53);
    back.rotation.x = Math.PI / 2;
    const face = solid(pivot, 'cylinder', palette.dye, 0, 0, .104, 1.37, .067, 1.37);
    face.rotation.x = Math.PI / 2;
    ['北','西','南','东'].forEach((glyph, i) => {
      const theta = i * TAU / 4;
      sign(pivot, glyph, -Math.sin(theta) * .505, Math.cos(theta) * .505, .15, .152, .159);
    });
    const needle = group(pivot, 0, 0, .18);
    const front = gem(needle, 0xffb67c, 0, .18, 0, .282);
    const rear = gem(needle, palette.edge, 0, -.18, 0, .282);
    front.scale.set(.251,.51,.08);
    rear.scale.copy(front.scale);
    solid(needle, 'ball', 0xffe3a6, 0, 0, .029, .122, .122, .067, 0, true);
    return (time, reveal) => {
      needle.rotation.z = time * .95 + 1.13 * Math.sin(time * .74) + reveal * .87;
      pivot.rotation.x = -.7 + Math.sin(time * 1.16) * .16;
    };
  }

  function meal(parent, palette) {
    const plate = group(parent, 0, .04, 0);
    solid(plate, 'cylinder', 0xa67468, 0, .21, 0, 1.32, .36, 1.21);
    solid(plate, 'cylinder', 0xe4b794, 0, .398, 0, 1.46, .18, 1.33);
    solid(plate, 'cylinder', 0xf79f73, 0, .496, 0, 1.24, .035, 1.13);
    for (let i = 0; i < 11; i++) {
      const theta = i * TAU / 11;
      const grain = solid(plate, 'soft', i % 3 ? 0xffd18a : palette.glow, Math.sin(theta) * (.19 + i * .026), .545, Math.cos(theta) * (.18 + i * .021), .235, .055, .063);
      grain.rotation.y = theta * 1.7;
    }
    const utensils = group(plate, -.27, .61, 0);
    line(utensils, 0xeab48e, [-.42,.39,.438], [.431,-.04,-.202], .065);
    line(utensils, 0xeab48e, [-.367,.391,.49], [.468,-.04,-.139], .065);
    const mist = Array.from({length:5}, (_, i) => halo(plate, 0xffba92, 0, .52, (i % 3 - 1) * .12, .52));
    return (time, reveal) => {
      utensils.rotation.y = .18 * Math.sin(time);
      mist.forEach((mote, i) => {
        const life = (time * .39 + i / mist.length) % 1;
        mote.position.y = .59 + life * (.76 + reveal * .2);
        mote.position.x = Math.sin(life * 5.2 + i) * .12;
        mote.scale.setScalar(.34 + life * .57);
        mote.material.opacity = Math.sin(life * Math.PI) * .53;
      });
    };
  }

  function weather(parent, palette) {
    const bank = group(parent, -.01, 1.1, .077);
    const sun = gem(bank, 0xffcc81, .29, .29, -.14, .794);
    halo(bank, 0xffcc81, .29, .29, -.14, 1.59);
    const cloud = group(bank, -.091, -.013, .041);
    solid(cloud, 'ball', 0xc1cde0, -.237, .044, .06, .678, .423, .462);
    solid(cloud, 'ball', 0xdbe0e4, .051, .14, .12, .69, .532, .481);
    solid(cloud, 'ball', palette.edge, .336, -.032, .099, .534, .402, .397);
    const drops = Array.from({length:5}, (_, i) => gem(parent, 0x89e7f5, (i - 2) * .185, .5, (i % 2) * .139, .088));
    const receptacle = solid(parent, 'cylinder', 0x3d7789, 0, .032, 0, 1.53, .112, 1.16);
    return (time, reveal) => {
      bank.position.y = 1.09 + .1 * Math.sin(time * 1.8) + reveal * .15;
      sun.rotation.set(time * .4, time * .72, -.1);
      cloud.rotation.x = .09 * Math.sin(time * 1.89);
      drops.forEach((drop, i) => {
        const progress = (time * .88 + i * .17) % 1;
        drop.position.y = .097 + (1 - progress) * .89;
        drop.scale.set(.087, .08 + .127 * Math.sin(progress * Math.PI), .079);
      });
      receptacle.scale.y = .11 + .018 * Math.cos(time * 3.1);
    };
  }

  const arcadeModels = [kite, radio, lock, pond, stars, ink, twinned, boat];

  function mapModel(index, prop, palette) {
    if (index === 0) {
      const doorway = gate(prop, palette.glow, 0, -.035, -.06, .88, false);
      return (time, reveal) => {
        doorway.left.rotation.y = -.41 - reveal * .85;
        doorway.right.rotation.y = .41 + reveal * .85;
        doorway.lamps.forEach((lamp,i) => lamp.rotation.z = Math.sin(time * 2.4 + i * 1.9) * .09);
      };
    }
    if (index === 4 || index === 5) {
      const book = foldedBook(prop, 0, .72, .01, palette);
      solid(prop, 'cylinder', 0x6b5778, 0, .175, 0, .92, .281, .79);
      return (time, reveal) => {
        book.position.y = .75 + .1 * Math.sin(time * 2) + reveal * .22;
        book.rotation.y = -.36 + .21 * Math.sin(time * 1.9);
      };
    }
    if (index === 2 || index === 3 || index === 16) return boat(prop, palette);
    if (index === 6) return pond(prop, palette);
    if (index === 7 || index >= 18) return twinned(prop, palette);
    if (index === 9 || index === 10) return tower(prop, palette, index === 10);
    if (index === 11 || index === 12) return clock(prop, palette, index === 12);
    if (index === 13) return compass(prop, palette);
    if (index === 15) return meal(prop, palette);
    if (index === 17) return weather(prop, palette);
    const kiosk = group(prop);
    solid(kiosk, 'soft', palette.dye, 0, .292, 0, 1.25, .64, .71);
    solid(kiosk, 'soft', 0xf2bc84, 0, .613, 0, 1.383, .113, .889);
    [-1,1].forEach(side => solid(kiosk, 'cylinder', wood, side * .55, .979, -.17, .084, .849, .084));
    roofSegment(kiosk, 0, 1.35, -.04, 1.53, .89, 0x8e536f);
    const teapot = group(kiosk, -.228, .747, .199);
    solid(teapot, 'ball', 0x599f8c, 0, .074, 0, .477, .38, .41);
    solid(teapot, 'cylinder', 0xb5c195, 0, .256, 0, .313, .069, .291);
    solid(teapot, 'ball', palette.glow, 0, .31, 0, .108, .105, .107);
    line(teapot, 0x599f8c, [.15,.12,0], [.36,.23,0], .111);
    const hanging = lantern(kiosk, palette.glow, .421, .74, .331, .49);
    return (time, reveal) => {
      hanging.rotation.z = Math.sin(time * 2.2) * .15;
      teapot.rotation.z = Math.sin(time * 1.55) * .09 + reveal * .12;
    };
  }

  function buildStop(parent, index, mode) {
    const palette = palettes[index % palettes.length];
    const position = index * STEP;
    const z = pathZ(index);
    const stage = group(parent, position, 0, z);
    const stillLife = group(stage);
    const prop = group(stage, .45, .303, -.3);
    const glyph = mode === 'arcade' ? arcadeGlyphs[index] : mapGlyphs[index];
    const marker = pennant(stage, -1.41, .14, -.82, glyph, palette);

    tile(stillLife, 0, -.18, 0, 4.45, 3.35, palette);
    tile(stillLife, 0, .054, -.035, 2.81, 2.1, palette, .42);
    shadow(stillLife, .45, .242, -.3, 2.07, 1.52);
    const plaque = solid(stillLife, 'soft', darkStone, 0, -.048, 1.07, .71, .25, .114);
    plaque.rotation.x = -.38;
    const label = sign(stillLife, String(index + 1).padStart(2,'0'), 0, -.052, 1.162, .47, .23);
    label.rotation.x = plaque.rotation.x;
    pine(stillLife, 1.46, .014, -.83, 1.14, index % 3 === 2);
    pine(stillLife, 1.2, .015, -1.125, .73);
    rock(stillLife, -1.3, -.028, .72, .51, 0x435778, .44);
    petals(stillLife, palette.edge, -1.235, .107, .77, .54);
    petals(stillLife, palette.dye, 1.035, .173, .71, .58);
    const lamp = lantern(stage, palette.glow, 1.53, .01, .42, .51);
    const working = mode === 'arcade' ? arcadeModels[index](prop, palette) : mapModel(index, prop, palette);
    mergeScenery(stillLife);
    return {stage, prop, marker, lamp, working};
  }

  function addBridge(parent, count) {
    for (let index = 1; index < count; index++) {
      const bridge = group(parent, (index - .5) * STEP, -.21, (pathZ(index - 1) + pathZ(index)) * .5);
      bridge.rotation.y = -Math.atan2(pathZ(index) - pathZ(index - 1), STEP);
      for (let slat = 0; slat < 7; slat++) {
        const x = (slat - 3) * .267;
        solid(bridge, 'soft', slat % 2 ? 0x916b78 : 0x746478, x, -Math.abs(slat - 3) * -.015, 0, .276, .13, .79, .013 * (slat - 3));
      }
      [-.365,.365].forEach(z => {
        line(bridge, 0x5d4e69, [-.93,-.02,z], [.93,-.02,z], .052);
        [-.7,.7].forEach(x => solid(bridge, 'cylinder', 0x755274, x, .058, z, .061, .43, .061));
        line(bridge, 0xc29990, [-.7,.264,z], [0,.18,z], .036);
        line(bridge, 0xc29990, [0,.18,z], [.7,.264,z], .036);
      });
      mergeScenery(bridge);
    }
  }

  function crossing(parent, ending) {
    const stage = group(parent);
    const base = group(stage);
    tile(base, 0, -.19, -.015, 6.55, 4.2, gold);
    tile(base, 0, .074, -.27, 3.84, 3.15, gold, .39);
    shadow(base, 0, .258, -.46, 4.2, 2.3);
    for (let i = 0; i < 6; i++) {
      solid(base, 'soft', i % 2 ? 0x9a7792 : 0x827597, -.16 - i * .125, .232 - Math.max(0,i-2) * .035, .61 + i * .218, 1.38, .06, .199, -.021 * i);
    }
    [1,-1].forEach(side => {
      pine(base, 2.11 * side, -.046, -.55, 1.62, ending);
      pine(base, 1.74 * side, .062, -1.126, 1.852, side < 0 || ending);
      pine(base, 2.6 * side, -.36, -.24, 1.07);
      rock(base, 1.938 * side, -.178, .93, .88, darkStone, side);
      rock(base, 2.8 * side, -.28, .26, .64, 0x4a5179, side);
      petals(base, side < 0 ? 0xffb487 : 0xa4c1ff, 1.422 * side, .02, .856, .84);
      petals(base, 0xe48686, 2.12 * side, -.1, .642, .55);
      solid(base, 'soft', 0x7a5971, 1.29 * side, .301, .72, .102, .707, .106);
      solid(base, 'soft', 0x90647a, 1.29 * side, .672, .72, .25, .079, .26);
    });
    const entry = gate(stage, gold.glow, -.1, .185, -.73, 1.48, !ending);
    const leftLamp = lantern(stage, 0xffca80, -1.29, .25, .72, .56, '光');
    const rightLamp = lantern(stage, 0xffad81, 1.29, .25, .72, .56, '路');
    const flag = pennant(stage, 1.68, .032, -.56, ending ? '成' : '汉', gold);
    const garland = [];
    if (ending) {
      const tones = [0xffbb88, 0xffc982, 0xfa9ab1, 0xaef0c4, 0xa0dcff];
      for (let i = 0; i < tones.length; i++) {
        const x = 1.09 + .2 * i;
        const y = 1.6 + i * .27;
        garland.push(lantern(stage, tones[i], x, y, .4 - .09 * i, .55 - .044 * i));
      }
    }
    mergeScenery(base);
    return {stage, entry, leftLamp, rightLamp, flag, garland};
  }

  const home = crossing(terrain, false);
  const ending = crossing(terrain, true);
  const boardwalks = Object.fromEntries(['arcade','map'].map(mode => {
    const area = group(terrain);
    const count = mode === 'map' ? mapGlyphs.length : arcadeGlyphs.length;
    const stops = Array.from({length:count}, () => null);
    return [mode, {area, stops, bridges:false}];
  }));

  const orb = group(sky, -.89, 2.03, -3.22);
  orb.position.x = -.32;
  solid(orb, 'ball', 0xffd7a0, 0, 0, 0, .88, .88, .88, 0, true);
  solid(orb, 'ball', 0xffe5b7, -.153, .127, .387, .25, .19, .049, -.31, true);
  solid(orb, 'ball', 0xffcd97, .193, .115, .37, .251, .146, .023, .4, true);
  solid(orb, 'ball', 0xffca99, .16, -.183, .377, .145, .138, .03, -.13, true);
  const moonAura = halo(orb, 0xffad78, 0, 0, -.12, 2.86);
  const backdrop = group(sky);
  for (let i = 0; i < 9; i++) {
    const distance = i - 4;
    const summit = Math.cos(i * 2.41) * .88;
    const pyramid = solid(backdrop, 'tree', i % 2 ? 0x27284c : 0x35345c, distance * 2.32, -1.45 + summit * .46, -5.1 - (i % 3) * .82, 3.5, 3.25 + summit, 1.7, .07 * Math.sin(i));
    pyramid.rotation.y = i * .48;
    if (i % 2) {
      const lower = solid(backdrop, 'rock', 0x20253f, distance * 2.11 + .83, -1.5, -3.59, 2.65, 2.2, 1.1);
      lower.rotation.y = i * .41;
    }
  }
  mergeScenery(backdrop);
  const starsBackdrop = group(sky);
  const stillStars = group(starsBackdrop);
  for (let i = 0; i < 29; i++) {
    const x = Math.sin(i * 8.91) * 4.93;
    const y = .42 + (Math.cos(i * 6.28 / 11) + 1) * 1.03;
    const z = -3.9 - Math.sin(i * 2.251) * .68;
    const radius = .025 + ((i + 3) % 5) * .012;
    const shimmer = i % 4 === 0;
    const spark = solid(shimmer ? starsBackdrop : stillStars, 'oct', i % 7 ? 0xe7d5b6 : 0xffba87, x, y, z, radius, radius * 1.81, radius, .2, true);
    spark.castShadow = false;
    if (shimmer) {
      const light = halo(starsBackdrop, 0xfbcb8d, x, y, z, .31);
      floats.push({spark, light, y, phase:i * .931});
    }
  }

  mergeScenery(stillStars, true);

  const dustCount = 15;
  const dust = new T.InstancedMesh(new T.OctahedronGeometry(.5), new T.MeshBasicMaterial({color:0xffb390}), dustCount);
  const dustFlake = new T.Object3D();
  dust.frustumCulled = false;
  dust.instanceMatrix.setUsage(T.DynamicDrawUsage);
  root.add(dust);

  const travel = {
    previousFocus:0,
    scene: '', focus:0, clock:0, duration:0, reveal:0, emotion:'', emotionAt:-Infinity, direction:1,
    from:new T.Vector3(), to:new T.Vector3(), cameraFrom:new T.Vector3(), time:0,
  };

  function show(scene = 'home', focus = 0) {
    const mode = scene === 'ending' ? 'ending' : boardwalks[scene] ? scene : 'home';
    const max = boardwalks[mode]?.stops.length - 1 || 0;
    const index = Math.min(max, Math.max(0, Math.round(Number(focus) || 0)));
    if (travel.scene === mode && travel.focus === index && actor.root.parent === root) return;
    const changed = travel.scene !== mode || actor.root.parent !== root;
    const board = boardwalks[mode];
    if (board && !board.bridges) {
      addBridge(board.area, board.stops.length);
      board.bridges = true;
    }
    const x = board ? index * STEP : 0;
    const z = board ? pathZ(index) : 0;
    const previousX = actor.root.position.x;
    travel.duration = changed ? 1.2 : .65 + Math.min(1.26, Math.abs(index - travel.focus) * .19);
    travel.from.copy(actor.root.position);
    travel.to.set(x - .73, board ? .242 : .256, z + .69);
    target.set(x + (board ? .02 : -.03), board ? .77 : 1.37, z - (board ? .12 : .19));
    travel.cameraFrom.copy(cameraTarget);
    if (changed) {
      travel.from.copy(travel.to).add(new T.Vector3(-1.17, -.052, .49));
      travel.cameraFrom.copy(target).add(new T.Vector3(-.65, .17, .15));
      cameraTarget.copy(travel.cameraFrom);
      actor.root.position.copy(travel.from);
    }
    travel.previousFocus = changed ? index : travel.focus;
    travel.scene = mode;
    travel.focus = index;
    travel.direction = changed || travel.to.x >= previousX ? 1 : -1;
    travel.clock = 0;
    travel.reveal = 0;
    travel.emotionAt = travel.time + travel.duration - .17;
    travel.emotion = mode === 'ending' ? 'celebrate' : mode === 'home' ? 'wave' : 'peek';
    home.stage.visible = mode === 'home';
    ending.stage.visible = mode === 'ending';
    for (const [name, location] of Object.entries(boardwalks)) location.area.visible = name === mode;
    root.add(actor.root);
    actor.root.scale.setScalar(board ? .825 : 1.12);
  }

  function cue(type) {
    if (type === 'enter' && travel.clock < travel.duration) return;
    const emotional = {
      complete:'celebrate', reward:'celebrate', unlock:'celebrate', lantern:'celebrate', discover:'peek',
      hit:'celebrate', success:'celebrate', miss:'surprise', enter:'wave', select:'peek',
    }[type];
    if (!emotional) return;
    travel.emotion = emotional;
    travel.emotionAt = travel.time;
  }

  function update(delta, time, reducedMotion = false) {
    travel.time = time;
    const animationTime = reducedMotion ? 0 : time;
    travel.clock = reducedMotion ? travel.duration : Math.min(travel.duration, travel.clock + delta);
    const blend = travel.duration ? travel.clock / travel.duration : 1;
    const follow = ease(blend);
    const glance = ease(clamp((blend - .17) / .83));
    travel.reveal = reducedMotion ? 1 : clamp((blend - .24) / .76);
    const stride = Math.sin(follow * Math.PI);
    cameraTarget.lerpVectors(travel.cameraFrom, target, glance);
    const world = boardwalks[travel.scene];
    if (actor.root.parent === root) {
      actor.root.position.lerpVectors(travel.from, travel.to, follow);
      if (world && travel.previousFocus !== travel.focus) {
        const position = Math.max(0, (actor.root.position.x + .73) / STEP);
        const step = Math.floor(position);
        const fraction = position - step;
        const descent = Math.sin(fraction * Math.PI);
        actor.root.position.y -= descent ** 4 * .24;
        actor.root.position.z = lerp(pathZ(step), pathZ(step + 1), fraction) + .69 - descent ** 2 * .67;
      } else {
        actor.root.position.z += stride * (world ? .17 : .13);
      }
      const beat = travel.time - travel.emotionAt;
      actor.update(delta, animationTime, {
        moving:reducedMotion ? 0 : Math.min(1, stride * 1.35),
        direction:travel.direction,
        emotion:beat >= 0 ? travel.emotion : '',
        stride:beat / 1.05,
        reducedMotion,
      });
    }
    dust.visible = !reducedMotion && stride > .06 && actor.root.parent === root;
    if (dust.visible) {
      for (let i = 0; i < dustCount; i++) {
        const progress = (time * 1.7 - i / dustCount + 1) % 1;
        dustFlake.position.copy(actor.root.position);
        dustFlake.position.x -= travel.direction * (.18 + progress * (.44 + stride * .74));
        dustFlake.position.y += .02 + Math.sin(progress * Math.PI * .9) * (.22 + (i % 3) * .045);
        dustFlake.position.z += (i % 2 ? .28 : -.19) * progress;
        dustFlake.scale.setScalar(.088 * stride * (1 - progress));
        dustFlake.rotation.set(progress * 4, i, progress * 2);
        dustFlake.updateMatrix();
        dust.setMatrixAt(i, dustFlake.matrix);
      }
      dust.instanceMatrix.needsUpdate = true;
    }
    sky.position.x = cameraTarget.x * .92;
    sky.position.z = cameraTarget.z * .5;
    moonAura.material.opacity = .6 + .08 * Math.sin(animationTime * 1.2);
    floats.forEach(({spark, light, y, phase}) => {
      const shimmer = .55 + .45 * Math.cos(phase + animationTime * 2.2);
      light.material.opacity = .3 + shimmer * .37;
      spark.position.y = light.position.y = y + .052 * Math.sin(phase + animationTime * 1.5);
    });

    if (world) {
      world.stops.forEach((existing, index) => {
        const distance = Math.abs(cameraTarget.x / STEP - index);
        if (distance > 2.42) {
          if (existing) existing.stage.visible = false;
          return;
        }
        const station = existing || (world.stops[index] = buildStop(world.area, index, travel.scene));
        station.stage.visible = true;
        const active = index === travel.focus;
        const reveal = active ? 1 - (1 - travel.reveal) ** 3 : 0;
        station.prop.scale.setScalar(active ? .85 + reveal * .15 : .92);
        station.prop.position.y = .254 + reveal * .077;
        station.marker.rotation.y = .165 * Math.sin(animationTime * 2 + index * .7);
        station.lamp.rotation.z = .094 * Math.sin(animationTime * 2.05 + index);
        station.working(animationTime + (reducedMotion ? 0 : index * .57), reveal);
      });
    } else {
      const hero = travel.scene === 'ending' ? ending : home;
      const open = ease(travel.reveal);
      hero.entry.left.rotation.y = -.1 - open * 1.08;
      hero.entry.right.rotation.y = .1 + open * 1.08;
      hero.entry.lamps.forEach((lamp, i) => lamp.rotation.z = Math.sin(animationTime * 2.6 + i * 2.1) * (.135 - .061 * open));
      hero.leftLamp.rotation.z = Math.sin(animationTime * 2.15) * .083;
      hero.rightLamp.rotation.z = Math.sin(animationTime * 2 + 1.5) * .083;
      hero.flag.rotation.y = .17 * Math.sin(animationTime * 2.2);
      hero.garland.forEach((lamp, i) => {
        lamp.position.y = 1.6 + i * .27 + open * .22 + .085 * Math.sin(animationTime * 1.8 + i * .8);
        lamp.rotation.z = .23 * Math.sin(animationTime * 2.15 + i * .6);
      });
    }
  }

  show();
  return {root, target, cameraTarget, show, update, cue};
}
