export function createArenaModels(T) {
  const scene = new T.Scene();
  const key = new T.DirectionalLight(0xffdfac, 2.6);
  key.position.set(-3, 4, 7);
  const rim = new T.DirectionalLight(0xa9c9ff, 1.1);
  rim.position.set(4, -1, -2);
  scene.add(new T.HemisphereLight(0xefe6ff, 0x562f60, 1.46), key, rim);

  const mesh = (parent, geometry, color, x = 0, y = 0, z = 0, glow = false) => {
    const item = new T.Mesh(geometry, new T.MeshStandardMaterial({
      color, roughness: .47, flatShading: true, emissive: glow ? color : 0,
      emissiveIntensity: glow ? .52 : 0,
    }));
    item.position.set(x, y, z);
    parent.add(item);
    return item;
  };
  const ring = (parent, color, radius, thickness, z, glow = false) =>
    mesh(parent, new T.TorusGeometry(radius, thickness, 7, 28), color, 0, 0, z, glow);
  const oct = (parent, color, size, x, y, z, glow = false) =>
    mesh(parent, new T.OctahedronGeometry(size), color, x, y, z, glow);

  function meteor(root) {
    const core = mesh(root, new T.IcosahedronGeometry(.43, 1), 0xb65949);
    core.scale.set(1, .9, .86);
    const craters = [[-.19,.12,.31,.10],[.14,.19,.28,.091],[.16,-.15,.29,.076],[-.076,-.16,.34,.11],[.29,.024,.235,.061]];
    for (const [x,y,z,r] of craters) {
      const shell = mesh(root, new T.SphereGeometry(r, 9, 6), 0x693942, x,y,z);
      shell.scale.z = .32;
      shell.rotation.y = x * 1.7;
    }
    for (let n = 0; n < 3; n++) {
      const spark = oct(root, n === 0 ? 0xffca83 : 0xf18654, .095 - n * .016, (n - 1) * .17, .38 + n * .07, -.06, true);
      spark.scale.set(.72, 2.1, 1);
    }
  }

  function crystal(root) {
    const stone = oct(root, 0x99a4ff, .42, 0,0,0, true);
    stone.scale.set(.77, 1.12, .87);
    const wire = new T.LineSegments(
      new T.EdgesGeometry(stone.geometry),
      new T.LineBasicMaterial({color:0xe9e6fe})
    );
    wire.scale.copy(stone.scale).multiplyScalar(1.012);
    root.add(wire);
    const track = ring(root, 0xd2b7ff, .45, .023, -.055);
    track.rotation.set(.84, .24, -.55);
    oct(root, 0xffce82, .062, .32,.27,.03,true);
  }

  function orb(root) {
    const shell = ring(root, 0x91eee5, .436, .038, .015, true);
    shell.scale.set(.99, 1.025, 1);
    const inner = ring(root, 0x577db5, .403, .012, -.03);
    inner.rotation.z = .17;
    const glint = oct(root, 0xf0fff3, .084, -.252,.23,.04,true);
    glint.scale.set(.71, 1.25, .56);
    oct(root, 0x9ceae6, .038, -.083,.34,.08,true);
  }

  function launcher(root) {
    const base = mesh(root, new T.CylinderGeometry(.29,.43,.19,8), 0x7a4b56, 0,-.26,0);
    base.rotation.x = .22;
    const arm = mesh(root, new T.CylinderGeometry(.215,.14,.46,9), 0xbc774e, 0,.028,.01);
    arm.rotation.x = 1.1;
    ring(root, 0xffcb83, .218, .044, .197, true);
    const lens = oct(root, 0x9bf0d9, .169, 0,.1,.20,true);
    lens.scale.set(.95, .93, .32);
    for (const side of [-1,1]) {
      const fin = oct(root, 0x96645f, .201, side*.276,-.148,0);
      fin.scale.set(.59, .84, .42);
      fin.rotation.z = side * -.36;
    }
  }

  function seal(root) {
    ring(root, 0xf0ac74, .446, .041, -.01, true);
    const inset = ring(root, 0xf79788, .365, .018, .012, true);
    inset.scale.set(1, .97, 1);
    for (const [x,y] of [[0,.445],[0,-.445],[.445,0],[-.445,0]]) oct(root, 0xffd592,.079,x,y,.03,true);
  }

  function bolt(root) {
    const core = oct(root, 0xffda94, .46, 0,0,0, true);
    core.scale.set(.29, 1, .29);
    const tip = oct(root, 0xfff4c8, .165, 0,.22,.03,true);
    tip.scale.set(.59, 1.1, .45);
  }

  const models = {meteor, crystal, orb, launcher, seal, bolt};
  const pools = new Map();

  function place(markers, rect, project, viewport, time) {
    for (const pool of pools.values()) {
      pool.used = 0;
      pool.items.forEach(item => { item.visible = false; });
    }

    let visible = 0;
    for (const marker of markers) {
      const type = marker.dataset.arenaModel;
      if (!Object.hasOwn(models, type) || marker.closest('[hidden], [data-arena-hidden]')) continue;
      const bounds = marker.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2;
      const y = bounds.top + bounds.height / 2;
      if (bounds.width < 5 || bounds.height < 5 || x < rect.left || x > rect.right ||
        y < rect.top || y > rect.bottom || y < viewport.top || y > viewport.bottom ||
        x < viewport.left || x > viewport.right) continue;

      if (!pools.has(type)) pools.set(type, {items:[], used:0});
      const pool = pools.get(type);
      if (pool.used === pool.items.length) {
        const item = pool.items[0]?.clone(true) || new T.Group();
        if (!pool.items.length) models[type](item);
        pool.items.push(item);
        scene.add(item);
      }

      const item = pool.items[pool.used++];
      const spin = time * 1.65 + pool.used * 1.78;
      const angle = Number(marker.dataset.arenaAngle) || 0;
      project({x:(x-viewport.left)/viewport.width,y:(y-viewport.top)/viewport.height},item.position);
      const span = type === 'bolt' ? Math.max(bounds.width,bounds.height) : Math.min(bounds.width,bounds.height);
      item.scale.setScalar(span * 10 / viewport.height);
      item.rotation.set(type === 'meteor' ? Math.sin(spin*.77)*.18 : 0,
        ['orb','seal','launcher','bolt'].includes(type) ? 0 : Math.sin(spin)*.64,
        -angle * Math.PI/180 + (type === 'meteor' ? Math.sin(spin)*.35 : 0));
      item.visible = true;
      visible++;
    }
    return visible;
  }

  return {scene, place};
}
