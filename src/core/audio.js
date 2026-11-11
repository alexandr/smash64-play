// All sound is synthesized at runtime with WebAudio (no sampled game audio).
// sfx(name, opts) plays a procedural effect; music(track) plays an original sequenced loop;
// say(text) uses speech synthesis for the announcer.
import { TRACKS } from './music.js';

export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this.musicGain = null; this.sfxGain = null;
    this.current = null; this.muted = false;
    this.noiseBuf = null;
  }
  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.6; this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.35; this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.8; this.sfxGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  resume() { if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume(); if (this.pendingTrack) { const t = this.pendingTrack; this.pendingTrack = null; this.music(t); } }
  get ok() { return this.ctx && this.ctx.state === 'running'; }

  tone(type, f0, f1, dur, vol = 0.3, delay = 0, dest = null) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, filt = 2000, q = 1, delay = 0, type = 'lowpass', f1 = null) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(filt, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  sfx(name, o = {}) {
    if (!this.ok || this.muted) return;
    const k = o.power ?? 1;
    switch (name) {
      case 'hitS': this.noise(0.08, 0.35, 3000, 1); this.tone('square', 300, 120, 0.06, 0.12); break;
      case 'hitM': this.noise(0.14, 0.45, 2000, 1); this.tone('square', 220, 70, 0.1, 0.18); break;
      case 'hitL': this.noise(0.28, 0.6, 1400, 1, 0, 'lowpass', 200); this.tone('sawtooth', 160, 40, 0.25, 0.25); this.tone('square', 90, 30, 0.3, 0.2); break;
      case 'fire': this.noise(0.3, 0.4, 900, 2, 0, 'bandpass', 3000); this.tone('sawtooth', 200, 60, 0.2, 0.15); break;
      case 'elec': for (let i = 0; i < 5; i++) this.tone('square', 900 + Math.random() * 900, 300, 0.05, 0.12, i * 0.035); this.noise(0.18, 0.3, 4000, 3, 0, 'bandpass'); break;
      case 'slash': this.noise(0.12, 0.4, 5000, 4, 0, 'highpass', 1500); this.tone('sawtooth', 1400, 500, 0.08, 0.1); break;
      case 'whiff': this.noise(0.1, 0.12 * k, 1800, 2, 0, 'bandpass', 600); break;
      case 'whiffL': this.noise(0.2, 0.18, 1200, 2, 0, 'bandpass', 300); break;
      case 'jump': this.tone('square', 260, 520, 0.09, 0.1); break;
      case 'jump2': this.tone('triangle', 400, 800, 0.1, 0.15); this.noise(0.08, 0.06, 2500, 1); break;
      case 'land': this.noise(0.06, 0.18, 500, 1); break;
      case 'step': this.noise(0.03, 0.06, 900, 1); break;
      case 'dash': this.noise(0.09, 0.14, 1200, 1, 0, 'bandpass', 300); break;
      case 'shieldOn': this.tone('sine', 500, 700, 0.08, 0.08); break;
      case 'shieldHit': this.tone('triangle', 900, 600, 0.1, 0.2); this.noise(0.06, 0.15, 3000, 2); break;
      case 'shieldBreak': for (let i = 0; i < 6; i++) this.tone('square', 1200 - i * 150, 200, 0.12, 0.12, i * 0.04); this.noise(0.5, 0.4, 2500, 1, 0, 'lowpass', 300); break;
      case 'grab': this.tone('square', 200, 160, 0.06, 0.1); this.noise(0.05, 0.12, 800, 1); break;
      case 'throw': this.noise(0.15, 0.25, 1500, 1, 0, 'bandpass', 500); break;
      case 'ledge': this.tone('square', 600, 900, 0.05, 0.08); break;
      case 'tech': this.tone('triangle', 700, 1400, 0.07, 0.12); break;
      case 'roll': this.noise(0.15, 0.1, 1000, 1, 0, 'bandpass', 400); break;
      case 'ko': this.noise(1.2, 0.7, 2500, 0.7, 0, 'lowpass', 80); this.tone('sawtooth', 120, 30, 1.0, 0.35); this.tone('square', 600, 60, 0.6, 0.15, 0.05); break;
      case 'star': for (let i = 0; i < 4; i++) this.tone('triangle', 1600 + i * 300, 2400, 0.12, 0.05, i * 0.1); break;
      case 'fall': this.tone('sine', 900, 200, 0.6, 0.15); break;
      case 'respawn': for (let i = 0; i < 3; i++) this.tone('triangle', 500 + i * 250, 700 + i * 250, 0.1, 0.1, i * 0.07); break;
      case 'menuMove': this.tone('square', 900, 900, 0.035, 0.07); break;
      case 'menuOk': this.tone('square', 700, 700, 0.05, 0.1); this.tone('square', 1050, 1050, 0.08, 0.1, 0.05); break;
      case 'menuBack': this.tone('square', 500, 300, 0.09, 0.1); break;
      case 'select': this.tone('triangle', 520, 520, 0.08, 0.15); this.tone('triangle', 780, 780, 0.12, 0.15, 0.08); break;
      case 'count': this.tone('square', 440, 440, 0.18, 0.15); break;
      case 'go': this.tone('square', 880, 880, 0.35, 0.18); this.tone('square', 1320, 1320, 0.35, 0.1); break;
      case 'item': this.tone('triangle', 800, 1200, 0.06, 0.1); break;
      case 'heal': for (let i = 0; i < 5; i++) this.tone('sine', 600 + i * 150, 600 + i * 150, 0.08, 0.1, i * 0.06); break;
      case 'explode': this.noise(0.6, 0.7, 1200, 0.7, 0, 'lowpass', 60); this.tone('sawtooth', 90, 25, 0.5, 0.3); break;
      case 'shoot': this.tone('square', 1300, 300, 0.1, 0.12); break;
      case 'laser': this.tone('sawtooth', 2000, 900, 0.08, 0.1); break;
      case 'charge': this.tone('sine', 300 + k * 400, 300 + k * 400, 0.05, 0.05); break;
      case 'bump': this.tone('square', 500, 1000, 0.12, 0.2); this.tone('square', 750, 1500, 0.12, 0.12, 0.03); break;
      case 'target': this.tone('square', 1200, 1200, 0.05, 0.1); this.tone('square', 1600, 1600, 0.08, 0.1, 0.05); this.noise(0.1, 0.2, 3000, 1); break;
      case 'clap': for (let i = 0; i < 12; i++) this.noise(0.04, 0.15, 2500, 1, i * 0.09 + Math.random() * 0.05, 'bandpass'); break;
      case 'warn': this.tone('square', 1000, 1000, 0.1, 0.1); this.tone('square', 1000, 1000, 0.1, 0.1, 0.2); break;
      case 'sleep': this.tone('sine', 400, 300, 0.4, 0.08); break;
      case 'eat': this.tone('square', 300, 600, 0.1, 0.12); break;
      default: this.tone('square', 600, 300, 0.05, 0.05);
    }
  }
  // Announcer via speech synthesis (deep, slow voice)
  say(text, rate = 0.85) {
    if (this.muted || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate; u.pitch = 0.3; u.volume = 1;
      const v = speechSynthesis.getVoices().find(v => /en(-|_)US/i.test(v.lang) && /male|david|daniel|fred|alex/i.test(v.name));
      if (v) u.voice = v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch {}
  }
  stopMusic() {
    if (this.current) { this.current.stop(); this.current = null; }
    this.currentName = null;
  }
  music(name) {
    if (this.currentName === name) return;
    this.stopMusic();
    if (!this.ok) { this.pendingTrack = name; return; }
    const tr = TRACKS[name]; if (!tr) return;
    this.currentName = name;
    this.current = new Sequencer(this, tr);
    this.current.start();
  }
}

// Minimal step sequencer for the original music tracks in music.js.
class Sequencer {
  constructor(audio, track) { this.a = audio; this.t = track; this.timer = null; this.step = 0; this.next = 0; }
  start() {
    const c = this.a.ctx; this.next = c.currentTime + 0.05;
    const spb = 60 / this.t.bpm / 4; // 16th notes
    this.timer = setInterval(() => {
      while (this.next < c.currentTime + 0.2) { this.play(this.step, this.next, spb); this.next += spb; this.step++; }
    }, 50);
  }
  stop() { clearInterval(this.timer); }
  play(step, when, spb) {
    const t = this.t, len = t.length;
    if (!t.loop && step >= len) return;
    const s = step % len;
    for (const ch of t.channels) {
      const n = ch.notes[s % ch.notes.length];
      if (n == null || n === '.' || n === '-') continue;
      const dur = (ch.len || 1) * spb * (ch.gate || 0.9);
      if (ch.drum) { this.drum(n, when); continue; }
      const f = typeof n === 'number' ? n : noteFreq(n);
      if (!f) continue;
      const c = this.a.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = ch.wave || 'square'; o.frequency.setValueAtTime(f, when);
      const v = ch.vol ?? 0.15;
      g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(v, when + 0.005);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v * (ch.sustain ?? 0.3)), when + dur);
      g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.03);
      o.connect(g); g.connect(this.a.musicGain); o.start(when); o.stop(when + dur + 0.05);
    }
  }
  drum(n, when) {
    const c = this.a.ctx;
    if (n === 'k') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, when); o.frequency.exponentialRampToValueAtTime(40, when + 0.12);
      g.gain.setValueAtTime(0.5, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.15); o.connect(g); g.connect(this.a.musicGain); o.start(when); o.stop(when + 0.2); return; }
    const s = c.createBufferSource(); s.buffer = this.a.noiseBuf; const f = c.createBiquadFilter(), g = c.createGain();
    f.type = n === 'h' ? 'highpass' : 'bandpass'; f.frequency.value = n === 'h' ? 7000 : 1800;
    const d = n === 'h' ? 0.03 : 0.12; g.gain.setValueAtTime(n === 'h' ? 0.12 : 0.3, when); g.gain.exponentialRampToValueAtTime(0.001, when + d);
    s.connect(f); f.connect(g); g.connect(this.a.musicGain); s.start(when, Math.random() * 0.5); s.stop(when + d + 0.02);
  }
}
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFreq(n) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(n); if (!m) return 0;
  let s = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (s - 69) / 12);
}
