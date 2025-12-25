(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const highEl  = document.getElementById("high");
  const overlay = document.getElementById("overlay");
  const btn = document.getElementById("btn");
  const card = document.getElementById("card");

  // ----- helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand  = (a, b) => a + Math.random() * (b - a);

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width  = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas._dpr = dpr;
  }
  addEventListener("resize", resize, { passive: true });
  resize();

  // ----- High score
  const HIGH_KEY = "flappyDolphinOceanHigh";
  let high = Number(localStorage.getItem(HIGH_KEY) || 0);
  highEl.textContent = `Highscore: ${high}`;

  // ----- Difficulty tuned EASY
  const BASE = {
    gravity: 1650,  // lower = easier
    flap: -640,     // more negative = stronger upward
    scroll: 270,    // slower = easier
    gap: 235,       // bigger = easier
    pipeDist: 300,  // more space between pipes = easier
    pipeW: 74
  };

  // Difficulty progression (very gentle)
  function difficultyFactor(score) {
    // starts at 1.0, slowly to max 1.18 (~+18%)
    return 1 + Math.min(0.18, score / 120);
  }

  // Gap shrink (gentle, with a floor)
  function gapForScore(score, dpr) {
    const shrink = Math.min(22 * dpr, score * 0.22 * dpr); // very mild
    const g = (BASE.gap * dpr) - shrink;
    return Math.max(190 * dpr, g); // never too small
  }

  // ----- Game state
  let running = false;
  let started = false;
  let score = 0;
  let last = 0;

  // World
  let groundY = 0;
  let seaLevel = 0;

  // Player
  const dolphin = { x: 0, y: 0, r: 18, vy: 0 };

  // Pipes
  const pipes = [];

  // Visual extras
  const bubbles = []; // particles
  const animals = []; // decorative near bottom
  const seaweed = []; // decorative
  let bgTime = 0;

  function updateHUD() {
    scoreEl.textContent = `Score: ${score}`;
    highEl.textContent  = `Highscore: ${high}`;
  }

  function reset() {
    score = 0;
    started = false;
    last = 0;
    bgTime = 0;
    pipes.length = 0;
    bubbles.length = 0;
    animals.length = 0;
    seaweed.length = 0;

    const dpr = canvas._dpr || 1;
    const W = canvas.width, H = canvas.height;

    groundY = H - Math.floor(70 * dpr);
    seaLevel = Math.floor(H * 0.18);

    dolphin.r = Math.floor(18 * dpr);
    dolphin.x = Math.floor(W * 0.28);
    dolphin.y = Math.floor(H * 0.45);
    dolphin.vy = 0;

    // spawn pipes
    for (let i = 0; i < 5; i++) {
      pipes.push(makePipe(W + i * Math.floor(BASE.pipeDist * dpr)));
    }

    // spawn seaweed (static, parallax feel)
    const weedCount = Math.floor(clamp(W / (150 * dpr), 6, 14));
    for (let i = 0; i < weedCount; i++) {
      seaweed.push(makeSeaweed(i));
    }

    updateHUD();
  }

  function makeSeaweed(i) {
    const dpr = canvas._dpr || 1;
    const W = canvas.width;
    const x = Math.floor((i + Math.random() * 0.6) * (W / 10));
    return {
      x,
      baseY: groundY,
      h: Math.floor(rand(55, 115) * dpr),
      sway: rand(0.8, 1.6),
      phase: rand(0, Math.PI * 2),
      w: Math.floor(rand(10, 16) * dpr),
      alpha: rand(0.30, 0.55),
    };
  }

  function makePipe(x) {
    const dpr = canvas._dpr || 1;
    const W = canvas.width;

    const gap = gapForScore(score, dpr);
    const topMin = Math.floor(80 * dpr);
    const topMax = Math.floor(groundY - gap - 90 * dpr);
    const topH = Math.floor(rand(topMin, topMax));

    return {
      x,
      w: Math.floor(BASE.pipeW * dpr),
      gap,
      topH,
      scored: false,
    };
  }

  // ----- Controls
  function flap() {
    if (!running) return;
    started = true;
    dolphin.vy = BASE.flap * (canvas._dpr || 1);

    // bubbles burst
    spawnBubbles();
  }

  addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      flap();
    }
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    flap();
  }, { passive: false });

  // ----- Collisions
  function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx, dy = cy - ny;
    return (dx * dx + dy * dy) <= r * r;
  }

  function endGame() {
    running = false;

    if (score > high) {
      high = score;
      localStorage.setItem(HIGH_KEY, String(high));
    }
    updateHUD();

    overlay.style.display = "flex";
    card.querySelector("h1").textContent = "Game Over 🌊";
    card.querySelectorAll("p")[0].textContent = `Score: ${score}`;
    card.querySelectorAll("p")[1].textContent = `Highscore (dit apparaat): ${high}`;
    btn.textContent = "Opnieuw";
  }

  // ----- Visual: bubbles
  function spawnBubbles() {
    const dpr = canvas._dpr || 1;
    const n = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      bubbles.push({
        x: dolphin.x + rand(-10, 6) * dpr,
        y: dolphin.y + rand(-6, 10) * dpr,
        r: rand(2.2, 5.8) * dpr,
        vx: rand(-40, 40) * dpr,
        vy: rand(-220, -120) * dpr,
        life: rand(0.5, 0.9),
        t: 0
      });
    }
  }

  // ----- Visual: animals near seabed (decor only)
  const ANIMAL_EMOJI = ["🐟", "🐠", "🦀", "🐢", "🦑"];
  function maybeSpawnAnimal(dt) {
    // about every few seconds
    if (animals.length > 4) return;
    if (Math.random() < dt * 0.20) { // ~0.2 spawns/sec
      const dpr = canvas._dpr || 1;
      const side = Math.random() < 0.5 ? "L" : "R";
      const y = groundY - rand(24, 56) * dpr;
      const speed = rand(35, 75) * dpr; // slow
      const emoji = ANIMAL_EMOJI[Math.floor(Math.random() * ANIMAL_EMOJI.length)];
      animals.push({
        emoji,
        x: side === "L" ? -60 * dpr : canvas.width + 60 * dpr,
        y,
        vx: side === "L" ? speed : -speed,
        size: rand(20, 30) * dpr,
        alpha: rand(0.55, 0.85),
      });
    }
  }

  // ----- Drawing helpers
  function drawOceanBackground(t) {
    const W = canvas.width, H = canvas.height;
    const dpr = canvas._dpr || 1;

    // Gradient ocean
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.0, "#062033");
    g.addColorStop(0.35, "#063a56");
    g.addColorStop(0.72, "#075d7a");
    g.addColorStop(1.0, "#084a52");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Light rays (subtle)
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 6; i++) {
      const x = (i * 120 + (t * 40)) * dpr % (W + 200 * dpr) - 100 * dpr;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 90 * dpr, 0);
      ctx.lineTo(x + 220 * dpr, H);
      ctx.lineTo(x - 40 * dpr, H);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
    }
    ctx.restore();

    // Distant particles (like tiny plankton)
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffffff";
    const count = 80;
    for (let i = 0; i < count; i++) {
      const x = (i * 97) % W;
      const y = ((i * 173) + t * 60 * dpr) % H;
      ctx.fillRect(x, y, 1.2 * dpr, 1.2 * dpr);
    }
    ctx.restore();

    // Surface shimmer
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#b9f2ff";
    ctx.fillRect(0, seaLevel, W, 2 * dpr);
    ctx.restore();
  }

  function drawSeabed(t) {
    const W = canvas.width;
    const dpr = canvas._dpr || 1;

    // Sand
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#f3d7a6";
    ctx.fillRect(0, groundY, W, canvas.height - groundY);
    ctx.restore();

    // Seaweed (sway)
    for (const w of seaweed) {
      const sway = Math.sin(t * w.sway + w.phase) * (10 * dpr);
      ctx.save();
      ctx.globalAlpha = w.alpha;
      ctx.strokeStyle = "#2ecc71";
      ctx.lineWidth = w.w;
      ctx.lineCap = "round";

      const x = w.x;
      const y0 = w.baseY;
      const y1 = w.baseY - w.h;

      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(x + sway, (y0 + y1) / 2, x - sway * 0.7, y1);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPipes() {
    const dpr = canvas._dpr || 1;

    // More "coral pipe" look
    for (const p of pipes) {
      const x = p.x, w = p.w;

      // body
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillRect(x, 0, w, p.topH);
      ctx.fillRect(x, p.topH + p.gap, w, groundY - (p.topH + p.gap));
      ctx.restore();

      // caps
      ctx.save();
      ctx.globalAlpha = 0.20;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 5 * dpr, p.topH - 10 * dpr, w + 10 * dpr, 10 * dpr);
      ctx.fillRect(x - 5 * dpr, p.topH + p.gap, w + 10 * dpr, 10 * dpr);
      ctx.restore();

      // shading
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = "#000";
      ctx.fillRect(x + w - 10 * dpr, 0, 10 * dpr, p.topH);
      ctx.fillRect(x + w - 10 * dpr, p.topH + p.gap, 10 * dpr, groundY - (p.topH + p.gap));
      ctx.restore();
    }
  }

  function drawDolphin() {
    const dpr = canvas._dpr || 1;
    ctx.save();
    ctx.font = `${Math.floor(44 * dpr)}px system-ui, Apple Color Emoji, Segoe UI Emoji`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Slight tilt based on velocity (cute feedback)
    const tilt = clamp(dolphin.vy / (900 * dpr), -0.35, 0.35);
    ctx.translate(dolphin.x, dolphin.y);
    ctx.rotate(tilt);
    ctx.fillText("🐬", 0, 0);
    ctx.restore();
  }

  function drawAnimals() {
    for (const a of animals) {
      ctx.save();
      ctx.globalAlpha = a.alpha;
      ctx.font = `${Math.floor(a.size)}px system-ui, Apple Color Emoji, Segoe UI Emoji`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(a.emoji, a.x, a.y);
      ctx.restore();
    }
  }

  function drawBubbles() {
    ctx.save();
    for (const b of bubbles) {
      const alpha = (1 - (b.t / b.life));
      ctx.globalAlpha = 0.25 * alpha;
      ctx.strokeStyle = "#d9fbff";
      ctx.lineWidth = 2 * (canvas._dpr || 1);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStartHint() {
    if (started) return;
    const dpr = canvas._dpr || 1;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.floor(18 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Tap om te starten", canvas.width / 2, Math.floor(canvas.height * 0.22));
    ctx.restore();
  }

  // ----- Main loop
  function tick(ts) {
    if (!running) return;
    if (!last) last = ts;
    const dt = Math.min(0.033, (ts - last) / 1000);
    last = ts;

    const dpr = canvas._dpr || 1;
    bgTime += dt;

    // decorative spawns
    maybeSpawnAnimal(dt);

    // Update animals (decor)
    for (let i = animals.length - 1; i >= 0; i--) {
      const a = animals[i];
      a.x += a.vx * dt;
      if (a.x < -120 * dpr || a.x > canvas.width + 120 * dpr) animals.splice(i, 1);
    }

    // Update bubbles
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy -= 30 * dpr * dt; // slight acceleration upward feel
      if (b.t >= b.life) bubbles.splice(i, 1);
    }

    if (started) {
      const diff = difficultyFactor(score);

      // Physics
      dolphin.vy += (BASE.gravity * dpr) * dt;
      dolphin.y  += dolphin.vy * dt;

      // Move pipes
      for (const p of pipes) p.x -= (BASE.scroll * dpr) * diff * dt;

      // Recycle pipes
      const first = pipes[0];
      if (first.x + first.w < 0) {
        pipes.shift();
        const lastPipe = pipes[pipes.length - 1];
        pipes.push(makePipe(lastPipe.x + Math.floor(BASE.pipeDist * dpr)));
      }

      // Scoring
      for (const p of pipes) {
        if (!p.scored && (p.x + p.w) < (dolphin.x - dolphin.r)) {
          p.scored = true;
          score += 1;
          updateHUD();
        }
      }

      // Bounds
      if (dolphin.y - dolphin.r < 0) {
        dolphin.y = dolphin.r;
        dolphin.vy = 0; // prevent instant death on ceiling
      }
      if (dolphin.y + dolphin.r > groundY) {
        endGame();
        return;
      }

      // Collision pipes
      for (const p of pipes) {
        // Top rect
        if (circleRectCollide(dolphin.x, dolphin.y, dolphin.r, p.x, 0, p.w, p.topH)) {
          endGame(); return;
        }
        // Bottom rect
        const by = p.topH + p.gap;
        if (circleRectCollide(dolphin.x, dolphin.y, dolphin.r, p.x, by, p.w, groundY - by)) {
          endGame(); return;
        }
      }
    }

    // Draw
    drawOceanBackground(bgTime);
    drawPipes();
    drawBubbles();
    drawDolphin();
    drawAnimals();
    drawSeabed(bgTime);
    drawStartHint();

    requestAnimationFrame(tick);
  }

  // ----- Start / restart
  btn.addEventListener("click", () => {
    overlay.style.display = "none";

    // restore overlay texts (for next game over)
    card.querySelector("h1").textContent = "🐬 Flappy Dolphin: Ocean Run";
    card.querySelectorAll("p")[0].textContent = "Tap/klik om te “flappen”.";
    card.querySelectorAll("p")[1].textContent = "Grote gaten + rustig tempo. Wordt langzaam iets lastiger.";
    btn.textContent = "Start";

    reset();
    running = true;
    requestAnimationFrame(tick);
  });

  // init
  reset();
})();
