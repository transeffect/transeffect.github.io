# Piano MVP

A static browser piano trainer. The app renders a two-octave on-screen piano with mouse, touch, QWERTY, and Web MIDI input, Web Audio playback, sustain, piano/organ modes, octave shifting, velocity and volume controls, stereo panning, and JSON-driven lessons.

## Run Locally

Because lessons are loaded with `fetch`, serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Backups

Create a timestamped backup after each change set:

```bash
scripts/backup.sh
```

The first run creates a full backup. Later runs copy only changed or new files and record deleted files.

## App Structure

- `src/app.js` wires DOM controls, audio, lessons, and practice UI together.
- `src/audio-engine.js` owns Web Audio note playback.
- `src/piano-view.js` renders the keyboard.
- `src/input.js` handles pointer and QWERTY input.
- `src/midi-input.js` handles Web MIDI device permission, device connection changes, and note on/off messages.
- `src/lesson-engine.js` owns current lesson step matching, target highlighting, and lesson events.
- `src/practice-engine.js` owns practice modes, challenge evaluator definitions, and practice-session metrics such as progress, attempts, accuracy, streaks, timing, and summary data.
- `src/lesson-loader.js` loads and validates lesson packs.

## App Modes

The top toolbar switches between `Free Play` and `Lesson`.

- `Free Play`: hides the lesson HUD and keeps the piano focused on open playing.
- `Lesson`: shows the lesson HUD with lesson selection, transport controls, feedback, progress, scoring, and mode-specific controls.

Switching back to `Free Play` stops any active lesson so notes are no longer scored.

## MIDI Support

External MIDI keyboards are supported in browsers that expose the Web MIDI API, such as Chromium-based browsers. GitHub Pages over HTTPS and `localhost` are valid secure contexts for Web MIDI.

Use Settings -> `MIDI: Off` to request MIDI access. When enabled, connected MIDI inputs send note on/off events into the same app path as the on-screen piano:

- Key highlights update on the rendered keyboard.
- Lesson and practice scoring receives the played MIDI note numbers.
- Velocity is normalized from MIDI `1..127` to app velocity `0..1`.
- MIDI `note on` with velocity `0` is treated as `note off`.
- Device connect/disconnect events update the MIDI status and release held MIDI notes.

The app does not request sysex access. If the browser does not support Web MIDI or the user denies permission, the Settings status reports that MIDI is unavailable or unsupported.

## Lesson Pack Contract

Lesson packs live under `packs/<packId>/`.

Each pack requires a `manifest.json`:

```json
{
  "packId": "beginner",
  "title": "Beginner Pack",
  "version": "1.0.0",
  "lessons": [
    {
      "id": "c-major-scale",
      "title": "C Major Scale (5 notes)",
      "file": "lessons/c-major-scale.json"
    }
  ]
}
```

Manifest rules:
- `packId` must match the folder loaded by the app.
- `title` is required.
- `version` is optional, but must be a non-empty string when present.
- `lessons` must be an array.
- Each lesson entry needs a unique `id`, a `title`, and a safe relative `.json` `file` path.
- Absolute paths and parent directory traversal are rejected.

Each lesson file uses this shape:

```json
{
  "id": "c-major-scale",
  "title": "C Major Scale (5 notes)",
  "mode": "stepLesson",
  "overview": "This short scale walk introduces the first five notes of C major.",
  "goal": "Build confidence finding adjacent white keys from C to G.",
  "instructions": [
    "Start on middle C.",
    "Play each highlighted note once, then release it."
  ],
  "settings": {
    "requireRelease": true
  },
  "steps": [
    {
      "label": "Play C",
      "notes": [60]
    }
  ]
}
```

Lesson rules:
- `id` and `title` are required.
- `mode` is optional and defaults to `stepLesson`.
- `overview`, `goal`, `instructions`, and `hint` are optional teaching fields shown in the Lesson HUD.
- `instructions` must be an array of short strings when present.
- `fingering` is optional at the lesson, step, or challenge level. It shows beginner-readable hand and finger guidance in the Lesson HUD.
- `settings` is optional.
- `settings.requireRelease` defaults to `false` and must be boolean when present.
- `steps` is the legacy `stepLesson` format and must be a non-empty array when `challenges` is omitted.
- `challenges` is the normalized practice-engine format and must be a non-empty array when present.
- Each step may have a `label`.
- Each challenge may have a `hint` shown in the Lesson HUD for the current challenge.
- Each challenge may have `fingering` to override lesson-level fingering for the current target.
- Each step must have a non-empty `notes` array.
- Notes must be unique MIDI note integers from `0` to `127`.

