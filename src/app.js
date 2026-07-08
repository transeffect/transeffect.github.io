import { AudioEngine } from "./audio-engine.js";
import { expandGeneratedChallenges } from "./challenge-generators.js";
import { midiToName } from "./constants.js";
import { setupInputHandlers } from "./input.js";
import { LessonEngine } from "./lesson-engine.js";
import { loadLesson, loadLessonPack } from "./lesson-loader.js";
import { setupMidiInput } from "./midi-input.js";
import { buildPiano } from "./piano-view.js";
import { PracticeEngine, formatDuration } from "./practice-engine.js";

const pianoEl = document.getElementById("piano");
const statusEl = document.getElementById("status");
const velEl = document.getElementById("vel");
const volEl = document.getElementById("vol");
const panWidthEl = document.getElementById("panWidth");
const panTestBtn = document.getElementById("btnPanTest");
const midiToggleBtn = document.getElementById("btnMidi");
const midiStatusEl = document.getElementById("midiStatus");
const freePlayModeBtn = document.getElementById("btnFreePlayMode");
const lessonModeBtn = document.getElementById("btnLessonMode");
const practiceHudEl = document.getElementById("practiceHud");
const practiceProgressEl = document.getElementById("practiceProgress");
const practiceStepsEl = document.getElementById("practiceSteps");
const practiceAccuracyEl = document.getElementById("practiceAccuracy");
const practiceStreakEl = document.getElementById("practiceStreak");
const practiceTimeEl = document.getElementById("practiceTime");
const practiceFeedbackEl = document.getElementById("practiceFeedback");
const practiceSummaryEl = document.getElementById("practiceSummary");
const practiceTitleEl = document.getElementById("practiceTitle");
const practiceStepLabelEl = document.getElementById("practiceStepLabel");
const lessonTeachingEl = document.getElementById("lessonTeaching");
const lessonGoalEl = document.getElementById("lessonGoal");
const lessonOverviewEl = document.getElementById("lessonOverview");
const lessonInstructionsEl = document.getElementById("lessonInstructions");
const lessonHintEl = document.getElementById("lessonHint");
const rhythmGuideEl = document.getElementById("rhythmGuide");
const rhythmGuideMetaEl = document.getElementById("rhythmGuideMeta");
const rhythmGuideEventsEl = document.getElementById("rhythmGuideEvents");
const beginRhythmBtn = document.getElementById("btnBeginRhythm");
const playRhythmExampleBtn = document.getElementById("btnPlayRhythmExample");
const earTrainingControlsEl = document.getElementById("earTrainingControls");
const earChoicesEl = document.getElementById("earChoices");
const playPromptBtn = document.getElementById("btnPlayPrompt");
const menuPairs = [
  {
    button: document.getElementById("btnVolumeMenu"),
    panel: document.getElementById("volumePopover")
  },
  {
    button: document.getElementById("btnSettingsMenu"),
    panel: document.getElementById("settingsPopover")
  }
];

const BASE_START = 60;
const OCTAVES = 2;
const LESSON_PACK_ID = "beginner";
const SUSTAIN_VISUAL_TTL_MS = 8000;

let octaveOffset = 0;
let visibleStart = BASE_START;
let visibleEnd = BASE_START + OCTAVES * 12 - 1;
let panWidth = panWidthEl ? Number(panWidthEl.value) || 1.0 : 1.0;
let sustainOn = false;
let audioEnabled = false;
let playMode = "piano";
let lessonManifest = null;
let appMode = "freePlay";

const pressedNotes = new Set();
const noteToEl = new Map();
const sustainedNotes = new Set();
const sustainTimers = new Map();
const pointerToNote = new Map();
const keyboardHeld = new Set();
const loadedLessons = new Map();
const practiceEngine = new PracticeEngine();
const rhythmExampleTimers = new Set();
let rhythmExample = {
  active: false,
  stepIndex: null,
  eventIndex: null
};

const lessonEngine = new LessonEngine({
  noteToEl,
  onStatus: renderLessonStatus,
  onPracticeEvent: handlePracticeEvent
});

const audio = new AudioEngine({
  getAudioEnabled: () => audioEnabled,
  getPlayMode: () => playMode,
  getVisibleRange: () => ({ start: visibleStart, end: visibleEnd }),
  getPanWidth: () => panWidth,
  onNoteEnded: handleNoteEnded
});

const midiInput = setupMidiInput({
  onNoteOn: noteOn,
  onNoteOff: noteOff,
  getVelocityFallback: () => Number(velEl?.value) || 0.8,
  onStatusChange: renderMidiStatus
});

function renderPiano() {
  buildPiano({
    pianoEl,
    noteToEl,
    pressedNotes,
    getOctaveOffset: () => octaveOffset,
    setVisibleRange: (start, end) => {
      visibleStart = start;
      visibleEnd = end;
    },
    lessonEngine,
    baseStart: BASE_START,
    octaves: OCTAVES
  });
}

