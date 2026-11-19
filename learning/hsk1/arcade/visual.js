(() => {
  'use strict';

  const base = new URL('./', document.currentScript.src);
  const threeUrl = new URL('vendor/three.module.min.js', base).href;
  const scenesUrl = new URL('cinema-scenes.js', base).href;
  const storyUrl = new URL('story-world.js', base).href;
  const arenaUrl = new URL('arena-models.js', base).href;
  const worldHeight = 10;
  const maxEffects = 12;
  const particleCount = 36;
  const easeOut = n => 1 - (1 - n) ** 3;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const mix = (a, b, blend) => a + (b - a) * blend;

  const recipes = {
    enter: {rings: 1, amount: 8, size: .33, life: .7},
    miss: {rings: 1, amount: 9, size: .47, life: .56, color: 0xfa8c80},
    hint: {rings: 2, amount: 11, size: .63, life: .79, color: 0xffe8ab},
    discover: {rings: 2, amount: 17, size: .61, life: .65},
    lantern: {rings: 2, amount: 26, size: .9, life: .92, color: 0xffc476},
    unlock: {rings: 3, amount: 29, size: 1.22, life: 1.09},
    complete: {rings: 3, amount: 36, size: 1.85, life: 1.26},
    success: {rings: 2, amount: 20, size: .88, life: .76},
    tune: {rings: 2, amount: 4, size: .68, life: .59},
  };
  let rendererModules;

  function loadModules() {
    rendererModules ||= Promise.all([import(threeUrl), import(scenesUrl), import(storyUrl), import(arenaUrl)]);
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
    const vectors = Array.from({length:particleCount}, () => {
      const azimuth = Math.random() * Math.PI * 2;
      const speed = .42 + Math.random() * 1.62;
      return [Math.cos(azimuth) * speed, Math.sin(azimuth) * speed, Math.random() * .12];
    });
    const state = {group, beginAt:-Infinity};
    const center = new THREE.Vector3();

    function begin(event, colors, now) {
      state.beginAt = now;
      state.event = event;
      state.recipe = recipes[event.type];
      const tint = state.recipe.color || colors[0];
      cloud.material.color.set(tint);
      radiant.material.color.set(colors[1]);
      rings.forEach((object, index) => object.material.color.set(index % 2 ? colors[1] : tint));
      group.visible = true;
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
      project(event.target, center, .52);
      radiant.position.copy(center);
      radiant.scale.setScalar(recipe.size * (1.1 + age));
      radiant.material.opacity = fade * .45;
      sparksGeometry.setDrawRange(0, recipe.amount);
      const spread = recipe.size * age ** .53;
      const rise = event.type === 'complete' ? .8 : -.35;
      for (let i = 0; i < recipe.amount; i++) {
        const [vx, vy, vz] = vectors[i];
        sparks.setXYZ(i, center.x + vx * spread, center.y + vy * spread + spread * spread * rise, .61 + vz);
      }
      sparks.needsUpdate = true;
      cloud.material.opacity = fade * .96;
      cloud.material.size = Math.max(.1, .3 - age * .17);
      rings.forEach((object, index) => {
        const energy = (age - index * .105) * 1.31;
        object.visible = index < (recipe.rings || 0) && energy > 0 && energy < 1;
        if (object.visible) {
          object.position.copy(center);
          object.rotation.x = event.type === 'lantern' ? .94 : index * .17;
          object.scale.setScalar(Math.max(.08, energy * (recipe.size || .73) * (1 + index * .27)));
          object.material.opacity = Math.max(0, (1 - energy) * .8);
        }
      });
    }

    return {group, begin, draw, started:()=>state.beginAt};
  }

  function rendererFor(canvas, context, THREE, library, storyModels, arenaLibrary, settings) {
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
    const models = arenaLibrary.createArenaModels(THREE);
    let shownWorld = '';
    let shownFocus = -1;
    let cameraBeat = -Infinity;
    const texture = textureFor(THREE);
    const effects = Array.from({length:maxEffects}, () => buildEffect(THREE, texture, foreground));
    let frame = 0;
    let lastFrame = 0;
    let previous = '';
    let stage;
    let startedAt = 0;
    let actionTime = -Infinity;
    let runningTime = 0;
    let modelTime = 0;
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
      shownWorld = name;
      shownFocus = focus;
      cameraBeat = now;
      const path = name === 'finished' || name === 'progress' ? 'ending'
        : name === 'arcade' ? 'arcade'
        : name === 'home' || name === 'settings' ? 'home' : 'map';
      story.show(path, Math.max(0, focus));
      if (newRoute) story.cue(name === 'finished' ? 'complete' : 'enter');
    }

    function showWorld(now, dt, width, height) {
      if (!coverRect) return false;
      const {x,y,width:w,height:h} = coverRect;
      const left = clamp(x, 0, width);
      const right = clamp(x+w, 0, width);
      const bottom = clamp(height-y-h, 0, height);
      const top = clamp(height-y, 0, height);
      if (right <= left || top <= bottom || w <= 1 || h <= 1) return false;

      story.update(dt, runningTime, false);
      look.copy(story.cameraTarget);
      const a = w/h;
      const close = shownWorld === 'home' ? 6.15 : 5.45;
      const elapsed = clamp((now - cameraBeat) / 1000);
      const dolly = 1 + (1 - easeOut(elapsed)) * .15;
      const viewHeight = Math.max(close, 7.45 / a) * dolly;
      const idle = Math.sin(runningTime * .58);
      worldCamera.left = -viewHeight * a / 2;
      worldCamera.right = -worldCamera.left;
      worldCamera.top = viewHeight / 2;
      worldCamera.bottom = -worldCamera.top;
      worldCamera.updateProjectionMatrix();
      offset.set(5.3 + idle * .35, 5.4, 9.3);
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

    function drawArena(width, height) {
      const surface = settings.arena.querySelector('[data-arena-surface]');
      stageOnScreen = false;
      const bounds = surface?.getBoundingClientRect();
      const viewport = canvas.getBoundingClientRect();
      if (!bounds || !viewport.height) {
        delete canvas.dataset.arenaVisual;
        return;
      }
      const left = clamp(bounds.left-viewport.left, 0, width);
      const right = clamp(bounds.right-viewport.left, 0, width);
      const top = clamp(bounds.top-viewport.top, 0, height);
      const bottom = clamp(bounds.bottom-viewport.top, 0, height);
      if (right <= left || bottom <= top) {
        delete canvas.dataset.arenaVisual;
        return;
      }
      const paused = surface.hasAttribute('data-arena-paused');
      if (!paused) modelTime = runningTime;
      const count = models.place(surface.querySelectorAll('[data-arena-model]'), bounds, project, viewport, modelTime);
      if (!count) {
        delete canvas.dataset.arenaVisual;
        return;
      }
      if (!canvas.dataset.arenaVisual) canvas.dataset.arenaVisual = '3d';
      renderer.setScissor(left, height-bottom, right-left, bottom-top);
      renderer.setScissorTest(true);
      renderer.render(models.scene, camera);
      renderer.setScissorTest(false);
      stageOnScreen = !paused;
    }

    function clear() {
      if (lost) return;
      renderer.setScissorTest(false);
      renderer.clear(true, true, true);
    }

    function redraw(now) {
      if (dirty || now - startedAt < 720) fit();
      if (!lastSize) return;
      const dt = clamp((now - lastFrame) / 1000, 0, .05);
      runningTime += dt;
      clear();
      const {width,height} = lastSize;
      if (settings.arena) {
        drawArena(width, height);
        lastFrame = now;
        return;
      }
      if (!stage) return;
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
          entrance:.72 + easeOut(clamp((now - startedAt) / 670)) * .28, activity });
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
      return !lost && pageVisible && !document.hidden && !settings.lowMotion;
    }

    function draw(now) {
      frame = 0;
      if (!canAnimate()) return;
      const interval = settings.arena || now - actionTime < 1250 || now - cameraBeat < 2150 || now - startedAt < 730 ? 15 : 31;
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
    const arenaChanges = new MutationObserver(invalidate);
    let observedArena;
    function observeArena() {
      if (observedArena === settings.arena) return;
      if (observedArena) observeSize?.unobserve(observedArena);
      arenaChanges.disconnect();
      observedArena = settings.arena;
      if (observedArena) {
        observeSize?.observe(observedArena);
        arenaChanges.observe(observedArena, {
          childList:true, subtree:true, attributes:true, attributeFilter:['data-arena-paused'],
        });
      }
    }

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
      story.cue(event.type);
      const candidate = effects.find(effect => !effect.group.visible) ||
        effects.reduce((earliest, effect) => effect.started() < earliest.started() ? effect : earliest);
      candidate.begin(event, stage.colors, now);
      invalidate();
    }

    function sync() {
      observeAnchor();
      observeArena();
      if (!settings.arena) changeWorld(performance.now());
      if (settings.name !== previous) {
        const firstScene = !previous;
        const now = performance.now();
        if (stage) releaseGroup(stage.group);
        stage = undefined;
        effects.forEach(effect => { effect.group.visible = false; });
        startedAt = now;
        previous = settings.name;
        if (!settings.arena) {
          stage = library.buildCinemaStage(THREE, texture, settings.name);
          background.add(stage.group);
          if (!firstScene) fire(makeEvent('enter', settings.anchor, {}, canvas));
        }
      }
      if (!canAnimate()) {
        delete canvas.dataset.arenaVisual;
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
      delete canvas.dataset.arenaVisual;
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
        arenaChanges.disconnect();
        releaseGroup(models.scene);
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
    return {type, target:pointFor(target, detail.x, detail.y)};
  }

  function mount(canvas) {
    const settings = {name:'', anchor:null, cover:null, arena:null, focus:0, lowMotion:false};
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
        const [THREE, library, storyModels, arenaLibrary] = await loadModules();
        if (disposed || !canvas.isConnected) return;
        display = rendererFor(canvas, context, THREE, library, storyModels, arenaLibrary, settings);
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
      setScene(name, {lowMotion = false, anchor = null, cover = null, arena = null, focus = 0} = {}) {
        const changed = settings.name !== name || settings.anchor !== anchor ||
          settings.cover !== cover || settings.arena !== arena || settings.focus !== focus;
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
        settings.arena = arena;
        if (!arena || lowMotion) delete canvas.dataset.arenaVisual;
        canvas.dataset.scene = name;
        canvas.dataset.focus = focus;
        canvas.dataset.visual = lowMotion ? 'still' : display?.active ? '3d' : '2d';
        if (display) display.sync();
        else if (!lowMotion) void initialize();
      },
      cue(type, target, detail = {}) {
        if (!recipes[type] || settings.lowMotion || settings.arena || disposed) return;
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
