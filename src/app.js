// App: owns the WebGL renderer, the 2D UI canvas, input, audio, save data and the current screen.
// Simulation runs at a fixed 60 Hz; rendering follows requestAnimationFrame.
import * as THREE from 'three';
import { InputManager } from './core/input.js';
import { Audio } from './core/audio.js';
import { Save } from './core/save.js';
import { TouchControls, isTouchDevice } from './core/touch.js';

export const W = 640, H = 480;   // internal resolution (N64 hi-res, 4:3)

export class App {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.uiCanvas = document.getElementById('ui');
    this.wrap = document.getElementById('wrap');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.uiCanvas.width = W; this.uiCanvas.height = H;
    this.ui = this.uiCanvas.getContext('2d');
    this.input = new InputManager();
    if (isTouchDevice() && window.nipplejs) { this.touch = this.input.touch = new TouchControls(this.input); this.touch.mount(); }
    this.audio = new Audio();
    this.save = new Save();
    this.screens = {};
    this.screen = null;
    this.frame = 0;
    this.paused = false;
    this.params = new URLSearchParams(location.search);
    this.manualStep = this.params.has('manual');   // tests drive frames explicitly
    window.addEventListener('resize', () => this.fit());
    this.fit();
    const unlockAudio = () => this.audio.resume();
    window.addEventListener('keydown', unlockAudio); window.addEventListener('pointerdown', unlockAudio);
  }
  fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.wrap.style.width = Math.floor(W * s) + 'px';
    this.wrap.style.height = Math.floor(H * s) + 'px';
  }
  register(name, ScreenClass) { this.screens[name] = ScreenClass; }
  go(name, params = {}) {
    if (this.screen?.exit) this.screen.exit();
    const S = this.screens[name];
    if (!S) throw new Error('no screen ' + name);
    this.screen = new S(this, params);
    this.screenName = name;
    this.input.menuMode = !this.screen.isGameplay;
    if (this.screen.enter) this.screen.enter();
  }
  step() {
    this.input.poll();
    if (this.screen) this.screen.update();
    this.input.endFrame();
    this.frame++;
  }
  draw() {
    const ui = this.ui;
    ui.clearRect(0, 0, W, H);
    if (this.screen) this.screen.render(this.renderer, ui);
  }
  start() {
    if (this.manualStep) { this.draw(); return; }
    let acc = 0, last = performance.now();
    const tick = now => {
      acc += Math.min(100, now - last); last = now;
      let n = 0;
      while (acc >= 1000 / 60 && n < 5) { this.step(); acc -= 1000 / 60; n++; }
      if (n === 5) acc = 0;
      this.draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // test hook: advance N frames synchronously and draw
  advance(n = 1) { for (let i = 0; i < n; i++) this.step(); this.draw(); }
}
