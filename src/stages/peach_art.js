// Peach's Castle backdrop: the castle grounds seen from high above through a sea of clouds.
// Seeded so the painting is identical every match.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function paintCastleSky(c, w, h) {
  const R = rng(7);
  // sky haze -> cloud sea
  let g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#9fc4cc'); g.addColorStop(0.35, '#7fb0b8'); g.addColorStop(1, '#6f9ec0');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // distant green land patches glimpsed through the clouds
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(${40 + R() * 40 | 0},${130 + R() * 50 | 0},${100 + R() * 40 | 0},0.6)`;
    c.beginPath(); c.ellipse(R() * w, h * 0.15 + R() * h * 0.8, 60 + R() * 160, 30 + R() * 70, 0, 0, 7); c.fill();
  }
  // castle island (centre), drawn at reduced scale around (cx, cy)
  const cx = w * 0.5, cy = h * 0.36, K = 0.62;
  c.save(); c.translate(cx, cy); c.scale(K, K); c.translate(-cx, -cy);
  c.fillStyle = '#4fa36a'; c.beginPath(); c.ellipse(cx, cy + 40, 420, 230, 0, 0, 7); c.fill();
  c.fillStyle = '#62b878'; c.beginPath(); c.ellipse(cx + 20, cy + 30, 360, 190, 0, 0, 7); c.fill();
  // moat & winding path
  c.strokeStyle = '#6aa4d8'; c.lineWidth = 34; c.beginPath(); c.ellipse(cx, cy + 50, 300, 150, 0, 0.2, 2.9); c.stroke();
  c.strokeStyle = '#e8d070'; c.lineWidth = 26; c.beginPath(); c.moveTo(cx - 40, cy + 120); c.bezierCurveTo(cx - 140, cy + 230, cx - 300, cy + 200, cx - 380, cy + 320); c.stroke();
  // castle walls (cream) with pink/red roofs
  const wall = '#ece2d6', wallS = '#c8b8b0', roof = '#d0606c', roofS = '#a84050';
  const block = (x, y, bw, bh, rh) => {
    c.fillStyle = wallS; c.fillRect(x, y, bw, bh); c.fillStyle = wall; c.fillRect(x, y, bw * 0.8, bh);
    c.fillStyle = roof; c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + bw / 2, y - rh); c.lineTo(x + bw + 8, y); c.fill();
    c.fillStyle = roofS; c.beginPath(); c.moveTo(x + bw / 2, y - rh); c.lineTo(x + bw + 8, y); c.lineTo(x + bw / 2, y); c.fill();
  };
  block(cx - 230, cy - 40, 460, 150, 70);
  block(cx - 330, cy, 140, 120, 60); block(cx + 190, cy, 140, 120, 60);
  // side towers
  for (const tx of [cx - 260, cx + 230]) { c.fillStyle = wall; c.fillRect(tx, cy - 120, 34, 150); c.fillStyle = roof; c.beginPath(); c.moveTo(tx - 10, cy - 120); c.lineTo(tx + 17, cy - 190); c.lineTo(tx + 44, cy - 120); c.fill(); }
  // central keep + tall tower with cone
  c.fillStyle = wall; c.fillRect(cx - 80, cy - 160, 160, 140);
  c.fillStyle = roof; c.beginPath(); c.moveTo(cx - 96, cy - 160); c.lineTo(cx, cy - 225); c.lineTo(cx + 96, cy - 160); c.fill();
  c.fillStyle = wall; c.fillRect(cx - 32, cy - 330, 64, 150);
  c.fillStyle = roof; c.beginPath(); c.moveTo(cx - 44, cy - 330); c.lineTo(cx, cy - 430); c.lineTo(cx + 44, cy - 330); c.fill();
  // stained-glass window + windows
  c.fillStyle = '#f0a0c0'; c.beginPath(); c.arc(cx, cy - 90, 22, 0, 7); c.fill();
  c.fillStyle = '#7a6a8a'; for (let i = 0; i < 6; i++) c.fillRect(cx - 200 + i * 75, cy + 40, 14, 24);
  // distance haze over the grounds
  c.fillStyle = 'rgba(200,215,235,0.28)'; c.beginPath(); c.ellipse(cx, cy, 440, 260, 0, 0, 7); c.fill();
  c.restore();
  // cloud sea: soft billows layered over everything, thinner around the castle
  const puff = (x, y, r, col, a) => {
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.6, `rgba(${col},${a * 0.6})`); gr.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  };
  for (let i = 0; i < 1400; i++) {
    const x = R() * w, y = R() * h;
    const dx = (x - cx) / 330, dy = (y - cy) / 210; if (dx * dx + dy * dy < 1 && R() < 0.9) continue;
    const r = 18 + R() * 60;
    if (R() < 0.5) puff(x + 12, y + 18, r * 1.25, R() < 0.5 ? '70,100,160' : '60,120,130', 0.4);
    puff(x, y, r, R() < 0.35 ? '190,225,230' : '250,252,255', 0.5 + R() * 0.35);
  }
  // a few tiny dark trees on the visible green patches
  c.fillStyle = 'rgba(30,70,50,0.8)';
  for (let i = 0; i < 30; i++) { const x = cx + (R() - 0.5) * 560, y = cy + (R() - 0.3) * 240; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
}
