export class Sfx {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.ready = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.5 : 0;
      this.master.connect(this.ctx.destination);
      this.startWind();
      this.ready = true;
      return true;
    } catch (err) {
      this.ctx = null;
      return false;
    }
  }

  startWind() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = last * 5.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    src.connect(filter).connect(this.windGain).connect(this.master);
    src.start();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) {
      this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
    }
  }

  tone(freq, endFreq, dur, type = 'square', gain = 0.12, delay = 0) {
    if (!this.enabled || !this.ensure()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, gain = 0.1, freq = 1200, q = 1, delay = 0) {
    if (!this.enabled || !this.ensure()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(env).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  play(name) {
    switch (name) {
      case 'jump':
        this.tone(240, 460, 0.14, 'square', 0.07);
        break;
      case 'land':
        this.noise(0.06, 0.05, 500, 0.8);
        break;
      case 'rune':
        this.tone(880, 880, 0.07, 'sine', 0.09);
        this.tone(1320, 1320, 0.12, 'sine', 0.07, 0.06);
        break;
      case 'pickup':
        this.tone(660, 990, 0.08, 'triangle', 0.07);
        break;
      case 'drink':
        this.tone(180, 120, 0.14, 'sine', 0.1);
        this.tone(150, 100, 0.14, 'sine', 0.09, 0.16);
        this.tone(210, 260, 0.2, 'triangle', 0.05, 0.3);
        break;
      case 'brew':
        this.noise(0.5, 0.07, 500, 0.5);
        this.tone(220, 440, 0.35, 'sine', 0.07);
        this.tone(440, 660, 0.25, 'triangle', 0.06, 0.22);
        break;
      case 'shield':
        this.tone(880, 1320, 0.16, 'triangle', 0.07);
        this.noise(0.12, 0.06, 2400, 1.2);
        break;
      case 'attack':
        this.noise(0.16, 0.09, 1800, 0.7);
        this.tone(320, 140, 0.12, 'sawtooth', 0.03);
        break;
      case 'hit':
        this.noise(0.18, 0.14, 300, 0.8);
        this.tone(160, 60, 0.2, 'square', 0.09);
        break;
      case 'kill':
        this.noise(0.2, 0.1, 700, 0.6);
        this.tone(220, 80, 0.18, 'triangle', 0.06);
        break;
      case 'checkpoint':
        this.tone(523, 523, 0.1, 'triangle', 0.08);
        this.tone(659, 659, 0.1, 'triangle', 0.08, 0.09);
        this.tone(784, 784, 0.22, 'triangle', 0.09, 0.18);
        break;
      case 'mead':
        this.tone(392, 523, 0.18, 'sine', 0.09);
        break;
      case 'death':
        this.tone(330, 55, 0.8, 'sawtooth', 0.1);
        this.noise(0.5, 0.08, 260, 0.5);
        break;
      case 'splash':
        this.noise(0.35, 0.12, 900, 0.5);
        this.tone(300, 90, 0.3, 'sine', 0.05);
        break;
      case 'throw':
        this.noise(0.12, 0.06, 2200, 0.8);
        this.tone(420, 220, 0.1, 'triangle', 0.04);
        break;
      case 'axeHit':
        this.noise(0.14, 0.1, 1600, 0.6);
        this.tone(360, 120, 0.12, 'square', 0.05);
        break;
      case 'roll':
        this.noise(0.22, 0.07, 420, 0.5);
        this.tone(180, 90, 0.16, 'triangle', 0.04);
        break;
      case 'warn':
        this.tone(760, 760, 0.07, 'square', 0.06);
        this.tone(1020, 1020, 0.07, 'square', 0.06, 0.09);
        break;
      case 'screech':
        this.tone(1200, 700, 0.18, 'sawtooth', 0.05);
        this.noise(0.14, 0.05, 2600, 1.4);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(f, f, 0.26, 'triangle', 0.09, i * 0.12)
        );
        break;
      case 'ui':
        this.tone(660, 880, 0.06, 'square', 0.04);
        break;
      default:
        break;
    }
  }
}