function renderPracticeStats() {
  const snapshot = practiceEngine.getSnapshot();
  const status = getLessonDisplayStatus();
  const total = snapshot.totalSteps || 0;
  const completed = snapshot.completedSteps || 0;
  const accuracy = snapshot.accuracy;
  const timing = snapshot.averageTimingErrorMs == null
    ? null
    : `${Math.round(snapshot.averageTimingErrorMs)}ms avg`;

  if (practiceProgressEl) practiceProgressEl.style.width = `${snapshot.progressPercent}%`;
  if (practiceStepsEl) practiceStepsEl.textContent = `Steps ${completed}/${total}`;
  if (practiceAccuracyEl) {
    practiceAccuracyEl.textContent = `Accuracy ${accuracy == null ? "--" : `${accuracy}%`}${timing ? ` / ${timing}` : ""}`;
  }
  if (practiceStreakEl) practiceStreakEl.textContent = `Streak ${snapshot.currentStreak}`;
  if (practiceTimeEl) practiceTimeEl.textContent = `Time ${formatDuration(snapshot.elapsedMs)}`;
  if (practiceFeedbackEl) practiceFeedbackEl.textContent = snapshot.lastMessage;

  if (practiceSummaryEl) {
    if (snapshot.completed) {
      practiceSummaryEl.hidden = false;
      const rhythmSummary = snapshot.mode === "rhythmDrill"
        ? ` Rhythm: ${snapshot.rhythmHits} on time, ${snapshot.rhythmEarly} early, ${snapshot.rhythmLate} late, ${snapshot.rhythmMisses} missed${timing ? `, ${timing}` : ""}.`
        : "";
      practiceSummaryEl.textContent = `Complete: ${completed}/${total} steps, ${accuracy == null ? "--" : `${accuracy}%`} accuracy, best streak ${snapshot.bestStreak}, avg step ${formatDuration(snapshot.averageStepMs)}.${rhythmSummary}`;
    } else {
      practiceSummaryEl.hidden = true;
      practiceSummaryEl.textContent = "";
    }
  }

  if (
    practiceFeedbackEl &&
    !rhythmExample.active &&
    appMode === "lesson" &&
    !status.active &&
    status.title &&
    status.title !== "(none)" &&
    snapshot.lastMessage === "Start a lesson to track progress."
  ) {
    practiceFeedbackEl.textContent = "Press Start when you are ready.";
  }

  if (
    practiceFeedbackEl &&
    !rhythmExample.active &&
    appMode === "lesson" &&
    status.preview
  ) {
    practiceFeedbackEl.textContent = getPreviewFeedback(status);
  }

  if (practiceFeedbackEl && rhythmExample.active) {
    practiceFeedbackEl.textContent = "Playing the example. Watch the guide before you try it.";
  }

  renderRhythmGuide(status);
}

function setAppMode(nextMode) {
  const normalized = nextMode === "lesson" ? "lesson" : "freePlay";
  if (appMode === normalized) return;

  appMode = normalized;
  closeMenus();
  clearRhythmExample();

  if (appMode === "freePlay" && lessonEngine.active) {
    lessonEngine.stop("modechange");
  }

  renderAppMode();
}

function renderAppMode() {
  const isLessonMode = appMode === "lesson";

  if (practiceHudEl) practiceHudEl.hidden = !isLessonMode;
  if (freePlayModeBtn) freePlayModeBtn.setAttribute("aria-pressed", String(!isLessonMode));
  if (lessonModeBtn) lessonModeBtn.setAttribute("aria-pressed", String(isLessonMode));

  if (!isLessonMode) {
    renderEarTrainingControls(null);
    renderRhythmGuide(null);
    renderTeachingNotes(null);
  } else {
    renderLessonStatus(getLessonDisplayStatus());
    renderPracticeStats();
  }
}

function handlePracticeEvent(event) {
  if (event.type === "lessonstop") clearRhythmExample();
  if (event.type === "rhythmbeat") playMetronomeClick(event.detail?.isDownbeat);
  practiceEngine.handleEvent(event);
  renderPracticeStats();
}

function playMetronomeClick(isDownbeat = false) {
  if (!audioEnabled || !audio.ctx || !audio.master || audio.ctx.state !== "running") return;

  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(isDownbeat ? 1320 : 990, now);
  gain.gain.setValueAtTime(isDownbeat ? 0.18 : 0.11, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(now);
  osc.stop(now + 0.05);
}

function closeMenus(exceptPanel = null) {
  for (const { button, panel } of menuPairs) {
    if (!button || !panel || panel === exceptPanel) continue;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }
}

function setupMenus() {
  for (const { button, panel } of menuPairs) {
    if (!button || !panel) continue;

    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = panel.hidden;
      closeMenus(panel);
      panel.hidden = !willOpen;
      button.setAttribute("aria-expanded", String(willOpen));
    });

    panel.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  document.addEventListener("click", () => closeMenus());
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenus();
  });
}

