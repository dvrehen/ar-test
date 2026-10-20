import * as THREE from "three";

const canvas = document.querySelector("#scene");
const imageInput = document.querySelector("#target-image");
const fileName = document.querySelector("#file-name");
const widthInput = document.querySelector("#target-width");
const launchButton = document.querySelector("#launch");
const launchLabel = document.querySelector("#launch-label");
const message = document.querySelector("#message");
const pulseButton = document.querySelector("#pulse");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
camera.position.set(0, 0.95, 2.7);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");

scene.add(new THREE.HemisphereLight(0xe2edff, 0x29313d, 2.2));
const keyLight = new THREE.DirectionalLight(0xd0ff71, 3.4);
keyLight.position.set(-2, 3, 4);
scene.add(keyLight);
const fillLight = new THREE.PointLight(0x9a8cff, 18, 8);
fillLight.position.set(2, -1, 2);
scene.add(fillLight);

const previewRoot = new THREE.Group();
scene.add(previewRoot);

const imageSurface = new THREE.Mesh(
  new THREE.PlaneGeometry(0.72, 0.48),
  new THREE.MeshBasicMaterial({ color: 0x252e3c, side: THREE.DoubleSide }),
);
imageSurface.position.z = -0.025;
previewRoot.add(imageSurface);

const projectionRoot = new THREE.Group();
previewRoot.add(projectionRoot);

const objectMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xd0ff71,
  metalness: 0.42,
  roughness: 0.2,
  clearcoat: 0.8,
  emissive: 0x31451c,
  emissiveIntensity: 0.4,
});
const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), objectMaterial);
crystal.position.z = 0.24;
projectionRoot.add(crystal);

const halo = new THREE.Mesh(
  new THREE.TorusGeometry(0.27, 0.008, 10, 100),
  new THREE.MeshStandardMaterial({
    color: 0xe1edff,
    emissive: 0x8a9cb2,
    emissiveIntensity: 0.55,
    metalness: 0.65,
    roughness: 0.25,
  }),
);
halo.position.z = 0.23;
halo.rotation.x = 0.92;
projectionRoot.add(halo);

const satellites = [];
for (let index = 0; index < 4; index += 1) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(index % 2 === 0 ? 0.045 : 0.032, 0),
    new THREE.MeshStandardMaterial({
      color: index % 2 === 0 ? 0xeee7d5 : 0x9b90ff,
      metalness: 0.5,
      roughness: 0.24,
    }),
  );
  projectionRoot.add(mesh);
  satellites.push(mesh);
}

const burst = new THREE.Group();
projectionRoot.add(burst);
for (let index = 0; index < 12; index += 1) {
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 8),
    new THREE.MeshBasicMaterial({ color: index % 2 ? 0xd0ff71 : 0xffffff }),
  );
  const angle = (index / 12) * Math.PI * 2;
  particle.userData.direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.25);
  burst.add(particle);
}

let targetBitmap = null;
let trackingMessage = "";
let lastTrackingMessage = "";
let burstStartedAt = -Infinity;
let imageAnchor = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(canvas);
resize();

function setMessage(text) {
  message.textContent = text;
}

async function loadTargetImage(blob, name) {
  const bitmap = await createImageBitmap(blob);
  const texture = new THREE.Texture(bitmap);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  targetBitmap?.close();
  targetBitmap = bitmap;
  const aspect = bitmap.width / bitmap.height;
  imageSurface.geometry.dispose();
  imageSurface.geometry = new THREE.PlaneGeometry(0.72, 0.72 / aspect);
  imageSurface.material.map?.dispose();
  imageSurface.material.map = texture;
  imageSurface.material.color.set(0xffffff);
  imageSurface.material.needsUpdate = true;
  fileName.textContent = name;

  if (navigator.xr && await navigator.xr.isSessionSupported("immersive-ar")) {
    launchButton.disabled = false;
    launchLabel.textContent = "View in your space";
    setMessage("Wrapper image ready. Start AR, then slowly move your camera over the printed image.");
  } else {
    launchButton.disabled = true;
    launchLabel.textContent = "AR is not available in this browser";
    setMessage("The image is ready, but immersive AR with image tracking needs a compatible WebXR browser and device.");
  }
}

function setTrackingMessage(text) {
  trackingMessage = text;
  if (trackingMessage !== lastTrackingMessage) {
    setMessage(trackingMessage);
    lastTrackingMessage = trackingMessage;
  }
}

function triggerBurst() {
  burstStartedAt = performance.now();
}

