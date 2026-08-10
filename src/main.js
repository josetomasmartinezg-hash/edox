import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  LEVELS,
  floorElevation,
  roofElevation,
  wallHeightsAt,
} from "./levels.js";

const WALL_COLOR = 0xf2ebe0;
const WALL_EDGE = 0x2a3328;
const SLAB_COLOR = 0xc4b8a5;
const RAMP_COLOR = 0xb9a890;
const CENTER_SLAB = 0xd2c4b0;
const COLUMN_COLOR = 0x1f261d;
const GLASS_COLOR = 0x8eb0b8;
const GROUND_COLOR = 0xb7c2ad;

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd5dccf, 45, 95);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(16, 14, 24);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 6;
controls.maxDistance = 70;
controls.target.set(-2, 2.2, 2);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const hemi = new THREE.HemisphereLight(0xf5f0e6, 0x6f7d68, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
sun.position.set(12, 22, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 70;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(52, 64),
  new THREE.MeshStandardMaterial({
    color: GROUND_COLOR,
    roughness: 1,
    metalness: 0,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

const building = new THREE.Group();
scene.add(building);

const planGroup = new THREE.Group();
building.add(planGroup);
const glassGroup = new THREE.Group();
building.add(glassGroup);
const roofGroup = new THREE.Group();
roofGroup.visible = false;
building.add(roofGroup);
const levelsGroup = new THREE.Group();
building.add(levelsGroup);

/** Muro trapezoidal: bases y coronas distintas en cada extremo (sigue la subida). */
function wallMeshSloped(a, b, thickness, y0a, y1a, y0b, y1b, material) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return null;

  const ux = dx / length;
  const uz = dz / length;
  const px = -uz;
  const pz = ux;
  const ht = thickness / 2;

  const corners = [
    [a[0] + px * ht, y0a, a[1] + pz * ht],
    [a[0] - px * ht, y0a, a[1] - pz * ht],
    [b[0] - px * ht, y0b, b[1] - pz * ht],
    [b[0] + px * ht, y0b, b[1] + pz * ht],
    [a[0] + px * ht, y1a, a[1] + pz * ht],
    [a[0] - px * ht, y1a, a[1] - pz * ht],
    [b[0] - px * ht, y1b, b[1] - pz * ht],
    [b[0] + px * ht, y1b, b[1] + pz * ht],
  ];

  const positions = new Float32Array(corners.flat());
  const indices = [
    0, 1, 2, 0, 2, 3, // bottom
    4, 6, 5, 4, 7, 6, // top
    0, 3, 7, 0, 7, 4, // side +
    1, 5, 6, 1, 6, 2, // side -
    0, 4, 5, 0, 5, 1, // end a
    3, 2, 6, 3, 6, 7, // end b
  ];

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addEdgesFromGeometry(mesh, color = WALL_EDGE) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 30);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.32 }),
  );
  return line;
}