function noteOn(evt) {
  const { note, velocity } = evt;

  sustainedNotes.delete(note);
  const priorTimer = sustainTimers.get(note);
  if (priorTimer) {
    clearTimeout(priorTimer);
    sustainTimers.delete(note);
  }

  pressedNotes.add(note);
  const el = noteToEl.get(note);
  if (el) {
    el.classList.add("active");
    el.classList.remove("sustained");
  }
  audio.noteOn(note, velocity);
  lessonEngine.handleNoteOn(note);
}

function noteOff(evt) {
  const { note } = evt;

  pressedNotes.delete(note);
  lessonEngine.handleNoteOff(note);

  const el = noteToEl.get(note);

  if (sustainOn) {
    sustainedNotes.add(note);
    if (el) {
      el.classList.remove("active");
      el.classList.add("sustained");
    }

    const prior = sustainTimers.get(note);
    if (prior) clearTimeout(prior);
    sustainTimers.set(
      note,
      setTimeout(() => {
        sustainTimers.delete(note);
        const keyEl = noteToEl.get(note);
        if (keyEl) keyEl.classList.remove("sustained");
      }, SUSTAIN_VISUAL_TTL_MS)
    );
    return;
  }

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

  if (!sustainOn) {
    for (const note of Array.from(sustainedNotes)) {
      if (!pressedNotes.has(note)) {
        const el = noteToEl.get(note);
        if (el) el.classList.remove("sustained");
        audio.noteOff(note);
        sustainedNotes.delete(note);
        const tid = sustainTimers.get(note);
        if (tid) {
          clearTimeout(tid);
          sustainTimers.delete(note);
        }
      }
    }

    for (const tid of sustainTimers.values()) clearTimeout(tid);
    sustainTimers.clear();
  }
}

function handleNoteEnded(note) {
  if (!pressedNotes.has(note)) {
    sustainedNotes.delete(note);
    const el = noteToEl.get(note);
    if (el) el.classList.remove("sustained");
  }
}

async function setAudioEnabled(next) {
  audioEnabled = !!next;

  const btn = document.getElementById("btnAudio");
  btn.setAttribute("aria-pressed", String(audioEnabled));
  btn.textContent = audioEnabled ? "Audio: On" : "Audio: Off";

  statusEl.textContent = audioEnabled ? "Audio: enabling..." : "Audio: muted";

  try {
    if (audioEnabled) {
      await audio.ensureStarted();
      statusEl.textContent = "Audio: enabled";
    } else {
      audio.allOff();
      if (audio.ctx) await audio.ctx.suspend();
      statusEl.textContent = "Audio: muted";
    }
  } catch (err) {
    audioEnabled = false;
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = "Audio: Off";
    statusEl.textContent = "Audio: unavailable";
    throw err;
  }
}

function setPlayMode(next) {
  playMode = (next === "organ") ? "organ" : "piano";

  const btn = document.getElementById("btnMode");
  const isOrgan = playMode === "organ";
  btn.setAttribute("aria-pressed", String(isOrgan));
  btn.textContent = isOrgan ? "Mode: Organ" : "Mode: Piano";
}

function setOctaveOffset(next) {
  octaveOffset = Math.max(-3, Math.min(3, next));
  audio.allOff();
  setSustain(false);
  midiInput.reset();
  pressedNotes.clear();
  pointerToNote.clear();
  keyboardHeld.clear();
  sustainedNotes.clear();
  renderPiano();
}

function renderMidiStatus(status) {
  if (midiToggleBtn) {
    const isOn = !!status.enabled;
    midiToggleBtn.setAttribute("aria-pressed", String(isOn));
    midiToggleBtn.textContent = isOn ? "MIDI: On" : "MIDI: Off";
    midiToggleBtn.disabled = status.state === "unsupported";
  }

  if (midiStatusEl) {
    if (status.state === "unsupported") {
      midiStatusEl.textContent = "MIDI: not supported by this browser";
    } else if (status.inputNames?.length > 1) {
      midiStatusEl.textContent = `${status.message}: ${status.inputNames.join(", ")}`;
    } else if (status.inputNames?.length) {
      midiStatusEl.textContent = status.message;
    } else {
      midiStatusEl.textContent = status.message;
    }
  }
}

function setLessonControlsEnabled(isLoaded) {
  const startBtn = document.getElementById("btnLessonStart");
  const stopBtn = document.getElementById("btnLessonStop");
  const prevBtn = document.getElementById("btnLessonPrev");
  const nextBtn = document.getElementById("btnLessonNext");
  startBtn.disabled = !isLoaded;
  stopBtn.disabled = !isLoaded;
  prevBtn.disabled = !isLoaded;
  nextBtn.disabled = !isLoaded;
}

