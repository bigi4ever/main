// פאזל חצים: לוחצים על חץ, והוא מחליק החוצה מהלוח בכיוון שלו, אם הדרך פנויה.
// חץ שנתקע בחץ אחר עולה בלב. מנקים את כל החצים כדי לעבור שלב.
//
// כל לוח פתיר בוודאות: הוא נבנה בסדר הפוך לסדר הפתרון. כל חץ חדש מונח רק אם הקרן שלו
// עד הקצה פנויה מכל החצים שכבר הונחו. החצים שהונחו קודם יוצאים אחריו, אז מסלולם
// יכול לעבור דרכו (הוא כבר לא יהיה שם). לכן הפתרון הוא להוציא בסדר הפוך להנחה.
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // ימינה, למטה, שמאלה, למעלה
let N, board, level, hearts, bx, by, cs, flying, shake, hint, cleared;

function rayLen(g, n, i, d) {
  // אורך הקרן עד הקצה, או -1 אם יש חוסם
  let x = i % n + DIRS[d][0], y = ((i / n) | 0) + DIRS[d][1], len = 0;
  while (x >= 0 && y >= 0 && x < n && y < n) {
    if (g[y * n + x] !== -1) return -1;
    x += DIRS[d][0]; y += DIRS[d][1]; len++;
  }
  return len;
}
function blocker(i) {
  let x = i % N + DIRS[board[i]][0], y = ((i / N) | 0) + DIRS[board[i]][1];
  while (x >= 0 && y >= 0 && x < N && y < N) {
    if (board[y * N + x] !== -1) return y * N + x;
    x += DIRS[board[i]][0]; y += DIRS[board[i]][1];
  }
  return -1;
}
function generate(n, density) {
  const g = new Array(n * n).fill(-1), want = Math.floor(n * n * density);
  let placed = 0;
  for (let tries = 0; placed < want && tries < 4000; tries++) {
    const i = randi(0, n * n - 1);
    if (g[i] !== -1) continue;
    // מעדיפים את הכיוון עם הקרן הארוכה ביותר: חצים שיוצאים מאוחר יותר יעברו דרכה, וזה יוצר תלויות
    let best = -1, bl = -1;
    for (const d of [0, 1, 2, 3].sort(() => Math.random() - 0.5)) {
      const l = rayLen(g, n, i, d);
      if (l > bl) { bl = l; best = d; }
    }
    if (best >= 0 && bl >= 0) { g[i] = best; placed++; }
  }
  return g;
}

function newLevel() {
  N = Math.min(S.maxSize, S.startSize + Math.floor((level - 1) / 2));
  board = generate(N, Math.min(0.92, S.density + level * 0.02));
  flying = []; shake = null; hint = null; hearts = S.hearts;
  game.resize();
}

function remaining() { return board.filter(v => v !== -1).length; }
function hintBtn() { return { x: W / 2 - 70, y: by + cs * N + 22, w: 140, h: 44 }; }

