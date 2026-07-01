export const PRACTICE_MODES = Object.freeze({
  STEP_LESSON: "stepLesson",
  CHORD_DRILL: "chordDrill",
  SCALE_DRILL: "scaleDrill",
  INTERVAL_DRILL: "intervalDrill",
  RHYTHM_DRILL: "rhythmDrill",
  EAR_TRAINING: "earTraining"
});

const MODE_LABELS = Object.freeze({
  [PRACTICE_MODES.STEP_LESSON]: "Step Lesson",
  [PRACTICE_MODES.CHORD_DRILL]: "Chord Drill",
  [PRACTICE_MODES.SCALE_DRILL]: "Scale Drill",
  [PRACTICE_MODES.INTERVAL_DRILL]: "Interval Drill",
  [PRACTICE_MODES.RHYTHM_DRILL]: "Rhythm Drill",
  [PRACTICE_MODES.EAR_TRAINING]: "Ear Training"
});

const CHALLENGE_EVALUATORS = Object.freeze({
  [PRACTICE_MODES.STEP_LESSON]: {
    isCorrectNote({ note, challenge }) {
      return (challenge.notes || []).includes(note);
    },

    isComplete({ heldNotes, challenge }) {
      return (challenge.notes || []).every(note => heldNotes.has(note));
    }
  },
  [PRACTICE_MODES.CHORD_DRILL]: {
    isCorrectNote({ note, challenge }) {
      return (challenge.notes || []).includes(note);
    },

    isComplete({ heldNotes, challenge }) {
      return (challenge.notes || []).every(note => heldNotes.has(note));
    }
  },
  [PRACTICE_MODES.SCALE_DRILL]: {
    isCorrectNote({ note, challenge, inputIndex }) {
      return note === (challenge.sequence || [])[inputIndex];
    },

    isComplete({ inputIndex, challenge }) {
      return inputIndex >= (challenge.sequence || []).length;
    }
  },
  [PRACTICE_MODES.INTERVAL_DRILL]: {
    isCorrectNote({ note, challenge, inputIndex }) {
      return note === (challenge.sequence || [])[inputIndex];
    },

    isComplete({ inputIndex, challenge }) {
      return inputIndex >= (challenge.sequence || []).length;
    }
  },
  [PRACTICE_MODES.RHYTHM_DRILL]: {
    isCorrectRhythm({ events, challenge }) {
      const pattern = challenge.rhythm || [];
      return events.length === pattern.length;
    }
  },
  [PRACTICE_MODES.EAR_TRAINING]: {
    isCorrectAnswer({ answer, challenge }) {
      return answer === challenge.answer;
    }
  }
});

export class PracticeEngine {
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
    this.session = this._createSession();
  }

  reset() {
    this.session = this._createSession();
    return this.getSnapshot();
  }

  startSession({ mode = PRACTICE_MODES.STEP_LESSON, title = "", challenges = [] } = {}) {
    const normalizedMode = normalizePracticeMode(mode);
    this.session = this._createSession();
    this.session.active = true;
    this.session.mode = normalizedMode;
    this.session.modeLabel = getPracticeModeLabel(normalizedMode);
    this.session.lessonTitle = title;
    this.session.totalSteps = challenges.length;
    this.session.challengeCount = challenges.length;
    this.session.startedAt = this.now();
    this.session.lastMessage = `${this.session.modeLabel} started.`;
    return this.getSnapshot();
  }

  handleEvent(event) {
    const { type, detail = {} } = event;

    if (type === "lessonstart") {
      this.startSession({
        mode: detail.mode || PRACTICE_MODES.STEP_LESSON,
        title: detail.title || "",
        challenges: detail.challenges || createChallengePlaceholders(detail.total || 0)
      });
      this.session.lastMessage = "Lesson started. Play the highlighted notes.";
      return this.getSnapshot();
    }

    if (type === "correctnote") {
      if (!this.session.active) return this.getSnapshot();
      this.session.correctNotes += 1;
      this.session.lastMessage = "Correct note.";
      return this.getSnapshot();
    }

    if (type === "wrongnote") {
      if (!this.session.active) return this.getSnapshot();
      this.session.wrongNotes += 1;
      this.session.currentStreak = 0;
      this.session.lastMessage = "Wrong note. Try the highlighted target.";
      return this.getSnapshot();
    }

    if (type === "stepcomplete") {
      if (!this.session.active) return this.getSnapshot();
      this.session.completedSteps = Math.max(this.session.completedSteps, detail.stepNum || 0);
      this.session.currentStreak += 1;
      this.session.bestStreak = Math.max(this.session.bestStreak, this.session.currentStreak);
      this.session.stepTimes.push(detail.elapsedMs || 0);
      this.session.lastMessage = `Step ${detail.stepNum}/${detail.total} complete.`;
      return this.getSnapshot();
    }

    if (type === "lessonstop") {
      if (!this.session.active) return this.getSnapshot();
      this.session.active = false;
      this.session.endedAt = this.now();
      this.session.completed = detail.reason === "completed";
      this.session.lastMessage = this.session.completed
        ? "Lesson complete."
        : "Lesson stopped.";
      return this.getSnapshot();
    }

    return this.getSnapshot();
  }

  getSnapshot() {
    const attempts = this.session.correctNotes + this.session.wrongNotes;
    const accuracy = attempts
      ? Math.round((this.session.correctNotes / attempts) * 100)
      : null;
    const elapsedMs = this._elapsedMs();
    const progressPercent = this.session.totalSteps
      ? Math.min(100, Math.round((this.session.completedSteps / this.session.totalSteps) * 100))
      : 0;
    const averageStepMs = this.session.stepTimes.length
      ? this.session.stepTimes.reduce((sum, ms) => sum + ms, 0) / this.session.stepTimes.length
      : 0;

    return {
      ...this.session,
      attempts,
      accuracy,
      averageStepMs,
      elapsedMs,
      progressPercent
    };
  }

  _elapsedMs() {
    if (this.session.startedAt == null) return 0;
    const end = this.session.endedAt == null ? this.now() : this.session.endedAt;
    return Math.max(0, end - this.session.startedAt);
  }

  _createSession() {
    return {
      active: false,
      completed: false,
      mode: PRACTICE_MODES.STEP_LESSON,
      modeLabel: getPracticeModeLabel(PRACTICE_MODES.STEP_LESSON),
      lessonTitle: "",
      totalSteps: 0,
      challengeCount: 0,
      completedSteps: 0,
      correctNotes: 0,
      wrongNotes: 0,
      currentStreak: 0,
      bestStreak: 0,
      startedAt: null,
      endedAt: null,
      stepTimes: [],
      lastMessage: "Start a lesson to track progress."
    };
  }
}

export function getPracticeEvaluator(mode) {
  return CHALLENGE_EVALUATORS[normalizePracticeMode(mode)];
}

export function getPracticeModeLabel(mode) {
  return MODE_LABELS[normalizePracticeMode(mode)];
}

export function isSupportedPracticeMode(mode) {
  return Object.values(PRACTICE_MODES).includes(mode);
}

export function normalizePracticeMode(mode) {
  return isSupportedPracticeMode(mode) ? mode : PRACTICE_MODES.STEP_LESSON;
}

function createChallengePlaceholders(total) {
  return Array.from({ length: total }, (_, idx) => ({ id: `step-${idx + 1}` }));
}

export function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
}
