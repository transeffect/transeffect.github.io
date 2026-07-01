import { midiToName } from "./constants.js";

export class LessonEngine {
  constructor({ noteToEl, onStatus, onPracticeEvent = () => {} }) {
    this.active = false;
    this.lesson = null;
    this.stepIndex = 0;
    this.inputIndex = 0;
    this.held = new Set();
    this.awaitingRelease = false;
    this.stepStartedAt = 0;
    this.noteToEl = noteToEl;
    this.onStatus = onStatus;
    this.onPracticeEvent = onPracticeEvent;
    this.rhythmTimers = new Set();
    this.rhythmState = null;
  }

  start(lesson) {
    this.clearRhythmTimers();
    this.lesson = lesson;
    this.stepIndex = 0;
    this.inputIndex = 0;
    this.held.clear();
    this.awaitingRelease = false;
    this.stepStartedAt = performance.now();
    this.active = true;
    this._emitPractice("lessonstart", this.getStatus());
    if (this.isRhythmMode()) {
      this.startRhythmStep();
    } else {
      this.refreshTargets();
    }
    this._emitStatus();
  }

  stop(reason = "stopped") {
    this.clearRhythmTimers();
    this.active = false;
    this.held.clear();
    this.inputIndex = 0;
    this.awaitingRelease = false;
    this.rhythmState = null;
    this.clearTargets();
    this._emitPractice("lessonstop", { reason, ...this.getStatus() });
    this._emitStatus();
  }

  refreshTargets() {
    if (!this.active || !this.lesson) return;
    this.showTargets();
  }

  getStep() {
    if (!this.lesson) return null;
    return this.lesson.steps?.[this.stepIndex] ?? this.lesson.challenges?.[this.stepIndex] ?? null;
  }

  getStepLabel() {
    const step = this.getStep();
    if (!step) return "";
    const label = step.label || "Play";
    const notes = this.getDisplayNotes(step);
    return notes.length ? `${label} (${notes.map(midiToName).join(", ")})` : label;
  }

  showTargets() {
    this.clearTargets();
    const step = this.getStep();
    if (!step) return;
    this.getTargetNotes(step).forEach(n => {
      const el = this.noteToEl.get(n);
      if (el) el.classList.add("target");
    });
  }

  clearTargets() {
    for (const el of this.noteToEl.values()) {
      el.classList.remove("target");
      el.classList.remove("wrong");
    }
  }

  handleNoteOn(note) {
    if (!this.active || !this.lesson) return;

    const step = this.getStep();
    if (!step || this.awaitingRelease) return;

    if (this.isRhythmMode()) {
      this.handleRhythmNoteOn(note, step);
      return;
    }

    if (this.isOrderedMode()) {
      this.handleOrderedNoteOn(note, step);
      return;
    }

    const want = this.getRequiredNotes(step);
    if (!want.includes(note)) {
      const el = this.noteToEl.get(note);
      if (el) {
        el.classList.add("wrong");
        setTimeout(() => el.classList.remove("wrong"), 160);
      }
      this._emitPractice("wrongnote", {
        note,
        stepIndex: this.stepIndex,
        expectedNotes: want.slice()
      });
      return;
    }

    this.held.add(note);
    this._emitPractice("correctnote", {
      note,
      stepIndex: this.stepIndex
    });

    const allPressed = want.every(n => this.held.has(n));
    if (!allPressed) return;

    if (this.lesson.settings?.requireRelease) {
      this.awaitingRelease = true;
      this._emitStatus();
      return;
    }

    this.completeStep();
  }

  handleNoteOff(note) {
    this.held.delete(note);
    if (!this.active || !this.lesson || !this.awaitingRelease) return;

    const step = this.getStep();
    if (!step) return;

    const releasedRequiredNotes = this.getRequiredNotes(step).every(n => !this.held.has(n));
    if (releasedRequiredNotes) this.completeStep();
  }