function updateBurst(now) {
  const elapsed = (now - burstStartedAt) / 1000;
  const active = elapsed >= 0 && elapsed < 1.1;
  burst.visible = active;
  if (!active) return;

  const progress = elapsed / 1.1;
  for (const particle of burst.children) {
    const direction = particle.userData.direction;
    particle.position.copy(direction).multiplyScalar(progress * 0.52);
    particle.scale.setScalar(1 - progress * 0.65);
  }
}

function updateScene(now) {
  const time = now / 1000;
  crystal.rotation.x = time * 0.34;
  crystal.rotation.y = time * 0.58;
  crystal.position.z = 0.24 + Math.sin(time * 1.6) * 0.035;
  halo.rotation.z = time * 0.34;
  halo.rotation.x = 0.92 + Math.sin(time * 0.7) * 0.08;
  satellites.forEach((satellite, index) => {
    const angle = time * (0.48 + index * 0.06) + (index / satellites.length) * Math.PI * 2;
    satellite.position.set(Math.cos(angle) * 0.36, Math.sin(angle) * 0.2, 0.2 + Math.sin(angle * 1.4) * 0.04);
    satellite.rotation.set(time * 0.5, time * 0.8, time * 0.4);
  });
  updateBurst(now);
}

function updateImageTracking(frame) {
  if (!imageAnchor || !frame) return;

  const referenceSpace = renderer.xr.getReferenceSpace();
  if (!referenceSpace) return;

  const result = frame.getImageTrackingResults().find((entry) => entry.index === 0);
  if (!result) {
    imageAnchor.visible = false;
    setTrackingMessage("Move the camera slowly over the wrapper image.");
    return;
  }

  const pose = frame.getPose(result.imageSpace, referenceSpace);
  if (!pose) {
    imageAnchor.visible = false;
    return;
  }

  imageAnchor.visible = true;
  imageAnchor.matrix.fromArray(pose.transform.matrix);
  setTrackingMessage(result.trackingState === "tracked"
    ? "Wrapper image tracked. Tap the scene for a surprise."
    : "Wrapper image is visible; move closer for stable tracking.");
}

renderer.setAnimationLoop((now, frame) => {
  updateScene(now);
  if (renderer.xr.isPresenting) updateImageTracking(frame);
  renderer.render(scene, camera);
});

canvas.addEventListener("pointerdown", (event) => {
  if (renderer.xr.isPresenting) return;
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObjects(projectionRoot.children, true).length) triggerBurst();
});

pulseButton.addEventListener("click", triggerBurst);
renderer.xr.addEventListener("sessionstart", () => {
  lastTrackingMessage = "";
  previewRoot.visible = false;
  imageAnchor = new THREE.Group();
  imageAnchor.matrixAutoUpdate = false;
  imageAnchor.add(projectionRoot);
  scene.add(imageAnchor);
});
renderer.xr.addEventListener("sessionend", () => {
  if (imageAnchor) {
    scene.remove(imageAnchor);
    imageAnchor = null;
  }
  previewRoot.add(projectionRoot);
  projectionRoot.scale.setScalar(1);
  previewRoot.visible = true;
  lastTrackingMessage = "";
  setMessage("AR session ended. You can scan the wrapper image again.");
});

imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setMessage("Please choose a valid image file.");
    return;
  }

  try {
    await loadTargetImage(file, file.name);
  } catch (error) {
    setMessage(`Could not load that image: ${error.message}`);
  }
});

async function loadIncludedImage() {
  try {
    const response = await fetch("./20261020_152511.jpg");
    if (!response.ok) throw new Error(`Image request failed (${response.status})`);
    await loadTargetImage(await response.blob(), "20261020_152511.jpg · included");
  } catch (error) {
    launchButton.disabled = true;
    launchLabel.textContent = "Choose an image to begin";
    fileName.textContent = "Choose the wrapper image";
    setMessage(`Could not load the included wrapper image: ${error.message}. You can select an image above.`);
  }
}

loadIncludedImage();

launchButton.addEventListener("click", async () => {
  if (!targetBitmap) {
    setMessage("Wait for the wrapper image to load or select an image before starting AR.");
    return;
  }
  if (!widthInput.reportValidity()) return;

  launchButton.disabled = true;
  setMessage("Starting your AR session…");

  try {
    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["local", "image-tracking"],
      trackedImages: [{ image: targetBitmap, widthInMeters: Number(widthInput.value) / 100 }],
    });
    projectionRoot.scale.setScalar(Number(widthInput.value) / 72);
    await renderer.xr.setSession(session);
    session.addEventListener("select", triggerBurst);
  } catch (error) {
    setMessage(`Could not start AR: ${error.message}. Try a compatible Android browser and a clear wrapper image.`);
  } finally {
    launchButton.disabled = false;
  }
});

window.addEventListener("pagehide", () => {
  resizeObserver.disconnect();
  targetBitmap?.close();
});
