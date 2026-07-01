const CHORD_QUALITY_INTERVALS = Object.freeze({
  major: [0, 4, 7],
  minor: [0, 3, 7]
});

export function expandGeneratedChallenges(lesson, { random = Math.random } = {}) {
  const challenges = lesson?.challenges || [];
  let generatedCount = 0;
  const expanded = [];

  challenges.forEach((challenge, idx) => {
    if (challenge.type !== "generatedEarTraining") {
      expanded.push(challenge);
      return;
    }

    const generated = generateEarTrainingChallenges(challenge, idx, random);
    generatedCount += generated.length;
    expanded.push(...generated);
  });

  if (generatedCount === 0) return lesson;

  return {
    ...lesson,
    challenges: expanded,
    generatedCount
  };
}

function generateEarTrainingChallenges(challenge, challengeIndex, random) {
  const generator = challenge.generator || {};
  if (generator.kind !== "chordQuality") return [];

  const roots = validMidiArray(generator.roots);
  const qualities = validQualities(generator.qualities);
  const count = positiveInteger(generator.count, 4);
  const choices = Array.isArray(generator.choices) && generator.choices.length
    ? generator.choices.slice()
    : qualities.slice();
  const label = challenge.label || "Listen and choose the chord quality";
  const playStyle = generator.playStyle || "blocked";
  const generated = [];

  if (!roots.length || !qualities.length) return generated;

  for (let idx = 0; idx < count; idx += 1) {
    const root = pick(roots, random);
    const quality = pick(qualities, random);
    generated.push({
      id: `${challenge.id || `generated-${challengeIndex + 1}`}-${idx + 1}`,
      type: "heardChord",
      label,
      hint: challenge.hint || "Listen for the chord quality, not the chord name.",
      prompt: {
        type: "chord",
        notes: buildTriad(root, quality),
        playStyle
      },
      answer: quality,
      choices
    });
  }

  return generated;
}

function buildTriad(root, quality) {
  return CHORD_QUALITY_INTERVALS[quality].map(interval => root + interval);
}

function validMidiArray(values) {
  if (!Array.isArray(values)) return [];
  return values.filter(value => Number.isInteger(value) && value >= 0 && value <= 120);
}

function validQualities(values) {
  if (!Array.isArray(values)) return [];
  return values.filter(value => Object.hasOwn(CHORD_QUALITY_INTERVALS, value));
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function pick(values, random) {
  return values[Math.floor(random() * values.length)];
}
