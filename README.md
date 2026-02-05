<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Piano MVP – Phase 1</title>
  <style>
    :root {
      --bg: #0f1115;
      --panel: #171a21;
      --text: #e7e9ee;
      --muted: #a7adbb;
      --whiteKey: #f4f5f7;
      --whiteKeyBorder: #cfd4df;
      --blackKey: #141821;
      --blackKeyBorder: #0a0c12;
      --active: #7aa2ff;
      --active2: #a0ffda;
      --radius: 16px;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: radial-gradient(1200px 600px at 40% -10%, #1b2340 0%, var(--bg) 55%, #0b0d12 100%);
      color: var(--text);
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 20px;
    }

    .app {
      width: min(1100px, 100%);
      background: color-mix(in oklab, var(--panel) 92%, black);
      border: 1px solid color-mix(in oklab, var(--panel) 70%, white);
      border-radius: var(--radius);
      box-shadow: 0 20px 60px rgba(0,0,0,.45);
      overflow: hidden;
    }

    header {
      padding: 16px 18px;
      display: flex;
      gap: 14px;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .title {
      display: flex;
      flex-direction: column;
      gap: 2px;
      line-height: 1.1;
    }
    .title strong { font-size: 16px; letter-spacing: .2px; }
    .title span { font-size: 12px; color: var(--muted); }

    .controls {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    button, .pill {
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06);
      color: var(--text);
      padding: 10px 12px;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    button:hover { background: rgba(255,255,255,.1); }
    button:active { transform: translateY(1px); }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: default;
    }

    input[type="range"] { width: 150px; }

    .main {
      padding: 18px;
    }

    .pianoWrap {
      background: rgba(0,0,0,.22);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: calc(var(--radius) - 6px);
      padding: 14px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .piano {
      position: relative;
      height: 220px;
      min-width: 740px;
      user-select: none;
      touch-action: none; /* we’ll handle touch ourselves */
    }

    /* White keys */
    .whiteKeys {
      position: absolute;
      inset: 0;
      display: flex;
    }

    .key.white {
      position: relative;
      width: 52px;
      height: 220px;
      background: linear-gradient(#ffffff, #f0f2f7);
      border: 1px solid var(--whiteKeyBorder);
      border-right: none;
      border-radius: 0 0 10px 10px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 10px;
      color: rgba(0,0,0,.55);
      font-size: 11px;
    }
    .key.white:last-child { border-right: 1px solid var(--whiteKeyBorder); }

    /* Black keys */
    .blackKeys {
      position: absolute;
      top: 0;
      left: 0;
      height: 140px;
      width: 100%;
      pointer-events: none; /* black keys will individually enable pointer events */
    }

    .key.black {
      position: absolute;
      width: 34px;
      height: 140px;
      background: linear-gradient(#1a2130, #0c0f18);
      border: 1px solid var(--blackKeyBorder);
      border-radius: 0 0 9px 9px;
      box-shadow: inset 0 -10px 14px rgba(255,255,255,.04), 0 8px 18px rgba(0,0,0,.35);
      pointer-events: auto;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 8px;
      color: rgba(255,255,255,.65);
      font-size: 10px;
    }

    /* Active styling */
    .key.white.active {
      background: linear-gradient(#dfe9ff, #cfe0ff);
      box-shadow: inset 0 -18px 26px rgba(0,0,0,.08);
      border-color: color-mix(in oklab, var(--active) 50%, var(--whiteKeyBorder));
    }
    .key.black.active {
      background: linear-gradient(#2b3e7a, #0e1630);
      border-color: rgba(122,162,255,.55);
      box-shadow: inset 0 -10px 14px rgba(160,255,218,.08), 0 10px 20px rgba(0,0,0,.45);
    }

    .key.white.sustained {
      background: linear-gradient(#dcfff2, #c8ffe8);
      border-color: color-mix(in oklab, var(--active2) 55%, var(--whiteKeyBorder));
    }
    .key.black.sustained {
      background: linear-gradient(#1f3a3a, #0b1516);
      border-color: rgba(160,255,218,.45);
    }

    .footerRow {
      margin-top: 12px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      color: var(--muted);
      font-size: 12px;
    }

    .kbdHint kbd {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.06);
      color: var(--text);
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <div class="title">
        <strong>Piano MVP</strong>
        <span>Phase 1: On-screen keys + audio + highlighting</span>
      </div>

      <div class="controls">
        <button id="btnAudio" aria-pressed="false">Audio: Off</button>
        <button id="btnSustain" aria-pressed="false">Sustain: Off</button>
        <button id="btnOctDown">Octave -</button>
        <button id="btnOctUp">Octave +</button>

        <span class="pill">
          Volume
          <input id="vol" type="range" min="0" max="1" step="0.01" value="0.7" />
        </span>

        <span class="pill">
          Velocity
          <input id="vel" type="range" min="0.05" max="1" step="0.01" value="0.8" />
        </span>
      </div>
    </header>

    <div class="main">
      <div class="pianoWrap">
        <div id="piano" class="piano" aria-label="On-screen piano"></div>
      </div>

      <div class="footerRow">
        <div class="kbdHint">
          Mouse/touch: press keys (drag works). Audio requires a click/tap first.
        </div>
        <div id="status">Audio: not enabled</div>
      </div>
    </div>
  </div>

<script>
(() => {
  // ---------------------------
  // Constants / helpers
  // ---------------------------
  const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const isBlack = (midiNote) => NOTE_NAMES[midiNote % 12].includes("#");

  function midiToName(n) {
    const name = NOTE_NAMES[n % 12];
    const octave = Math.floor(n / 12) - 1;
    return `${name}${octave}`;
  }

  function midiToFreq(n) {
    // A4 = 440 at MIDI 69
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  // ---------------------------
  // Audio Engine (simple, responsive synth)
  // ---------------------------
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.active = new Map(); // note -> {osc, gain}
      this.volume = 0.7;
    }

    async ensureStarted() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state !== "running") {
        await this.ctx.resume();
      }
    }

    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.value = v;
    }

    noteOn(note, velocity = 0.8) {
      if (!audioEnabled) return;

      if (!this.ctx || this.ctx.state !== "running") return;
    
      // If already active, ignore (prevents retrigger spam while dragging)
      if (this.active.has(note)) return;
    
      const now = this.ctx.currentTime;
    
      // Clamp and shape velocity a bit so the response feels musical
      const v = Math.max(0.01, Math.min(1, velocity));
      const vCurve = Math.pow(v, 0.75); // boosts low velocities slightly
    
      // Velocity affects attack (soft = slower, hard = faster)
      const attack = 0.005 + (1 - vCurve) * 0.035; // ~5ms to ~40ms
    
      // Velocity affects brightness (soft = darker, hard = brighter)
      const cutoff = 900 + vCurve * 5200;          // ~900Hz to ~6100Hz
      const q = 0.55 + vCurve * 0.35;              // slightly sharper when harder
    
      // Amplitude still matters, but keep it in a reasonable range
      const peak = 0.08 + vCurve * 0.75;           // ~0.08 to ~0.83
    
      // Slightly richer than a plain sine, still light weight.
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(midiToFreq(note), now);
    
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
    
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(cutoff, now);
      filter.Q.setValueAtTime(q, now);
    
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
    
      // Envelope: velocity-shaped attack, then gentle decay
      gain.gain.exponentialRampToValueAtTime(peak, now + attack);
      gain.gain.exponentialRampToValueAtTime(peak * 0.55, now + attack + 0.18);
    
      osc.start(now);
    
      this.active.set(note, { osc, gain });
    }

    noteOff(note) {
      if (!this.ctx || this.ctx.state !== "running") return;

      const voice = this.active.get(note);
      if (!voice) return;

      const now = this.ctx.currentTime;
      const { osc, gain } = voice;

      // Release envelope
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.stop(now + 0.14);

      this.active.delete(note);
    }

    allOff() {
      for (const note of Array.from(this.active.keys())) {
        this.noteOff(note);
      }
    }
  }

  const audio = new AudioEngine();

  // ---------------------------
  // Piano View
  // ---------------------------
  const pianoEl = document.getElementById("piano");
  const statusEl = document.getElementById("status");

  // Range: 2 octaves default (C4..B5). We'll shift with octaveOffset.
  const BASE_START = 60; // C4
  const OCTAVES = 2;
  let octaveOffset = 0;

  // State of pressed notes by source pointer
  const pressedNotes = new Set(); // notes currently down (regardless of source)
  const noteToEl = new Map();     // note -> key element

  // State of sustained notes by source pointer
  const sustainedNotes = new Set(); // notes being held by sustain pedal
  let sustainOn = false;

  // Pointer tracking for dragging across keys
  const pointerToNote = new Map(); // pointerId -> note

  // Velocity slider for touch/mouse (since we don't have real velocity)
  const velEl = document.getElementById("vel");
  const volEl = document.getElementById("vol");

    // ---------------------------
  // Phase 1.5: Computer keyboard input (QWERTY)
  // ---------------------------

  // QWERTY mapping uses "piano row" layout:
  // White keys: A S D F G H J K = C D E F G A B C
  // Black keys: W E T Y U       = C# D# F# G# A#
  //
  // This is relative to the visible keyboard range start (C of the base octave),
  // so octave shifting affects both on-screen and QWERTY together.

  const QWERTY_WHITE = ["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK"];
  const QWERTY_BLACK = ["KeyW","KeyE","KeyT","KeyY","KeyU"];

  // Semitone offsets from C for each key in the above lists:
  // White: C D E F G A B C
  const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12];
  // Black: C# D# F# G# A#
  const BLACK_OFFSETS = [1, 3, 6, 8, 10];

  const qwertyCodeToOffset = new Map();
  QWERTY_WHITE.forEach((code, i) => qwertyCodeToOffset.set(code, WHITE_OFFSETS[i]));
  QWERTY_BLACK.forEach((code, i) => qwertyCodeToOffset.set(code, BLACK_OFFSETS[i]));

  const keyboardHeld = new Set(); // codes currently held down (prevents repeat spam)

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  // For QWERTY, velocity is fixed (user can adjust with the Velocity slider).
  function qwertyVelocity() {
    return Number(velEl.value);
  }

  function qwertyBaseC() {
    // Visible keyboard start is BASE_START + octaveOffset*12 (which is a C)
    return BASE_START + octaveOffset * 12;
  }

  window.addEventListener("keydown", (e) => {
    // Don't hijack typing or slider interactions
    if (isTypingTarget(e.target)) return;

    // Sustain toggle via Space
    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat) setSustain(!sustainOn);
      return;
    }

    // Octave shift via Z / X
    if (e.code === "KeyZ") {
      e.preventDefault();
      setOctaveOffset(octaveOffset - 1);
      return;
    }
    if (e.code === "KeyX") {
      e.preventDefault();
      setOctaveOffset(octaveOffset + 1);
      return;
    }

    const offset = qwertyCodeToOffset.get(e.code);
    if (offset == null) return;

    // Prevent browser from scrolling on space/etc (not used now, but safe pattern)
    e.preventDefault();

    // Ignore auto-repeat: only fire on first press
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

  function noteOn(evt) {
    const { note, velocity } = evt;
  
    // If a note was being sustained and is pressed again, it's no longer "pedal-only"
    sustainedNotes.delete(note);
  
    pressedNotes.add(note);
    const el = noteToEl.get(note);
    if (el) {
      el.classList.add("active");
      el.classList.remove("sustained");
    }
    audio.noteOn(note, velocity);
  }
  
  function noteOff(evt) {
    const { note } = evt;
  
    // Key released physically
    pressedNotes.delete(note);
  
    const el = noteToEl.get(note);
  
    if (sustainOn) {
      // Keep sounding until sustain is turned off
      sustainedNotes.add(note);
      if (el) {
        el.classList.remove("active");
        el.classList.add("sustained");
      }
      return;
    }
  
    // No sustain: stop immediately
    sustainedNotes.delete(note);
    if (el) {
      el.classList.remove("active");
      el.classList.remove("sustained");
    }
    audio.noteOff(note);
  }

  function setSustain(next) {
  sustainOn = !!next;

  const btn = document.getElementById("btnSustain");
  btn.setAttribute("aria-pressed", String(sustainOn));
  btn.textContent = sustainOn ? "Sustain: On" : "Sustain: Off";

    // When sustain turns OFF, release any notes that are no longer physically held
    if (!sustainOn) {
      for (const note of Array.from(sustainedNotes)) {
        if (!pressedNotes.has(note)) {
          const el = noteToEl.get(note);
          if (el) el.classList.remove("sustained");
          audio.noteOff(note);
          sustainedNotes.delete(note);
        }
      }
    }
  }

  function buildPiano() {
    pianoEl.innerHTML = "";
    noteToEl.clear();

    const start = BASE_START + octaveOffset * 12;
    const end = start + OCTAVES * 12 - 1; // inclusive

    const whiteLayer = document.createElement("div");
    whiteLayer.className = "whiteKeys";

    const blackLayer = document.createElement("div");
    blackLayer.className = "blackKeys";

    // Build list of notes
    const notes = [];
    for (let n = start; n <= end; n++) notes.push(n);

    // Create white keys first (layout baseline)
    const whiteNotes = notes.filter(n => !isBlack(n));
    whiteNotes.forEach((n) => {
      const key = document.createElement("div");
      key.className = "key white";
      key.dataset.note = String(n);
      key.setAttribute("role", "button");
      key.setAttribute("aria-label", `Key ${midiToName(n)}`);
      key.textContent = midiToName(n).replace(/\d+$/, ""); // show letter name only
      whiteLayer.appendChild(key);
      noteToEl.set(n, key);
    });

    // Position black keys relative to white keys.
    // We'll compute left offset based on white index.
    // Pattern within octave: C# after C, D# after D, F# after F, G# after G, A# after A
    const blackOffsets = new Map(); // note -> left px
    const whiteWidth = 52;
    const blackWidth = 34;

    // Map each white note to its index
    const whiteIndex = new Map();
    whiteNotes.forEach((n, idx) => whiteIndex.set(n, idx));

    // For each black note, place it between adjacent whites
    const blackNotes = notes.filter(n => isBlack(n));
    blackNotes.forEach((n) => {
      // Find nearest lower white note: n-1 or n-2 depending (because black keys exist between certain notes)
      // A black key is always between two whites: e.g. C# between C and D.
      let lowerWhite = n - 1;
      while (isBlack(lowerWhite)) lowerWhite--;
      let upperWhite = n + 1;
      while (isBlack(upperWhite)) upperWhite++;

      const li = whiteIndex.get(lowerWhite);
      const ui = whiteIndex.get(upperWhite);
      if (li == null || ui == null) return;

      // Place centered between those whites, with a small bias so it looks natural.
      const centerBetween = ((li + ui) / 2) * whiteWidth;
      const left = centerBetween - (blackWidth / 2);

      const key = document.createElement("div");
      key.className = "key black";
      key.dataset.note = String(n);
      key.setAttribute("role", "button");
      key.setAttribute("aria-label", `Key ${midiToName(n)}`);
      key.textContent = midiToName(n).replace(/\d+$/, ""); // letter name
      key.style.left = `${left}px`;

      blackLayer.appendChild(key);
      noteToEl.set(n, key);
    });

    pianoEl.appendChild(whiteLayer);
    pianoEl.appendChild(blackLayer);

    // Re-apply active classes if octave shifting while holding notes (rare, but consistent)
    for (const note of pressedNotes) {
      const el = noteToEl.get(note);
      if (el) el.classList.add("active");
    }
  }

  // Hit-test: determine key under point, preferring black keys on top.
  function getNoteFromPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;

    const key = el.closest?.(".key");
    if (!key) return null;

    const n = Number(key.dataset.note);
    return Number.isFinite(n) ? n : null;
  }

  // Pointer logic (mouse + touch + pen)
  function onPointerDown(e) {
    // Prevent scrolling / text selection
    e.preventDefault();

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
  }

  function onPointerMove(e) {
    if (!pointerToNote.has(e.pointerId)) return;
    e.preventDefault();

    const current = pointerToNote.get(e.pointerId);
    const over = getNoteFromPoint(e.clientX, e.clientY);

    if (over == null || over === current) return;

    // Switch notes while dragging:
    noteOff({ note: current, source: "touch", time: performance.now() });
    pointerToNote.set(e.pointerId, over);
    noteOn({ note: over, velocity: Number(velEl.value), source: "touch", time: performance.now() });
  }

  function onPointerUp(e) {
    if (!pointerToNote.has(e.pointerId)) return;
    e.preventDefault();

    const note = pointerToNote.get(e.pointerId);
    pointerToNote.delete(e.pointerId);

    noteOff({ note, source: "touch", time: performance.now() });
  }

  function onPointerCancel(e) {
    if (!pointerToNote.has(e.pointerId)) return;
    const note = pointerToNote.get(e.pointerId);
    pointerToNote.delete(e.pointerId);
    noteOff({ note, source: "touch", time: performance.now() });
  }

  // ---------------------------
  // UI wiring
  // ---------------------------

  let audioEnabled = false;
  
  async function setAudioEnabled(next) {
    audioEnabled = !!next;
  
    const btn = document.getElementById("btnAudio");
    btn.setAttribute("aria-pressed", String(audioEnabled));
    btn.textContent = audioEnabled ? "Audio: On" : "Audio: Off";
  
    if (!audio.ctx) {
      if (audioEnabled) {
        await audio.ensureStarted();
      }
      return;
    }
  
    if (audioEnabled) {
      await audio.ctx.resume();
    } else {
      audio.allOff();
      await audio.ctx.suspend();
    }
  
    statusEl.textContent = audioEnabled ? "Audio: enabled" : "Audio: muted";
  }

  document.getElementById("btnAudio").addEventListener("click", async () => {
    try {
      await setAudioEnabled(!audioEnabled);
    } catch {
      statusEl.textContent = "Audio: unavailable";
    }
  });

  document.getElementById("btnSustain").addEventListener("click", () => {
    setSustain(!sustainOn);
  });

  volEl.addEventListener("input", () => {
    audio.setVolume(Number(volEl.value));
  });

  function setOctaveOffset(next) {
    octaveOffset = Math.max(-3, Math.min(3, next));
    // Turn off any sounding notes that are now out-of-range
    audio.allOff();
    pressedNotes.clear();
    pointerToNote.clear();
    buildPiano();
  }

  document.getElementById("btnOctDown").addEventListener("click", () => setOctaveOffset(octaveOffset - 1));
  document.getElementById("btnOctUp").addEventListener("click", () => setOctaveOffset(octaveOffset + 1));

  // Attach pointer handlers
  pianoEl.addEventListener("pointerdown", onPointerDown, { passive: false });
  pianoEl.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: false });
  window.addEventListener("pointercancel", onPointerCancel, { passive: false });

  // Safety: when tab loses focus, stop sound
  window.addEventListener("blur", () => {
    audio.allOff();
    pressedNotes.clear();
    pointerToNote.clear();
    keyboardHeld.clear();
    sustainedNotes.clear();
    setAudioEnabled(false);
    setSustain(false);
  
    for (const el of noteToEl.values()) {
      el.classList.remove("active");
      el.classList.remove("sustained");
    }
  });

  // Initial render
  buildPiano();
})();
</script>
</body>
</html>
