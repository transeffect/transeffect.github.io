# Piano MVP

A static browser piano trainer. The app renders a two-octave on-screen piano with mouse, touch, and QWERTY input, Web Audio playback, sustain, piano/organ modes, octave shifting, velocity and volume controls, stereo panning, and JSON-driven lessons.

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
- `src/lesson-engine.js` owns lesson step matching, target highlighting, and lesson events.
- `src/practice-engine.js` owns practice-session metrics such as progress, attempts, accuracy, streaks, timing, and summary data.
- `src/lesson-loader.js` loads and validates lesson packs.

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
- `settings` is optional.
- `settings.requireRelease` defaults to `false` and must be boolean when present.
- `steps` must be a non-empty array.
- Each step may have a `label`.
- Each step must have a non-empty `notes` array.
- Notes must be unique MIDI note integers from `0` to `127`.

When `requireRelease` is `true`, the player must press all required notes for the current step, then physically release them before the lesson advances.
