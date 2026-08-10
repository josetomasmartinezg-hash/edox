import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const WALL_COLOR = 0xf2ebe0;
const WALL_EDGE = 0x2a3328;
const SLAB_COLOR = 0xc4b8a5;
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
scene.fog = new THREE.Fog(0xd5dccf, 40, 90);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(18, 16, 22);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 6;
controls.maxDistance = 60;
controls.target.set(0, 1.2, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const hemi = new THREE.HemisphereLight(0xf5f0e6, 0x6f7d68, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
sun.position.set(12, 22, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(48, 64),
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

function wallMesh(a, b, thickness, height, material) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return null;

  const geom = new THREE.BoxGeometry(length, height, thickness);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set((a[0] + b[0]) / 2, height / 2, (a[1] + b[1]) / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addEdges(mesh, color = WALL_EDGE) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 20);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }),
  );
  line.position.copy(mesh.position);
  line.rotation.copy(mesh.rotation);
  return line;
}

async function loadModel() {
  const [geoRes, texMetaRes] = await Promise.all([
    fetch("/plan_geometry.json"),
    fetch("/plan_texture_meta.json"),
  ]);
  const geometry = await geoRes.json();
  const texMeta = await texMetaRes.json();
  const height = geometry.meta.wall_height_m ?? 2.7;
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

  const loader = new THREE.TextureLoader();
  const planTex = await loader.loadAsync("/plan_floor.png");
  planTex.colorSpace = THREE.SRGBColorSpace;
  planTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const plan = new THREE.Mesh(
    new THREE.PlaneGeometry(texMeta.world_width, texMeta.world_depth),
    new THREE.MeshBasicMaterial({
      map: planTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
  );
  plan.rotation.x = -Math.PI / 2;
  plan.position.y = 0.01;
  planGroup.add(plan);

  for (const wall of geometry.walls) {
    const mesh = wallMesh(wall.a, wall.b, wall.thickness, height, wallMat);
    if (!mesh) continue;
    building.add(mesh);
    building.add(addEdges(mesh));
  }

  for (const g of geometry.glass ?? []) {
    const mesh = wallMesh(g.a, g.b, 0.06, height * 0.92, glassMat);
    if (!mesh) continue;
    mesh.position.y = height * 0.46;
    glassGroup.add(mesh);
  }

  const colH = height;
  for (const [x, z, size] of geometry.columns ?? []) {
    const s = Math.max(size, 0.18);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(s, colH, s),
      colMat,
    );
    mesh.position.set(x, colH / 2, z);
    mesh.castShadow = true;
    building.add(mesh);
  }

  // Simple flat roof footprint from bounds (toggle)
  const roof = new THREE.Mesh(
    new THREE.PlaneGeometry(slabW + 0.4, slabD + 0.4),
    roofMat,
  );
  roof.rotation.x = -Math.PI / 2;
  roof.position.set(
    (bounds.min_x + bounds.max_x) / 2,
    height + 0.05,
    (bounds.min_y + bounds.max_y) / 2,
  );
  roof.receiveShadow = true;
  roofGroup.add(roof);

  // Soft intro motion: ease camera in
  const start = performance.now();
  const from = new THREE.Vector3(28, 24, 30);
  const to = camera.position.clone();
  camera.position.copy(from);

  function intro(now) {
    const t = Math.min(1, (now - start) / 1800);
    const e = 1 - (1 - t) ** 3;
    camera.position.lerpVectors(from, to, e);
    controls.target.set(0, 1.2 * e, 0);
    if (t < 1) requestAnimationFrame(intro);
  }
  requestAnimationFrame(intro);

  // Gentle ambient sway of light
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
document.getElementById("btn-reset").addEventListener("click", () => {
  camera.position.set(18, 16, 22);
  controls.target.set(0, 1.2, 0);
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
