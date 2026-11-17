// ריצה אינסופית: קפיצה (וקפיצה כפולה) מעל מכשולים, איסוף מטבעות, המהירות עולה.
let hero, obs, coins, distRun, speed, nextObs, nextCoins, coinsGot, groundY, t;

function jump() {
  if (hero.jumps < 2) {
    hero.vy = -S.jump * (hero.jumps ? 0.85 : 1); hero.jumps++;
    beep(hero.jumps === 1 ? 520 : 780, 0.08, 'triangle');
    burst(hero.x, groundY, P.fg, 5, 80);
  }
}

const game = {
  resize() { groundY = H * 0.74; },
  reset() {
    groundY = H * 0.74;
    hero = { x: Math.min(W * 0.22, 160), y: groundY, vy: 0, jumps: 0, size: 44 };
    obs = []; coins = []; distRun = 0; speed = S.speed; nextObs = 1.2; nextCoins = 2; coinsGot = 0; t = 0;
  },
  down() { jump(); },
  key(code) { if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') jump(); },
  update(dt) {
    t += dt;
    speed = Math.min(S.speed * 2.6, speed + S.accel * dt);
    distRun += speed * dt;
    hero.vy += S.gravity * dt; hero.y += hero.vy * dt;
    if (hero.y >= groundY) { hero.y = groundY; hero.vy = 0; hero.jumps = 0; }

    nextObs -= dt;
    if (nextObs <= 0) {
      const fly = t > 12 && Math.random() < 0.22;
      const size = rand(36, 50);
      obs.push({ x: W + 60, y: fly ? groundY - hero.size - 70 : groundY - size / 2 + 4, e: pick(T.obstacle), s: size, fly });
      if (!fly && t > 20 && Math.random() < 0.3) obs.push({ x: W + 60 + size * 0.95, y: groundY - size / 2 + 4, e: pick(T.obstacle), s: size, fly: false });
      nextObs = rand(0.75, 1.5) * Math.sqrt(S.speed / speed) * S.gapMul + 0.35;
    }
    nextCoins -= dt;
    if (nextCoins <= 0) {
      const n = randi(3, 6), h = rand(40, 150);
      for (let i = 0; i < n; i++) coins.push({ x: W + 40 + i * 38, y: groundY - 30 - h - Math.sin(i / (n - 1) * Math.PI) * 30 });
      nextCoins = rand(1.5, 3.5);
    }
    for (const o of obs) o.x -= speed * dt * (o.fly ? 1.15 : 1);
    for (const c of coins) c.x -= speed * dt;
    obs = obs.filter(o => o.x > -80);
    coins = coins.filter(c => c.x > -40);

    const hx = hero.x, hy = hero.y - hero.size / 2;
    for (const o of obs) {
      if (Math.abs(o.x - hx) < (o.s + hero.size) * 0.36 && Math.abs(o.y - hy) < (o.s + hero.size) * 0.36) {
        burst(hx, hy, P.danger, 30, 250);
        gameOver(G.score, `רצת ${Math.floor(distRun / 10)} מטר ואספת ${coinsGot} ${T.pickup}`);
        return;
      }
    }
    for (let i = coins.length - 1; i >= 0; i--) {
      if (dist(coins[i].x, coins[i].y, hx, hy) < 34) {
        floatText(coins[i].x, coins[i].y, '+10'); coins.splice(i, 1); coinsGot++; beep(1100, 0.05, 'sine', 0.03);
      }
    }
    G.score = Math.floor(distRun / 10) + coinsGot * 10;
  },
  draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, P.bg); g.addColorStop(1, P.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const d = distRun || 0;
    // שכבות פרלקסה
    const layer = (k, amp, base, color, step) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + step; x += step) {
        const wx = x + d * k;
        ctx.lineTo(x, base - Math.abs(Math.sin(wx / step * 1.3) * amp) - Math.abs(Math.sin(wx / (step * 2.7))) * amp * 0.6);
      }
      ctx.lineTo(W, H); ctx.fill();
    };
    ctx.globalAlpha = 0.5; layer(0.15, 90, groundY - 40, P.grid, 120);
    ctx.globalAlpha = 0.8; layer(0.4, 50, groundY - 5, P.bg2, 80);
    ctx.globalAlpha = 1;
    // קרקע
    ctx.fillStyle = P.grid; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = P.accent; ctx.fillRect(0, groundY, W, 4);
    ctx.fillStyle = '#ffffff14';
    for (let x = -(d % 60); x < W; x += 60) ctx.fillRect(x, groundY + 18, 30, 6);

    if (!hero) return;
    for (const c of coins) drawEmoji(T.pickup, c.x, c.y + Math.sin(performance.now() / 200 + c.x / 50) * 3, 28);
    for (const o of obs) drawEmoji(o.e, o.x, o.y, o.s);
    const bob = hero.jumps ? 0 : Math.abs(Math.sin(distRun / 30)) * 4;
    ctx.fillStyle = '#0005'; ctx.beginPath();
    ctx.ellipse(hero.x, groundY + 4, 18 * (1 - (groundY - hero.y) / 400), 5, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(hero.x, hero.y - hero.size / 2 - bob);
    if (hero.jumps) ctx.rotate(hero.vy / 2500);
    ctx.translate(-hero.x, -(hero.y - hero.size / 2 - bob));
    drawEmoji(T.hero, hero.x, hero.y - hero.size / 2 - bob, hero.size, true);
    ctx.restore();
    drawFx();
    hud(`${T.pickup} ${coinsGot}`, `📏 ${Math.floor(distRun / 10)} מ' · ⭐ ${G.score}`);
  },
};
