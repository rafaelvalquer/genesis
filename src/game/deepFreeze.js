export function deepFreeze(value, visited = new WeakSet()) {
  if (value == null || (typeof value !== "object" && typeof value !== "function")) {
    return value;
  }
  if (visited.has(value)) return value;
  visited.add(value);

  if (value instanceof Map) {
    for (const [key, entry] of value.entries()) {
      deepFreeze(key, visited);
      deepFreeze(entry, visited);
    }
  } else if (value instanceof Set) {
    for (const entry of value.values()) deepFreeze(entry, visited);
  } else {
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], visited));
  }

  return Object.freeze(value);
}

export default deepFreeze;
