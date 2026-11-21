// קליקר / איידל: לוחצים לאיסוף, קונים מחוללים שמייצרים לבד. ההתקדמות נשמרת, כולל רווחים בזמן היעדרות.
const BASE_COST = [15, 110, 1200, 13000, 140000, 1.6e6];
const BASE_PROD = [0.15, 1.2, 9, 50, 280, 1600];
const app = document.getElementById('app');
let s, lastSave = 0, bg = [];

const cost = i => Math.ceil(BASE_COST[i] * Math.pow(1.15, s.owned[i]));
const mult = i => Math.pow(2, Math.floor(s.owned[i] / 25)); // כל 25 יחידות: פי 2
const prodOf = i => BASE_PROD[i] * S.speed * s.owned[i] * mult(i);
const perSec = () => BASE_PROD.reduce((a, _, i) => a + prodOf(i), 0) * (1 + s.prestige * 0.1);
const clickVal = () => S.click * Math.pow(2, s.clickLvl) + perSec() * 0.02;
const clickCost = () => Math.ceil(50 * Math.pow(6, s.clickLvl));
const PRESTIGE_AT = 1e7;

function save() { s.t = Date.now(); store.set('save', s); store.set('best', Math.floor(s.total)); }

function render() {
  app.innerHTML = `
    <div class="money" id="money"></div>
    <div class="rate" id="rate"></div>
    <button id="tap" aria-label="לחץ">${T.clickable}</button>
    <div class="tapinfo" id="tapinfo"></div>
    <div class="shop">
      <div class="sect">שדרוגים</div>
      <div class="row"><div class="ic">👆</div><div class="info"><div class="nm">לחיצה חזקה</div><div class="sub">כל לחיצה שווה פי 2</div></div><div class="own" id="clvl"></div><button id="bclick"></button></div>
      <div class="sect">מחוללים</div>
      ${T.buildings.map(([e, n], i) => `
        <div class="row" id="r${i}"><div class="ic">${e}</div><div class="info"><div class="nm">${n}</div><div class="sub" id="sub${i}"></div></div>
        <div class="own" id="own${i}"></div><button id="b${i}"></button></div>`).join('')}
      <div class="sect">התחלה מחדש</div>
      <div class="row"><div class="ic">🌟</div><div class="info"><div class="nm">לידה מחדש</div><div class="sub" id="psub"></div></div><button id="bpres">אפס</button></div>
      <div class="row"><div class="ic">🔊</div><div class="info"><div class="nm">צלילים</div></div><button id="bmute"></button></div>
    </div>`;
  const tap = document.getElementById('tap');
  tap.addEventListener('pointerdown', e => {
    const v = clickVal(); s.money += v; s.total += v; s.clicks++;
    const el = document.createElement('div'); el.className = 'pop'; el.textContent = '+' + fmt(v);
    el.style.left = (e.clientX - 20 + rand(-20, 20)) + 'px'; el.style.top = (e.clientY - 30) + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 800);
    burst(e.clientX, e.clientY, P.accent, 6, 140);
    beep(rand(500, 700), 0.04, 'triangle', 0.03);
  });
  document.getElementById('bclick').onclick = () => {
    const c = clickCost(); if (s.money < c) return; s.money -= c; s.clickLvl++; beep(880, 0.1, 'triangle');
  };
  T.buildings.forEach((_, i) => document.getElementById('b' + i).onclick = () => {
    const c = cost(i); if (s.money < c) return;
    s.money -= c; s.owned[i]++; beep(660 + i * 80, 0.08, 'triangle');
    if (s.owned[i] % 25 === 0) floatText(W / 2, H / 2, `${T.buildings[i][0]} ייצור כפול!`, P.accent, 28);
  });
  document.getElementById('bpres').onclick = () => {
    if (s.total < PRESTIGE_AT) return;
    const gain = Math.floor(Math.sqrt(s.total / PRESTIGE_AT));
    s = fresh(s.prestige + gain); save(); beep(1000, 0.3, 'sine');
  };
  document.getElementById('bmute').onclick = () => { muted = !muted; store.set('muted', muted); };
}

