import * as THREE from "three";
import { floorElevation } from "./levels.js";

/**
 * Navegación interactiva del modelo:
 * - orbit: arrastrar / pinch / zoom (OrbitControls existentes)
 * - walk: recorrer el plano a pie (WASD + mirar con el mouse)
 */
export function createNavigator({ camera, controls, canvas, hintEl }) {
  const keys = new Set();
  const lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const velocity = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const eyeHeight = 1.65;
  let mode = "orbit";
  let draggingLook = false;
  let lastX = 0;
  let lastY = 0;
  let autoOrbit = true;
  let userInteracted = false;
  let lastFrame = performance.now();

  function setHint() {
    if (!hintEl) return;
    if (mode === "walk") {
      hintEl.textContent =
        "Recorrer: WASD mover · arrastra para mirar · Espacio/Shift subir-bajar · Esc orbitar";
    } else if (autoOrbit && !userInteracted) {
      hintEl.textContent =
        "El modelo gira solo — arrastra para tomarlo · scroll zoom · modo Recorrer abajo";
    } else {
      hintEl.textContent =
        "Arrastra para girar · scroll zoom · clic derecho pan · o entra a Recorrer";
    }
  }

  function enterOrbit() {
    mode = "orbit";
    controls.enabled = true;
    canvas.style.cursor = "grab";
    document.body.classList.remove("mode-walk");
    document.body.classList.add("mode-orbit");
    setHint();
  }

  function enterWalk() {
    mode = "walk";
    controls.enabled = false;
    autoOrbit = false;
    userInteracted = true;
    // Partir desde una posición a pie en la rampa
    camera.position.set(-12, floorElevation(-12, 3) + eyeHeight, 3);
    lookEuler.set(0, Math.PI * 0.15, 0);
    camera.quaternion.setFromEuler(lookEuler);
    canvas.style.cursor = "crosshair";
    document.body.classList.remove("mode-orbit");
    document.body.classList.add("mode-walk");
    setHint();
  }

  function markInteracted() {
    if (!userInteracted) {
      userInteracted = true;
      autoOrbit = false;
      controls.autoRotate = false;
      setHint();
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    markInteracted();
    if (mode === "orbit") {
      canvas.style.cursor = "grabbing";
    } else if (mode === "walk" && e.button === 0) {
      draggingLook = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  window.addEventListener("pointerup", () => {
    draggingLook = false;
    if (mode === "orbit") canvas.style.cursor = "grab";
  });
  window.addEventListener("pointermove", (e) => {
    if (mode !== "walk" || !draggingLook) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    lookEuler.y -= dx * 0.0045;
    lookEuler.x -= dy * 0.0035;
    lookEuler.x = Math.max(-1.2, Math.min(1.2, lookEuler.x));
    camera.quaternion.setFromEuler(lookEuler);
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift"].includes(k)) {
      keys.add(k);
      if (mode === "walk") e.preventDefault();
    }
    if (k === "escape" && mode === "walk") {
      enterOrbit();
      document.getElementById("mode-orbit")?.click();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
  });

  controls.addEventListener("start", markInteracted);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;
  canvas.style.cursor = "grab";
  document.body.classList.add("mode-orbit");
  setHint();

  // Tras el intro, mantener auto-órbita hasta que el usuario toque
  setTimeout(() => {
    if (!userInteracted) {
      controls.autoRotate = true;
      setHint();
    }
  }, 2200);

  function update() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    if (mode === "orbit") {
      controls.autoRotate = autoOrbit && !userInteracted;
      controls.update();
      return;
    }

    // Walk
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() > 0.0001) forward.normalize();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    if (right.lengthSq() > 0.0001) right.normalize();

    velocity.set(0, 0, 0);
    const speed = keys.has("shift") ? 7.5 : 3.8;
    if (keys.has("w") || keys.has("arrowup")) velocity.add(forward);
    if (keys.has("s") || keys.has("arrowdown")) velocity.sub(forward);
    if (keys.has("a") || keys.has("arrowleft")) velocity.sub(right);
    if (keys.has("d") || keys.has("arrowright")) velocity.add(right);
    if (keys.has(" ")) velocity.y += 1;

    if (velocity.lengthSq() > 0) {
      velocity.normalize().multiplyScalar(speed * dt);
      camera.position.add(velocity);
    }

    // Pegar la cámara al piso en subida (salvo si flota con espacio)
    if (!keys.has(" ")) {
      const ground = floorElevation(camera.position.x, camera.position.z);
      const targetY = ground + eyeHeight;
      camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 8);
    }

    // Límites suaves del solar
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -20, 18);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -14, 14);
  }

  return {
    update,
    enterOrbit,
    enterWalk,
    get mode() {
      return mode;
    },
    setAutoOrbit(v) {
      autoOrbit = v;
      if (!v) markInteracted();
      setHint();
    },
  };
}
