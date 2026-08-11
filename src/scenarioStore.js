// Local scenario store.
//
// Scenarios are normally persisted in the browser's localStorage, so they
// survive page reloads but live only on this machine/browser.
//
// Some sandboxed hosts (e.g. the Claude artifacts iframe) block storage
// access — reading/writing localStorage throws a SecurityError or the object
// is undefined. In that case we transparently fall back to an in-memory store
// so scenarios still work within the session (they just won't survive a full
// reload on those hosts).

const KEY = "spaceplanner.scenarios";

// Detect a usable localStorage. Access alone can throw in a sandbox, so probe
// it with a real read/write inside a try/catch.
const storage = (() => {
  try {
    const probe = "__spaceplanner_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    // In-memory shim implementing the tiny subset we use.
    let mem = null;
    return {
      getItem: () => mem,
      setItem: (_k, v) => { mem = v; },
      removeItem: () => { mem = null; },
    };
  }
})();

function readAll() {
  try {
    return JSON.parse(storage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  storage.setItem(KEY, JSON.stringify(list));
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