function renderLessonStatus(status) {
  const el = document.getElementById("lessonStatus");
  if (!el) return;

  if (!lessonManifest) {
    el.textContent = "Lesson: (pack not loaded)";
    renderPracticeHeader(null);
    return;
  }

  if (!status || !status.title) {
    el.textContent = "Lesson: Ready";
    renderPracticeHeader(status);
    return;
  }

  if (!status.active) {
    el.textContent = `Lesson: ${status.title} (ready)`;
  } else if (status.awaitingRelease) {
    el.textContent = `Lesson: ${status.title} • Step ${status.stepNum}/${status.total}: Release`;
  } else {
    el.textContent = `Lesson: ${status.title} • Step ${status.stepNum}/${status.total}: ${status.stepLabel}`;
  }

  renderPracticeHeader(status);
}

function renderLessonError(message) {
  const el = document.getElementById("lessonStatus");
  if (!el) return;
  el.textContent = `Lesson: ${message}`;
  renderPracticeHeader(null);
}

function getLessonDisplayStatus() {
  const activeStatus = lessonEngine.getStatus();
  if (activeStatus.active) return activeStatus;

  const lesson = getSelectedLesson();
  if (!lesson) return activeStatus;

  return createLessonPreviewStatus(lesson);
}

function createLessonPreviewStatus(lesson) {
  const challenges = getPreviewChallenges(lesson);
  const firstChallenge = challenges[0] || null;
  return {
    active: false,
    preview: true,
    mode: lesson.mode || "stepLesson",
    title: lesson.title || "(none)",
    stepIndex: 0,
    stepNum: challenges.length ? 1 : 0,
    total: challenges.length,
    stepLabel: getChallengeLabel(firstChallenge),
    awaitingRelease: false,
    settings: lesson.settings || {},
    teaching: getTeachingNotes(lesson, firstChallenge),
    challenges,
    currentChallenge: firstChallenge,
    inputIndex: 0,
    rhythmReady: false,
    rhythm: null
  };
}

function getPreviewChallenges(lesson) {
  const challenges = lesson.challenges || lesson.steps || [];
  return challenges.flatMap((challenge, idx) => {
    if (challenge.type !== "generatedEarTraining") return [challenge];
    return [{
      id: challenge.id || `generated-preview-${idx + 1}`,
      type: "heardChord",
      label: challenge.label || "Listen and choose the chord quality",
      hint: challenge.hint || "Generated quiz questions will be created when you press Start.",
      prompt: { type: "chord" },
      choices: challenge.generator?.choices || challenge.generator?.qualities || []
    }];
  });
}

function getChallengeLabel(challenge) {
  if (!challenge) return "";
  const label = challenge.label || "Play";
  const notes = getChallengeDisplayNotes(challenge);
  return notes.length ? `${label} (${notes.map(midiToName).join(", ")})` : label;
}

function getChallengeDisplayNotes(challenge) {
  if (challenge.notes) return challenge.notes;
  if (challenge.sequence) return challenge.sequence;
  if (challenge.rhythm) return challenge.rhythm.map(event => event.note).filter(Number.isFinite);
  if (challenge.prompt?.notes) return challenge.prompt.notes;
  if (challenge.prompt?.chords) return challenge.prompt.chords.flatMap(chord => chord.notes || []);
  return [];
}

function getPreviewFeedback(status) {
  if (status.mode === "rhythmDrill") {
    return "Study the rhythm guide or play the example, then press Start.";
  }
  if (status.mode === "earTraining") {
    return "Press Start to hear the prompt and answer the question.";
  }
  if (status.mode === "scaleDrill" || status.mode === "intervalDrill") {
    return "Review the first target, then press Start.";
  }
  return "Review the first target, then press Start.";
}

function getTeachingNotes(lesson, challenge) {
  const fingering = challenge?.fingering || lesson.fingering || null;
  return {
    goal: lesson.goal || "",
    overview: lesson.overview || lesson.description || "",
    instructions: Array.isArray(lesson.instructions) ? lesson.instructions : [],
    hint: challenge?.hint || lesson.hint || "",
    fingering
  };
}

function renderPracticeHeader(status) {
  if (!practiceTitleEl || !practiceStepLabelEl) return;

  if (!status || !status.title || status.title === "(none)") {
    practiceTitleEl.textContent = "No lesson active";
    practiceStepLabelEl.textContent = "Choose a lesson, then press Start.";
    renderEarTrainingControls(null);
    renderRhythmGuide(null);
    renderTeachingNotes(null);
    return;
  }

  practiceTitleEl.textContent = status.active
    ? status.title
    : `${status.title} ready`;

  if (status.preview) {
    practiceStepLabelEl.textContent = status.total
      ? `Step ${status.stepNum}/${status.total}: ${status.stepLabel}`
      : "Press Start to begin.";
  } else if (!status.active) {
    practiceStepLabelEl.textContent = "Choose a lesson and press Start.";
  } else if (status.awaitingRelease) {
    practiceStepLabelEl.textContent = `Step ${status.stepNum}/${status.total}: release the target notes.`;
  } else if (status.rhythmReady) {
    practiceStepLabelEl.textContent = `Step ${status.stepNum}/${status.total}: study the pattern, then press Begin Rhythm.`;
  } else {
    practiceStepLabelEl.textContent = `Step ${status.stepNum}/${status.total}: ${status.stepLabel}`;
  }
  renderTeachingNotes(status);
  renderEarTrainingControls(status);
  renderRhythmGuide(status);
}

