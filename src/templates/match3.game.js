// Match-3: מחליפים שני פריטים צמודים כדי ליצור שורה של 3 ומעלה.
// 4 ברצף יוצרים פריט פס (מנקה שורה או עמודה), 5 ברצף יוצרים פצצת צבע.
// לכל שלב יש יעד ניקוד ומספר מהלכים מוגבל.
const N = 8;
const BG = ['#ff5d73', '#ffb02e', '#ffe14d', '#4cd97b', '#3ec9ff', '#b77bff'];
const K = S.kinds;
let grid, bx, by, cs, sel, drag, phase, pair, combo, level, moves, levelStart, target, idc = 0;

const tile = t => ({ t, sp: null, ox: 0, oy: 0, vy: 0, id: idc++ });
const inB = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

function runs() {
  const out = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N;) {
    const t = grid[y][x].t; let e = x + 1;
    if (t >= 0) while (e < N && grid[y][e].t === t) e++;
    if (t >= 0 && e - x >= 3) out.push({ h: true, cells: Array.from({ length: e - x }, (_, k) => [x + k, y]) });
    x = e;
  }
  for (let x = 0; x < N; x++) for (let y = 0; y < N;) {
    const t = grid[y][x].t; let e = y + 1;
    if (t >= 0) while (e < N && grid[e][x].t === t) e++;
    if (t >= 0 && e - y >= 3) out.push({ h: false, cells: Array.from({ length: e - y }, (_, k) => [x, y + k]) });
    y = e;
  }
  return out;
}
function swapCells(a, b) { const t = grid[a[1]][a[0]]; grid[a[1]][a[0]] = grid[b[1]][b[0]]; grid[b[1]][b[0]] = t; }
function hasMove() {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (grid[y][x].sp === 'bomb') return true;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (!inB(x + dx, y + dy)) continue;
      swapCells([x, y], [x + dx, y + dy]);
      const ok = runs().length > 0;
      swapCells([x, y], [x + dx, y + dy]);
      if (ok) return true;
    }
  }
  return false;
}
function freshBoard() {
  do {
    grid = [];
    for (let y = 0; y < N; y++) {
      grid.push([]);
      for (let x = 0; x < N; x++) {
        let t;
        do { t = randi(0, K - 1); } while ((x >= 2 && grid[y][x - 1].t === t && grid[y][x - 2].t === t) || (y >= 2 && grid[y - 1][x].t === t && grid[y - 2][x].t === t));
        const c = tile(t); c.oy = -(N - y) * cs * 0.6 - 40; grid[y].push(c);
      }
    }
  } while (!hasMove());
}

function explode(seed, create = [], colorAll = null) {
  const seen = new Set(seed), queue = [...seed];
  while (queue.length) {
    const i = queue.pop(), x = i % N, y = (i / N) | 0, c = grid[y][x];
    const extra = [];
    if (c.sp === 'row') for (let k = 0; k < N; k++) extra.push(y * N + k);
    if (c.sp === 'col') for (let k = 0; k < N; k++) extra.push(k * N + x);
    if (c.sp === 'bomb') {
      const tt = colorAll ?? randi(0, K - 1);
      for (let j = 0; j < N * N; j++) if (grid[(j / N) | 0][j % N].t === tt) extra.push(j);
    }
    for (const e of extra) if (!seen.has(e)) { seen.add(e); queue.push(e); }
  }
  combo++;
  const pts = seen.size * 10 * combo; G.score += pts;
  let sx = 0, sy = 0;
  for (const i of seen) {
    const x = i % N, y = (i / N) | 0, c = grid[y][x];
    const px = bx + (x + 0.5) * cs, py = by + (y + 0.5) * cs; sx += px; sy += py;
    burst(px, py, c.t >= 0 ? BG[c.t] : P.accent, 4, 150);
    grid[y][x] = null;
  }
  for (const cr of create) { const c = tile(cr.t); c.sp = cr.sp; grid[cr.y][cr.x] = c; }
  floatText(sx / seen.size, sy / seen.size, '+' + pts + (combo > 1 ? ` ×${combo}` : ''), P.accent, 22 + Math.min(10, combo * 2));
  beep(440 + combo * 110, 0.1, 'triangle', 0.045);
  if (seen.size >= N) beep(220, 0.25, 'sawtooth', 0.04);
  gravity();
  phase = 'fall';
}

