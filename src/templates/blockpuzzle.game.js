// פאזל בלוקים: גוררים צורות ללוח 8×8, משלימים שורות ועמודות כדי לנקות אותן. נגמר כשאין מקום לאף צורה.
const N = 8;
const SHAPES = [
  ['#'], ['##'], ['#', '#'], ['###'], ['#', '#', '#'], ['####'], ['#', '#', '#', '#'], ['#####'], ['#', '#', '#', '#', '#'],
  ['##', '##'], ['###', '###', '###'], ['###', '###'], ['##', '##', '##'],
  ['#.', '##'], ['.#', '##'], ['##', '#.'], ['##', '.#'],
  ['#..', '#..', '###'], ['..#', '..#', '###'], ['###', '#..', '#..'], ['###', '..#', '..#'],
  ['###', '.#.'], ['.#.', '###'], ['#.', '##', '#.'], ['.#', '##', '.#'],
  ['##.', '.##'], ['.##', '##.'], ['#.', '##', '.#'], ['.#', '##', '#.'],
  ['#..', '###'], ['###', '..#'], ['..#', '###'], ['###', '#..'],
].map(rows => {
  const cells = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') cells.push([x, y]); }));
  return { cells, w: Math.max(...rows.map(r => r.length)), h: rows.length };
});
const COLORS = ['#ff5d5d', '#ffb13b', '#ffe14d', '#5ddc6a', '#3ec9ff', '#6f7bff', '#c86bff', '#ff6bc4'];

let board, tray, drag, bx, by, cs, combo, sincClear, clearing, lines;

function fits(sh, gx, gy) {
  return sh.cells.every(([x, y]) => { const X = gx + x, Y = gy + y; return X >= 0 && Y >= 0 && X < N && Y < N && !board[Y * N + X]; });
}
function canPlaceAnywhere(sh) {
  for (let y = 0; y <= N - sh.h; y++) for (let x = 0; x <= N - sh.w; x++) if (fits(sh, x, y)) return true;
  return false;
}
function newPiece() {
  // ככל שהקושי גבוה יותר יש יותר צורות גדולות
  let sh;
  do { sh = pick(SHAPES); } while (sh.cells.length >= 6 && Math.random() > S.bigChance);
  const k = randi(0, COLORS.length - 1);
  return { sh, color: COLORS[k], e: T.tiers[k % T.tiers.length] };
}
function refill() {
  tray = [newPiece(), newPiece(), newPiece()];
  // לפחות צורה אחת שאפשר להניח, אם יש בכלל אפשרות כזו
  if (!tray.some(p => canPlaceAnywhere(p.sh))) {
    for (let i = 0; i < 30; i++) { const p = newPiece(); if (canPlaceAnywhere(p.sh)) { tray[0] = p; break; } }
  }
}
function trayPos(i) { return { x: W / 2 + (1 - i) * (W / 3.2), y: by + cs * N + cs * 1.6 }; }
function gridFromDrag() {
  const sh = drag.p.sh;
  return [Math.round((drag.x - bx) / cs - sh.w / 2), Math.round((drag.y - by) / cs - sh.h / 2)];
}
function checkOver() {
  const left = tray.filter(Boolean);
  if (left.length && !left.some(p => canPlaceAnywhere(p.sh))) gameOver(G.score, `ניקית ${lines} שורות · קומבו מקסימלי ×${G.maxCombo}`);
}