function renderTeachingNotes(status) {
  if (!lessonTeachingEl || !lessonGoalEl || !lessonOverviewEl || !lessonInstructionsEl || !lessonHintEl) return;

  const teaching = status?.teaching || getTeachingNotes(getSelectedLesson() || {}, status?.currentChallenge);
  const instructions = Array.isArray(teaching.instructions) ? teaching.instructions : [];
  const fingeringText = formatFingering(teaching.fingering);
  const hasContent = !!(teaching.goal || teaching.overview || teaching.hint || instructions.length || fingeringText.length);
  lessonTeachingEl.hidden = !hasContent || appMode !== "lesson";

  if (!hasContent) {
    lessonGoalEl.textContent = "";
    lessonOverviewEl.textContent = "";
    lessonInstructionsEl.innerHTML = "";
    lessonHintEl.hidden = true;
    lessonHintEl.textContent = "";
    return;
  }

  lessonGoalEl.textContent = teaching.goal ? `Goal: ${teaching.goal}` : "";
  lessonOverviewEl.textContent = teaching.overview || "";
  lessonInstructionsEl.innerHTML = "";
  for (const item of instructions) {
    const li = document.createElement("li");
    li.textContent = item;
    lessonInstructionsEl.appendChild(li);
  }
  for (const item of fingeringText) {
    const li = document.createElement("li");
    li.textContent = item;
    lessonInstructionsEl.appendChild(li);
  }
  lessonHintEl.hidden = !teaching.hint;
  lessonHintEl.textContent = teaching.hint ? `Hint: ${teaching.hint}` : "";
}

function formatFingering(fingering) {
  if (!fingering) return [];

  const hand = formatHand(fingering.hand);
  const lines = [];
  const pattern = fingering.pattern ? ` Suggested pattern: ${fingering.pattern}.` : "";
  lines.push(`${hand}: finger numbers are 1 thumb, 2 index, 3 middle, 4 ring, 5 pinky.${pattern}`);

  const noteMap = fingering.notes || {};
  const noteLines = Object.entries(noteMap)
    .map(([note, finger]) => {
      const midiNote = Number(note);
      if (!Number.isInteger(midiNote)) return null;
      return `${midiToName(midiNote)}: ${fingerName(finger)}`;
    })
    .filter(Boolean);

  if (noteLines.length) {
    lines.push(`Use ${noteLines.join(", ")}.`);
  }

  if (fingering.note) lines.push(fingering.note);
  return lines;
}

function formatHand(hand) {
  if (hand === "left") return "Left hand";
  if (hand === "both") return "Both hands";
  return "Right hand";
}

function fingerName(finger) {
  const names = {
    1: "1 thumb",
    2: "2 index",
    3: "3 middle",
    4: "4 ring",
    5: "5 pinky"
  };
  return names[finger] || `finger ${finger}`;
}

