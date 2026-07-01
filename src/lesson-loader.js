import { PRACTICE_MODES, isSupportedPracticeMode } from "./practice-engine.js";

function assertPlainObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
}

function assertNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function assertOptionalNonEmptyString(value, path) {
  if (value != null) assertNonEmptyString(value, path);
}

function assertOptionalStringArray(value, path) {
  if (value == null) return;
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  value.forEach((item, idx) => assertNonEmptyString(item, `${path}[${idx}]`));
}

function assertSafeRelativePath(value, path) {
  assertNonEmptyString(value, path);
  if (value.startsWith("/") || value.includes("..") || !value.endsWith(".json")) {
    throw new Error(`${path} must be a safe relative JSON path`);
  }
}

function assertMidiNote(value, path) {
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    throw new Error(`${path} must be a MIDI note integer from 0 to 127`);
  }
}

export async function loadLessonPack(packId) {
  const url = `./packs/${packId}/manifest.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Pack manifest fetch failed ${res.status} ${res.statusText}: ${url}`);
  return validateLessonManifest(await res.json(), packId);
}

export async function loadLesson(packId, lessonFile) {
  const url = `./packs/${packId}/${lessonFile}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Lesson fetch failed ${res.status} ${res.statusText}: ${url}`);
  return validateLesson(await res.json(), lessonFile);
}

export function validateLessonManifest(manifest, expectedPackId) {
  assertPlainObject(manifest, "manifest");
  assertNonEmptyString(manifest.packId, "manifest.packId");
  if (manifest.packId !== expectedPackId) {
    throw new Error(`manifest.packId must be "${expectedPackId}"`);
  }
  assertNonEmptyString(manifest.title, "manifest.title");
  if (manifest.version != null) assertNonEmptyString(manifest.version, "manifest.version");
  if (!Array.isArray(manifest.lessons)) throw new Error("manifest.lessons must be an array");

  const ids = new Set();
  manifest.lessons.forEach((lesson, idx) => {
    const path = `manifest.lessons[${idx}]`;
    assertPlainObject(lesson, path);
    assertNonEmptyString(lesson.id, `${path}.id`);
    assertNonEmptyString(lesson.title, `${path}.title`);
    assertSafeRelativePath(lesson.file, `${path}.file`);
    if (ids.has(lesson.id)) throw new Error(`${path}.id must be unique`);
    ids.add(lesson.id);
  });

  return manifest;
}

export function validateLesson(lesson, sourcePath = "lesson") {
  assertPlainObject(lesson, sourcePath);
  assertNonEmptyString(lesson.id, `${sourcePath}.id`);
  assertNonEmptyString(lesson.title, `${sourcePath}.title`);
  assertOptionalNonEmptyString(lesson.overview, `${sourcePath}.overview`);
  assertOptionalNonEmptyString(lesson.goal, `${sourcePath}.goal`);
  assertOptionalNonEmptyString(lesson.hint, `${sourcePath}.hint`);
  assertOptionalStringArray(lesson.instructions, `${sourcePath}.instructions`);

  if (lesson.mode == null) {
    lesson.mode = PRACTICE_MODES.STEP_LESSON;
  } else if (!isSupportedPracticeMode(lesson.mode)) {
    throw new Error(`${sourcePath}.mode must be a supported practice mode`);
  }

  if (lesson.settings == null) {
    lesson.settings = {};
  } else {
    assertPlainObject(lesson.settings, `${sourcePath}.settings`);
  }

  if (lesson.settings.requireRelease == null) {
    lesson.settings.requireRelease = false;
  } else if (typeof lesson.settings.requireRelease !== "boolean") {
    throw new Error(`${sourcePath}.settings.requireRelease must be a boolean`);
  }

  if (lesson.steps != null && !Array.isArray(lesson.steps)) {
    throw new Error(`${sourcePath}.steps must be an array when present`);
  }

  if (lesson.challenges != null && !Array.isArray(lesson.challenges)) {
    throw new Error(`${sourcePath}.challenges must be an array when present`);
  }

  if (lesson.mode === PRACTICE_MODES.STEP_LESSON && lesson.challenges == null) {
    if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) {
      throw new Error(`${sourcePath}.steps must be a non-empty array`);
    }
    lesson.challenges = lesson.steps.map((step, idx) => ({
      id: step.id || `step-${idx + 1}`,
      type: "noteSet",
      label: step.label,
      notes: step.notes
    }));
  }

  if (!Array.isArray(lesson.challenges) || lesson.challenges.length === 0) {
    throw new Error(`${sourcePath}.challenges must be a non-empty array`);
  }

  lesson.challenges.forEach((challenge, idx) => {
    validateChallenge(challenge, `${sourcePath}.challenges[${idx}]`, lesson.mode);
  });

  if (lesson.steps != null) {
    lesson.steps.forEach((step, idx) => {
      validateStep(step, `${sourcePath}.steps[${idx}]`);
    });
  }

  return lesson;
}

function validateStep(step, path) {
  assertPlainObject(step, path);
  if (step.id != null) assertNonEmptyString(step.id, `${path}.id`);
  if (step.label != null) assertNonEmptyString(step.label, `${path}.label`);
  validateMidiNoteArray(step.notes, `${path}.notes`);
}

function validateChallenge(challenge, path, mode) {
  assertPlainObject(challenge, path);
  if (challenge.id != null) assertNonEmptyString(challenge.id, `${path}.id`);
  if (challenge.type != null) assertNonEmptyString(challenge.type, `${path}.type`);
  if (challenge.label != null) assertNonEmptyString(challenge.label, `${path}.label`);
  assertOptionalNonEmptyString(challenge.hint, `${path}.hint`);

  if (mode === PRACTICE_MODES.STEP_LESSON || mode === PRACTICE_MODES.CHORD_DRILL) {
    validateMidiNoteArray(challenge.notes, `${path}.notes`);
    return;
  }

  if (mode === PRACTICE_MODES.SCALE_DRILL || mode === PRACTICE_MODES.INTERVAL_DRILL) {
    validateMidiNoteArray(challenge.sequence, `${path}.sequence`);
    return;
  }

  if (mode === PRACTICE_MODES.RHYTHM_DRILL) {
    if (!Array.isArray(challenge.rhythm) || challenge.rhythm.length === 0) {
      throw new Error(`${path}.rhythm must be a non-empty array`);
    }
    challenge.rhythm.forEach((event, idx) => {
      assertPlainObject(event, `${path}.rhythm[${idx}]`);
      if (typeof event.beats !== "number" || event.beats <= 0) {
        throw new Error(`${path}.rhythm[${idx}].beats must be a positive number`);
      }
      if (event.note != null) assertMidiNote(event.note, `${path}.rhythm[${idx}].note`);
    });
    return;
  }

  if (mode === PRACTICE_MODES.EAR_TRAINING) {
    if (challenge.prompt == null) throw new Error(`${path}.prompt is required`);
    assertPlainObject(challenge.prompt, `${path}.prompt`);
    assertNonEmptyString(challenge.prompt.type, `${path}.prompt.type`);
    if (challenge.answer == null) throw new Error(`${path}.answer is required`);
  }
}

function validateMidiNoteArray(notes, path) {
  if (!Array.isArray(notes) || notes.length === 0) {
    throw new Error(`${path} must be a non-empty array`);
  }

  const seen = new Set();
  notes.forEach((note, noteIdx) => {
    assertMidiNote(note, `${path}[${noteIdx}]`);
    if (seen.has(note)) throw new Error(`${path} must not contain duplicates`);
    seen.add(note);
  });
}