const game = {
  resize() {
    const size = Math.min(W * 0.94, H * 0.6, 520);
    cs = size / N; bx = (W - size) / 2; by = Math.max(56, (H - size - cs * 3.4) / 2);
  },
  reset() {
    game.resize();
    board = new Array(N * N).fill(null); combo = 0; sincClear = 0; clearing = []; lines = 0; G.maxCombo = 0; drag = null;
    refill();
  },
  down(x, y) {
    for (let i = 0; i < 3; i++) {
      if (!tray[i]) continue;
      const p = trayPos(i);
      if (Math.abs(x - p.x) < W / 6.4 && Math.abs(y - p.y) < cs * 1.6) { drag = { i, p: tray[i], x, y: y - cs * 2 }; beep(500, 0.03, 'sine'); return; }
    }
  },
  move(x, y) { if (drag) { drag.x = x; drag.y = y - cs * 2; } },
  up() {
    if (!drag) return;
    const [gx, gy] = gridFromDrag(), p = drag.p;
    if (fits(p.sh, gx, gy)) {
      for (const [x, y] of p.sh.cells) board[(gy + y) * N + gx + x] = { c: p.color, e: p.e };
      G.score += p.sh.cells.length; tray[drag.i] = null;
      beep(330, 0.06, 'triangle');
      // ניקוי שורות ועמודות מלאות
      const rows = [], cols = [];
      for (let k = 0; k < N; k++) {
        let r = true, c = true;
        for (let j = 0; j < N; j++) { if (!board[k * N + j]) r = false; if (!board[j * N + k]) c = false; }
        if (r) rows.push(k); if (c) cols.push(k);
      }
      const n = rows.length + cols.length;
      if (n) {
        combo++; sincClear = 0; lines += n; G.maxCombo = Math.max(G.maxCombo, combo);
        const pts = n * N * 2 * n * combo; G.score += pts;
        const set = new Set();
        rows.forEach(r => { for (let j = 0; j < N; j++) set.add(r * N + j); });
        cols.forEach(c => { for (let j = 0; j < N; j++) set.add(j * N + c); });
        for (const i of set) {
          const cell = board[i]; board[i] = null;
          clearing.push({ i, cell, t: 0.35 });
          burst(bx + (i % N + 0.5) * cs, by + (((i / N) | 0) + 0.5) * cs, cell.c, 3, 140);
        }
        floatText(W / 2, by + cs * N / 2, (combo > 1 ? `קומבו ×${combo}! ` : '') + '+' + pts, P.accent, 30);
        [0, 1, 2].slice(0, Math.min(3, n)).forEach(k => setTimeout(() => beep(660 + k * 220 + combo * 60, 0.12, 'triangle', 0.05), k * 70));
      } else if (++sincClear >= 3) combo = 0;
      if (tray.every(t => !t)) refill();
      checkOver();
    } else beep(150, 0.05, 'sine', 0.02);
    drag = null;
  },
  update(dt) {
    for (const c of clearing) c.t -= dt;
    clearing = clearing.filter(c => c.t > 0);
  },
  draw() {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    if (!board) return;
    const size = cs * N;
    ctx.fillStyle = P.bg2; roundRect(bx - 8, by - 8, size + 16, size + 16, 16); ctx.fill();
    const block = (x, y, s, color, e, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color; roundRect(x + 2, y + 2, s - 4, s - 4, s * 0.18); ctx.fill();
      ctx.fillStyle = '#ffffff40'; roundRect(x + 4, y + 4, s - 8, (s - 8) * 0.38, s * 0.14); ctx.fill();
      ctx.globalAlpha = 1;
      if (e && s > 22) drawEmoji(e, x + s / 2, y + s / 2 + 1, s * 0.5, false, alpha);
    };
    // תצוגה מקדימה של מיקום הצורה הנגררת, כולל השורות שיתנקו
    let ghost = null, willClear = new Set();
    if (drag) {
      const [gx, gy] = gridFromDrag();
      if (fits(drag.p.sh, gx, gy)) {
        ghost = { gx, gy };
        const tmp = board.slice();
        for (const [x, y] of drag.p.sh.cells) tmp[(gy + y) * N + gx + x] = 1;
        for (let k = 0; k < N; k++) {
          let r = true, c = true;
          for (let j = 0; j < N; j++) { if (!tmp[k * N + j]) r = false; if (!tmp[j * N + k]) c = false; }
          for (let j = 0; j < N; j++) { if (r) willClear.add(k * N + j); if (c) willClear.add(j * N + k); }
        }
      }
    }
    for (let i = 0; i < N * N; i++) {
      const x = bx + (i % N) * cs, y = by + ((i / N) | 0) * cs, b = board[i];
      if (b) block(x, y, cs, willClear.has(i) ? P.fg : b.c, b.e);
      else { ctx.fillStyle = willClear.has(i) ? P.accent + '44' : P.bg; roundRect(x + 2, y + 2, cs - 4, cs - 4, cs * 0.16); ctx.fill(); }
    }
    for (const c of clearing) {
      const x = bx + (c.i % N) * cs, y = by + ((c.i / N) | 0) * cs, k = c.t / 0.35, s = cs * k;
      block(x + (cs - s) / 2, y + (cs - s) / 2, s, c.cell.c, null, k);
    }
    if (ghost) for (const [x, y] of drag.p.sh.cells) block(bx + (ghost.gx + x) * cs, by + (ghost.gy + y) * cs, cs, drag.p.color, null, 0.35);
    // מגש הצורות
    for (let i = 0; i < 3; i++) {
      const p = tray[i]; if (!p || (drag && drag.i === i)) continue;
      const tp = trayPos(i), s = Math.min(cs * 0.55, (W / 3.4) / Math.max(p.sh.w, 3));
      const ok = canPlaceAnywhere(p.sh);
      for (const [x, y] of p.sh.cells) block(tp.x - p.sh.w * s / 2 + x * s, tp.y - p.sh.h * s / 2 + y * s, s, p.color, null, ok ? 1 : 0.3);
    }
    if (drag) {
      const sh = drag.p.sh;
      for (const [x, y] of sh.cells) block(drag.x - sh.w * cs / 2 + x * cs, drag.y - sh.h * cs / 2 + y * cs, cs, drag.p.color, drag.p.e, 0.9);
    }
    drawFx();
    hud(`⭐ ${fmt(G.score)}`, combo > 1 ? `🔥 קומבו ×${combo}` : `🧱 ${lines} שורות`);
  },
};