function renderRhythmGuide(status) {
  if (!rhythmGuideEl || !rhythmGuideMetaEl || !rhythmGuideEventsEl) return;

  const challenge = status?.currentChallenge;
  const events = Array.isArray(challenge?.rhythm) ? challenge.rhythm : [];
  const show = appMode === "lesson" && status?.title && status.mode === "rhythmDrill" && events.length > 0;
  const exampleActive = rhythmExample.active && rhythmExample.stepIndex === status?.stepIndex;
  const guideIndex = exampleActive ? rhythmExample.eventIndex : (status?.inputIndex ?? 0);
  rhythmGuideEl.hidden = !show;
  rhythmGuideEventsEl.innerHTML = "";
  if (beginRhythmBtn) {
    beginRhythmBtn.hidden = !show || !status.rhythmReady || status.preview;
    beginRhythmBtn.disabled = exampleActive;
  }
  if (playRhythmExampleBtn) {
    playRhythmExampleBtn.hidden = !show || (!status.rhythmReady && !status.preview);
    playRhythmExampleBtn.disabled = exampleActive;
    playRhythmExampleBtn.textContent = exampleActive ? "Playing Example" : "Play Example";
  }

  if (!show) {
    rhythmGuideMetaEl.textContent = "";
    return;
  }

  const activeEvent = events[guideIndex];
  const beatOffset = events
    .slice(0, guideIndex)
    .reduce((sum, event) => sum + rhythmBeats(event), 0);
  const activeLabel = activeEvent?.note == null ? "Rest" : midiToName(activeEvent.note);
  rhythmGuideMetaEl.textContent = exampleActive
    ? `Example: ${activeLabel} at beat ${formatBeatPosition(beatOffset)}. Watch the blocks and listen for where notes and rests land.`
    : status.preview
    ? `Study this rhythm before you start. Use Play Example to hear the pattern without scoring.`
    : status.rhythmReady
    ? `Study this rhythm first. Gray blocks are rests. Press Begin Rhythm when you are ready for the count-in.`
    : `Current target: ${activeLabel} at beat ${formatBeatPosition(beatOffset)}. Rests are gray; the bright block is next.`;

  for (let idx = 0; idx < events.length; idx += 1) {
    const event = events[idx];
    const beats = rhythmBeats(event);
    const isRest = event.note == null;
    const item = document.createElement("div");
    item.className = `rhythmEvent${isRest ? " rest" : " note"}${idx === guideIndex && (exampleActive || !status.rhythmReady) ? " current" : ""}${!exampleActive && !status.rhythmReady && idx < guideIndex ? " complete" : ""}`;
    item.style.flexGrow = String(Math.max(0.5, beats));

    const label = document.createElement("span");
    label.className = "rhythmEventLabel";
    label.textContent = isRest ? "Rest" : midiToName(event.note);

    const beatLabel = document.createElement("span");
    beatLabel.className = "rhythmEventBeats";
    beatLabel.textContent = formatBeatLength(beats);

    item.append(label, beatLabel);
    rhythmGuideEventsEl.appendChild(item);
  }
}

function rhythmBeats(event) {
  return typeof event?.beats === "number" && Number.isFinite(event.beats) && event.beats > 0
    ? event.beats
    : 1;
}

function formatBeatLength(beats) {
  if (beats === 0.5) return "1/2 beat";
  if (beats === 1) return "1 beat";
  return `${beats} beats`;
}

function formatBeatPosition(offset) {
  const beat = Math.floor(offset) + 1;
  const fraction = offset - Math.floor(offset);
  if (fraction === 0) return String(beat);
  if (fraction === 0.5) return `${beat} + 1/2`;
  return `${Math.round((offset + 1) * 100) / 100}`;
}

async function playRhythmExample() {
  const status = getLessonDisplayStatus();
  const events = Array.isArray(status.currentChallenge?.rhythm)
    ? status.currentChallenge.rhythm
    : [];
  if (status.mode !== "rhythmDrill" || (!status.rhythmReady && !status.preview) || events.length === 0) return;

  clearRhythmExample();

  try {
    await setAudioEnabled(true);
  } catch {
    return;
  }

  const settings = status.settings || {};
  const tempo = positiveNumber(settings.tempo, 80);
  const msPerBeat = 60000 / tempo;
  const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature || "4/4");
  const countInBeats = Math.max(0, Number.isFinite(settings.countInBeats)
    ? Number(settings.countInBeats)
    : beatsPerMeasure);
  const totalBeats = events.reduce((sum, event) => sum + rhythmBeats(event), 0);
  const exampleStartDelay = countInBeats * msPerBeat;

  rhythmExample = {
    active: true,
    stepIndex: status.stepIndex,
    eventIndex: null
  };
  if (practiceFeedbackEl) {
    practiceFeedbackEl.textContent = "Playing the example. Watch the guide before you try it.";
  }
  renderRhythmGuide(status);

  for (let beat = 0; beat < countInBeats + Math.ceil(totalBeats); beat += 1) {
    const timer = setTimeout(() => {
      playMetronomeClick(beat % beatsPerMeasure === 0);
    }, beat * msPerBeat);
    rhythmExampleTimers.add(timer);
  }

  let beatOffset = 0;
  events.forEach((event, idx) => {
    const eventDelay = exampleStartDelay + beatOffset * msPerBeat;
    const highlightTimer = setTimeout(() => {
      rhythmExample.eventIndex = idx;
      renderRhythmGuide(lessonEngine.getStatus());
    }, eventDelay);
    rhythmExampleTimers.add(highlightTimer);

    if (event.note != null) {
      const noteTimer = setTimeout(() => {
        playExampleNote(event.note, Math.min(520, rhythmBeats(event) * msPerBeat * 0.72));
      }, eventDelay);
      rhythmExampleTimers.add(noteTimer);
    }

    beatOffset += rhythmBeats(event);
  });

  const doneTimer = setTimeout(() => {
    clearRhythmExample();
    const nextStatus = getLessonDisplayStatus();
    renderRhythmGuide(nextStatus);
    if (practiceFeedbackEl && nextStatus.preview) {
      practiceFeedbackEl.textContent = "Example complete. Press Start when you are ready.";
    } else if (practiceFeedbackEl && nextStatus.rhythmReady) {
      practiceFeedbackEl.textContent = "Example complete. Press Begin Rhythm when you are ready.";
    }
  }, exampleStartDelay + totalBeats * msPerBeat + 120);
  rhythmExampleTimers.add(doneTimer);
}

