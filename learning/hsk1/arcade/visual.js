(() => {
  'use strict';

  const threeUrl = new URL('./vendor/three.module.min.js', document.currentScript.src).href;

  function start(canvas, THREE, lowMotion, context) {
    const renderer = new THREE.WebGLRenderer({canvas, context, alpha: true, antialias: true,
      powerPreference: 'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5, 5, 3, -3, .1, 80);
    camera.position.z = 22;
    const depth = new THREE.Group();
    scene.add(depth);

    const stars = new THREE.BufferGeometry();
    const coordinates = new Float32Array(270);
    for (let i = 0; i < coordinates.length; i += 3) {
      coordinates[i] = (Math.random() - .5) * 25;
      coordinates[i + 1] = (Math.random() - .5) * 11;
      coordinates[i + 2] = (Math.random() - .5) * 10;
    }
    stars.setAttribute('position', new THREE.BufferAttribute(coordinates, 3));
    const starlight = new THREE.PointsMaterial({size: .055, color: 0x8ce8f4, transparent: true, opacity: .8});
    depth.add(new THREE.Points(stars, starlight));

    const crystal = new THREE.OctahedronGeometry(1);
    const wire = new THREE.EdgesGeometry(crystal);
    crystal.dispose();
    const glimmer = new THREE.LineBasicMaterial({color: 0x89d8ee, transparent: true, opacity: .32});
    const prisms = Array.from({length: 6}, (_, index) => {
      const shape = new THREE.LineSegments(wire, glimmer);
      shape.position.set((index % 2 ? 1 : -1) * (1.45 + index * .38), (index - 2.5) * .88, -2 - index);
      shape.scale.setScalar(.24 + (index % 3) * .12);
      depth.add(shape);
      return shape;
    });

    const sparkGeometry = new THREE.BufferGeometry();
    const sparkCount = 48;
    const sparkPositions = new THREE.BufferAttribute(new Float32Array(sparkCount * 3), 3);
    sparkGeometry.setAttribute('position', sparkPositions);
    const sparkLight = new THREE.PointsMaterial({size: .13, color: 0xffdc91, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false});
    const sparkCloud = new THREE.Points(sparkGeometry, sparkLight);
    sparkCloud.visible = false;
    sparkCloud.frustumCulled = false;
    scene.add(sparkCloud);
    const velocities = Array.from({length: sparkCount}, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      return [Math.cos(angle) * speed, Math.sin(angle) * speed, Math.random() - .5];
    });
    let originX = 0;
    let originY = 0;
    let burstAt = -Infinity;
    let frame = 0;

    function draw(now) {
      if (!lowMotion && canvas.dataset.paused !== 'true') {
        const time = now / 1000;
        depth.rotation.z = Math.sin(time * .11) * .09;
        depth.rotation.y = Math.cos(time * .17) * .32;
        prisms.forEach((shape, index) => {
          shape.rotation.x = time * (.21 + index * .03);
          shape.rotation.y = time * .47 + index;
        });
        const age = (now - burstAt) / 1000;
        sparkCloud.visible = age < .8;
        if (sparkCloud.visible) {
          sparkLight.opacity = 1 - age / .8;
          velocities.forEach(([x, y, z], index) => sparkPositions.setXYZ(index,
            originX + x * age, originY + y * age - age * age, z * age));
          sparkPositions.needsUpdate = true;
        }
      }
      renderer.render(scene, camera);
    }

    function animate(now) {
      draw(now);
      frame = requestAnimationFrame(animate);
    }

    function resize() {
      const bounds = canvas.parentElement?.getBoundingClientRect();
      if (!bounds?.width || !bounds.height) return;
      const horizontal = 3 * bounds.width / bounds.height;
      camera.left = -horizontal;
      camera.right = horizontal;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height, false);
      draw(performance.now());
    }

    function syncVisibility() {
      cancelAnimationFrame(frame);
      if (!document.hidden && !lowMotion && canvas.dataset.paused !== 'true') {
        frame = requestAnimationFrame(animate);
      }
    }

    function pulse(event) {
      const {x, y} = event.detail || {};
      if (lowMotion || !Number.isFinite(x) || !Number.isFinite(y)) return;
      originX = camera.left + (camera.right - camera.left) * Math.max(0, Math.min(1, x));
      originY = camera.top + (camera.bottom - camera.top) * Math.max(0, Math.min(1, y));
      burstAt = performance.now();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement);
    const playback = new MutationObserver(syncVisibility);
    playback.observe(canvas, {attributes: true, attributeFilter: ['data-paused']});
    document.addEventListener('visibilitychange', syncVisibility);
    canvas.addEventListener('hsk-arcade-pulse', pulse);
    canvas.dataset.visual = '3d';
    resize();
    syncVisibility();

    function lost() {
      canvas.dataset.visual = '2d';
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', syncVisibility);
      observer.disconnect();
      playback.disconnect();
    }
    canvas.addEventListener('webglcontextlost', lost);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('hsk-arcade-pulse', pulse);
      lost();
      stars.dispose();
      starlight.dispose();
      wire.dispose();
      glimmer.dispose();
      sparkGeometry.dispose();
      sparkLight.dispose();
      renderer.dispose();
    };
  }

  window.HSK_ARCADE_VISUAL = (canvas, lowMotion) => {
    let disposed = false;
    let cleanup;
    canvas.dataset.visual = '2d';
    const show = async () => {
      try {
        const THREE = await import(threeUrl);
        if (disposed || !canvas.isConnected) return;
        const context = canvas.getContext('webgl2', {alpha: true, antialias: true,
          powerPreference: 'low-power'});
        if (context) cleanup = start(canvas, THREE, lowMotion, context);
      } catch {
        // Decorative 3D can be unavailable on older devices.
      }
    };
    void show();
    return () => {
      disposed = true;
      cleanup?.();
    };
  };
})();
