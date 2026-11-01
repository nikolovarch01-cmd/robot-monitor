// 3D изглед (three.js, MIT): роботът, 64-те точки на 8×8 в пространството, лъчът отзад, земя с мрежа.
// Света: Y нагоре, север по −Z, изток по +X; курс h (по часовниковата стрелка) завърта модела с rotation.y = −h.
// Роботът е в центъра; мрежата под него се плъзга, когато той се движи.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { distRGB, DIST_GRADIENT_CSS, clamp, wrap180, D2R } from './util.js';

// Ако наклонът на тялото излезе обърнат (нос надолу при +), сменете на −1.
const BODY_PITCH_SIGN = 1;
const ACCENT = 0x3cc8ff;
const BG = 0x070b11;

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _e = new THREE.Euler();

function glowTexture(inner = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner); grd.addColorStop(0.35, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function labelSprite(text, color, size) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 38px -apple-system, "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(text, 64, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(size, size / 2, 1);
  return s;
}

export function init(root) {
  root.innerHTML = `
    <div class="v3-stage">
      <canvas class="v3-cv"></canvas>
      <div class="v3-top">
        <span class="v3-title">3D · облак от 8×8</span>
        <span class="v3-btns"><button type="button" data-a="follow" class="on">Следи</button><button type="button" data-a="reset">Начало</button></span>
      </div>
      <div class="v3-leg"><span>0.2 м</span><i style="background:${DIST_GRADIENT_CSS}"></i><span>3 м</span></div>
    </div>`;
  const stage = root.querySelector('.v3-stage'), canvas = root.querySelector('canvas');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    stage.insertAdjacentHTML('beforeend', '<div class="miss">WebGL не е наличен на това устройство</div>');
    return { update() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BG, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 4.2, 10.5);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 60);
  const CAM0 = new THREE.Vector3(1.05, 0.95, 1.55), TGT0 = new THREE.Vector3(0, 0.15, -0.6);   // отзад и отстрани: роботът и облакът до 1.5 m
  camera.position.copy(CAM0);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(TGT0);
  controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.minDistance = 0.35; controls.maxDistance = 6;
  controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.5;
  controls.screenSpacePanning = false;
  controls.update();

  // ── светлини ──
  scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x18202c, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(1.4, 2.6, 1.6); scene.add(key);
  const rim = new THREE.DirectionalLight(ACCENT, 1.2); rim.position.set(-1.6, 1.0, -2.2); scene.add(rim);

  // ── земя: две мрежи, които се плъзгат; сияние под робота ──
  const gridFine = new THREE.GridHelper(24, 96, 0x16283a, 0x16283a);
  const gridMajor = new THREE.GridHelper(24, 24, 0x25445f, 0x25445f);
  gridMajor.position.y = 0.0005;
  scene.add(gridFine, gridMajor);

  const glowTex = glowTexture();
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTex, color: ACCENT, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
  floorGlow.position.y = 0.002; scene.add(floorGlow);

  // посоки на света (фиксирани): С И Ю З
  for (const [txt, x, z, col] of [['С', 0, -3.45, '#3cc8ff'], ['И', 3.45, 0, '#7d90a8'], ['Ю', 0, 3.45, '#7d90a8'], ['З', -3.45, 0, '#7d90a8']]) {
    const sp = labelSprite(txt, col, 0.34); sp.position.set(x, 0.05, z); scene.add(sp);
  }

  // ── роботът ──
  const robot = new THREE.Group(); scene.add(robot);      // завърта се по курса на тялото

  // кръгове за разстояние (с робота: надписите са пред него вдясно)
  for (const r of [1, 2, 3]) {
    const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * r, 0.003, Math.cos(a) * r)); }
    robot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2f7aa6, transparent: true, opacity: r === 1 ? 0.4 : 0.26 })));
    const sp = labelSprite(r + ' м', '#6fb4de', 0.2); sp.position.set(r * Math.sin(0.52), 0.012, -r * Math.cos(0.52)); robot.add(sp);
  }

  const M = {
    tire: new THREE.MeshStandardMaterial({ color: 0x0f141b, roughness: 0.95 }),
    tread: new THREE.MeshStandardMaterial({ color: 0x1f2a37, roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x3b4b60, roughness: 0.4, metalness: 0.6 }),
    spoke: new THREE.MeshStandardMaterial({ color: 0x8aa0bb, roughness: 0.35, metalness: 0.5 }),
    mark: new THREE.MeshBasicMaterial({ color: ACCENT }),
    chassis: new THREE.MeshStandardMaterial({ color: 0x2a3748, roughness: 0.5, metalness: 0.3 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x182130, roughness: 0.4, metalness: 0.4 }),
    neck: new THREE.MeshStandardMaterial({ color: 0x516278, roughness: 0.45, metalness: 0.6 }),
    head: new THREE.MeshStandardMaterial({ color: 0xe9eff7, roughness: 0.3, metalness: 0.05 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x070b11, roughness: 0.12, metalness: 0.6 }),
    eye: new THREE.MeshBasicMaterial({ color: 0x6fd8ff }),
  };

  function makeWheel(side) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.026, 44).rotateZ(Math.PI / 2), M.tire));
    const n = 28, tread = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0272, 0.0042, 0.0068), M.tread, n), d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      d.position.set(0, Math.cos(a) * 0.0402, Math.sin(a) * 0.0402); d.rotation.set(a, 0, 0); d.updateMatrix(); tread.setMatrixAt(i, d.matrix);
    }
    g.add(tread);
    const face = new THREE.Group(); face.position.x = side * 0.0132; g.add(face);
    face.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0305, 0.0305, 0.003, 36).rotateZ(Math.PI / 2), M.rim));
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.0034, 0.058, 0.0052), M.spoke);
      sp.position.x = side * 0.0022; sp.rotation.x = i * Math.PI / 3; face.add(sp);
    }
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.0042, 0.016, 0.0072), M.mark);
    mark.position.set(side * 0.0026, 0.0235, 0); face.add(mark);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.006, 20).rotateZ(Math.PI / 2), M.spoke);
    hub.position.x = side * 0.003; face.add(hub);
    return g;
  }
  const AX = 0.04;       // оста на колелата над земята
  const wheelL = makeWheel(-1), wheelR = makeWheel(1);
  wheelL.position.set(-0.075, AX, 0); wheelR.position.set(0.075, AX, 0);
  robot.add(wheelL, wheelR);

  const tilt = new THREE.Group(); tilt.position.set(0, AX, 0); robot.add(tilt);     // наклоняваме около оста
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(0.108, 0.116, 0.074, 4, 0.012), M.chassis); chassis.position.y = 0.075; tilt.add(chassis);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.05, 0.003, 3, 0.001), M.plate); plate.position.set(0, 0.085, -0.0375); tilt.add(plate);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.004, 0.076), M.mark); strip.position.y = 0.0805 + 0.036; tilt.add(strip);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.032, 24), M.neck); neck.position.y = 0.1485 + 0.002; tilt.add(neck);

  const yawG = new THREE.Group(); yawG.position.y = 0.162; tilt.add(yawG);            // пан
  const pitchG = new THREE.Group(); pitchG.position.y = 0.028; yawG.add(pitchG);       // тилт
  pitchG.add(new THREE.Mesh(new RoundedBoxGeometry(0.096, 0.06, 0.072, 5, 0.016), M.head));
  const visor = new THREE.Mesh(new RoundedBoxGeometry(0.084, 0.046, 0.004, 3, 0.0015), M.visor); visor.position.z = -0.0345; pitchG.add(visor);
  const eyes = new THREE.Group(); pitchG.add(eyes);
  const eyeGeo = new THREE.CircleGeometry(0.0125, 28), eyeMeshes = [];
  const eyeGlowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x45c8ff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * 0.0215, 0.002, -0.0372); eyes.add(e);
    const disc = new THREE.Mesh(eyeGeo, M.eye); e.add(disc);
    const glow = new THREE.Sprite(eyeGlowMat); glow.scale.set(0.05, 0.05, 1); glow.position.z = -0.002; e.add(glow);
    eyeMeshes.push(e);
  }
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.009, 0.004), new THREE.MeshStandardMaterial({ color: 0x0c1118, roughness: 0.2, metalness: 0.7 })); win.position.set(0, 0.0185, -0.0372); pitchG.add(win);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0048, 20), new THREE.MeshBasicMaterial({ color: 0x1b6fa0 })); lens.position.set(0, -0.0165, -0.0366); pitchG.add(lens);
  const sensor = new THREE.Object3D(); sensor.position.set(0, 0.0185, -0.0392); pitchG.add(sensor);     // тук е VL53L5CX

  // VL53L1X отзад на главата: платката на тила, лъчът в рамката на IMU на главата (като облака отпред), но назад
  const rearBoard = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.016, 0.003), M.visor); rearBoard.position.set(0, 0.006, 0.0372); pitchG.add(rearBoard);
  const rearSensor = new THREE.Object3D(); rearSensor.position.set(0, 0.006, 0.0392); pitchG.add(rearSensor);
  const rearMount = new THREE.Group(); scene.add(rearMount);
  const rearGeo = new THREE.ConeGeometry(Math.tan(13.5 * D2R), 1, 16, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);   // връх в 0, основа по +Z
  const rearCone = new THREE.Group(); rearMount.add(rearCone);
  rearCone.add(new THREE.Mesh(rearGeo, new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })));
  rearCone.add(new THREE.Mesh(rearGeo, new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.13, wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const rearDot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), new THREE.MeshBasicMaterial({ color: 0xc9b8ff })); rearMount.add(rearDot);
  const rearGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xa78bfa, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); rearGlow.scale.set(0.12, 0.12, 1); rearDot.add(rearGlow);

  // ── облакът от 8×8 (в рамката на сензора; групата се ориентира по IMU на главата) ──
  const cloud = new THREE.Group(); scene.add(cloud);
  const dirs = new Float32Array(64 * 3);
  let fovCur = 0;
  const pos = new Float32Array(64 * 3), col = new Float32Array(64 * 3), siz = new Float32Array(64);
  const dd = new Float32Array(64).fill(1.2), ss = new Float32Array(64);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1).setUsage(THREE.DynamicDrawUsage));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aColor; attribute float aSize; uniform float uScale; varying vec3 vC; varying float vS;
      void main(){ vC = aColor; vS = aSize; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / max(0.05, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vS;
      void main(){ if (vS < 0.002) discard;
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float core = clamp(1.0 - r, 0.0, 1.0);
        float disc = smoothstep(0.62, 0.5, r);
        float a = clamp(pow(core, 2.0) * 0.85 + disc * 0.55, 0.0, 1.0);
        gl_FragColor = vec4(vC * (0.7 + 0.3 * disc) + vec3(0.16) * pow(core, 6.0), a); }`,
  });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; cloud.add(points);

  // мрежа между съседни точки (повърхност), само когато разликата е малка
  const edges = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const i = r * 8 + c; if (c < 7) edges.push(i, i + 1); if (r < 7) edges.push(i, i + 8); }
  const nE = edges.length / 2;
  const lpos = new Float32Array(nE * 6), lcol = new Float32Array(nE * 6);
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3).setUsage(THREE.DynamicDrawUsage));
  lGeo.setAttribute('aColor', new THREE.BufferAttribute(lcol, 3).setUsage(THREE.DynamicDrawUsage));
  const lMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aColor; varying vec3 vC; void main(){ vC = aColor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 0.6); }',
  });
  const wire = new THREE.LineSegments(lGeo, lMat); wire.frustumCulled = false; cloud.add(wire);

  // зрителното поле: ръбове, правоъгълници на 1 и 2.6 m и бледа пирамида
  const frGeo = new THREE.BufferGeometry(), frFill = new THREE.BufferGeometry();
  const frLines = new THREE.LineSegments(frGeo, new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
  const frMesh = new THREE.Mesh(frFill, new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  frLines.frustumCulled = false; frMesh.frustumCulled = false; cloud.add(frLines, frMesh);
  function buildFrustum(fov) {
    const R = 2.6, t = Math.tan(fov / 2 * D2R), L = [];
    const corner = (z, sx, sy) => [sx * z * t, sy * z * t, -z];
    const cs = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    for (const [sx, sy] of cs) L.push(0, 0, 0, ...corner(R, sx, sy));
    for (const z of [1.0, R]) for (let i = 0; i < 4; i++) { L.push(...corner(z, ...cs[i]), ...corner(z, ...cs[(i + 1) % 4])); }
    frGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(L), 3));
    const T = [];
    for (let i = 0; i < 4; i++) T.push(0, 0, 0, ...corner(R, ...cs[i]), ...corner(R, ...cs[(i + 1) % 4]));
    frFill.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T), 3));
  }
  function buildDirs(fov) {
    const zone = fov / 8;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const i = (r * 8 + c) * 3, az = (c - 3.5) * zone * D2R, el = (3.5 - r) * zone * D2R;
      dirs[i] = Math.sin(az) * Math.cos(el); dirs[i + 1] = Math.sin(el); dirs[i + 2] = -Math.cos(az) * Math.cos(el);
    }
    buildFrustum(fov); fovCur = fov;
  }
  buildDirs(45);

  // ── размер, видимост ──
  let vis = true, W = 0, H = 0;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w < 2 || h < 2 || (w === W && h === H)) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // в тесен (портретен) прозорец вертикалното поле расте, за да остане хоризонталното поне ~52°
    camera.fov = clamp(2 * Math.atan(Math.tan(26 * D2R) / camera.aspect) / D2R, 40, 68);
    camera.updateProjectionMatrix();
    pMat.uniforms.uScale.value = h * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * D2R / 2));
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);
  const io = new IntersectionObserver((en) => { vis = en[0].isIntersecting; }, { threshold: 0 }); io.observe(stage);
  resize();

  // ── кнопки ──
  let follow = true;
  const btnFollow = root.querySelector('[data-a="follow"]'), btnReset = root.querySelector('[data-a="reset"]');
  btnFollow.addEventListener('click', () => { follow = !follow; btnFollow.classList.toggle('on', follow); });
  let curYaw = 0, started = false;
  btnReset.addEventListener('click', () => {
    camera.position.copy(CAM0).applyAxisAngle(UP, follow ? -curYaw * D2R : 0);
    controls.target.copy(TGT0).applyAxisAngle(UP, follow ? -curYaw * D2R : 0);
    controls.update();
  });

  // ── състояние между кадрите ──
  let lastPos = null, wx = 0, wz = 0, blinkT = 3.2, blink = 0;

  return {
    update(ctx) {
      if (!vis) return;
      resize();
      const s = ctx.state, h = s.head, b = s.body, sv = s.servos, dt = ctx.dt, sec = ctx.now * 0.001;
      const pan = sv.pan.deg, yaw = h.heading - pan;     // курс на тялото

      // камерата следва завъртането на робота (по желание)
      if (!started) {
        started = true; curYaw = yaw;
        camera.position.applyAxisAngle(UP, -yaw * D2R); controls.target.applyAxisAngle(UP, -yaw * D2R);
      }
      const dy = wrap180(yaw - curYaw); curYaw = yaw;
      if (follow && dy !== 0) {
        camera.position.applyAxisAngle(UP, -dy * D2R); controls.target.applyAxisAngle(UP, -dy * D2R);
      }
      robot.rotation.y = -yaw * D2R;

      // изминатият път плъзга мрежата под робота
      if (lastPos !== null) {
        const dp = (b.pos_mm - lastPos) / 1000;
        if (Math.abs(dp) < 2) { wx += dp * Math.sin(yaw * D2R); wz -= dp * Math.cos(yaw * D2R); }
      }
      lastPos = b.pos_mm;
      gridFine.position.x = -(wx - Math.floor(wx / 0.25) * 0.25); gridFine.position.z = -(wz - Math.floor(wz / 0.25) * 0.25);
      gridMajor.position.x = -(wx - Math.floor(wx / 1) * 1); gridMajor.position.z = -(wz - Math.floor(wz / 1) * 1);

      // колела, тяло, глава
      wheelL.rotation.x = -((b.wheel_l_deg % 360) * D2R);
      wheelR.rotation.x = -((b.wheel_r_deg % 360) * D2R);
      tilt.rotation.set(BODY_PITCH_SIGN * b.pitch * D2R, 0, -b.roll * D2R);
      yawG.rotation.y = -pan * D2R;
      pitchG.rotation.x = sv.tilt.deg * D2R;

      // очите мигат
      blinkT -= dt;
      if (blinkT < 0) { blink = 0.14; blinkT = 2.8 + ((sec * 7.3) % 3); }
      let sy = 1;
      if (blink > 0) { blink -= dt; sy = Math.min(1, Math.max(0.08, Math.abs(blink - 0.07) / 0.07)); }
      eyeMeshes[0].scale.y = eyeMeshes[1].scale.y = sy;

      // облакът: ориентация по IMU на главата, начало — в сензора
      robot.updateMatrixWorld(true);
      sensor.getWorldPosition(cloud.position);
      _e.set(h.pitch * D2R, -h.heading * D2R, -h.roll * D2R, 'YXZ');
      cloud.quaternion.setFromEuler(_e);

      // задният лъч: от тила на главата назад (+Z в същата рамка), върти се с главата
      rearSensor.getWorldPosition(rearMount.position);
      rearMount.quaternion.copy(cloud.quaternion);
      const rr = s.rear;
      if (rr.ok && rr.mm != null && rr.mm > 0 && !s.izk.zad) {
        const d = rr.mm / 1000;
        rearCone.visible = rearDot.visible = true;
        rearCone.scale.set(d, d, d); rearDot.position.set(0, 0, d);
      } else { rearCone.visible = rearDot.visible = false; }
      floorGlow.rotation.y = -yaw * D2R;

      const tof = s.tof;
      const tofOn = !!tof.ok && !s.izk.tof;      // изключен с ключето: облакът го няма
      cloud.visible = tofOn;
      if (tofOn) {
        if (tof.fov_deg !== fovCur && tof.fov_deg > 5) buildDirs(tof.fov_deg);
        const kd = 1 - Math.exp(-dt / 0.05), ks = 1 - Math.exp(-dt / 0.09);
        for (let i = 0; i < 64; i++) {
          const mm = tof.mm[i], ok = tof.valid[i] && mm >= 0;
          if (ok) {
            const tg = mm / 1000;
            if (ss[i] < 0.05) dd[i] = tg; else dd[i] += (tg - dd[i]) * kd;
            ss[i] += (1 - ss[i]) * ks;
          } else ss[i] += (0 - ss[i]) * ks;
          if (ss[i] < 0.01) ss[i] = 0;
          const d = dd[i], j = i * 3;
          pos[j] = dirs[j] * d; pos[j + 1] = dirs[j + 1] * d; pos[j + 2] = dirs[j + 2] * d;
          distRGB(d * 1000, col, j);
          siz[i] = ss[i] * clamp(d * 0.052, 0.014, 0.085);
        }
        pGeo.attributes.position.needsUpdate = true; pGeo.attributes.aColor.needsUpdate = true; pGeo.attributes.aSize.needsUpdate = true;
        for (let e = 0; e < nE; e++) {
          const a = edges[e * 2], c = edges[e * 2 + 1], o = e * 6;
          const conn = ss[a] > 0.5 && ss[c] > 0.5 && Math.abs(dd[a] - dd[c]) < 0.16;
          for (let k = 0; k < 3; k++) {
            lpos[o + k] = pos[a * 3 + k]; lpos[o + 3 + k] = pos[c * 3 + k];
            lcol[o + k] = conn ? col[a * 3 + k] * 0.42 : 0; lcol[o + 3 + k] = conn ? col[c * 3 + k] * 0.42 : 0;
          }
        }
        lGeo.attributes.position.needsUpdate = true; lGeo.attributes.aColor.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    },
    // махната плочка: спира наблюдателите и освобождава WebGL (геометрии, материали, текстури, контекста)
    destroy() {
      ro.disconnect(); io.disconnect(); controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); }
      });
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
