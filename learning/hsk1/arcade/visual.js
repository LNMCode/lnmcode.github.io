(() => {
  'use strict';

  const base = new URL('./', document.currentScript.src);
  const threeUrl = new URL('vendor/three.module.min.js', base).href;
  const scenesUrl = new URL('cinema-scenes.js', base).href;
  const storyUrl = new URL('story-world.js', base).href;
  const gamesUrl = new URL('game-sets.js', base).href;
  const worldHeight = 10;
  const maxEffects = 12;
  const particleCount = 36;
  const easeOut = n => 1 - (1 - n) ** 3;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const mix = (a, b, blend) => a + (b - a) * blend;
  const trajectory = {kite:1.6, wind:.27, link:.22, boat:.38, ink:.22, comet:.48};

  const recipes = {
    enter: {rings: 1, amount: 8, size: .33, life: .7},
    enterGame: {rings: 2, amount: 14, size: .62, life: .8},
    round: {rings: 1, amount: 7, size: .4, life: .48},
    launch: {travel: 'comet', life: .47},
    hit: {rings: 2, amount: 24, size: .89, life: .78},
    miss: {rings: 1, amount: 9, size: .47, life: .56, color: 0xfa8c80},
    select: {rings: 1, amount: 7, size: .42, life: .46},
    hint: {rings: 2, amount: 11, size: .63, life: .79, color: 0xffe8ab},
    discover: {rings: 2, amount: 17, size: .61, life: .65},
    lantern: {rings: 2, amount: 26, size: .9, life: .92, color: 0xffc476},
    unlock: {rings: 3, amount: 29, size: 1.22, life: 1.09},
    complete: {rings: 3, amount: 36, size: 1.85, life: 1.26},
    reward: {rings: 3, amount: 36, size: 1.44, life: 1.14},
    success: {rings: 2, amount: 20, size: .88, life: .76},
    steer: {amount: 0, life: .3},
    drift: {travel: 'wind', rings: 0, amount: 6, size: .49, life: .69},
    gust: {travel: 'wind', rings: 1, amount: 8, size: .46, life: .7},
    cross: {travel: 'kite', rings: 2, amount: 16, size: .75, life: .76},
    tune: {rings: 2, amount: 4, size: .68, life: .59},
    listen: {rings: 3, amount: 9, size: 1.1, life: .94},
    dial: {rings: 1, amount: 5, size: .58, life: .47},
    ink: {travel: 'ink', amount: 12, size: .53, life: .52},
    seal: {rings: 2, amount: 26, size: 1.02, life: .92},
    collect: {rings: 2, amount: 16, size: .69, life: .79},
    flip: {rings: 1, amount: 7, size: .54, life: .48},
    link: {travel: 'link', amount: 12, size: .58, life: .69},
    connect: {travel: 'link', rings: 2, amount: 12, size: .65, life: .77},
    match: {travel: 'link', rings: 2, amount: 15, size: .76, life: .73},
    boat: {travel: 'boat', amount: 7, size: .44, life: .61},
    sail: {travel: 'boat', rings: 1, amount: 16, size: .74, life: .88},
  };
  const gameNames = new Set(['wind','echo','riddle','lights','pinyin','strokes','pairs','flow']);
  let rendererModules;

  function loadModules() {
    rendererModules ||= Promise.all([import(threeUrl), import(scenesUrl), import(storyUrl), import(gamesUrl)]);
    return rendererModules;
  }

  function textureFor(THREE) {
    const dimension = 64;
    const pixels = new Uint8Array(dimension * dimension * 4);
    for (let y = 0; y < dimension; y++) {
      for (let x = 0; x < dimension; x++) {
        const radius = Math.hypot(x / 31.5 - 1, y / 31.5 - 1);
        const index = (y * dimension + x) * 4;
        pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
        pixels[index + 3] = Math.round(255 * Math.max(0, 1 - radius) ** 2.25);
      }
    }
    const texture = new THREE.DataTexture(pixels, dimension, dimension);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function releaseGroup(group, releaseTextures = false) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    group.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) materials.add(node.material);
    });
    geometries.forEach(geometry => geometry.dispose());
    for (const material of materials) {
      if (releaseTextures && material.map) textures.add(material.map);
      material.dispose();
    }
    for (const texture of textures) texture.dispose();
    group.removeFromParent();
  }

  function buildEffect(THREE, texture, scene) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    const sparksGeometry = new THREE.BufferGeometry();
    const sparks = new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3);
    sparksGeometry.setAttribute('position', sparks);
    const cloud = new THREE.Points(sparksGeometry, new THREE.PointsMaterial({
      map:texture, size:.24, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false,
    }));
    cloud.frustumCulled = false;
    group.add(cloud);

    const trailGeometry = new THREE.BufferGeometry();
    const trace = new THREE.BufferAttribute(new Float32Array(51), 3);
    trailGeometry.setAttribute('position', trace);
    const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite:false,
    }));
    trail.frustumCulled = false;
    group.add(trail);

    const radiant = new THREE.Sprite(new THREE.SpriteMaterial({
      map:texture, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false,
    }));
    group.add(radiant);

    const ringGeometry = new THREE.TorusGeometry(1, .024, 5, 44);
    const rings = Array.from({length:3}, () => {
      const object = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
        transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending,
      }));
      group.add(object);
      return object;
    });
    const skiff = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(.66, .105, .13), new THREE.MeshBasicMaterial({
      color:0xf1b77b, transparent:true, depthWrite:false,
    }));
    body.rotation.z = -.09;
    const sail = new THREE.Mesh(new THREE.CircleGeometry(.24, 3), new THREE.MeshBasicMaterial({
      color:0xffe3a1, transparent:true, depthWrite:false,
    }));
    sail.position.set(.01, .167, .02);
    sail.rotation.z = Math.PI / 2;
    skiff.add(body, sail);
    group.add(skiff);

    const vectors = Array.from({length:particleCount}, () => {
      const azimuth = Math.random() * Math.PI * 2;
      const speed = .42 + Math.random() * 1.62;
      return [Math.cos(azimuth) * speed, Math.sin(azimuth) * speed, Math.random() * .12];
    });
    const state = {group, beginAt:-Infinity};
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const head = new THREE.Vector3();

    function begin(event, colors, now) {
      state.beginAt = now;
      state.event = event;
      state.recipe = event.type === 'cross' && event.detail.correct === false
        ? {...recipes.cross, color:0xfa8c80, amount:8}
        : recipes[event.type];
      const tint = state.recipe.color || colors[0];
      cloud.material.color.set(tint);
      trail.material.color.set(event.type === 'ink' ? colors[2] : tint);
      radiant.material.color.set(event.type === 'ink' ? colors[2] : colors[1]);
      rings.forEach((object, index) => object.material.color.set(index % 2 ? colors[1] : tint));
      group.visible = true;
    }

    function curve(progress, kind, output) {
      output.lerpVectors(from, to, progress);
      const span = Math.abs(from.x - to.x);
      const arch = trajectory[kind] || 0;
      output.y += Math.sin(progress * Math.PI) * (span * .21 + arch);
      if (kind === 'ink' || kind === 'wind') output.x += Math.sin(progress * Math.PI * 2) * .1;
    }

    function draw(now, project) {
      if (!group.visible) return;
      const {recipe, event, beginAt} = state;
      const age = Math.max(0, (now - beginAt) / (recipe.life * 1000));
      if (age >= 1) {
        group.visible = false;
        return;
      }
      const fade = (1 - age) ** 1.22;
      project(event.target, to, .52);
      project(event.from, from, .52);
      const travel = recipe.travel;
      const headProgress = travel === 'link' ? easeOut(clamp(age * 2.8)) : easeOut(clamp(age * 1.24));
      curve(headProgress, travel, head);

      trail.visible = Boolean(travel);
      if (travel) {
        const tail = travel === 'link' ? 0 : Math.max(0, headProgress - .28);
        for (let i = 0; i < trace.count; i++) {
          curve(mix(tail, headProgress, i / (trace.count - 1)), travel, head);
          trace.setXYZ(i, head.x, head.y, .3 + i * .004);
        }
        trace.needsUpdate = true;
        trail.material.opacity = fade * .9;
      }
      radiant.visible = travel !== 'boat';
      radiant.position.copy(travel ? head : to);
      radiant.scale.setScalar((recipe.size || .76) * (1.1 + age));
      radiant.material.opacity = fade * (travel ? .76 : .45);
      skiff.visible = travel === 'boat';
      if (skiff.visible) {
        skiff.position.copy(head);
        skiff.rotation.z = Math.sin(age * Math.PI * 2) * .09;
        skiff.scale.setScalar(.72 + Math.sin(age * Math.PI) * .25);
        skiff.children.forEach(part => { part.material.opacity = fade * .94; });
      }

      const bloomAge = travel ? clamp((age - .27) * 1.37) : age;
      // Symmetric bursts expand the halo while the motes drift under gravity.
      cloud.visible = Boolean(recipe.amount) && (!travel || age > .27);
      if (cloud.visible) {
        sparksGeometry.setDrawRange(0, recipe.amount);
        const spread = (recipe.size || .73) * (bloomAge ** .53);
        for (let i = 0; i < recipe.amount; i++) {
          const [vx, vy, vz] = vectors[i];
          const rise = event.type === 'complete' || event.type === 'reward' ? .8 : -.35;
          sparks.setXYZ(i, to.x + vx * spread, to.y + vy * spread + spread * spread * rise, .61 + vz);
        }
        sparks.needsUpdate = true;
        cloud.material.opacity = fade * .96;
        cloud.material.size = Math.max(.1, .3 - bloomAge * .17);
      }
      rings.forEach((object, index) => {
        const energy = (bloomAge - index * .105) * 1.31;
        object.visible = index < (recipe.rings || 0) && energy > 0 && energy < 1;
        if (object.visible) {
          object.position.copy(to);
          object.rotation.x = event.type === 'connect' || event.type === 'lantern' ? .94 : index * .17;
          object.scale.setScalar(Math.max(.08, energy * (recipe.size || .73) * (1 + index * .27)));
          object.material.opacity = Math.max(0, (1 - energy) * .8);
        }
      });
    }

    return {group, begin, draw, started:()=>state.beginAt};
  }

  function rendererFor(canvas, context, THREE, library, storyModels, gameModels, settings) {
    const renderer = new THREE.WebGLRenderer({
      canvas, context, alpha:true, antialias:true, powerPreference:'low-power', premultipliedAlpha:true,
    });
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 50);
    camera.position.z = 24;
    const background = new THREE.Scene();
    const foreground = new THREE.Scene();
    const world = new THREE.Scene();
    const worldCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 50);
    const key = new THREE.DirectionalLight(0xffe1b2, 2.2);
    const rim = new THREE.DirectionalLight(0xc2c9ff, 1.34);
    const fill = new THREE.HemisphereLight(0xf9e9ff, 0x504063, 2.05);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {left:-8, right:8, top:8, bottom:-8, near:.35, far:26});
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -.00024;
    key.shadow.normalBias = .035;
    world.add(key, key.target, rim, rim.target, fill);

    const actor = storyModels.createTraveler(THREE);
    const story = storyModels.createStoryWorld(THREE, actor);
    world.add(story.root);
    const look = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const gameSets = new Map();
    const celebration = new Set(['unlock','seal','hit','cross','connect','match','sail','reward','complete','success']);
    let activeSet = null;
    let shownWorld = '';
    let shownFocus = -1;
    let cameraBeat = -Infinity;
    let actorBeat = -Infinity;
    let actorMood = '';
    const texture = textureFor(THREE);
    const effects = Array.from({length:maxEffects}, () => buildEffect(THREE, texture, foreground));
    let frame = 0;
    let lastFrame = 0;
    let previous = '';
    let stage;
    let startedAt = 0;
    let actionTime = -Infinity;
    let runningTime = 0;
    let lane = 1;
    let targetLane = 1;
    let signal = .4;
    let flight = 0;
    let lastSize;
    let stageRect;
    let coverRect;
    let stageOnScreen = true;
    let dirty = true;
    let lost = false;
    let pageVisible = true;

    function project(point, out, z = 0) {
      out.set(mix(camera.left, camera.right, point.x), mix(camera.top, camera.bottom, point.y), z);
      return out;
    }

    function fit() {
      const canvasRect = canvas.getBoundingClientRect();
      const {width, height} = canvasRect;
      if (!width || !height) return;
      // Use the clipped content itself as the stage so the motif follows the app layout while scrolling.
      const anchor = settings.anchor?.isConnected ? settings.anchor.getBoundingClientRect() : null;
      const widthLimit = Math.min(width, 660);
      const rect = anchor?.width && anchor.height ? anchor : {
        left:canvasRect.left + (width - widthLimit) / 2, top:canvasRect.top, width:widthLimit, height,
      };
      stageRect = {x:rect.left - canvasRect.left, y:rect.top - canvasRect.top,
        width:rect.width, height:Math.min(height, rect.height)};
      const cover = settings.cover?.isConnected ? settings.cover.getBoundingClientRect() : null;
      coverRect = cover?.width && cover.height ? {
        x:cover.left - canvasRect.left + 1, y:cover.top - canvasRect.top + 1,
        width:cover.width - 2, height:cover.height - 2,
      } : null;
      if (!lastSize || lastSize.width !== width || lastSize.height !== height) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4, Math.sqrt(950000 / (width * height))));
        renderer.setSize(width, height, false);
        camera.left = -(worldHeight / 2) * width / height;
        camera.right = -camera.left;
        camera.updateProjectionMatrix();
        lastSize = {width,height};
      }
      dirty = false;
    }

    function changeWorld(now) {
      const name = settings.name;
      const focus = settings.focus;
      if (name === shownWorld && focus === shownFocus) return;
      const newRoute = name !== shownWorld;
      if (activeSet) activeSet.root.visible = false;
      activeSet = null;
      shownWorld = name;
      shownFocus = focus;
      cameraBeat = now;
      if (gameNames.has(name)) {
        if (!gameSets.has(name)) {
          const set = gameModels.createGameSet(THREE, name);
          gameSets.set(name, set);
          world.add(set.root);
        }
        activeSet = gameSets.get(name);
        activeSet.root.visible = true;
        story.root.visible = false;
        activeSet.root.add(actor.root);
        actor.root.scale.setScalar(.97);
        actor.root.position.set(-2.38, -.12, 1.04);
        actorBeat = now + 260;
        actorMood = 'wave';
        activeSet.cue('enterGame', {});
      } else {
        const path = name === 'finished' || name === 'progress' ? 'ending'
          : name === 'arcade' ? 'arcade'
          : name === 'home' || name === 'settings' ? 'home' : 'map';
        story.root.visible = true;
        story.show(path, Math.max(0, focus));
        if (newRoute) story.cue(name === 'finished' ? 'complete' : 'enter');
      }
    }

    function showWorld(now, dt, width, height) {
      if (!coverRect) return false;
      const {x,y,width:w,height:h} = coverRect;
      const left = clamp(x, 0, width);
      const right = clamp(x+w, 0, width);
      const bottom = clamp(height-y-h, 0, height);
      const top = clamp(height-y, 0, height);
      if (right <= left || top <= bottom || w <= 1 || h <= 1) return false;

      if (activeSet) {
        activeSet.update(dt, runningTime);
        const beat = (now - actorBeat) / 920;
        const entering = easeOut(clamp((now - cameraBeat) / 760));
        actor.root.position.x = -2.27 - (1 - entering) * 1.6;
        actor.update(dt, runningTime, {moving:Math.sin(entering * Math.PI), emotion:beat < 0 ? '' : actorMood, stride:beat});
        look.copy(activeSet.target);
      } else {
        story.update(dt, runningTime, false);
        look.copy(story.cameraTarget);
      }

      const a = w/h;
      const close = activeSet ? 4.65 : shownWorld === 'home' ? 6.15 : 5.45;
      const elapsed = clamp((now - cameraBeat) / 1000);
      const dolly = 1 + (1 - easeOut(elapsed)) * .15;
      const punchTime = clamp((now - actorBeat) / 710);
      const punch = activeSet && actorMood === 'celebrate' ? Math.sin(punchTime * Math.PI) * .073 : 0;
      const viewHeight = Math.max(close, (activeSet ? 8.85 : 7.45) / a) * dolly * (1 - punch);
      const idle = Math.sin(runningTime * .58);
      worldCamera.left = -viewHeight * a / 2;
      worldCamera.right = -worldCamera.left;
      worldCamera.top = viewHeight / 2;
      worldCamera.bottom = -worldCamera.top;
      worldCamera.updateProjectionMatrix();
      offset.set((activeSet ? 3.1 : 5.3) + idle * .35 + punch * 4, activeSet ? 5.1 : 5.4, 9.3);
      worldCamera.position.copy(look).add(offset);
      worldCamera.lookAt(look);
      key.position.set(look.x-3.3, 6.2, look.z+4.8);
      key.target.position.set(look.x, .3, look.z);
      rim.position.set(look.x+4, 4.2, look.z-4);
      rim.target.position.set(look.x, .4, look.z);
      renderer.setViewport(x, height-y-h, w, h);
      renderer.setScissor(left, bottom, right-left, top-bottom);
      renderer.setScissorTest(true);
      renderer.render(world, worldCamera);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      return true;
    }

    function clear() {
      if (lost) return;
      renderer.setScissorTest(false);
      renderer.clear(true, true, true);
    }

    function redraw(now) {
      if (dirty || now - startedAt < 720) fit();
      if (!lastSize || !stage) return;
      const dt = clamp((now - lastFrame) / 1000, 0, .05);
      runningTime += dt;
      lane = mix(lane, targetLane, Math.min(1, dt * 10));
      clear();
      const {width,height} = lastSize;
      const {x,y,width:w,height:h} = stageRect;
      const activity = clamp(1 - (now - actionTime) / 920) ** 2;
      const left = clamp(x, 0, width);
      const right = clamp(x + w, 0, width);
      const top = clamp(y, 0, height);
      const bottom = clamp(y + h, 0, height);
      const renderedWorld = showWorld(now, dt, width, height);
      const anchorOnScreen = right > left && bottom > top;
      stageOnScreen = renderedWorld || !coverRect && anchorOnScreen;
      if (!coverRect && anchorOnScreen) {
        const stageScale = worldHeight / height;
        project({x:(x + w / 2) / width, y:(y + h / 2) / height}, stage.group.position);
        stage.draw({ width:w * stageScale, height:h * stageScale, time:runningTime,
          entrance:.72 + easeOut(clamp((now - startedAt) / 670)) * .28, activity, lane, signal, flight });
        renderer.setScissor(left, height - bottom, right - left, bottom - top);
        renderer.setScissorTest(true);
        renderer.render(background, camera);
        renderer.setScissorTest(false);
      }
      if (effects.some(effect => effect.group.visible)) {
        for (const effect of effects) effect.draw(now, project);
        renderer.clearDepth();
        renderer.render(foreground, camera);
      }
      lastFrame = now;
    }

    function canAnimate() {
      return !lost && pageVisible && !document.hidden && !settings.lowMotion && !settings.paused;
    }

    function draw(now) {
      frame = 0;
      if (!canAnimate()) return;
      const interval = now - actionTime < 1250 || now - cameraBeat < 2150 || now - startedAt < 730 ? 15 : 31;
      if (now - lastFrame >= interval) redraw(now);
      if (stageOnScreen || dirty || effects.some(effect => effect.group.visible)) {
        frame = requestAnimationFrame(draw);
      }
    }

    function invalidate() {
      dirty = true;
      if (canAnimate() && !frame) frame = requestAnimationFrame(draw);
    }

    const observeSize = typeof ResizeObserver === 'function' ? new ResizeObserver(invalidate) : null;
    observeSize?.observe(canvas);
    let observed;
    let observedCover;
    function observeAnchor() {
      if (observed === settings.anchor && observedCover === settings.cover) return;
      if (observed) observeSize?.unobserve(observed);
      if (observedCover) observeSize?.unobserve(observedCover);
      observed = settings.anchor;
      observedCover = settings.cover;
      if (observed?.isConnected) observeSize?.observe(observed);
      if (observedCover?.isConnected) observeSize?.observe(observedCover);
    }

    function fire(event) {
      if (!stage || !recipes[event.type] || !canAnimate()) return;
      const now = performance.now();
      actionTime = now;
      if (finite(event.detail.lane)) targetLane = clamp(event.detail.lane, 0, 2);
      if (finite(event.detail.signal)) signal = .37 + event.detail.signal * .31;
      if (event.type === 'cross') flight = event.detail.correct === false ? -.46 : 1;
      if (activeSet) {
        activeSet.cue(event.type, event.detail);
        if (event.type === 'miss' || event.detail.correct === false) {
          actorMood = 'surprise';
          actorBeat = now;
        } else if (celebration.has(event.type)) {
          actorMood = 'celebrate';
          actorBeat = now;
        }
      } else {
        story.cue(event.type, event.detail);
      }
      if (event.type === 'steer') return;
      const candidate = effects.find(effect => !effect.group.visible) ||
        effects.reduce((earliest, effect) => effect.started() < earliest.started() ? effect : earliest);
      candidate.begin(event, stage.colors, now);
      invalidate();
    }

    function sync() {
      observeAnchor();
      changeWorld(performance.now());
      if (settings.name !== previous || !stage) {
        const firstScene = !stage;
        if (stage) {
          releaseGroup(stage.group);
          effects.forEach(effect => { effect.group.visible = false; });
        }
        stage = library.buildCinemaStage(THREE, texture, settings.name);
        background.add(stage.group);
        startedAt = performance.now();
        previous = settings.name;
        const startingLane = Number(settings.anchor?.dataset.lane);
        targetLane = lane = finite(startingLane) ? clamp(startingLane, 0, 2) : 1;
        signal = .4;
        flight = 0;
        if (!firstScene) {
          fire(makeEvent(gameNames.has(previous) ? 'enterGame' : 'enter', settings.anchor, {}, canvas));
        }
      }
      if (!canAnimate()) {
        cancelAnimationFrame(frame);
        frame = 0;
        if (settings.lowMotion) {
          effects.forEach(effect => { effect.group.visible = false; });
          clear();
        }
      } else {
        lastFrame = performance.now() - 34;
        invalidate();
      }
    }

    function onPageHide() {
      pageVisible = false;
      sync();
    }

    function onPageShow() {
      pageVisible = true;
      sync();
    }

    function onLost(event) {
      event.preventDefault();
      lost = true;
      canvas.dataset.visual = '2d';
      sync();
    }

    function onRestored() {
      lost = false;
      lastSize = null;
      canvas.dataset.visual = settings.lowMotion ? 'still' : '3d';
      invalidate();
    }

    const listeners = new AbortController();
    const options = {signal:listeners.signal, passive:true};
    window.addEventListener('resize', invalidate, options);
    window.addEventListener('scroll', invalidate, {...options,capture:true});
    window.visualViewport?.addEventListener('resize', invalidate, options);
    window.visualViewport?.addEventListener('scroll', invalidate, options);
    window.addEventListener('pagehide', onPageHide, options);
    window.addEventListener('pageshow', onPageShow, options);
    document.addEventListener('visibilitychange', sync, options);
    canvas.addEventListener('webglcontextlost', onLost, {signal:listeners.signal});
    canvas.addEventListener('webglcontextrestored', onRestored, options);
    sync();

    return {
      fire, sync,
      get active() { return !lost; },
      dispose() {
        cancelAnimationFrame(frame);
        listeners.abort();
        observeSize?.disconnect();
        releaseGroup(background);
        releaseGroup(foreground);
        releaseGroup(world, true);
        key.shadow.dispose();
        texture.dispose();
        renderer.dispose();
      },
    };
  }

  function makeEvent(type, target, detail, canvas) {
    const frame = canvas.getBoundingClientRect();
    const pointFor = (element, x = .5, y = .5) => {
      if (element && finite(element.x) && finite(element.y) && !element.getBoundingClientRect) {
        return {x:clamp(element.x), y:clamp(element.y)};
      }
      const rect = element?.isConnected ? element.getBoundingClientRect() : null;
      return rect?.width && rect.height && frame.width && frame.height ? {
        x:clamp((rect.left - frame.left + rect.width * x) / frame.width, .02, .98),
        y:clamp((rect.top - frame.top + rect.height * y) / frame.height, .02, .98),
      } : {x:.5, y:.42};
    };
    const toward = pointFor(target, detail.toX ?? detail.x ?? .5, detail.toY ?? detail.y ?? .5);
    const from = detail.from || finite(detail.fromX) || finite(detail.fromY)
      ? pointFor(detail.from || target, detail.fromX ?? .5, detail.fromY ?? .5)
      : {x:clamp(toward.x - (type === 'cross' ? .04 : .17), .03, .96),
        y:clamp(toward.y + (type === 'cross' ? .31 : .17), .03, .96)};
    return {type,target:toward,from,detail};
  }

  function mount(canvas) {
    const settings = {name:'home', anchor:null, cover:null, focus:0, lowMotion:false, paused:false};
    let display;
    let disposed = false;
    let initializing = false;
    let unavailable = false;
    let pending;
    canvas.dataset.visual = '2d';

    async function initialize() {
      if (disposed || display || initializing || unavailable || settings.lowMotion) return;
      initializing = true;
      try {
        const context = canvas.getContext('webgl2', {alpha:true, antialias:true, powerPreference:'low-power'});
        if (!context) {
          unavailable = true;
          return;
        }
        const [THREE, library, storyModels, gameModels] = await loadModules();
        if (disposed || !canvas.isConnected) return;
        display = rendererFor(canvas, context, THREE, library, storyModels, gameModels, settings);
        canvas.dataset.visual = settings.lowMotion ? 'still' : '3d';
        if (pending && performance.now() - pending.time < 650) display.fire(pending.event);
        pending = null;
      } catch {
        unavailable = true;
      } finally {
        initializing = false;
      }
    }

    return {
      setScene(name, {lowMotion = false, anchor = null, cover = null, focus = 0} = {}) {
        const changed = settings.name !== name || settings.anchor !== anchor ||
          settings.cover !== cover || settings.focus !== focus;
        if (!changed && lowMotion === settings.lowMotion) return;
        if (settings.name !== name) {
          delete canvas.dataset.cue;
          pending = null;
        }
        settings.name = name;
        settings.anchor = anchor;
        settings.cover = cover;
        settings.focus = focus;
        settings.lowMotion = lowMotion;
        if (changed) settings.paused = false;
        canvas.dataset.scene = name;
        canvas.dataset.focus = focus;
        canvas.dataset.visual = lowMotion ? 'still' : display?.active ? '3d' : '2d';
        if (display) display.sync();
        else if (!lowMotion) void initialize();
      },
      cue(type, target, detail = {}) {
        if (type === 'pause') {
          settings.paused = Boolean(detail.paused);
          display?.sync();
          return;
        }
        if (!recipes[type] || settings.lowMotion || settings.paused || disposed) return;
        canvas.dataset.cue = type;
        const event = makeEvent(type, target, detail, canvas);
        if (display) display.fire(event);
        else pending = {time:performance.now(), event};
      },
      dispose() {
        disposed = true;
        pending = null;
        display?.dispose();
        canvas.dataset.visual = '2d';
      },
    };
  }

  window.HSK_CINEMA = {mount};
})();
