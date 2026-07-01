import { dlog, midiToFreq } from "./constants.js";

let oscCounter = 0;

export class AudioEngine {
  constructor({ getAudioEnabled, getPlayMode, getVisibleRange, getPanWidth, onNoteEnded }) {
    this.ctx = null;
    this.master = null;
    this.active = new Map();
    this.volume = 0.7;
    this.getAudioEnabled = getAudioEnabled;
    this.getPlayMode = getPlayMode;
    this.getVisibleRange = getVisibleRange;
    this.getPanWidth = getPanWidth;
    this.onNoteEnded = onNoteEnded;
  }

  async ensureStarted() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  _stopVoice(note, stopDelay = 0.08) {
    const voice = this.active.get(note);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    const { osc, damperGain } = voice;

    damperGain.gain.cancelScheduledValues(now);
    damperGain.gain.setTargetAtTime(0.0001, now, 0.03);
    const stopAt = now + stopDelay;
    dlog(`Osc ${osc._id} stop() requested by _stopVoice at t=${stopAt.toFixed(3)} (now=${now.toFixed(3)})`);
    try { osc.stop(stopAt); } catch {}
  }

  noteOn(note, velocity = 0.8) {
    if (!this.getAudioEnabled()) return;
    if (!this.ctx || this.ctx.state !== "running") return;

    note = Number(note);
    if (!Number.isFinite(note)) return;

    if (this.active.has(note)) this._stopVoice(note, 0.12);

    const now = this.ctx.currentTime;
    const v = Math.max(0.01, Math.min(1, velocity));
    const vCurve = Math.pow(v, 0.75);
    const { start, end } = this.getVisibleRange();

    const span = Math.max(1, end - start);
    let pos = (note - start) / span;
    pos = Math.max(0, Math.min(1, pos));
    let pan = (pos * 2 - 1) * 0.55 * this.getPanWidth();
    pan *= (0.65 + 0.35 * vCurve);
    pan = Math.max(-1, Math.min(1, pan));

    const attack = 0.005 + (1 - vCurve) * 0.035;
    const cutoff = 900 + vCurve * 5200;
    const q = 0.55 + vCurve * 0.35;
    const peak = 0.08 + vCurve * 0.75;

    const osc = this.ctx.createOscillator();
    osc._id = ++oscCounter;
    dlog(`Osc ${osc._id} START (note ${note}) at now (${now.toFixed(3)})`);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(midiToFreq(note), now);

    const detuneMax = 5;
    const detune = (Math.random() * 2 - 1) * detuneMax;
    osc.detune.setValueAtTime(detune * (0.6 + 0.4 * vCurve), now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, now);
    filter.Q.setValueAtTime(q, now);

    const envGain = this.ctx.createGain();
    envGain.gain.setValueAtTime(0.0, now);

    const damperGain = this.ctx.createGain();
    damperGain.gain.setValueAtTime(1.0, now);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, now);

    osc.connect(filter);
    filter.connect(envGain);
    envGain.connect(damperGain);
    damperGain.connect(panner);
    panner.connect(this.master);

    envGain.gain.cancelScheduledValues(now);
    envGain.gain.setValueAtTime(0.0, now);
    envGain.gain.linearRampToValueAtTime(peak, now + attack);

    if (this.getPlayMode() === "piano") {
      const ringTC = 0.6 + vCurve * 0.9;
      envGain.gain.setTargetAtTime(0.0001, now + attack, ringTC);

      const autoStop = now + attack + 4.0;
      dlog(`Osc ${osc._id} autoStop scheduled at t=${autoStop.toFixed(3)} (now=${now.toFixed(3)})`);
      try { osc.stop(autoStop); } catch {}
    } else {
      const sustainLevel = Math.max(0.01, peak * 0.65);
      envGain.gain.setValueAtTime(sustainLevel, now + attack);
    }

    osc.start(now);

    const voiceObj = { osc, envGain, damperGain, panner };
    osc.onended = () => {
      dlog(`Osc ${osc._id} ENDED at ctx.t=${this.ctx.currentTime.toFixed(3)}`);
      if (this.active.get(note) === voiceObj) {
        this.active.delete(note);
        this.onNoteEnded(note);
      }
    };

    this.active.set(note, voiceObj);
  }

  noteOff(note) {
    if (!this.ctx) return;

    note = Number(note);
    if (!Number.isFinite(note)) return;

    const voice = this.active.get(note);
    if (!voice) return;

    const now = this.ctx.currentTime;
    const { osc, damperGain } = voice;
    const isPiano = this.getPlayMode() === "piano";
    const tc = isPiano ? 0.05 : 0.08;

    damperGain.gain.cancelScheduledValues(now);
    damperGain.gain.setTargetAtTime(0.0001, now, tc);

    const stopAt = now + (isPiano ? 0.65 : 0.45);
    dlog(`Osc ${osc._id} noteOff stop scheduled at t=${stopAt.toFixed(3)} (now=${now.toFixed(3)})`);
    try { osc.stop(stopAt); } catch {}
  }

  allOff() {
    if (!this.ctx) return;
    for (const note of Array.from(this.active.keys())) {
      this._stopVoice(note, 0.08);
      this.active.delete(note);
      this.onNoteEnded(note);
    }
  }
}
