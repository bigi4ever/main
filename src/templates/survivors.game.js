// הישרדות מול גלים: זזים, הנשק יורה לבד, אוספים ניסיון ובוחרים שדרוגים.
let pl, enemies, bullets, gems, t, kills, spawnAcc, fireAcc, st, xp, xpNeed, level, joy, bossT, shake;

const UPGRADES = [
  { id: 'dmg', icon: '💥', name: 'כוח אש', desc: '+1 נזק לכל קליע', apply: () => st.dmg += 1 },
  { id: 'rate', icon: '⚡', name: 'ירי מהיר', desc: '+25% קצב ירי', apply: () => st.rate *= 1.25 },
  { id: 'shots', icon: '🔱', name: 'ירי מפוצל', desc: '+1 קליע בכל יריה', apply: () => st.shots += 1 },
  { id: 'speed', icon: '👟', name: 'זריזות', desc: '+12% מהירות תנועה', apply: () => st.speed *= 1.12 },
  { id: 'magnet', icon: '🧲', name: 'מגנט', desc: '+40% טווח איסוף', apply: () => st.magnet *= 1.4 },
  { id: 'pierce', icon: '🗡️', name: 'חדירה', desc: 'קליע עובר דרך עוד אויב', apply: () => st.pierce += 1 },
  { id: 'heal', icon: '❤️', name: 'לב נוסף', desc: '+1 חיים מקסימליים וריפוי מלא', apply: () => { pl.maxHp += 1; pl.hp = pl.maxHp; } },
  { id: 'orbit', icon: T.pickup, name: 'מגן מסתובב', desc: 'כדור מגן שפוגע באויבים קרובים', apply: () => st.orbs += 1 },
];

function spawnEnemy(boss) {
  const a = Math.random() * Math.PI * 2, R = Math.max(W, H) / 2 + 80;
  const tier = Math.min(T.enemies.length - 1, Math.floor(Math.random() * (1 + t / 40)));
  const hp = boss ? 25 + t * 0.8 : 1 + tier + Math.floor(t / 45);
  enemies.push({
    x: pl.x + Math.cos(a) * R, y: pl.y + Math.sin(a) * R,
    e: boss ? T.boss : T.enemies[tier], hp, maxHp: hp, boss,
    r: boss ? 34 : 15, sp: (boss ? 0.55 : rand(0.8, 1.15)) * S.enemySpeed * (1 + t / 240), hit: 0,
  });
}

function levelUp() {
  level++; xp -= xpNeed; xpNeed = Math.floor(xpNeed * 1.35 + 3);
  G.state = 'pause'; beep(880, 0.15, 'triangle'); setTimeout(() => beep(1320, 0.15, 'triangle'), 120);
  const opts = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
  showCard(`<h1>עלית לשלב ${level}!</h1><p>בחר שדרוג:</p>` +
    opts.map((u, i) => `<button class="choice" data-i="${i}"><span class="ic">${u.icon}</span><span><b>${u.name}</b><br><small>${u.desc}</small></span></button>`).join(''));
  $card.querySelectorAll('.choice').forEach(b => b.onclick = () => {
    opts[+b.dataset.i].apply(); hideCard(); G.state = 'play';
  });
}

function killEnemy(e, i) {
  enemies.splice(i, 1); kills++;
  burst(e.x, e.y, P.danger, e.boss ? 40 : 10);
  gems.push({ x: e.x, y: e.y, v: e.boss ? 20 : 1 + Math.floor(e.maxHp / 3) });
  if (e.boss) { shake = 0.4; floatText(e.x, e.y - 40, 'בוס הובס!', P.accent, 28); }
  beep(e.boss ? 120 : rand(300, 500), 0.05, 'square', 0.025);
}