function playExampleNote(note, durationMs) {
  const v = Number(velEl?.value) || 0.8;
  audio.noteOn(note, v);
  setTimeout(() => audio.noteOff(note), Math.max(120, durationMs));
}

function clearRhythmExample() {
  for (const timer of rhythmExampleTimers) clearTimeout(timer);
  rhythmExampleTimers.clear();
  rhythmExample = {
    active: false,
    stepIndex: null,
    eventIndex: null
  };
}

function positiveNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function getBeatsPerMeasure(timeSignature) {
  const match = String(timeSignature).match(/^(\d+)\s*\/\s*\d+$/);
  if (!match) return 4;
  return Math.max(1, Number(match[1]) || 4);
}

function renderEarTrainingControls(status) {
  if (!earTrainingControlsEl || !earChoicesEl) return;

  const challenge = status?.currentChallenge;
  const show = status?.active && status.mode === "earTraining" && challenge;
  earTrainingControlsEl.hidden = !show;
  earChoicesEl.innerHTML = "";

  if (!show) return;

  if (playPromptBtn) {
    playPromptBtn.textContent = getPromptButtonLabel(challenge.prompt);
  }

  if (challenge.scored === false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Continue";
    btn.addEventListener("click", () => {
      lessonEngine.continueCurrentChallenge();
    });
    earChoicesEl.appendChild(btn);
    return;
  }

  for (const choice of challenge.choices || []) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = choice;
    btn.addEventListener("click", () => {
      lessonEngine.answerCurrentChallenge(choice);
    });
    earChoicesEl.appendChild(btn);
  }
}

function getPromptButtonLabel(prompt) {
  if (prompt?.type === "progression") return "Play Progression";
  if (prompt?.type === "chord") return "Play Chord";
  if (prompt?.type === "interval") return "Play Interval";
  return "Play Prompt";
}

async function playCurrentEarPrompt() {
  const status = lessonEngine.getStatus();
  const challenge = status.currentChallenge;
  if (!status.active || status.mode !== "earTraining" || !challenge?.prompt) return;

  try {
    await setAudioEnabled(true);
  } catch {
    return;
  }

  const prompt = challenge.prompt;
  if (Array.isArray(prompt.notes)) {
    playNotes(prompt.notes, prompt.playStyle || "blocked");
  } else if (Array.isArray(prompt.chords)) {
    playChordSequence(prompt.chords);
  }
}

function playNotes(notes, playStyle = "blocked") {
  const v = Number(velEl?.value) || 0.8;
  const dur = 550;
  const gap = 170;

  if (playStyle === "arpeggiated" || playStyle === "melodic") {
    notes.forEach((note, idx) => {
      setTimeout(() => {
        audio.noteOn(note, v);
        setTimeout(() => audio.noteOff(note), dur);
      }, idx * (dur + gap));
    });
    return;
  }

  notes.forEach(note => audio.noteOn(note, v));
  setTimeout(() => notes.forEach(note => audio.noteOff(note)), dur);
}

function playChordSequence(chords) {
  const dur = 650;
  const gap = 220;
  chords.forEach((chord, idx) => {
    setTimeout(() => {
      playNotes(chord.notes || [], "blocked");
    }, idx * (dur + gap));
  });
}

async function initLessons() {
  try {
    lessonManifest = await loadLessonPack(LESSON_PACK_ID);

    const select = document.getElementById("lessonSelect");
    select.innerHTML = "";

    const lessons = lessonManifest.lessons || [];
    for (const item of lessons) {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.title || item.id;
      opt.dataset.file = item.file;
      select.appendChild(opt);
    }

    if (lessons.length === 0) {
      setLessonControlsEnabled(false);
      renderLessonStatus(null);
      return;
    }

    await preloadLessonFromSelect();
    setLessonControlsEnabled(true);
    renderLessonStatus(getLessonDisplayStatus());

    select.addEventListener("change", async () => {
      try {
        clearRhythmExample();
        await preloadLessonFromSelect();
        setLessonControlsEnabled(true);
        if (lessonEngine.active) {
          const l = getSelectedLesson();
          if (l) lessonEngine.start(expandGeneratedChallenges(l));
        } else {
          renderLessonStatus(getLessonDisplayStatus());
          renderPracticeStats();
        }
      } catch (err) {
        console.error("Lesson load failed:", err);
        setLessonControlsEnabled(false);
        renderLessonError("failed to load");
      }
    });

    document.getElementById("btnLessonStart").addEventListener("click", () => {
      const l = getSelectedLesson();
      if (l) lessonEngine.start(expandGeneratedChallenges(l));
    });

    document.getElementById("btnLessonStop").addEventListener("click", () => {
      lessonEngine.stop();
    });

    document.getElementById("btnLessonPrev").addEventListener("click", () => {
      lessonEngine.prev();
    });

    document.getElementById("btnLessonNext").addEventListener("click", () => {
      lessonEngine.next();
    });
  } catch (err) {
    console.error("Lesson init failed:", err);
    setLessonControlsEnabled(false);
    renderLessonError("failed to load");
  }
}

