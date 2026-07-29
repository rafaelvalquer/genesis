export function compactActive(items, predicate) {
  let write = 0;
  for (let read = 0; read < items.length; read += 1) {
    const item = items[read];
    if (!predicate(item)) continue;
    items[write] = item;
    write += 1;
  }
  items.length = write;
  return items;
}