function resolve(swapped) {
  const rs = runs();
  if (!rs.length) return false;
  const seed = new Set(), create = [];
  for (const r of rs) {
    for (const [x, y] of r.cells) seed.add(y * N + x);
    if (r.cells.length >= 4) {
      const spot = (swapped && r.cells.find(c => swapped.some(s => s[0] === c[0] && s[1] === c[1]))) || r.cells[r.cells.length >> 1];
      const five = r.cells.length >= 5;
      create.push({ x: spot[0], y: spot[1], t: five ? -1 : grid[spot[1]][spot[0]].t, sp: five ? 'bomb' : (r.h ? 'col' : 'row') });
    }
  }
  explode(seed, create);
  return true;
}

function gravity() {
  for (let x = 0; x < N; x++) {
    let w = N - 1;
    for (let y = N - 1; y >= 0; y--) {
      const c = grid[y][x];
      if (!c) continue;
      if (y !== w) { grid[w][x] = c; grid[y][x] = null; c.oy -= (w - y) * cs; }
      w--;
    }
    for (let y = w; y >= 0; y--) { const c = tile(randi(0, K - 1)); c.oy = -(w + 1) * cs; grid[y][x] = c; }
  }
}

function settled() {
  for (const row of grid) for (const c of row) if (c.ox || c.oy) return false;
  return true;
}