function fresh(prestige = 0) { return { money: 0, total: 0, owned: T.buildings.map(() => 0), clickLvl: 0, clicks: 0, prestige, t: Date.now() }; }

function refresh() {
  document.getElementById('money').textContent = `${T.currency} ${fmt(Math.floor(s.money))}`;
  document.getElementById('rate').textContent = `${fmt(perSec())} לשנייה` + (s.prestige ? ` · 🌟 בונוס ${s.prestige * 10}%` : '');
  document.getElementById('tapinfo').textContent = `כל לחיצה: \u2066+${fmt(clickVal())}\u2069`; // בידוד LTR כדי שהפלוס יופיע לפני המספר
  document.getElementById('clvl').textContent = s.clickLvl;
  const bc = document.getElementById('bclick'); bc.textContent = fmt(clickCost()); bc.disabled = s.money < clickCost();
  T.buildings.forEach((_, i) => {
    const visible = i === 0 || s.owned[i - 1] > 0 || s.total >= BASE_COST[i] * 0.5;
    document.getElementById('r' + i).classList.toggle('locked', !visible);
    document.getElementById('own' + i).textContent = s.owned[i];
    document.getElementById('sub' + i).textContent = `${fmt(BASE_PROD[i] * S.speed * mult(i))} לשנייה ליחידה` + (mult(i) > 1 ? ` (×${mult(i)})` : '') + ` · עוד ${25 - s.owned[i] % 25} להכפלה`;
    const b = document.getElementById('b' + i); b.textContent = fmt(cost(i)); b.disabled = !visible || s.money < cost(i);
  });
  const gain = Math.floor(Math.sqrt(s.total / PRESTIGE_AT));
  document.getElementById('psub').textContent = s.total >= PRESTIGE_AT
    ? `מתחילים מאפס ומקבלים ${gain} 🌟 (+${gain * 10}% ייצור לתמיד)` : `נפתח אחרי ${fmt(PRESTIGE_AT)} ${T.currency} מצטבר`;
  document.getElementById('bpres').disabled = s.total < PRESTIGE_AT;
  document.getElementById('bmute').textContent = muted ? 'כבוי' : 'פועל';
}

const game = {
  autostart: true,
  init() {
    s = Object.assign(fresh(), store.get('save', {}));
    if (s.owned.length !== T.buildings.length) s = fresh();
    render();
    const away = Math.min(2 * 3600, (Date.now() - s.t) / 1000);
    const earned = perSec() * away * 0.5;
    if (earned >= 1) {
      s.money += earned; s.total += earned;
      showCard(`<div class="big">${T.clickable}</div><h1>ברוך שובך!</h1><p>כשלא היית כאן הרווחת</p><div class="stat">${T.currency} ${fmt(earned)}</div><button class="btn" id="ok">יופי!</button>`);
      document.getElementById('ok').onclick = hideCard;
    }
    for (let i = 0; i < 24; i++) bg.push({ x: Math.random(), y: Math.random(), v: rand(0.02, 0.06), s: rand(18, 34), e: pick([T.currency, ...T.buildings.map(b => b[0])]) });
    window.addEventListener('beforeunload', save);
  },
  reset() {},
  update(dt) {
    const g = perSec() * dt; s.money += g; s.total += g;
    lastSave += dt; if (lastSave > 5) { lastSave = 0; save(); }
    for (const b of bg) { b.y -= b.v * dt; if (b.y < -0.1) { b.y = 1.1; b.x = Math.random(); } }
  },
  draw() {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    for (const b of bg) drawEmoji(b.e, b.x * W, b.y * H, b.s, false, 0.12);
    drawFx();
    if (s) refresh();
    hud(CFG.title, s && s.prestige ? `🌟 ${s.prestige}` : '');
  },
};