When `requireRelease` is `true`, the player must press all required notes for the current step, then physically release them before the lesson advances.

Fingering uses standard piano finger numbers:

```json
{
  "fingering": {
    "hand": "right",
    "pattern": "1-3-5",
    "notes": {
      "60": 1,
      "64": 3,
      "67": 5
    },
    "note": "For this beginner chord, place your thumb on C, middle finger on E, and pinky on G."
  }
}
```

Fingering rules:
- `hand` must be `left`, `right`, or `both`.
- Finger numbers are `1` thumb, `2` index, `3` middle, `4` ring, and `5` pinky.
- `notes` maps MIDI note numbers to finger numbers.
- Fingering is instructional only; the app cannot verify which physical finger was used.

## Practice Modes

The supported `mode` values are:

- `stepLesson`: A guided sequence of note or chord targets.
- `chordDrill`: Repeated chord challenges using note-set matching.
- `scaleDrill`: Ordered note-sequence challenges.
- `intervalDrill`: Ordered two-note or short-sequence challenges.
- `rhythmDrill`: Rhythm-event challenges. Basic note-event playback is supported; strict timing evaluation is future work.
- `earTraining`: Heard prompt plus answer challenges. Prompt playback and choice answers are supported; richer answer types are future work.

The practice engine uses this normalized session shape internally:

```json
{
  "mode": "stepLesson",
  "title": "C Major Scale (5 notes)",
  "challenges": []
}
```

Current legacy `steps` are automatically converted into `stepLesson` challenges:

```json
{
  "id": "step-1",
  "type": "noteSet",
  "label": "Play C",
  "notes": [60]
}
```

### stepLesson

Use `stepLesson` for guided tutorials where each challenge presents a target note or chord.

```json
{
  "id": "c-major-triad",
  "title": "C Major Triad",
  "mode": "stepLesson",
  "settings": {
    "requireRelease": true
  },
  "challenges": [
    {
      "id": "c",
      "type": "noteSet",
      "label": "Play C",
      "notes": [60]
    },
    {
      "id": "c-major",
      "type": "noteSet",
      "label": "Play C major chord",
      "notes": [60, 64, 67]
    }
  ]
}
```

Required keys:
- `mode`: `stepLesson`
- `challenges[].notes`: non-empty MIDI note array

Important optional keys:
- `settings.requireRelease`: require physical release before advancing
- `challenges[].id`: stable challenge id
- `challenges[].label`: user-facing instruction
- `challenges[].type`: currently `noteSet`

### chordDrill

Use `chordDrill` for repeated chord identification or chord-shape practice.

```json
{
  "id": "major-triads",
  "title": "Major Triads",
  "mode": "chordDrill",
  "challenges": [
    {
      "id": "c-major-root",
      "type": "chord",
      "label": "C major root position",
      "root": 60,
      "quality": "major",
      "inversion": 0,
      "notes": [60, 64, 67]
    }
  ]
}
```

Required keys:
- `mode`: `chordDrill`
- `challenges[].notes`: non-empty MIDI note array

Important optional keys:
- `challenges[].root`: root MIDI note
- `challenges[].quality`: `major`, `minor`, `diminished`, `augmented`, `dominant7`, etc.
- `challenges[].inversion`: `0` for root position, `1` for first inversion, etc.

### scaleDrill

Use `scaleDrill` for ordered ascending, descending, or multi-octave scale practice.

```json
{
  "id": "c-major-scale-one-octave",
  "title": "C Major Scale",
  "mode": "scaleDrill",
  "challenges": [
    {
      "id": "c-major-ascending",
      "type": "sequence",
      "label": "C major ascending",
      "key": "C",
      "scale": "major",
      "direction": "ascending",
      "sequence": [60, 62, 64, 65, 67, 69, 71, 72]
    }
  ]
}
```

Required keys:
- `mode`: `scaleDrill`
- `challenges[].sequence`: ordered MIDI note array

