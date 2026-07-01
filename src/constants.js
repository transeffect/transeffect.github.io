export const DEBUG = false;
export const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

export const dlog = (...args) => {
  if (DEBUG) console.log(...args);
};

export function isBlack(midiNote) {
  return NOTE_NAMES[midiNote % 12].includes("#");
}

export function midiToName(n) {
  const name = NOTE_NAMES[n % 12];
  const octave = Math.floor(n / 12) - 1;
  return `${name}${octave}`;
}

export function midiToFreq(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}
