import * as THREE from './vendor/three/three.module.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { buildModelGeometry } from './model.js';

export class ModelRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#202328');
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    this.camera.position.set(16, 14, 18);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.minDistance = 2; this.controls.maxDistance = 180;
    this.scene.add(new THREE.HemisphereLight(0xe8edf5, 0x31343a, 2.2));
    const key = new THREE.DirectionalLight(0xfff3d4, 3.3); key.position.set(7, 16, 9); key.castShadow = true; this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x95b9ff, 1.1); fill.position.set(-8, 5, -12); this.scene.add(fill);
    this.grid = new THREE.GridHelper(30, 30, 0x4a5059, 0x30353c); this.grid.position.y = -0.01; this.scene.add(this.grid);
    this.modelRoot = new THREE.Group(); this.scene.add(this.modelRoot);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas.parentElement);
    this.resize(); this.animate();
  }
  resize() { const rect = this.canvas.parentElement.getBoundingClientRect(); const width = Math.max(1, rect.width); const height = Math.max(1, rect.height); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); }
  resetView() { this.camera.position.set(16, 14, 18); this.controls.target.set(0, 3, 0); this.controls.update(); }
  update(document, options) {
    while (this.modelRoot.children.length) { const child = this.modelRoot.children.pop(); child.geometry?.dispose(); child.material?.dispose(); }
    const data = buildModelGeometry(document, options); const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 4)); geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05, side: THREE.DoubleSide, transparent: true });
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; this.modelRoot.add(mesh);
    this.grid.scale.setScalar(Math.max(document.width, document.height, 16) / 16); this.grid.position.y = options.base ? -Number(options.baseThickness || 1) : -0.01;
    if (data.activePixels && this.controls.target.length() === 0) this.resetView();
    return data;
  }
  animate() { requestAnimationFrame(() => this.animate()); this.controls.update(); this.renderer.render(this.scene, this.camera); }
}
