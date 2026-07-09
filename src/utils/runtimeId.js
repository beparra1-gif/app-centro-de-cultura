let nextRuntimeId = 1000;

export function nextId() {
  const id = nextRuntimeId;
  nextRuntimeId += 1;
  return id;
}
