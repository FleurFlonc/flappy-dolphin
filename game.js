(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const highEl = document.getElementById("high");
  const overlay = document.getElementById("overlay");
  const btn = document.getElementById("btn");

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas._dpr = dpr;
  }
  window.addEventListener("resize", resize);
  resize();

  const HIGH_KEY = "flappyDolphinHigh";
  let high = Number(localStorage.getItem(HIGH_KEY) || 0);

  // BASE difficulty
  const BASE = {
    gravity: 2100,
    flap: -660,
    scroll: 420,
    gap: 160,
    pipeDist: 250
  };

  let running = false;
  let started = false;
  let score = 0;
  let last = 0;

  const dolphin = { x: 0, y: 0, r: 18, vy: 0 };
  const pipes = [];
  let groundY = 0;

  function reset() {
    score = 0;
    started = false;
    pipes.length = 0;

    dolphin.r = 18 * canvas._dpr;
    dolphin.x = canvas.width * 0.28;
    dolphin.y = canvas.height * 0.45;
    dolphin.vy = 0;

    groundY = canvas.height - 60 * canvas._dpr;

    for (let i = 0; i < 5; i++) {
      pipes.push(makePipe(canvas.width + i * BASE.pipeDist * canvas._dpr));
    }

    updateHUD();
  }

  function difficultyFactor() {
    return 1 + Math.min(0.45, score / 35);
  }

  function makePipe(x) {
    const dpr = canvas._dpr;
    const shrink = Math.min(35 * dpr, score * 0.9 * dpr);
    const gap = Math.max(90 * dpr, BASE.gap * dpr - shrink);

    const topMax = groundY - gap - 70 * dpr;
    const topH = 70 * dpr + Math.random() * (topMax - 70 * dpr);

    return { x, w: 76 * dpr, gap, topH, scored: false };
  }

  function flap() {
    if (!running) return;
    started = true;
    dolphin.vy = BASE.flap * canvas._dpr;
  }

  window.addEventListener("keydown", e => {
    if (e.code === "Space" || e.code === "ArrowUp") flap();
  });
  canvas.addEventListener("pointerdown", flap);

  function updateHUD() {
    scoreEl.textContent = `Score: ${score}`;
    highEl.textContent = `Highscore: ${high}`;
  }

  function collideCircleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function endGame() {
    running = false;
    if (score > high) {
      high = score;
      localStorage.setItem(HIGH_KEY, high);
    }
    updateHUD();
    overlay.style.display = "flex";
    btn.textContent = "Opnieuw";
  }

  function tick(ts) {
    if (!running) return;
    if (!last) last = ts;
    const dt = Math.min(0.033, (ts - last) / 1000);
    last = ts;

    const dpr = canvas._dpr;
    const diff = difficultyFactor();

    if (started) {
      dolphin.vy += BASE.gravity * dpr * dt;
      dolphin.y += dolphin.vy * dt;

      pipes.forEach(p => p.x -= BASE.scroll * dpr * diff * dt);

      if (pipes[0].x + pipes[0].w < 0) {
        pipes.shift();
        pipes.push(makePipe(pipes[pipes.length - 1].x + BASE.pipeDist * dpr));
      }

      pipes.forEach(p => {
        if (!p.scored && p.x + p.w < dolphin.x) {
          p.scored = true;
          score++;
          updateHUD();
        }
      });

      if (dolphin.y - dolphin.r < 0 || dolphin.y + dolphin.r > groundY) {
        endGame();
        return;
      }

      for (const p of pipes) {
        if (
          collideCircleRect(dolphin.x, dolphin.y, dolphin.r, p.x, 0, p.w, p.topH) ||
          collideCircleRect(dolphin.x, dolphin.y, dolphin.r, p.x, p.topH + p.gap, p.w, groundY)
        ) {
          endGame();
          return;
        }
      }
    }

    draw();
    requestAnimationFrame(tick);
  }

  function draw() {
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    pipes.forEach(p => {
      ctx.fillRect(p.x, 0, p.w, p.topH);
      ctx.fillRect(p.x, p.topH + p.gap, p.w, groundY);
    });

    ctx.font = `${42 * canvas._dpr}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🐬", dolphin.x, dolphin.y);
  }

  btn.addEventListener("click", () => {
    overlay.style.display = "none";
    reset();
    running = true;
    last = 0;
    requestAnimationFrame(tick);
  });

  reset();
})();