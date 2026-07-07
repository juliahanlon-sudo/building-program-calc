// Local scenario store — replaces the former Firestore backend.
// Scenarios are persisted in the browser's localStorage, so they survive
// page reloads but live only on this machine/browser.

const KEY = "spaceplanner.scenarios";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Returns all scenarios, newest first.
export async function getScenarios() {
  return readAll().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

// Create a new scenario (scenarioId null) or overwrite an existing one.
export async function saveScenario(scenarioId, name, data) {
  const list = readAll();
  const now = Date.now();
  if (scenarioId) {
    const idx = list.findIndex(s => s.id === scenarioId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], name, data, updatedAt: now };
      writeAll(list);
      return scenarioId;
    }
  }
  const id = uid();
  list.push({ id, name, data, createdAt: now, updatedAt: now });
  writeAll(list);
  return id;
}

export async function deleteScenario(scenarioId) {
  writeAll(readAll().filter(s => s.id !== scenarioId));
}