/** Rampa / losa izquierda en subida hacia el centro. */
function buildRampDeck(material) {
  const { leftX, rampEndX, wingZMin, wingZMax } = LEVELS;
  const segsX = 24;
  const segsZ = 8;
  const geom = new THREE.PlaneGeometry(
    rampEndX - leftX,
    wingZMax - wingZMin,
    segsX,
    segsZ,
  );
  geom.rotateX(-Math.PI / 2);
  const pos = geom.attributes.position;
  const ox = (leftX + rampEndX) / 2;
  const oz = (wingZMin + wingZMax) / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox;
    const z = pos.getZ(i) + oz;
    pos.setXYZ(i, x, floorElevation(x, z) + 0.02, z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Plataforma elevada del centro. */
function buildCenterPlinth(material) {
  const { rampEndX, centerEndX, floorCenter, wingZMin, wingZMax } = LEVELS;
  const w = centerEndX - rampEndX + 1.2;
  const d = wingZMax - wingZMin;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, floorCenter, d * 0.72),
    material,
  );
  mesh.position.set(
    (rampEndX + centerEndX) / 2,
    floorCenter / 2,
    (wingZMin + wingZMax) / 2 - 1.2,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Cubierta que sigue la subida (izquierda baja → centro 4 m). */
function buildSlopedRoof(material) {
  const { leftX, centerEndX, wingZMin, wingZMax } = LEVELS;
  const segsX = 32;
  const segsZ = 10;
  const geom = new THREE.PlaneGeometry(
    centerEndX - leftX + 2,
    wingZMax - wingZMin,
    segsX,
    segsZ,
  );
  geom.rotateX(-Math.PI / 2);
  const pos = geom.attributes.position;
  const ox = (leftX + centerEndX) / 2;
  const oz = (wingZMin + wingZMax) / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox;
    const z = pos.getZ(i) + oz;
    pos.setXYZ(i, x, roofElevation(x, z) + 0.06, z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Marcadores de cota para leer la subida. */
function buildHeightMarkers() {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({
    color: 0xa65d3f,
    transparent: true,
    opacity: 0.85,
  });
  const samples = [
    { x: -14.5, label: "0 → 2.2 m" },
    { x: -8, label: "subida" },
    { x: -1, label: "centro 4 m" },
  ];
  for (const s of samples) {
    const z = 8.4;
    const y0 = floorElevation(s.x, z);
    const y1 = roofElevation(s.x, z);
    const pts = [
      new THREE.Vector3(s.x, y0, z),
      new THREE.Vector3(s.x, y1, z),
    ];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      mat,
    );
    group.add(line);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xa65d3f }),
    );
    cap.position.set(s.x, y1, z);
    group.add(cap);
  }
  return group;
}

