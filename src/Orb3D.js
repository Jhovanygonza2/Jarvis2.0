import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const Orb3D = ({ analyser, listening, processing }) => {
  const mountRef = useRef(null);
  const analyserRef = useRef(analyser);
  const listeningRef = useRef(listening);
  const processingRef = useRef(processing);

  useEffect(() => { analyserRef.current = analyser; }, [analyser]);
  useEffect(() => {
    listeningRef.current = listening;
    processingRef.current = processing;
  }, [listening, processing]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    camera.position.z = 4.15;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      mount.classList.add('orb-fallback');
      return () => mount.classList.remove('orb-fallback');
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(mount);
    window.addEventListener('resize', resize);

    const orb = new THREE.Group();
    scene.add(orb);

    const glowGeometry = new THREE.SphereGeometry(1.48, 40, 28);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x45105c,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    orb.add(new THREE.Mesh(glowGeometry, glowMaterial));

    const ribbons = [];
    const uSegments = 168;
    const vSegments = 14;
    const ribbonColors = [0xf626d4, 0x9d36ff, 0x13cfff, 0xe83bff, 0x2a72ff, 0xff42c7, 0x00d9ff];

    for (let band = 0; band < ribbonColors.length; band++) {
      const geometry = new THREE.BufferGeometry();
      const vertexCount = (uSegments + 1) * (vSegments + 1);
      const positions = new Float32Array(vertexCount * 3);
      const colors = new Float32Array(vertexCount * 3);
      const indices = [];
      const phase = (band / ribbonColors.length) * Math.PI * 2;
      const accent = new THREE.Color(ribbonColors[band]);
      const cyan = new THREE.Color(0x14d8ff);

      for (let u = 0; u <= uSegments; u++) {
        const theta = (u / uSegments) * Math.PI * 2;
        const blend = 0.5 + 0.5 * Math.sin(theta * 1.5 + phase);
        const vertexColor = cyan.clone().lerp(accent, blend);

        for (let v = 0; v <= vSegments; v++) {
          const index = u * (vSegments + 1) + v;
          vertexColor.toArray(colors, index * 3);
          if (u < uSegments && v < vSegments) {
            const next = index + vSegments + 1;
            indices.push(index, next, index + 1, next, next + 1, index + 1);
          }
        }
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(indices);

      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.29,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      orb.add(mesh);
      ribbons.push({ geometry, material, mesh, phase, band });
    }

    const lineMaterials = [];
    const circlePoints = 160;
    const makeCircle = (radius, color, opacity) => {
      const points = [];
      for (let i = 0; i < circlePoints; i++) {
        const angle = (i / circlePoints) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      lineMaterials.push(material);
      return new THREE.LineLoop(geometry, material);
    };

    const outline = makeCircle(1.5, 0x168dff, 0.82);
    orb.add(outline);

    const orbitGroup = new THREE.Group();
    const orbitA = makeCircle(1.58, 0x00d9ff, 0.43);
    orbitA.rotation.x = 0.74;
    orbitA.rotation.y = -0.42;
    const orbitB = makeCircle(1.62, 0xd234ff, 0.38);
    orbitB.rotation.x = -0.88;
    orbitB.rotation.y = 0.58;
    orbitGroup.add(orbitA, orbitB);
    orb.add(orbitGroup);

    const starCount = 150;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const cyan = new THREE.Color(0x00dfff);
    const pink = new THREE.Color(0xf72bdb);
    for (let i = 0; i < starCount; i++) {
      const index = i * 3;
      starPositions[index] = (Math.random() - 0.5) * 8;
      starPositions[index + 1] = (Math.random() - 0.5) * 8;
      starPositions[index + 2] = (Math.random() - 0.5) * 5;
      const color = Math.random() > 0.72 ? pink : cyan;
      color.toArray(starColors, index);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const updateRibbon = (ribbon, time, audioPulse) => {
      const { geometry, phase, band } = ribbon;
      const position = geometry.attributes.position;
      for (let u = 0; u <= uSegments; u++) {
        const theta = (u / uSegments) * Math.PI * 2;
        const wave = Math.sin(theta * 2 + phase + time * 0.58) * 0.48
          + Math.sin(theta * 5 - phase - time * 0.82) * 0.14;
        for (let v = 0; v <= vSegments; v++) {
          const across = (v / vSegments) * 2 - 1;
          const latitude = wave + across * (0.12 + (band % 3) * 0.045)
            + Math.sin(theta * 8 + phase + time) * 0.035;
          const radius = 1.16 + Math.sin(theta * 3 + phase + time * 0.7) * 0.055 + audioPulse * 0.09;
          const cosLatitude = Math.cos(latitude);
          const index = u * (vSegments + 1) + v;
          position.setXYZ(
            index,
            radius * Math.sin(theta) * cosLatitude,
            radius * Math.sin(latitude),
            radius * Math.cos(theta) * cosLatitude
          );
        }
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
      ribbon.material.opacity = 0.24 + audioPulse * 0.18;
    };

    let audioData = new Uint8Array(128);
    let frameId;
    const startedAt = performance.now();
    const animate = (now) => {
      frameId = requestAnimationFrame(animate);
      const time = (now - startedAt) * 0.001;
      let audioPulse = 0;
      const activeAnalyser = analyserRef.current;

      if (activeAnalyser) {
        if (audioData.length !== activeAnalyser.frequencyBinCount) {
          audioData = new Uint8Array(activeAnalyser.frequencyBinCount);
        }
        activeAnalyser.getByteFrequencyData(audioData);
        let total = 0;
        for (let i = 0; i < audioData.length; i++) total += audioData[i];
        audioPulse = total / Math.max(audioData.length, 1) / 255;
      }

      ribbons.forEach((ribbon) => updateRibbon(ribbon, time, audioPulse));
      orb.rotation.y = time * 0.14;
      orb.rotation.x = Math.sin(time * 0.22) * 0.12;
      orbitGroup.rotation.z = time * 0.11;
      outline.material.color.setHex(processingRef.current ? 0xff35e8 : listeningRef.current ? 0x00ffd0 : 0x168dff);
      outline.material.opacity = 0.7 + audioPulse * 0.25;
      glowMaterial.opacity = 0.1 + audioPulse * 0.12;
      stars.rotation.y = -time * 0.018;

      renderer.render(scene, camera);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      glowGeometry.dispose();
      glowMaterial.dispose();
      ribbons.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose(); });
      lineMaterials.forEach((material) => material.dispose());
      orbitGroup.children.forEach((line) => line.geometry.dispose());
      outline.geometry.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="orb-3d-container" aria-hidden="true" />;
};

export default Orb3D;