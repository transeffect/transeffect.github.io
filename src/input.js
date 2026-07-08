export function setupInputHandlers({
  pianoEl,
  velEl,
  pointerToNote,
  keyboardHeld,
  noteOn,
  noteOff,
  setPlayMode,
  getPlayMode,
  setSustain,
  getSustainOn,
  setOctaveOffset,
  getOctaveOffset,
  baseStart = 60
}) {
  const qwertyWhite = ["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon","Quote"];
  const qwertyBlack = ["KeyW","KeyE","KeyT","KeyY","KeyU"];
  const whiteOffsets = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17];
  const blackOffsets = [1, 3, 6, 8, 10];
  const qwertyCodeToOffset = new Map();

  qwertyWhite.forEach((code, i) => qwertyCodeToOffset.set(code, whiteOffsets[i]));
  qwertyBlack.forEach((code, i) => qwertyCodeToOffset.set(code, blackOffsets[i]));

  function isTypingTarget(el) {
    if (!el) return false;

    const tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) return true;

    if (tag === "INPUT") {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "range") return false;
      return true;
    }

    return false;
  }

  function qwertyVelocity() {
    return Number(velEl.value);
  }

  function qwertyBaseC() {
    return baseStart + getOctaveOffset() * 12;
  }

  function getNoteFromPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;

    const key = el.closest?.(".key");
    if (!key) return null;

    const n = Number(key.dataset.note);
    return Number.isFinite(n) ? n : null;
  }

  window.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;

    if (e.code === "KeyO") {
      e.preventDefault();
      if (!e.repeat) setPlayMode(getPlayMode() === "piano" ? "organ" : "piano");
      return;
    }

    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat) setSustain(!getSustainOn());
      return;
    }

    if (e.code === "KeyZ") {
      e.preventDefault();
      setOctaveOffset(getOctaveOffset() - 1);
      return;
    }
    if (e.code === "KeyX") {
      e.preventDefault();
      setOctaveOffset(getOctaveOffset() + 1);
      return;
    }

    const offset = qwertyCodeToOffset.get(e.code);
    if (offset == null) return;

    e.preventDefault();
    if (e.repeat) return;
    if (keyboardHeld.has(e.code)) return;

    keyboardHeld.add(e.code);
    const note = qwertyBaseC() + offset;
    noteOn({
      note,
      velocity: qwertyVelocity(),
      source: "keyboard",
      time: performance.now()
    });
  }, { passive: false });

  window.addEventListener("keyup", (e) => {
    if (isTypingTarget(e.target)) return;

    const offset = qwertyCodeToOffset.get(e.code);
    if (offset == null) return;

    e.preventDefault();
    if (!keyboardHeld.has(e.code)) return;
    keyboardHeld.delete(e.code);

    const note = qwertyBaseC() + offset;
    noteOff({
      note,
      source: "keyboard",
      time: performance.now()
    });
  }, { passive: false });

  pianoEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const ae = document.activeElement;
    if (ae && ae.tagName === "INPUT" && (ae.type || "").toLowerCase() === "range") {
      ae.blur();
    }

    const note = getNoteFromPoint(e.clientX, e.clientY);
    if (note == null) return;

    pianoEl.setPointerCapture?.(e.pointerId);
    pointerToNote.set(e.pointerId, note);

    noteOn({
      note,
      velocity: Number(velEl.value),
      source: "touch",
      time: performance.now()
    });
  }, { passive: false });

  pianoEl.addEventListener("pointermove", (e) => {
    if (!pointerToNote.has(e.pointerId)) return;
    e.preventDefault();

    const current = pointerToNote.get(e.pointerId);
    const over = getNoteFromPoint(e.clientX, e.clientY);
    if (over == null || over === current) return;

    noteOff({ note: current, source: "touch", time: performance.now() });
    pointerToNote.set(e.pointerId, over);
    noteOn({ note: over, velocity: Number(velEl.value), source: "touch", time: performance.now() });
  }, { passive: false });

  window.addEventListener("pointerup", (e) => {
    if (!pointerToNote.has(e.pointerId)) return;
    e.preventDefault();

    const note = pointerToNote.get(e.pointerId);
    pointerToNote.delete(e.pointerId);
    noteOff({ note, source: "touch", time: performance.now() });
  }, { passive: false });

  window.addEventListener("pointercancel", (e) => {
    if (!pointerToNote.has(e.pointerId)) return;
    const note = pointerToNote.get(e.pointerId);
    pointerToNote.delete(e.pointerId);
    noteOff({ note, source: "touch", time: performance.now() });
  }, { passive: false });
}
