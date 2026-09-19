import { GLTFExporter } from './vendor/three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from './vendor/three/examples/jsm/exporters/OBJExporter.js';

function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function exportGlb(scene, name = 'pixel-model') {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(scene, (result) => { download(`${name}.glb`, result, 'model/gltf-binary'); resolve(); }, (error) => reject(error), { binary: true, trs: false, onlyVisible: true });
  });
}

export function exportObj(scene, name = 'pixel-model') {
  const output = new OBJExporter().parse(scene);
  download(`${name}.obj`, output, 'text/plain');
}
