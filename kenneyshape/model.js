export const MAX_HEIGHT = 16;
export const TRANSPARENT = [0, 0, 0, 0, 0];

export function blankPixels(width, height) {
  return Array.from({ length: width * height }, () => [...TRANSPARENT]);
}

export function clampHeight(value) {
  return Math.max(0, Math.min(MAX_HEIGHT, Math.round(Number(value) || 0)));
}

export function normalizePixel(pixel, legacyDefault = true) {
  const values = Array.isArray(pixel) ? pixel : [];
  const rgba = [0, 1, 2, 3].map((index) => Math.max(0, Math.min(255, Number(values[index]) || 0)));
  const legacyHeight = rgba[3] > 0 && legacyDefault ? 1 : 0;
  return [...rgba, clampHeight(values.length >= 5 ? values[4] : legacyHeight)];
}

export function normalizeDocument(data) {
  if (!data || !Number.isInteger(data.width) || !Number.isInteger(data.height) || !Array.isArray(data.pixels)) throw new Error('不是有效的 Pixel Foundry 文件');
  const width = Math.max(1, Math.min(128, data.width));
  const height = Math.max(1, Math.min(128, data.height));
  if (data.pixels.length !== width * height) throw new Error('像素数量与尺寸不匹配');
  return { width, height, pixels: data.pixels.map((pixel) => normalizePixel(pixel)) };
}

export function snapshotDocument(document) {
  return { width: document.width, height: document.height, pixels: document.pixels.map((pixel) => [...normalizePixel(pixel, false)]) };
}

function rgba(pixel) {
  return [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255, pixel[3] / 255];
}

function shade(pixel, amount = 0.72) {
  const color = rgba(pixel);
  return [color[0] * amount, color[1] * amount, color[2] * amount, color[3]];
}

export function buildModelGeometry(document, options = {}) {
  const pixelSize = Math.max(0.1, Number(options.pixelSize) || 1);
  const heightScale = Math.max(0.05, Number(options.heightScale) || 1);
  const gap = Math.max(0, Math.min(pixelSize * 0.45, Number(options.gap) || 0));
  const mode = options.mode || 'voxel';
  const stride = pixelSize + gap;
  const widthOffset = (document.width - 1) * stride / 2;
  const depthOffset = (document.height - 1) * stride / 2;
  const positions = [];
  const normals = [];
  const colors = [];

  function addVertex(x, y, z, normal, color) {
    positions.push(x, y, z); normals.push(...normal); colors.push(...color);
  }
  function quad(a, b, c, d, normal, color) {
    addVertex(...a, normal, color); addVertex(...b, normal, color); addVertex(...d, normal, color);
    addVertex(...b, normal, color); addVertex(...c, normal, color); addVertex(...d, normal, color);
  }
  function getHeight(x, z) {
    if (x < 0 || x >= document.width || z < 0 || z >= document.height) return 0;
    const pixel = document.pixels[z * document.width + x];
    return pixel[3] > 0 ? clampHeight(pixel[4]) * heightScale : 0;
  }
  function getPixel(x, z) { return document.pixels[z * document.width + x]; }

  let activePixels = 0;
  let maxHeight = 0;
  for (let z = 0; z < document.height; z += 1) {
    for (let x = 0; x < document.width; x += 1) {
      const pixel = getPixel(x, z);
      const h = getHeight(x, z);
      if (!h) continue;
      activePixels += 1; maxHeight = Math.max(maxHeight, h);
      const x0 = x * stride - widthOffset - pixelSize / 2 + gap / 2;
      const x1 = x0 + pixelSize - gap;
      const z0 = z * stride - depthOffset - pixelSize / 2 + gap / 2;
      const z1 = z0 + pixelSize - gap;
      const topColor = rgba(pixel);
      const sideColor = mode === 'contour' ? shade(pixel) : topColor;
      quad([x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], [0, 1, 0], topColor);
      const left = getHeight(x - 1, z); if (left < h) quad([x0, left, z1], [x0, left, z0], [x0, h, z0], [x0, h, z1], [-1, 0, 0], sideColor);
      const right = getHeight(x + 1, z); if (right < h) quad([x1, right, z0], [x1, right, z1], [x1, h, z1], [x1, h, z0], [1, 0, 0], sideColor);
      const front = getHeight(x, z - 1); if (front < h) quad([x1, front, z0], [x0, front, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], sideColor);
      const back = getHeight(x, z + 1); if (back < h) quad([x0, back, z1], [x1, back, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], sideColor);
    }
  }

  // Mirror the painted half across the requested world plane. The source
  // geometry remains intact and the mirrored normals are flipped for lighting.
  if (options.symmetry === 'xy' || options.symmetry === 'z') {
    const mirrorAxis = options.symmetry === 'xy' ? 2 : 0;
    const sourcePositions = positions.slice();
    const sourceNormals = normals.slice();
    const sourceColors = colors.slice();
    for (let index = 0; index < sourcePositions.length; index += 3) {
      const coordinate = sourcePositions[index + mirrorAxis];
      if (Math.abs(coordinate) < 0.00001) continue;
      const mirrored = [sourcePositions[index], sourcePositions[index + 1], sourcePositions[index + 2]];
      mirrored[mirrorAxis] *= -1;
      positions.push(...mirrored);
      const mirroredNormal = [sourceNormals[index], sourceNormals[index + 1], sourceNormals[index + 2]];
      mirroredNormal[mirrorAxis] *= -1;
      normals.push(...mirroredNormal);
      colors.push(sourceColors[index], sourceColors[index + 1], sourceColors[index + 2], sourceColors[index + 3]);
    }
  }

  if (options.base) {
    const baseHeight = Math.max(0.05, Number(options.baseThickness) || 1);
    const x0 = -document.width * stride / 2; const x1 = document.width * stride / 2;
    const z0 = -document.height * stride / 2; const z1 = document.height * stride / 2;
    const color = [0.18, 0.2, 0.23, 1];
    quad([x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [0, -1, 0], color);
    quad([x0, baseHeight, z1], [x1, baseHeight, z1], [x1, baseHeight, z0], [x0, baseHeight, z0], [0, 1, 0], color);
    quad([x0, 0, z1], [x1, 0, z1], [x1, baseHeight, z1], [x0, baseHeight, z1], [0, 0, 1], color);
    quad([x1, 0, z0], [x0, 0, z0], [x0, baseHeight, z0], [x1, baseHeight, z0], [0, 0, -1], color);
    quad([x0, 0, z0], [x0, 0, z1], [x0, baseHeight, z1], [x0, baseHeight, z0], [-1, 0, 0], color);
    quad([x1, 0, z1], [x1, 0, z0], [x1, baseHeight, z0], [x1, baseHeight, z1], [1, 0, 0], color);
  }
  return { positions, normals, colors, activePixels, maxHeight, triangles: positions.length / 9 };
}

export function parseRgbaText(text) {
  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  const header = rows.find((row) => /^\d+\s+\d+$/.test(row));
  if (!header) throw new Error('未找到画布尺寸');
  const [width, height] = header.split(/\s+/).map(Number);
  const pixels = rows.slice(rows.indexOf(header) + 1).filter((row) => !row.startsWith('#')).map((row) => row.split(/[\s,]+/).map(Number)).filter((row) => row.length >= 4);
  if (pixels.length !== width * height) throw new Error('像素数量与尺寸不匹配');
  return normalizeDocument({ width, height, pixels });
}
