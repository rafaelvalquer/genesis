export const LEVIATHAN_AUDIT_RULES = Object.freeze({
  alphaThreshold: 16,
  transparentMarginPx: 24,
  cornerZonePx: 72,
  ignoreComponentAreaPx: 4,
  warningComponentAreaPx: 8,
  errorComponentAreaPx: 20,
  maximumSecondaryAreaFactor: 0.0005,
  maximumAnchorDriftPx: 10,
});

const pointDistance = (first, second) => Math.max(
  Math.max(first.left - second.right - 1, second.left - first.right - 1, 0),
  Math.max(first.top - second.bottom - 1, second.top - first.bottom - 1, 0),
);

/**
 * Groups visible pixels with an eight-way search. A one-pixel dilation is
 * represented by allowing a two-pixel Chebyshev step, so antialiased strokes
 * separated by a transparent pixel stay part of the same anatomy.
 */
export function analyzeLeviathanComponents(data, width, height, rules = LEVIATHAN_AUDIT_RULES) {
  const visible = new Uint8Array(width * height);
  for (let index = 0; index < visible.length; index += 1) visible[index] = data[index * 4 + 3] >= rules.alphaThreshold;
  const visited = new Uint8Array(visible.length);
  const components = [];
  for (let start = 0; start < visible.length; start += 1) {
    if (!visible[start] || visited[start]) continue;
    const queue = [start]; visited[start] = 1;
    let cursor = 0; let area = 0; let left = width; let top = height; let right = -1; let bottom = -1;
    while (cursor < queue.length) {
      const point = queue[cursor++]; const x = point % width; const y = Math.floor(point / width);
      area += 1; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (let ny = Math.max(0, y - 2); ny <= Math.min(height - 1, y + 2); ny += 1) for (let nx = Math.max(0, x - 2); nx <= Math.min(width - 1, x + 2); nx += 1) {
        const next = ny * width + nx;
        if (visible[next] && !visited[next]) { visited[next] = 1; queue.push(next); }
      }
    }
    components.push({ area, left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, pixels: queue });
  }
  components.sort((left, right) => right.area - left.area);
  const main = components[0] || null;
  const secondary = components.slice(1).map((component) => ({ ...component, distanceToMainPx: main ? pointDistance(component, main) : 0 }));
  const totalVisiblePixels = components.reduce((sum, component) => sum + component.area, 0);
  return { components, main, secondary, totalVisiblePixels, mainComponentRatio: main ? main.area / totalVisiblePixels : 0 };
}

export function componentTouchesProtectedZone(component, width, height, rules = LEVIATHAN_AUDIT_RULES) {
  const inCorner = (component.left < rules.cornerZonePx && component.top < rules.cornerZonePx)
    || (component.right >= width - rules.cornerZonePx && component.top < rules.cornerZonePx)
    || (component.left < rules.cornerZonePx && component.bottom >= height - rules.cornerZonePx)
    || (component.right >= width - rules.cornerZonePx && component.bottom >= height - rules.cornerZonePx);
  const touchesMargin = component.left < rules.transparentMarginPx || component.top < rules.transparentMarginPx
    || component.right >= width - rules.transparentMarginPx || component.bottom >= height - rules.transparentMarginPx;
  return { inCorner, touchesMargin };
}