  goToStep(idx) {
    if (!this.lesson) return;
    this.clearRhythmTimers();
    const max = this.getStepCount();
    this.stepIndex = Math.max(0, Math.min(max - 1, idx));
    this.inputIndex = 0;
    this.held.clear();
    this.awaitingRelease = false;
    this.stepStartedAt = performance.now();
    if (this.active) {
      if (this.isRhythmMode()) {
        this.startRhythmStep();
      } else {
        this.refreshTargets();
      }
    }
    this._emitStatus();
  }

  startRhythmStep() {
    const step = this.getStep();
    if (!step) return;

    this.clearRhythmTimers();
    this.inputIndex = 0;
    this.skipRhythmRests(step);

    const settings = this.lesson.settings || {};
    const tempo = positiveNumber(settings.tempo, 80);
    const toleranceMs = positiveNumber(settings.timingToleranceMs, 120);
    const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature || "4/4");
    const countInBeats = Math.max(0, Number.isFinite(settings.countInBeats)
      ? Number(settings.countInBeats)
      : beatsPerMeasure);
    const msPerBeat = 60000 / tempo;
    const now = performance.now();

    this.stepStartedAt = now + countInBeats * msPerBeat;
    this.rhythmState = {
      stepIndex: this.stepIndex,
      tempo,
      toleranceMs,
      beatsPerMeasure,
      countInBeats,
      metronome: settings.metronome !== false,
      msPerBeat,
      startedAt: this.stepStartedAt
    };

    this._emitPractice("rhythmcountin", {
      stepIndex: this.stepIndex,
      tempo,
      countInBeats,
      msPerBeat
    });

