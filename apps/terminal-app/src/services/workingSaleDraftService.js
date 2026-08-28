import AsyncStorage from '@react-native-async-storage/async-storage';

const workingSaleDraftKey = 'terminalWorkingSaleDraftV1';
const workingSaleDraftVersion = 1;

let writeChain = Promise.resolve();

function serializeWrite(operation) {
  const nextWrite = writeChain
    .catch(() => {})
    .then(operation);

  writeChain = nextWrite;
  return nextWrite;
}

function isRecoverableDraft(draft) {
  return Boolean(
    draft
    && draft.version === workingSaleDraftVersion
    && draft.customer?.id
    && Array.isArray(draft.lines)
    && draft.lines.length > 0,
  );
}

export async function getWorkingSaleDraft() {
  await writeChain.catch(() => {});
  const raw = await AsyncStorage.getItem(workingSaleDraftKey);
  if (!raw) return null;

  try {
    const draft = JSON.parse(raw);
    return isRecoverableDraft(draft) ? draft : null;
  } catch {
    return null;
  }
}

export async function saveWorkingSaleDraft({ customer, lines, editingEventId = '' }) {
  if (!customer?.id || !Array.isArray(lines) || lines.length === 0) {
    return clearWorkingSaleDraft();
  }

  const draft = {
    version: workingSaleDraftVersion,
    customer,
    lines,
    editingEventId,
    savedAt: new Date().toISOString(),
  };
  const serializedDraft = JSON.stringify(draft);

  await serializeWrite(() => AsyncStorage.setItem(workingSaleDraftKey, serializedDraft));
  return draft;
}

export async function clearWorkingSaleDraft() {
  await serializeWrite(() => AsyncStorage.removeItem(workingSaleDraftKey));
}
