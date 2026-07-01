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

  if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) {
    throw new Error(`${sourcePath}.steps must be a non-empty array`);
  }

  lesson.steps.forEach((step, idx) => {
    const path = `${sourcePath}.steps[${idx}]`;
    assertPlainObject(step, path);
    if (step.label != null) assertNonEmptyString(step.label, `${path}.label`);
    if (!Array.isArray(step.notes) || step.notes.length === 0) {
      throw new Error(`${path}.notes must be a non-empty array`);
    }

    const notes = new Set();
    step.notes.forEach((note, noteIdx) => {
      assertMidiNote(note, `${path}.notes[${noteIdx}]`);
      if (notes.has(note)) throw new Error(`${path}.notes must not contain duplicates`);
      notes.add(note);
    });
  });

  return lesson;
}