const game = {
  reset() {
    pl = { x: 0, y: 0, hp: S.hp, maxHp: S.hp, inv: 0, face: 1 };
    enemies = []; bullets = []; gems = [];
    t = 0; kills = 0; spawnAcc = 0; fireAcc = 0; level = 1; xp = 0; xpNeed = 5; bossT = S.bossEvery; shake = 0; joy = null;
    st = { dmg: 1, rate: S.fireRate, shots: 1, speed: S.playerSpeed, magnet: 70, pierce: 0, orbs: 0 };
  },
  down(x, y) { joy = { sx: x, sy: y, x, y, dx: 0, dy: 0 }; },
  move(x, y) {
    if (!joy) return;
    joy.x = x; joy.y = y;
    const dx = x - joy.sx, dy = y - joy.sy, d = Math.hypot(dx, dy), m = Math.min(1, d / 50);
    joy.dx = d ? dx / d * m : 0; joy.dy = d ? dy / d * m : 0;
  },
  up() { joy = null; },
  update(dt) {
    t += dt; shake = Math.max(0, shake - dt); pl.inv = Math.max(0, pl.inv - dt);
    let dx = 0, dy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
    if (dx || dy) { const d = Math.hypot(dx, dy); dx /= d; dy /= d; }
    if (joy) { dx = joy.dx; dy = joy.dy; }
    pl.x += dx * st.speed * dt; pl.y += dy * st.speed * dt;
    if (dx) pl.face = dx > 0 ? 1 : -1;

    spawnAcc += dt * S.spawnRate * (1 + t / 25);
    while (spawnAcc >= 1 && enemies.length < 350) { spawnAcc--; spawnEnemy(false); }
    bossT -= dt; if (bossT <= 0) { bossT = S.bossEvery; spawnEnemy(true); floatText(pl.x, pl.y - 60, '⚠️ בוס מתקרב!', P.danger, 26); }

    for (const e of enemies) {
      const d = dist(e.x, e.y, pl.x, pl.y) || 1;
      e.x += (pl.x - e.x) / d * e.sp * dt; e.y += (pl.y - e.y) / d * e.sp * dt;
      e.hit = Math.max(0, e.hit - dt);
      if (d < e.r + 14 && pl.inv <= 0) {
        pl.hp -= e.boss ? 2 : 1; pl.inv = 0.8; shake = 0.25; beep(90, 0.15, 'sawtooth', 0.06);
        if (pl.hp <= 0) { const m = Math.floor(t / 60), s = Math.floor(t % 60); gameOver(kills, `שרדת ${m}:${String(s).padStart(2, '0')} · שלב ${level}`); return; }
      }
    }

    fireAcc += dt;
    if (fireAcc >= 1 / st.rate && enemies.length) {
      fireAcc = 0;
      let best = null, bd = 1e9;
      for (const e of enemies) { const d = dist(e.x, e.y, pl.x, pl.y); if (d < bd) { bd = d; best = e; } }
      if (bd < Math.max(W, H)) {
        const a0 = Math.atan2(best.y - pl.y, best.x - pl.x);
        for (let i = 0; i < st.shots; i++) {
          const a = a0 + (i - (st.shots - 1) / 2) * 0.16;
          bullets.push({ x: pl.x, y: pl.y, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460, life: 1.4, pierce: st.pierce, hits: new Set() });
        }
        beep(rand(700, 900), 0.03, 'square', 0.012);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0;
      for (let j = enemies.length - 1; j >= 0 && !dead; j--) {
        const e = enemies[j];
        if (!b.hits.has(e) && dist(b.x, b.y, e.x, e.y) < e.r + 5) {
          b.hits.add(e); e.hp -= st.dmg; e.hit = 0.1;
          if (e.hp <= 0) killEnemy(e, j);
          if (b.pierce-- <= 0) dead = true;
        }
      }
      if (dead) bullets.splice(i, 1);
    }

    // מגינים מסתובבים
    for (let k = 0; k < st.orbs; k++) {
      const a = t * 3 + k * Math.PI * 2 / st.orbs, ox = pl.x + Math.cos(a) * 70, oy = pl.y + Math.sin(a) * 70;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (e.hit <= 0 && dist(ox, oy, e.x, e.y) < e.r + 12) { e.hp -= st.dmg; e.hit = 0.25; if (e.hp <= 0) killEnemy(e, j); }
      }
    }

    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i], d = dist(g.x, g.y, pl.x, pl.y);
      if (d < st.magnet) { g.x += (pl.x - g.x) / d * 520 * dt; g.y += (pl.y - g.y) / d * 520 * dt; }
      if (d < 18) {
        gems.splice(i, 1); xp += g.v; beep(1200, 0.03, 'sine', 0.02);
        if (xp >= xpNeed) { levelUp(); break; }
      }
    }
    G.score = kills;
  },
  draw() {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    if (!pl) return;
    const sx = shake ? rand(-6, 6) * shake * 4 : 0, sy = shake ? rand(-6, 6) * shake * 4 : 0;
    const cx = pl.x - W / 2 + sx, cy = pl.y - H / 2 + sy;
    // רצפה
    const cell = 64;
    ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = -((cx % cell) + cell) % cell; x < W; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = -((cy % cell) + cell) % cell; y < H; y += cell) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    for (const g of gems) {
      ctx.fillStyle = P.accent; ctx.beginPath();
      const x = g.x - cx, y = g.y - cy, r = g.v > 5 ? 8 : 5;
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.fill();
    }
    for (const e of enemies) {
      const x = e.x - cx, y = e.y - cy;
      if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue;
      if (e.hit > 0) { ctx.fillStyle = '#fff8'; ctx.beginPath(); ctx.arc(x, y, e.r + 4, 0, 7); ctx.fill(); }
      drawEmoji(e.e, x, y, e.r * 2, e.x < pl.x);
      if (e.boss) {
        ctx.fillStyle = '#0008'; ctx.fillRect(x - 40, y - e.r - 14, 80, 7);
        ctx.fillStyle = P.danger; ctx.fillRect(x - 40, y - e.r - 14, 80 * e.hp / e.maxHp, 7);
      }
    }
    ctx.fillStyle = P.accent; ctx.shadowColor = P.accent; ctx.shadowBlur = 10;
    for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x - cx, b.y - cy, 4.5, 0, 7); ctx.fill(); }
    ctx.shadowBlur = 0;
    for (let k = 0; k < st.orbs; k++) {
      const a = t * 3 + k * Math.PI * 2 / st.orbs;
      drawEmoji(T.pickup, pl.x + Math.cos(a) * 70 - cx, pl.y + Math.sin(a) * 70 - cy, 24);
    }
    if (!(pl.inv > 0 && Math.floor(pl.inv * 12) % 2)) drawEmoji(T.hero, pl.x - cx, pl.y - cy, 38, pl.face > 0);
    drawFx(cx, cy);

    // פס ניסיון
    ctx.fillStyle = '#0007'; ctx.fillRect(0, H - 10, W, 10);
    ctx.fillStyle = P.accent; ctx.fillRect(0, H - 10, W * Math.min(1, xp / xpNeed), 10);
    if (joy) {
      ctx.strokeStyle = '#fff5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(joy.sx, joy.sy, 50, 0, 7); ctx.stroke();
      ctx.fillStyle = '#fff6'; ctx.beginPath(); ctx.arc(joy.sx + joy.dx * 50, joy.sy + joy.dy * 50, 20, 0, 7); ctx.fill();
    }
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    hud(`${'❤️'.repeat(Math.max(0, pl.hp))}<span style="opacity:.35">${'🖤'.repeat(Math.max(0, pl.maxHp - pl.hp))}</span>`,
      `⏱ ${m}:${String(s).padStart(2, '0')} · ⭐ ${level} · ☠️ ${kills}`);
  },
};
