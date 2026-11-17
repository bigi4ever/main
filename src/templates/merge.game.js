// מיזוג שלישיות: מניחים פריט על הלוח; שלושה (או יותר) פריטים זהים צמודים מתמזגים לפריט הבא בסדרה.
let N, board, nextT, stash, topTier, bx, by, cs, hover, anim, moves;
const MAXT = T.tiers.length - 1;
const val = k => Math.round(Math.pow(3, k + 1));

function group(b, i, tier) {
  const seen = new Set([i]), st = [i];
  while (st.length) {
    const c = st.pop(), x = c % N, y = (c / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * N + nx;
      if (nx >= 0 && ny >= 0 && nx < N && ny < N && !seen.has(n) && b[n] === tier) { seen.add(n); st.push(n); }
    }
  }
  return seen;
}

function rollNext() {
  const cap = Math.min(MAXT - 1, Math.max(1, topTier - 2));
  const r = Math.random();
  // רוב הזמן פריטים נמוכים; מדי פעם פריט גבוה יותר
  return r < 0.62 ? 0 : r < 0.88 ? Math.min(1, cap) : r < 0.97 ? Math.min(2, cap) : randi(0, cap);
}

function place(i) {
  if (board[i] !== -1) return;
  board[i] = nextT; moves++;
  beep(440, 0.05, 'triangle');
  let chain = 0;
  while (true) {
    const tier = board[i];
    const grp = group(board, i, tier);
    if (grp.size < 3) break;
    chain++;
    const cx = bx + (i % N + 0.5) * cs, cy = by + (((i / N) | 0) + 0.5) * cs;
    for (const c of grp) {
      if (c !== i) { board[c] = -1; burst(bx + (c % N + 0.5) * cs, by + (((c / N) | 0) + 0.5) * cs, P.accent, 6, 120); }
    }
    let pts;
    if (tier === MAXT) { board[i] = -1; pts = val(tier) * grp.size * 2; floatText(cx, cy, 'מושלם! ' + T.tiers[MAXT], P.accent, 28); }
    else {
      board[i] = tier + 1; pts = val(tier + 1) * (grp.size - 2) * chain;
      if (tier + 1 > topTier) { topTier = tier + 1; floatText(cx, cy - 30, 'חדש! ' + T.tiers[topTier], P.fg, 24); }
    }
    G.score += pts; floatText(cx, cy, '+' + fmt(pts) + (chain > 1 ? ` ×${chain}` : ''));
    anim[i] = 1;
    beep(500 + chain * 160 + tier * 40, 0.12, 'triangle', 0.05);
    if (board[i] === -1) break;
  }
  nextT = rollNext();
  if (!board.includes(-1)) gameOver(G.score, `הגעת עד ${T.tiers[topTier]} ב-${moves} מהלכים`);
}

function cellAt(x, y) {
  const cx = Math.floor((x - bx) / cs), cy = Math.floor((y - by) / cs);
  return cx >= 0 && cy >= 0 && cx < N && cy < N ? cy * N + cx : -1;
}
function stashRect() { return { x: W / 2 - cs * 1.6, y: by - cs * 1.25, s: cs * 0.95 }; }
function nextRect() { return { x: W / 2 + cs * 0.65, y: by - cs * 1.25, s: cs * 0.95 }; }

