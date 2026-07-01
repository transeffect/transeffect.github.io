import { isBlack, midiToName } from "./constants.js";

export function buildPiano({
  pianoEl,
  noteToEl,
  pressedNotes,
  getOctaveOffset,
  setVisibleRange,
  lessonEngine,
  baseStart = 60,
  octaves = 2
}) {
  pianoEl.innerHTML = "";
  noteToEl.clear();

  const start = baseStart + getOctaveOffset() * 12;
  const end = start + octaves * 12 - 1;
  setVisibleRange(start, end);

  const whiteLayer = document.createElement("div");
  whiteLayer.className = "whiteKeys";

  const blackLayer = document.createElement("div");
  blackLayer.className = "blackKeys";

  const notes = [];
  for (let n = start; n <= end; n++) notes.push(n);

  const whiteNotes = notes.filter(n => !isBlack(n));
  whiteNotes.forEach((n) => {
    const key = document.createElement("div");
    key.className = "key white";
    key.dataset.note = String(n);
    key.setAttribute("role", "button");
    key.setAttribute("aria-label", `Key ${midiToName(n)}`);
    key.textContent = midiToName(n).replace(/\d+$/, "");
    whiteLayer.appendChild(key);
    noteToEl.set(n, key);
  });

  const whiteWidth = 52;
  const blackWidth = 34;
  const whiteIndex = new Map();
  whiteNotes.forEach((n, idx) => whiteIndex.set(n, idx));

  const blackNotes = notes.filter(n => isBlack(n));
  blackNotes.forEach((n) => {
    let lowerWhite = n - 1;
    while (isBlack(lowerWhite)) lowerWhite--;
    let upperWhite = n + 1;
    while (isBlack(upperWhite)) upperWhite++;

    const li = whiteIndex.get(lowerWhite);
    const ui = whiteIndex.get(upperWhite);
    if (li == null || ui == null) return;

    const centerBetween = (((li + 0.5) + (ui + 0.5)) / 2) * whiteWidth;
    const left = centerBetween - (blackWidth / 2);

    const key = document.createElement("div");
    key.className = "key black";
    key.dataset.note = String(n);
    key.setAttribute("role", "button");
    key.setAttribute("aria-label", `Key ${midiToName(n)}`);
    key.textContent = midiToName(n).replace(/\d+$/, "");
    key.style.left = `${left}px`;

    blackLayer.appendChild(key);
    noteToEl.set(n, key);
  });

  pianoEl.appendChild(whiteLayer);
  pianoEl.appendChild(blackLayer);

  console.log("Visible range:", start, end);

  for (const note of pressedNotes) {
    const el = noteToEl.get(note);
    if (el) el.classList.add("active");
    if (lessonEngine?.refreshTargets) {
      lessonEngine.refreshTargets();
    }
  }

  if (lessonEngine?.refreshTargets) {
    lessonEngine.refreshTargets();
  }
}