    this.scheduleRhythmBeatTicks(step);
    this.scheduleRhythmMissCheck(step);
    this.refreshTargets();
  }

  handleRhythmNoteOn(note, step) {
    this.skipRhythmRests(step);

    const event = this.getOrderedEvents(step)[this.inputIndex];
    if (!event) {
      this.completeStep();
      return;
    }

    const expected = event.note;
    const expectedAt = this.getRhythmExpectedTime(this.inputIndex);
    const playedAt = performance.now();
    const deltaMs = Math.round(playedAt - expectedAt);
    const toleranceMs = this.rhythmState?.toleranceMs ?? 120;

    if (note !== expected) {
      const el = this.noteToEl.get(note);
      if (el) {
        el.classList.add("wrong");
        setTimeout(() => el.classList.remove("wrong"), 160);
      }
      this._emitPractice("wrongnote", {
        note,
        stepIndex: this.stepIndex,
        expectedNotes: [expected]
      });
      return;
    }

    if (deltaMs < -toleranceMs) {
      this._emitPractice("rhythmearly", {
        note,
        stepIndex: this.stepIndex,
        inputIndex: this.inputIndex,
        deltaMs,
        toleranceMs
      });
      return;
    }

    if (deltaMs > toleranceMs) {
      this._emitPractice("rhythmlate", {
        note,
        stepIndex: this.stepIndex,
        inputIndex: this.inputIndex,
        deltaMs,
        toleranceMs
      });
      this.advanceRhythmInput(step);
      return;
    }

    this._emitPractice("rhythmhit", {
      note,
      stepIndex: this.stepIndex,
      inputIndex: this.inputIndex,
      deltaMs,
      toleranceMs
    });

    this.advanceRhythmInput(step);
  }

  advanceRhythmInput(step) {
    this.inputIndex += 1;
    this.skipRhythmRests(step);

    if (this.isOrderedStepComplete(step)) {
      this.completeStep();
      return;
    }

    this.refreshTargets();
    this._emitStatus();
    this.scheduleRhythmMissCheck(step);
  }

  handleOrderedNoteOn(note, step) {
    this.skipRests(step);

    const expected = this.getExpectedOrderedNote(step);
    if (expected == null) {
      this.completeStep();
      return;
    }

    if (note !== expected) {
      const el = this.noteToEl.get(note);
      if (el) {
        el.classList.add("wrong");
        setTimeout(() => el.classList.remove("wrong"), 160);
      }
      this._emitPractice("wrongnote", {
        note,
        stepIndex: this.stepIndex,
        expectedNotes: [expected]
      });
      return;
    }

    this._emitPractice("correctnote", {
      note,
      stepIndex: this.stepIndex,
      inputIndex: this.inputIndex
    });

    this.inputIndex += 1;
    this.skipRests(step);

    if (this.isOrderedStepComplete(step)) {
      this.completeStep();
    } else {
      this.refreshTargets();
      this._emitStatus();
    }
  }

  answerCurrentChallenge(answer) {
    if (!this.active || !this.lesson || this.lesson.mode !== "earTraining") return;

    const step = this.getStep();
    if (!step) return;

    if (answer === step.answer) {
      this._emitPractice("correctnote", {
        answer,
        stepIndex: this.stepIndex
      });
      this.completeStep();
      return;
    }

    this._emitPractice("wrongnote", {
      answer,
      stepIndex: this.stepIndex,
      expectedAnswer: step.answer
    });
    this._emitStatus();
  }

  completeStep() {
    if (!this.lesson) return;
    this.clearRhythmTimers();
    const elapsedMs = Math.max(0, performance.now() - this.stepStartedAt);
    this._emitPractice("stepcomplete", {
      stepIndex: this.stepIndex,
      stepNum: this.stepIndex + 1,
      total: this.getStepCount(),
      elapsedMs,
      stepLabel: this.getStepLabel()
    });
    this.next();
  }

  next() {
    if (!this.lesson) return;
    const max = this.getStepCount();
    const nextIdx = this.stepIndex + 1;
    if (nextIdx >= max) {
      this.stop("completed");
      return;
    }
    this.goToStep(nextIdx);
  }

  prev() {
    this.goToStep(this.stepIndex - 1);
  }

  _emitStatus() {
    this.onStatus(this.getStatus());
  }

  _emitPractice(type, detail = {}) {
    this.onPracticeEvent({ type, detail });
  }

  getStepCount() {
    return this.lesson?.steps?.length ?? this.lesson?.challenges?.length ?? 0;
  }

  isOrderedMode() {
    return ["scaleDrill", "intervalDrill"].includes(this.lesson?.mode);
  }

  isRhythmMode() {
    return this.lesson?.mode === "rhythmDrill";
  }

  getRequiredNotes(step) {
    return step.notes || [];
  }

  getDisplayNotes(step) {
    if (step.notes) return step.notes;
    if (step.sequence) return step.sequence;
    if (step.rhythm) return step.rhythm.map(event => event.note).filter(Number.isFinite);
    if (step.prompt?.notes) return step.prompt.notes;
    if (step.prompt?.chords) return step.prompt.chords.flatMap(chord => chord.notes || []);
    return [];
  }

  getTargetNotes(step) {
    if (this.isRhythmMode()) {
      this.skipRhythmRests(step);
      const expected = this.getExpectedOrderedNote(step);
      return expected == null ? [] : [expected];
    }
    if (this.isOrderedMode()) {
      this.skipRests(step);
      const expected = this.getExpectedOrderedNote(step);
      return expected == null ? [] : [expected];
    }
    if (this.lesson?.mode === "earTraining") return [];
    return this.getRequiredNotes(step);
  }

  getOrderedEvents(step) {
    if (step.sequence) return step.sequence.map(note => ({ note }));
    if (step.rhythm) return step.rhythm;
    return [];
  }

  getExpectedOrderedNote(step) {
    const event = this.getOrderedEvents(step)[this.inputIndex];
    return event?.note;
  }

  skipRests(step) {
    const events = this.getOrderedEvents(step);
    while (this.inputIndex < events.length && events[this.inputIndex].note == null) {
      this.inputIndex += 1;
    }
  }

  isOrderedStepComplete(step) {
    return this.inputIndex >= this.getOrderedEvents(step).length;
  }

  skipRhythmRests(step) {
    const events = this.getOrderedEvents(step);
    while (this.inputIndex < events.length && events[this.inputIndex].note == null) {
      this.inputIndex += 1;
    }
  }

  getRhythmExpectedTime(eventIndex) {
    const state = this.rhythmState;
    const step = this.getStep();
    if (!state || !step) return performance.now();

    const beatOffset = this.getOrderedEvents(step)
      .slice(0, eventIndex)
      .reduce((sum, event) => sum + positiveNumber(event.beats, 0), 0);
    return state.startedAt + beatOffset * state.msPerBeat;
  }

  scheduleRhythmMissCheck(step) {
    if (!this.rhythmState || !this.active || !this.isRhythmMode()) return;
    this.skipRhythmRests(step);

    const eventIndex = this.inputIndex;
    if (eventIndex >= this.getOrderedEvents(step).length) {
      this.completeStep();
      return;
    }

    const expectedAt = this.getRhythmExpectedTime(eventIndex);
    const fireAt = expectedAt + this.rhythmState.toleranceMs;
    const delay = Math.max(0, fireAt - performance.now());
    const timer = setTimeout(() => {
      this.rhythmTimers.delete(timer);
      if (!this.active || !this.isRhythmMode() || this.stepIndex !== this.rhythmState?.stepIndex) return;
      if (this.inputIndex !== eventIndex) return;

      const event = this.getOrderedEvents(step)[eventIndex];
      this._emitPractice("rhythmmiss", {
        note: event?.note,
        stepIndex: this.stepIndex,
        inputIndex: eventIndex,
        deltaMs: Math.round(performance.now() - expectedAt),
        toleranceMs: this.rhythmState.toleranceMs
      });
      this.advanceRhythmInput(step);
    }, delay);
    this.rhythmTimers.add(timer);
  }

  scheduleRhythmBeatTicks(step) {
    if (!this.rhythmState) return;
    if (!this.rhythmState.metronome) return;
    const totalBeats = this.getOrderedEvents(step)
      .reduce((sum, event) => sum + positiveNumber(event.beats, 0), 0);
    const firstBeat = -this.rhythmState.countInBeats;
    const lastBeat = Math.ceil(totalBeats);

    for (let beat = firstBeat; beat <= lastBeat; beat += 1) {
      const at = this.rhythmState.startedAt + beat * this.rhythmState.msPerBeat;
      const delay = Math.max(0, at - performance.now());
      const timer = setTimeout(() => {
        this.rhythmTimers.delete(timer);
        if (!this.active || !this.isRhythmMode() || this.stepIndex !== this.rhythmState?.stepIndex) return;
        this._emitPractice("rhythmbeat", {
          stepIndex: this.stepIndex,
          beat,
          isCountIn: beat < 0,
          isDownbeat: beat % this.rhythmState.beatsPerMeasure === 0
        });
      }, delay);
      this.rhythmTimers.add(timer);
    }
  }

  clearRhythmTimers() {
    for (const timer of this.rhythmTimers) clearTimeout(timer);
    this.rhythmTimers.clear();
  }

  getStatus() {
    const title = this.lesson?.title || "(none)";
    const total = this.getStepCount();
    const stepNum = total ? (this.stepIndex + 1) : 0;
    return {
      active: this.active,
      mode: this.lesson?.mode || "stepLesson",
      title,
      stepIndex: this.stepIndex,
      stepNum,
      total,
      stepLabel: this.getStepLabel(),
      awaitingRelease: this.awaitingRelease,
      challenges: this.lesson?.challenges || [],
      currentChallenge: this.getStep(),
      inputIndex: this.inputIndex,
      rhythm: this.rhythmState ? {
        tempo: this.rhythmState.tempo,
        toleranceMs: this.rhythmState.toleranceMs,
        countInBeats: this.rhythmState.countInBeats,
        msPerBeat: this.rhythmState.msPerBeat,
        startedAt: this.rhythmState.startedAt
      } : null
    };
  }
}

function positiveNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function getBeatsPerMeasure(timeSignature) {
  const match = String(timeSignature).match(/^(\d+)\s*\/\s*\d+$/);
  if (!match) return 4;
  return Math.max(1, Number(match[1]) || 4);
}