const game = {
  resize() {
    N = S.size;
    const size = Math.min(W * 0.94, H * 0.62, 560);
    cs = size / N; bx = (W - size) / 2; by = Math.max(cs * 1.6 + 50, (H - size) / 2 + cs * 0.5);
  },
  reset() {
    game.resize();
    board = new Array(N * N).fill(-1); anim = {}; topTier = 0; moves = 0; stash = -1; hover = -1;
    // כמה פריטים פזורים בהתחלה, בלי שלישיות מוכנות
    for (let k = 0; k < Math.floor(N * N * 0.18); k++) {
      const i = randi(0, N * N - 1); if (board[i] !== -1) continue;
      board[i] = randi(0, 1); if (group(board, i, board[i]).size >= 3) board[i] = -1;
    }
    nextT = rollNext();
  },
  move(x, y) { hover = cellAt(x, y); },
  down(x, y) {
    const s = stashRect();
    if (x > s.x && x < s.x + s.s && y > s.y && y < s.y + s.s) {
      if (stash === -1) { stash = nextT; nextT = rollNext(); } else { [stash, nextT] = [nextT, stash]; }
      beep(300, 0.06, 'sine'); return;
    }
    const i = cellAt(x, y); if (i >= 0) place(i);
  },
  update(dt) {
    for (const k in anim) { anim[k] -= dt * 3; if (anim[k] <= 0) delete anim[k]; }
  },
  draw() {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    if (!board) return;
    const size = cs * N;
    ctx.fillStyle = P.bg2; roundRect(bx - 8, by - 8, size + 16, size + 16, 18); ctx.fill();
    // קבוצה שתתמזג אם נניח כאן
    let preview = null;
    if (hover >= 0 && board[hover] === -1 && G.state === 'play') {
      const b = board.slice(); b[hover] = nextT; const g = group(b, hover, nextT);
      if (g.size >= 3) preview = g;
    }
    for (let i = 0; i < N * N; i++) {
      const x = bx + (i % N) * cs, y = by + ((i / N) | 0) * cs;
      ctx.fillStyle = preview && preview.has(i) ? P.accent + '55' : (i === hover ? P.grid : P.bg);
      roundRect(x + 3, y + 3, cs - 6, cs - 6, 10); ctx.fill();
      if (board[i] >= 0) {
        const a = anim[i] || 0;
        drawEmoji(T.tiers[board[i]], x + cs / 2, y + cs / 2, cs * 0.62 * (1 + a * 0.35));
        ctx.fillStyle = '#ffffff99'; ctx.font = `800 ${cs * 0.17}px system-ui`; ctx.textAlign = 'left';
        ctx.fillText(board[i] + 1, x + 8, y + cs * 0.22);
      } else if (i === hover && G.state === 'play') {
        drawEmoji(T.tiers[nextT], x + cs / 2, y + cs / 2, cs * 0.55, false, 0.45);
      }
    }
    const s = stashRect(), n = nextRect();
    ctx.textAlign = 'center'; ctx.fillStyle = P.fg; ctx.font = `700 ${Math.max(12, cs * 0.18)}px system-ui`;
    ctx.fillStyle = P.bg2; roundRect(s.x, s.y, s.s, s.s, 12); ctx.fill();
    ctx.strokeStyle = P.grid; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = P.accent + '33'; roundRect(n.x, n.y, n.s, n.s, 12); ctx.fill();
    ctx.strokeStyle = P.accent; ctx.stroke();
    ctx.fillStyle = P.fg;
    ctx.fillText('שמור (החלף)', s.x + s.s / 2, s.y - 8);
    ctx.fillText('הבא', n.x + n.s / 2, n.y - 8);
    if (stash >= 0) drawEmoji(T.tiers[stash], s.x + s.s / 2, s.y + s.s / 2, s.s * 0.6);
    drawEmoji(T.tiers[nextT], n.x + n.s / 2, n.y + n.s / 2, n.s * 0.62 * (1 + Math.sin(performance.now() / 250) * 0.05));
    // סרגל ההתקדמות בסדרה
    const ry = by + size + 26, step = Math.min(34, (W - 20) / (MAXT + 1));
    for (let k = 0; k <= MAXT; k++) {
      drawEmoji(T.tiers[k], W / 2 + (MAXT / 2 - k) * step, ry, step * 0.75, false, k <= topTier ? 1 : 0.18);
    }
    drawFx();
    hud(`⭐ ${fmt(G.score)}`, `השיא שלך בסדרה: ${T.tiers[topTier]}`);
  },
};
