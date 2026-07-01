export function setupMidiInput({
  onNoteOn,
  onNoteOff,
  onStatusChange = () => {},
  getVelocityFallback = () => 0.8
}) {
  let midiAccess = null;
  let enabled = false;
  const activeNotes = new Map();

  function isSupported() {
    return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
  }

  function getInputs() {
    if (!midiAccess) return [];
    return Array.from(midiAccess.inputs.values());
  }

  function getInputLabel(inputs = getInputs()) {
    if (inputs.length === 0) return "MIDI: waiting for device";
    if (inputs.length === 1) return `MIDI: ${inputs[0].name || "connected"}`;
    return `MIDI: ${inputs.length} inputs`;
  }

  function emitStatus(state, message = "") {
    const inputs = getInputs();
    onStatusChange({
      enabled,
      supported: isSupported(),
      state,
      message: message || (enabled ? getInputLabel(inputs) : "MIDI: Off"),
      inputCount: inputs.length,
      inputNames: inputs.map(input => input.name || "Unnamed input")
    });
  }

  function noteOn(note, velocity) {
    const heldCount = activeNotes.get(note) || 0;
    activeNotes.set(note, heldCount + 1);
    if (heldCount > 0) return;

    onNoteOn({
      note,
      velocity: velocity > 0 ? velocity : getVelocityFallback(),
      source: "midi",
      time: performance.now()
    });
  }

  function noteOff(note) {
    const heldCount = activeNotes.get(note) || 0;
    if (heldCount <= 1) {
      activeNotes.delete(note);
      onNoteOff({
        note,
        source: "midi",
        time: performance.now()
      });
      return;
    }

    activeNotes.set(note, heldCount - 1);
  }

  function handleMidiMessage(event) {
    const [statusByte, noteNumber, rawVelocity = 0] = event.data || [];
    if (!Number.isFinite(statusByte) || !Number.isFinite(noteNumber)) return;

    const command = statusByte & 0xf0;
    const note = Number(noteNumber);
    if (!Number.isInteger(note) || note < 0 || note > 127) return;

    if (command === 0x90 && rawVelocity > 0) {
      noteOn(note, Math.max(0, Math.min(1, rawVelocity / 127)));
      return;
    }

    if (command === 0x80 || (command === 0x90 && rawVelocity === 0)) {
      noteOff(note);
    }
  }

  function bindInputs() {
    for (const input of getInputs()) {
      input.onmidimessage = enabled ? handleMidiMessage : null;
    }
  }

  function releaseHeldNotes() {
    for (const note of Array.from(activeNotes.keys())) {
      onNoteOff({
        note,
        source: "midi",
        time: performance.now()
      });
    }
    activeNotes.clear();
  }

  async function enable() {
    if (!isSupported()) {
      enabled = false;
      emitStatus("unsupported", "MIDI: unsupported");
      return false;
    }

    try {
      if (!midiAccess) {
        midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        midiAccess.onstatechange = () => {
          bindInputs();
          releaseHeldNotes();
          emitStatus(enabled ? "connected" : "off");
        };
      }

      enabled = true;
      bindInputs();
      emitStatus("connected");
      return true;
    } catch (err) {
      enabled = false;
      releaseHeldNotes();
      emitStatus("error", "MIDI: unavailable");
      throw err;
    }
  }

  function disable() {
    enabled = false;
    bindInputs();
    releaseHeldNotes();
    emitStatus("off", "MIDI: Off");
  }

  function reset() {
    releaseHeldNotes();
  }

  emitStatus("off", isSupported() ? "MIDI: Off" : "MIDI: unsupported");

  return {
    enable,
    disable,
    reset,
    isEnabled: () => enabled
  };
}
