# Game Forge runtime API

Every game is one HTML file: `base.html` (shared runtime) + one `*.game.js` file (the game logic).
The game file is a plain browser script (not a module). It runs after the runtime script and before the boot script.
It MUST define a global `const game = { ... }`. No imports, no external files, no network, no images: draw with canvas shapes and emoji.

## The `game` object

| Member | Required | Called when |
|---|---|---|
| `reset()` | yes | A new round starts (after the player presses Play / Again). Re-initialise ALL state here. |
| `update(dt)` | yes | Every frame while `G.state === 'play'`. `dt` is seconds (≤ 0.05). |
| `draw()` | yes | Every frame in every state (menu, play, pause, over). Must not throw before `reset()` ran: guard with `if (!state) return;` after painting the background. |
| `resize()` | no | Window size changed (also once at boot, before `reset()`). Recompute layout from `W`, `H`. |
| `down(x, y)`, `move(x, y)`, `up(x, y)` | no | Pointer events (mouse + touch) in CSS pixels, only while playing. `move` also fires without a press (mouse hover). |
| `key(code)` | no | Key pressed while playing (`KeyboardEvent.code`, e.g. `'Space'`, `'ArrowLeft'`). Held keys: `keys.has(code)`. |
| `init()` | no | Once at boot, after the first `resize()`. |
| `autostart` | no | `true` = skip the menu (idle games). Leave unset for normal games. |

Flow: menu card → Play → `reset()` → loop (`update` + `draw`) → the game calls `gameOver(score, extraHtml)` → result card → Again → `reset()`.
Keep the current score in `G.score` (number, shown on cards and saved as the best score).
To pause for a choice/level card: set `G.state = 'pause'`, call `showCard(html)`, and in the button's handler call `hideCard(); G.state = 'play';`.

## Globals provided by the runtime

- `CFG` config; `T` = the theme; `P` = `T.palette`; `S` = `CFG.params` (the numeric params from the design, already scaled by difficulty).
- `W`, `H` canvas size in CSS pixels; `ctx` the 2D context (already scaled for device pixel ratio; draw in CSS pixels).
- `G` = `{ state: 'menu'|'play'|'pause'|'over', score }`; `keys` = Set of held key codes.
- Math: `rand(a,b)`, `randi(a,b)` (inclusive ints), `pick(arr)`, `clamp(v,a,b)`, `dist(ax,ay,bx,by)`, `fmt(n)` (1.2K, 3.4M).
- `store.get(key, default)`, `store.set(key, value)`: per-game localStorage (safe if storage is blocked).
- `beep(freq=440, dur=0.08, type='square', vol=0.04)`: tiny WebAudio sound effect.
- `drawEmoji(emoji, x, y, size, flip=false, alpha=1)`: fast cached emoji drawing, centred on x,y.
- `roundRect(x, y, w, h, r)`: builds a rounded-rect path; then call `ctx.fill()` / `ctx.stroke()`.
- Effects: `burst(x, y, color, n=10, speed=160)` particles; `floatText(x, y, text, color=P.accent, size=20)`; call `drawFx()` near the end of `draw()` (effects are updated by the runtime).
- UI: `hud(rightHtml, leftHtml)` top bar (cheap to call every frame); `showCard(html)` / `hideCard()` modal card. Classes for card HTML: `.big` (large emoji), `h1`, `p`, `.stat`, `.btn` (button), `.choice` (big option button with `<span class="ic">emoji</span>`).
- `gameOver(score, extraHtml)`: ends the round, saves the best score, shows the result card.

## Theme `T` (8 themes: space, jungle, ocean, candy, spooky, fantasy, robots, farm)

- `T.palette` (`P`): `bg`, `bg2` (panels), `fg` (text), `accent` (highlights, player-side), `danger`, `grid` (lines/empty cells). Hex strings; you may append 2 hex digits for alpha, e.g. `P.accent + '55'`.
- `T.hero` emoji for the player; `T.enemies` 4 enemy emoji (weakest first); `T.boss`; `T.pickup` collectible; `T.obstacle` 2 obstacle emoji.
- `T.tiers` 10 emoji in ascending value (progressions); `T.gems` 6 clearly distinct emoji (matching/colour games).
- `T.currency`, `T.clickable`, `T.buildings` (6 × [emoji, Hebrew name]).
- `T.words`: Hebrew words `place`, `hero`, `thing`, `adj` (e.g. "החלל", "הטייס", "הכוכבים", "קוסמי").
Use theme emoji and palette colours for everything, so the same game works in every theme. Never hard-code a theme.

## Rules for good games here

- Language is Hebrew, page is RTL. The canvas has `dir="ltr"`: when drawing text that mixes Hebrew and numbers, draw the Hebrew label and the number as two separate `fillText` calls, or bidi will scramble the order. Plain numbers or plain Hebrew are fine.
- Mobile first: everything must be playable with one finger on a 360×640 portrait screen and also with a mouse; keyboard is optional extra. Leave ~50px at the top for the HUD. Tap targets ≥ 40px.
- Fill the whole background every frame (`ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H)`).
- A round must be able to end (`gameOver`) and must give feedback (sounds, particles, floating score) on every meaningful action. Difficulty should ramp up over time or levels.
- Read tunable numbers from `S` (e.g. `S.speed`), never from hard-coded constants, when they are in the design's params.
- Performance: no allocation-heavy work per frame on big arrays, cap entity counts, use `drawEmoji` (not `fillText`) for emoji.
- The code runs in strict mode: declare every variable. Your top-level names must NOT redeclare any runtime global, or the page fails with a SyntaxError. Reserved: `CFG T P S cv ctx W H DPR G keys rand randi pick clamp dist fmt store AC muted beep emojiCache drawEmoji roundRect fx burst floatText updFx drawFx $ov $card $hudR $hudL hud showCard hideCard menu startGame gameOver fit ptr booted ready active last loop`. Define `game` yourself.