Important optional keys:
- `challenges[].key`: tonic name
- `challenges[].scale`: `major`, `naturalMinor`, `harmonicMinor`, `melodicMinor`, pentatonic modes, etc.
- `challenges[].direction`: `ascending`, `descending`, or `both`

### intervalDrill

Use `intervalDrill` for recognizing or playing intervals.

```json
{
  "id": "basic-intervals",
  "title": "Basic Intervals",
  "mode": "intervalDrill",
  "challenges": [
    {
      "id": "m3-c-eb",
      "type": "interval",
      "label": "Minor third from C",
      "root": 60,
      "interval": "m3",
      "sequence": [60, 63]
    }
  ]
}
```

Required keys:
- `mode`: `intervalDrill`
- `challenges[].sequence`: ordered MIDI note array

Important optional keys:
- `challenges[].root`: starting MIDI note
- `challenges[].interval`: `m2`, `M2`, `m3`, `M3`, `P4`, `tritone`, `P5`, etc.
- `challenges[].direction`: `up`, `down`, or `harmonic`

### rhythmDrill

Use `rhythmDrill` for timing and rhythmic accuracy. Rhythm drills first show a ready phase so the player can study the visual note/rest guide and use `Play Example` to hear the expected pattern. `Begin Rhythm` then starts the count-in, metronome ticks, early/late feedback, missed-note detection, and average timing-error scoring.

```json
{
  "id": "quarter-half-rhythm",
  "title": "Quarter and Half Notes",
  "mode": "rhythmDrill",
  "settings": {
    "tempo": 80,
    "timeSignature": "4/4",
    "timingToleranceMs": 120,
    "countInBeats": 4,
    "metronome": true
  },
  "challenges": [
    {
      "id": "q-q-h",
      "type": "rhythm",
      "label": "Quarter, quarter, half",
      "rhythm": [
        { "beats": 1, "note": 60 },
        { "beats": 1, "note": 60 },
        { "beats": 2, "note": 60 }
      ]
    }
  ]
}
```

Required keys:
- `mode`: `rhythmDrill`
- `challenges[].rhythm`: non-empty array of rhythm events
- `challenges[].rhythm[].beats`: positive number

Important optional keys:
- `settings.tempo`: beats per minute
- `settings.timeSignature`: display and measure grouping
- `settings.timingToleranceMs`: acceptable early/late window
- `settings.countInBeats`: count-in duration before the first playable event; defaults to the top number of `timeSignature`
- `settings.metronome`: set to `false` to disable rhythm beat ticks and audible clicks
- `challenges[].rhythm[].note`: MIDI note to play for that event

### earTraining

Use `earTraining` for heard prompts and user answers. The current app can play note/chord prompts and render multiple-choice answers.

```json
{
  "id": "hear-major-minor",
  "title": "Hear Major vs Minor",
  "mode": "earTraining",
  "challenges": [
    {
      "id": "learn-major",
      "type": "lessonPrompt",
      "label": "Learn the major sound",
      "scored": false,
      "prompt": {
        "type": "chord",
        "label": "C major",
        "notes": [60, 64, 67],
        "playStyle": "blocked"
      }
    },
    {
      "id": "random-major-minor-quality",
      "type": "generatedEarTraining",
      "label": "Listen and choose the chord quality",
      "generator": {
        "kind": "chordQuality",
        "count": 6,
        "roots": [48, 50, 52, 53, 55, 57, 60],
        "qualities": ["major", "minor"],
        "choices": ["major", "minor"],
        "playStyle": "blocked"
      }
    }
  ]
}
```

Required keys:
- `mode`: `earTraining`
- `challenges[].prompt`: object with a non-empty `type`
- `challenges[].answer`: expected answer unless `challenges[].scored` is `false`

Important optional keys:
- `challenges[].scored`: set to `false` for unscored teaching prompts with Play/Continue controls
- `challenges[].type`: use `generatedEarTraining` with `generator.kind: "chordQuality"` to create randomized quiz prompts each time the lesson starts
- `challenges[].generator.count`: number of generated prompts
- `challenges[].generator.roots`: MIDI root notes available to the generator
- `challenges[].generator.qualities`: currently supports `major` and `minor`
- `challenges[].choices`: answer choices for multiple-choice flows
- `challenges[].prompt.notes`: MIDI notes to play
- `challenges[].prompt.playStyle`: `blocked`, `arpeggiated`, or `melodic`