async function loadModel() {
  const [geoRes, texMetaRes] = await Promise.all([
    fetch("/plan_geometry.json"),
    fetch("/plan_texture_meta.json"),
  ]);
  const geometry = await geoRes.json();
  const texMeta = await texMetaRes.json();
  const slabT = geometry.meta.slab_thickness_m ?? 0.2;

  const wallMat = new THREE.MeshStandardMaterial({
    color: WALL_COLOR,
    roughness: 0.82,
    metalness: 0.02,
  });
  const slabMat = new THREE.MeshStandardMaterial({
    color: SLAB_COLOR,
    roughness: 0.9,
    metalness: 0,
  });
  const rampMat = new THREE.MeshStandardMaterial({
    color: RAMP_COLOR,
    roughness: 0.92,
    metalness: 0,
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: CENTER_SLAB,
    roughness: 0.85,
    metalness: 0,
  });
  const colMat = new THREE.MeshStandardMaterial({
    color: COLUMN_COLOR,
    roughness: 0.55,
    metalness: 0.1,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: GLASS_COLOR,
    roughness: 0.05,
    metalness: 0.05,
    transmission: 0.85,
    thickness: 0.04,
    transparent: true,
    opacity: 0.55,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x5c6658,
    roughness: 0.75,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const bounds = geometry.meta.bounds_m;

  // Losa base general (cota baja)
  const slabW = bounds.max_x - bounds.min_x + 1.2;
  const slabD = bounds.max_y - bounds.min_y + 1.2;
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(slabW, slabT, slabD),
    slabMat,
  );
  slab.position.set(
    (bounds.min_x + bounds.max_x) / 2,
    -slabT / 2,
    (bounds.min_y + bounds.max_y) / 2,
  );
  slab.receiveShadow = true;
  slab.castShadow = true;
  building.add(slab);

  // Rampa izquierda + plinto central elevado
  levelsGroup.add(buildRampDeck(rampMat));
  levelsGroup.add(buildCenterPlinth(centerMat));
  levelsGroup.add(buildHeightMarkers());

  const loader = new THREE.TextureLoader();
  const planTex = await loader.loadAsync("/plan_floor.png");
  planTex.colorSpace = THREE.SRGBColorSpace;
  planTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Plano de referencia: sigue la subida del piso
  const planGeom = new THREE.PlaneGeometry(
    texMeta.world_width,
    texMeta.world_depth,
    48,
    32,
  );
  planGeom.rotateX(-Math.PI / 2);
  const planPos = planGeom.attributes.position;
  for (let i = 0; i < planPos.count; i++) {
    const x = planPos.getX(i);
    const z = planPos.getZ(i);
    planPos.setY(i, floorElevation(x, z) + 0.03);
  }
  planPos.needsUpdate = true;
  planGeom.computeVertexNormals();
  const plan = new THREE.Mesh(
    planGeom,
    new THREE.MeshBasicMaterial({
      map: planTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
  );
  planGroup.add(plan);

  for (const wall of geometry.walls) {
    const { y0a, y0b, y1a, y1b } = wallHeightsAt(wall.a, wall.b);
    const mesh = wallMeshSloped(
      wall.a,
      wall.b,
      wall.thickness,
      y0a,
      y1a,
      y0b,
      y1b,
      wallMat,
    );
    if (!mesh) continue;
    building.add(mesh);
    building.add(addEdgesFromGeometry(mesh));
  }

  for (const g of geometry.glass ?? []) {
    const { y0a, y0b, y1a, y1b } = wallHeightsAt(g.a, g.b);
    // Cristal un poco más bajo que el muro
    const inset = 0.12;
    const mesh = wallMeshSloped(
      g.a,
      g.b,
      0.06,
      y0a + inset,
      y1a - inset,
      y0b + inset,
      y1b - inset,
      glassMat,
    );
    if (!mesh) continue;
    glassGroup.add(mesh);
  }

  for (const [x, z, size] of geometry.columns ?? []) {
    const s = Math.max(size, 0.18);
    const y0 = floorElevation(x, z);
    const y1 = roofElevation(x, z);
    const h = Math.max(0.2, y1 - y0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s, h, s), colMat);
    mesh.position.set(x, y0 + h / 2, z);
    mesh.castShadow = true;
    building.add(mesh);
  }

  roofGroup.add(buildSlopedRoof(roofMat));

  // Cámara: mira la subida izquierda → centro
  const start = performance.now();
  const from = new THREE.Vector3(8, 18, 28);
  const to = new THREE.Vector3(-6, 10, 18);
  camera.position.copy(from);

  function intro(now) {
    const t = Math.min(1, (now - start) / 2000);
    const e = 1 - (1 - t) ** 3;
    camera.position.lerpVectors(from, to, e);
    controls.target.set(-3 * e, 1.5 + 1.2 * e, 2);
    if (t < 1) requestAnimationFrame(intro);
  }
  requestAnimationFrame(intro);

  const sunBase = sun.position.clone();
  function pulseLight(t) {
    sun.position.x = sunBase.x + Math.sin(t * 0.00025) * 2.5;
    sun.position.z = sunBase.z + Math.cos(t * 0.0002) * 2;
  }
  return pulseLight;
}

let pulseLight = () => {};
loadModel()
  .then((fn) => {
    pulseLight = fn;
  })
  .catch((err) => {
    console.error(err);
  });

document.getElementById("toggle-plan").addEventListener("change", (e) => {
  planGroup.visible = e.target.checked;
});
document.getElementById("toggle-glass").addEventListener("change", (e) => {
  glassGroup.visible = e.target.checked;
});
document.getElementById("toggle-roof").addEventListener("change", (e) => {
  roofGroup.visible = e.target.checked;
});
document.getElementById("toggle-levels")?.addEventListener("change", (e) => {
  levelsGroup.visible = e.target.checked;
});
document.getElementById("btn-reset").addEventListener("click", () => {
  camera.position.set(-6, 10, 18);
  controls.target.set(-3, 2.7, 2);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function frame(t) {
  controls.update();
  pulseLight(t);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
