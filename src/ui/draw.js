// 2D drawing helpers for menus and HUD (canvas 640x480).
export const FONT = '"Arial Black", "Arial Bold", Gadget, sans-serif';

export function text(ctx, str, x, y, o = {}) {
  ctx.save();
  ctx.font = `${o.italic === false ? '' : 'italic '}${o.weight ?? 900} ${o.size ?? 20}px ${o.font ?? FONT}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.scaleX) { ctx.translate(x, y); ctx.scale(o.scaleX, 1); x = 0; y = 0; }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeW ?? 4; ctx.strokeStyle = o.stroke; ctx.strokeText(str, x, y); }
  if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(str, x + (o.sx ?? 2), y + (o.sy ?? 2)); }
  if (o.gradient) {
    const g = ctx.createLinearGradient(0, y - (o.size ?? 20), 0, y);
    o.gradient.forEach((c, i) => g.addColorStop(i / (o.gradient.length - 1), c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = o.color ?? '#fff';
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function panel(ctx, x, y, w, h, o = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, o.r ?? 8);
  if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
  if (o.gradient) { const g = ctx.createLinearGradient(x, y, x, y + h); o.gradient.forEach((c, i) => g.addColorStop(i / (o.gradient.length - 1), c)); ctx.fillStyle = g; ctx.fill(); }
  if (o.stroke) { ctx.lineWidth = o.lw ?? 2; ctx.strokeStyle = o.stroke; ctx.stroke(); }
  ctx.restore();
}

// Slanted "SSB64 menu" bar (parallelogram)
export function slant(ctx, x, y, w, h, fill, skew = 14, stroke) {
  ctx.save(); ctx.beginPath();
  ctx.moveTo(x + skew, y); ctx.lineTo(x + w + skew, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
  if (typeof fill === 'object' && fill.length) { const g = ctx.createLinearGradient(x, y, x, y + h); fill.forEach((c, i) => g.addColorStop(i / (fill.length - 1), c)); ctx.fillStyle = g; }
  else ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
}