const game = {
  resize() {
    if (!N) return;
    const size = Math.min(W * 0.94, H * 0.66, 600);
    cs = size / N; bx = (W - size) / 2; by = Math.max(64, (H - size) / 2 - 20);
  },
  reset() { level = 1; cleared = 0; newLevel(); },
  down(x, y) {
    const hb = hintBtn();
    if (x > hb.x && x < hb.x + hb.w && y > hb.y && y < hb.y + hb.h) {
      const free = board.map((d, i) => (d !== -1 && blocker(i) === -1 ? i : -1)).filter(i => i >= 0);
      if (free.length) { hint = { i: pick(free), t: 1.6 }; G.score = Math.max(0, G.score - 15); beep(600, 0.08, 'sine'); }
      return;
    }
    const cx = Math.floor((x - bx) / cs), cy = Math.floor((y - by) / cs);
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return;
    const i = cy * N + cx, d = board[i];
    if (d === -1) return;
    const b = blocker(i);
    if (b === -1) {
      board[i] = -1; cleared++;
      flying.push({ x: bx + (cx + 0.5) * cs, y: by + (cy + 0.5) * cs, d, v: 300, life: 1 });
      G.score += 10; if (hint && hint.i === i) hint = null;
      beep(520 + Math.random() * 200, 0.06, 'triangle');
      if (!remaining()) {
        const bonus = 50 * level + hearts * 25;
        G.score += bonus;
        floatText(W / 2, by + cs * N / 2, `שלב ${level} הושלם! +${bonus}`, P.accent, 28);
        beep(880, 0.15, 'triangle'); setTimeout(() => beep(1320, 0.2, 'triangle'), 120);
        level++;
        setTimeout(() => { if (G.state === 'play') newLevel(); }, 900);
      }
    } else {
      // החץ מתקדם עד החוסם וחוזר
      const dist = Math.max(Math.abs((b % N) - cx), Math.abs(((b / N) | 0) - cy)) - 1;
      shake = { i, d, dist: dist * cs + cs * 0.25, t: 0, blk: b };
      hearts--; beep(140, 0.18, 'sawtooth', 0.05);
      if (hearts <= 0) gameOver(G.score, `הגעת לשלב ${level} וניקית ${cleared} חצים`);
    }
  },
  update(dt) {
    for (const f of flying) { f.v += 2600 * dt; f.x += DIRS[f.d][0] * f.v * dt; f.y += DIRS[f.d][1] * f.v * dt; f.life -= dt * 1.5; }
    flying = flying.filter(f => f.life > 0);
    if (shake) { shake.t += dt * 3; if (shake.t >= 1) shake = null; }
    if (hint) { hint.t -= dt; if (hint.t <= 0) hint = null; }
  },
  draw() {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    if (!board) return;
    const size = cs * N;
    ctx.fillStyle = P.bg2; roundRect(bx - 10, by - 10, size + 20, size + 20, 18); ctx.fill();
    for (let i = 0; i < N * N; i++) {
      const x = bx + (i % N) * cs, y = by + ((i / N) | 0) * cs;
      ctx.fillStyle = P.grid + '66'; ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, cs * 0.06, 0, 7); ctx.fill();
    }
    const arrow = (cx, cy, d, color, alpha = 1, glow = false) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(d * Math.PI / 2);
      const s = cs * 0.42;
      if (glow) { ctx.shadowColor = P.accent; ctx.shadowBlur = 18; }
      ctx.fillStyle = color; roundRect(-s, -s, s * 2, s * 2, s * 0.35); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = P.bg;
      ctx.beginPath();
      ctx.moveTo(s * 0.62, 0); ctx.lineTo(s * 0.02, -s * 0.52); ctx.lineTo(s * 0.02, -s * 0.2); ctx.lineTo(-s * 0.6, -s * 0.2);
      ctx.lineTo(-s * 0.6, s * 0.2); ctx.lineTo(s * 0.02, s * 0.2); ctx.lineTo(s * 0.02, s * 0.52); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    for (let i = 0; i < N * N; i++) {
      if (board[i] === -1) continue;
      let cx = bx + (i % N + 0.5) * cs, cy = by + (((i / N) | 0) + 0.5) * cs, color = P.accent;
      if (shake && shake.i === i) {
        const k = Math.sin(shake.t * Math.PI) * shake.dist;
        cx += DIRS[shake.d][0] * k; cy += DIRS[shake.d][1] * k; color = P.danger;
      }
      if (shake && shake.blk === i) color = P.fg;
      arrow(cx, cy, board[i], color, 1, hint && hint.i === i && Math.floor(hint.t * 6) % 2 === 0);
    }
    for (const f of flying) arrow(f.x, f.y, f.d, P.accent, Math.max(0, f.life));
    const hb = hintBtn();
    ctx.fillStyle = P.bg2; roundRect(hb.x, hb.y, hb.w, hb.h, 12); ctx.fill();
    ctx.strokeStyle = P.grid; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = P.fg; ctx.font = '800 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💡 רמז (-15)', hb.x + hb.w / 2, hb.y + hb.h / 2 + 1); ctx.textBaseline = 'alphabetic';
    drawFx();
    hud(`${'❤️'.repeat(Math.max(0, hearts))}<span style="opacity:.35">${'🖤'.repeat(Math.max(0, S.hearts - hearts))}</span>`,
      `${T.pickup} שלב ${level} · נשארו ${remaining()} · ⭐ ${G.score}`);
  },
};
