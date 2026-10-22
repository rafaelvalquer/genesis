// Deterministic helpers shared by the chapter 1 ground and ambient renderers.
function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

export function pseudo(index, seed = 1) {
  return seeded(seed * 997 + index * 131)();
}

export function rgba(hex, alpha) {
  const clean = String(hex || "#ffffff").replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((part) => part + part).join("") : clean, 16);
  return `rgba(${value >> 16 & 255},${value >> 8 & 255},${value & 255},${alpha})`;
}