function getSelectedLessonId() {
  const select = document.getElementById("lessonSelect");
  return select?.value || null;
}

function getSelectedLessonFile() {
  const select = document.getElementById("lessonSelect");
  const opt = select?.selectedOptions?.[0];
  return opt?.dataset?.file || null;
}

function getSelectedLesson() {
  const id = getSelectedLessonId();
  if (!id) return null;
  return loadedLessons.get(id) || null;
}

async function preloadLessonFromSelect() {
  const id = getSelectedLessonId();
  const file = getSelectedLessonFile();
  if (!id || !file) return;

  if (!loadedLessons.has(id)) {
    const lesson = await loadLesson(LESSON_PACK_ID, file);
    loadedLessons.set(id, lesson);
  }

  renderLessonStatus(getLessonDisplayStatus());
}

document.getElementById("btnAudio").addEventListener("click", async () => {
  try {
    await setAudioEnabled(!audioEnabled);
  } catch {
    // status is already set in setAudioEnabled
  }
});

document.getElementById("btnSustain").addEventListener("click", () => {
  setSustain(!sustainOn);
});

document.getElementById("btnMode").addEventListener("click", () => {
  setPlayMode(playMode === "piano" ? "organ" : "piano");
});

if (freePlayModeBtn) {
  freePlayModeBtn.addEventListener("click", () => setAppMode("freePlay"));
}

if (lessonModeBtn) {
  lessonModeBtn.addEventListener("click", () => setAppMode("lesson"));
}

volEl.addEventListener("input", () => {
  audio.setVolume(Number(volEl.value));
});

if (panWidthEl) {
  panWidthEl.addEventListener("input", () => {
    panWidth = Number(panWidthEl.value) || 1.0;
  });
}

if (panTestBtn) {
  panTestBtn.addEventListener("click", async () => {
    try {
      await setAudioEnabled(true);
    } catch {}
    const v = Number(velEl?.value) || 0.8;
    const low = visibleStart;
    const high = visibleEnd;
    const dur = 180;
    const gap = 120;

    audio.noteOn(low, v);
    setTimeout(() => audio.noteOff(low), dur);

    setTimeout(() => {
      audio.noteOn(high, v);
      setTimeout(() => audio.noteOff(high), dur);
    }, dur + gap);
  });
}

if (midiToggleBtn) {
  midiToggleBtn.addEventListener("click", async () => {
    try {
      if (midiInput.isEnabled()) {
        midiInput.disable();
      } else {
        await midiInput.enable();
      }
    } catch (err) {
      console.error("MIDI init failed:", err);
    }
  });
}

if (playPromptBtn) {
  playPromptBtn.addEventListener("click", () => {
    void playCurrentEarPrompt();
  });
}

if (beginRhythmBtn) {
  beginRhythmBtn.addEventListener("click", () => {
    clearRhythmExample();
    lessonEngine.beginRhythm();
  });
}

if (playRhythmExampleBtn) {
  playRhythmExampleBtn.addEventListener("click", () => {
    void playRhythmExample();
  });
}

document.getElementById("btnOctDown").addEventListener("click", () => setOctaveOffset(octaveOffset - 1));
document.getElementById("btnOctUp").addEventListener("click", () => setOctaveOffset(octaveOffset + 1));

setupInputHandlers({
  pianoEl,
  velEl,
  pointerToNote,
  keyboardHeld,
  noteOn,
  noteOff,
  setPlayMode,
  getPlayMode: () => playMode,
  setSustain,
  getSustainOn: () => sustainOn,
  setOctaveOffset,
  getOctaveOffset: () => octaveOffset,
  baseStart: BASE_START
});

window.addEventListener("blur", () => {
  audio.allOff();
  setSustain(false);
  clearRhythmExample();
  midiInput.reset();
  for (const tid of sustainTimers.values()) clearTimeout(tid);
  sustainTimers.clear();
  pressedNotes.clear();
  pointerToNote.clear();
  keyboardHeld.clear();
  sustainedNotes.clear();
  void setAudioEnabled(false).catch(() => {});

  for (const el of noteToEl.values()) {
    el.classList.remove("active");
    el.classList.remove("sustained");
  }
});

setupMenus();
setPlayMode("piano");
renderAppMode();
renderPiano();
renderPracticeStats();
setInterval(() => {
  if (practiceEngine.getSnapshot().active) renderPracticeStats();
}, 1000);
initLessons();