function trySwap(a, b) {
  if (!inB(...b) || Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return;
  swapCells(a, b);
  const A = grid[a[1]][a[0]], B = grid[b[1]][b[0]];
  A.ox = (b[0] - a[0]) * cs; A.oy = (b[1] - a[1]) * cs;
  B.ox = (a[0] - b[0]) * cs; B.oy = (a[1] - b[1]) * cs;
  pair = [a, b]; phase = 'swap'; sel = null; combo = 0;
  beep(330, 0.05, 'sine');
}

function nextLevel() {
  level++; levelStart = G.score; moves = S.moves; target = Math.round(S.target * level * (1 + level * 0.15));
}

function cellAt(x, y) {
  const cx = Math.floor((x - bx) / cs), cy = Math.floor((y - by) / cs);
  return inB(cx, cy) ? [cx, cy] : null;
}

const game = {
  resize() {
    const size = Math.min(W * 0.96, H * 0.66, 580);
    cs = size / N; bx = (W - size) / 2; by = Math.max(96, (H - size) / 2 + 20);
  },
  reset() {
    game.resize();
    level = 0; G.score = 0; nextLevel(); combo = 0; sel = null; drag = null; phase = 'idle';
    freshBoard();
  },
  down(x, y) {
    if (phase !== 'idle') return;
    const c = cellAt(x, y); if (!c) return;
    drag = { x, y, c };
  },
  move(x, y) {
    if (!drag || phase !== 'idle') return;
    const dx = x - drag.x, dy = y - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cs * 0.35) return;
    const c = drag.c; drag = null;
    trySwap(c, Math.abs(dx) > Math.abs(dy) ? [c[0] + Math.sign(dx), c[1]] : [c[0], c[1] + Math.sign(dy)]);
  },
  up(x, y) {
    if (!drag) return;
    const c = drag.c; drag = null;
    if (sel && Math.abs(sel[0] - c[0]) + Math.abs(sel[1] - c[1]) === 1) trySwap(sel, c);
    else sel = sel && sel[0] === c[0] && sel[1] === c[1] ? null : c;
  },
  update(dt) {
    for (const row of grid) for (const c of row) {
      if (!c) continue;
      if (c.ox) { const s = Math.sign(c.ox); c.ox -= s * 900 * dt; if (Math.sign(c.ox) !== s) c.ox = 0; }
      if (c.oy > 0 || (c.oy && phase !== 'fall')) { const s = Math.sign(c.oy); c.oy -= s * 900 * dt; if (Math.sign(c.oy) !== s) c.oy = 0; }
      else if (c.oy < 0) { c.vy += 3200 * dt; c.oy = Math.min(0, c.oy + c.vy * dt); if (!c.oy) c.vy = 0; }
    }
    if (!settled()) return;
    if (phase === 'swap') {
      const [a, b] = pair, A = grid[a[1]][a[0]], B = grid[b[1]][b[0]];
      if (A.sp === 'bomb' || B.sp === 'bomb') {
        moves--;
        const bomb = A.sp === 'bomb' ? a : b, other = A.sp === 'bomb' ? B : A;
        const seed = [bomb[1] * N + bomb[0]];
        if (other.sp === 'bomb') { for (let j = 0; j < N * N; j++) seed.push(j); } // שתי פצצות: כל הלוח
        explode(seed, [], other.t >= 0 ? other.t : null);
      } else if (runs().length) { moves--; resolve(pair); }
      else {
        swapCells(a, b);
        const A2 = grid[a[1]][a[0]], B2 = grid[b[1]][b[0]];
        A2.ox = (b[0] - a[0]) * cs; A2.oy = (b[1] - a[1]) * cs; B2.ox = (a[0] - b[0]) * cs; B2.oy = (a[1] - b[1]) * cs;
        phase = 'back'; beep(160, 0.08, 'sine', 0.03);
      }
    } else if (phase === 'back') phase = 'idle';
    else if (phase === 'fall') {
      if (resolve(null)) return;
      phase = 'idle'; combo = 0;
      if (G.score - levelStart >= target) {
        G.state = 'pause';
        const bonus = moves * 50; G.score += bonus;
        beep(880, 0.15, 'triangle'); setTimeout(() => beep(1320, 0.2, 'triangle'), 120);
        showCard(`<div class="big">${T.gems[0]}</div><h1>שלב ${level} הושלם!</h1><p>בונוס על ${moves} מהלכים שנשארו: +${bonus}</p><button class="btn" id="cont">לשלב ${level + 1} ▶</button>`);
        document.getElementById('cont').onclick = () => { hideCard(); nextLevel(); G.state = 'play'; };
      } else if (moves <= 0) {
        gameOver(G.score, `הגעת לשלב ${level}`);
      } else if (!hasMove()) {
        floatText(W / 2, by + cs * N / 2, 'אין מהלכים, מערבב…', P.fg, 22);
        freshBoard();
      }
    }
  },
  draw() {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    if (!grid) return;
    const size = cs * N;
    // פס התקדמות ליעד
    const prog = clamp((G.score - levelStart) / target, 0, 1);
    ctx.fillStyle = P.bg2; roundRect(bx, by - 46, size, 16, 8); ctx.fill();
    ctx.fillStyle = P.accent; roundRect(bx + size * (1 - prog), by - 46, size * prog, 16, 8); ctx.fill();
    // טקסט עברי ומספרים בנפרד, כדי שכיווניות הטקסט לא תערבב את הסדר
    ctx.fillStyle = P.fg; ctx.font = '700 13px system-ui';
    ctx.textAlign = 'right'; ctx.fillText('🎯 יעד השלב', bx + size, by - 54);
    ctx.textAlign = 'left'; ctx.fillText(`${fmt(Math.max(0, G.score - levelStart))} / ${fmt(target)}`, bx, by - 54);

    ctx.fillStyle = P.bg2; roundRect(bx - 8, by - 8, size + 16, size + 16, 16); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(bx - 8, by - 8, size + 16, size + 16); ctx.clip();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      ctx.fillStyle = (x + y) % 2 ? P.bg + 'cc' : P.bg + '88';
      ctx.fillRect(bx + x * cs, by + y * cs, cs, cs);
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const c = grid[y][x]; if (!c) continue;
      const px = bx + x * cs + c.ox, py = by + y * cs + c.oy, m = cs * 0.08;
      const isSel = sel && sel[0] === x && sel[1] === y;
      ctx.fillStyle = c.t >= 0 ? BG[c.t] + (isSel ? 'cc' : '55') : '#ffffff33';
      roundRect(px + m, py + m, cs - 2 * m, cs - 2 * m, cs * 0.22); ctx.fill();
      if (isSel) { ctx.strokeStyle = P.fg; ctx.lineWidth = 3; ctx.stroke(); }
      if (c.sp === 'row' || c.sp === 'col') {
        ctx.fillStyle = '#ffffffaa';
        for (let k = -1; k <= 1; k += 2) {
          if (c.sp === 'row') ctx.fillRect(px + m * 1.5, py + cs / 2 + k * cs * 0.18 - 2, cs - 3 * m, 4);
          else ctx.fillRect(px + cs / 2 + k * cs * 0.18 - 2, py + m * 1.5, 4, cs - 3 * m);
        }
      }
      if (c.sp === 'bomb') {
        const g = ctx.createRadialGradient(px + cs / 2, py + cs / 2, 2, px + cs / 2, py + cs / 2, cs * 0.45);
        BG.forEach((col, k) => g.addColorStop(k / (BG.length - 1), col));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px + cs / 2, py + cs / 2, cs * 0.4 * (1 + Math.sin(performance.now() / 180) * 0.05), 0, 7); ctx.fill();
        drawEmoji('💥', px + cs / 2, py + cs / 2, cs * 0.5);
      } else drawEmoji(T.gems[c.t], px + cs / 2, py + cs / 2, cs * 0.58 * (isSel ? 1.08 : 1));
    }
    ctx.restore();
    drawFx();
    hud(`⭐ ${fmt(G.score)}`, `שלב ${level} · 👆 ${moves} מהלכים`);
  },
};
