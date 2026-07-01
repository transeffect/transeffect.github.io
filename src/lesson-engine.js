import { midiToName } from "./constants.js";

export class LessonEngine {
  constructor({ noteToEl, onStatus, onPracticeEvent = () => {} }) {
    this.active = false;
    this.lesson = null;
    this.stepIndex = 0;
    this.held = new Set();
    this.awaitingRelease = false;
    this.stepStartedAt = 0;
    this.noteToEl = noteToEl;
    this.onStatus = onStatus;
    this.onPracticeEvent = onPracticeEvent;
  }

  start(lesson) {
    this.lesson = lesson;
    this.stepIndex = 0;
    this.held.clear();
    this.awaitingRelease = false;
    this.stepStartedAt = performance.now();
    this.active = true;
    this.refreshTargets();
    this._emitPractice("lessonstart", this.getStatus());
    this._emitStatus();
  }

  stop(reason = "stopped") {
    this.active = false;
    this.held.clear();
    this.awaitingRelease = false;
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
    return this.lesson.steps?.[this.stepIndex] ?? null;
  }

  getStepLabel() {
    const step = this.getStep();
    if (!step) return "";
    const label = step.label || "Play";
    const notes = (step.notes || []).map(midiToName).join(", ");
    return `${label} (${notes})`;
  }

  showTargets() {
    this.clearTargets();
    const step = this.getStep();
    if (!step) return;
    (step.notes || []).forEach(n => {
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

    const want = step.notes || [];
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

    const releasedRequiredNotes = (step.notes || []).every(n => !this.held.has(n));
    if (releasedRequiredNotes) this.completeStep();
  }

  goToStep(idx) {
    if (!this.lesson) return;
    const max = this.lesson.steps?.length ?? 0;
    this.stepIndex = Math.max(0, Math.min(max - 1, idx));
    this.held.clear();
    this.awaitingRelease = false;
    this.stepStartedAt = performance.now();
    if (this.active) this.refreshTargets();
    this._emitStatus();
  }

  completeStep() {
    if (!this.lesson) return;
    const elapsedMs = Math.max(0, performance.now() - this.stepStartedAt);
    this._emitPractice("stepcomplete", {
      stepIndex: this.stepIndex,
      stepNum: this.stepIndex + 1,
      total: this.lesson.steps?.length ?? 0,
      elapsedMs,
      stepLabel: this.getStepLabel()
    });
    this.next();
  }

  next() {
    if (!this.lesson) return;
    const max = this.lesson.steps?.length ?? 0;
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

  getStatus() {
    const title = this.lesson?.title || "(none)";
    const total = this.lesson?.steps?.length ?? 0;
    const stepNum = total ? (this.stepIndex + 1) : 0;
    return {
      active: this.active,
      title,
      stepIndex: this.stepIndex,
      stepNum,
      total,
      stepLabel: this.getStepLabel(),
      awaitingRelease: this.awaitingRelease
    };
  }
}
