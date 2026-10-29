// Конфети при первом открытии главной страницы.
// Показываются один раз (флаг в localStorage). Без внешних библиотек.
// Подключается на главной (index.html).
(function () {
  'use strict';

  // Показываем только на главной (если подключили случайно на другой странице — не мешаем)
  var STORAGE_KEY = 'alinaConfettiShown';

  // Уже показывали — выходим.
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
  } catch (e) {
    // localStorage недоступен (приватный режим) — тогда не рискуем показывать многократно,
    // но всё равно покажем один раз в этой загрузке.
  }

  // Ждём, пока пользователь окажется на сайте, если включён гейт.
  // Если гейт не активен (доступ уже открыт в сессии) — запускаем сразу.
  var unlocked = false;
  try {
    unlocked = sessionStorage.getItem('alinaGateUnlockedSession') === '1';
  } catch (e) { /* игнорируем */ }

  if (unlocked) {
    // Небольшая задержка, чтобы контент отрисовался
    window.setTimeout(fireConfetti, 250);
  } else {
    // Ждём события разблокировки гейта
    document.addEventListener('alina:unlocked', function () {
      window.setTimeout(fireConfetti, 150);
    });
  }

  var started = false;

  function markShown() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (e) { /* игнорируем */ }
  }

  function fireConfetti() {
    if (started) return;
    started = true;
    markShown();

    var prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0;
    var H = 0;

    function resize() {
      // Берём фактический CSS-размер canvas (100% вьюпорта), чтобы частицы
      // точно попадали в видимую область независимо от скроллбара.
      var rect = canvas.getBoundingClientRect();
      W = Math.round(rect.width) || window.innerWidth;
      H = Math.round(rect.height) || window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Палитра под стиль сайта
    var COLORS = ['#d0b2f0', '#f0b9d5', '#a78bfa', '#f7e6ff', '#ffd6e7', '#c4b5fd', '#ffffff'];

    var COUNT = prefersReduced ? 60 : 180;
    var pieces = [];

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    // Создаём частицы сверху экрана «залпом»
    function spawnPiece(i) {
      var x = rand(0, W);
      // слегка группируем по центру для красивого «фонтана»
      if (i % 2 === 0) x = W / 2 + rand(-W * 0.3, W * 0.3);
      return {
        x: x,
        y: rand(-H * 0.3, -10),
        vx: rand(-2.2, 2.2),
        vy: rand(2.5, 6.5),
        size: rand(6, 12),
        color: COLORS[(Math.random() * COLORS.length) | 0],
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.2, 0.2),
        shape: Math.random() < 0.5 ? 'rect' : 'circle',
        sway: rand(0.01, 0.05),
        swayPhase: rand(0, Math.PI * 2),
        life: 0
      };
    }

    for (var i = 0; i < COUNT; i++) {
      pieces.push(spawnPiece(i));
    }

    var gravity = 0.12;
    var drag = 0.995;
    var lastTime = performance.now();
    var elapsed = 0;
    var maxDuration = prefersReduced ? 1800 : 4200;

    function drawPiece(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.5);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function frame(now) {
      var delta = now - lastTime;
      if (delta > 48) delta = 48;   // защита от «прыжков» после переключения вкладки
      lastTime = now;
      elapsed += delta;

      var dt = delta / 16.67; // нормализация к ~60fps

      ctx.clearRect(0, 0, W, H);

      var alive = false;

      for (var k = 0; k < pieces.length; k++) {
        var p = pieces[k];
        if (p.dead) continue;

        p.life += dt;

        p.vy += gravity * dt;
        p.vx *= drag;
        p.vy *= drag;

        // лёгкое покачивание
        p.x += (p.vx + Math.sin(p.life * 0.1 + p.swayPhase) * p.sway * 10) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        // плавное появление/исчезновение
        var fadeIn = Math.min(1, p.life / 8);
        var fadeOut = 1;
        if (p.y > H * 0.85) {
          fadeOut = Math.max(0, 1 - (p.y - H * 0.85) / (H * 0.25));
        }
        p.alpha = fadeIn * fadeOut;

        // Убираем ушедшие вниз и со временем
        if (p.y > H + 40 || p.life > 520 || p.alpha <= 0.02) {
          p.dead = true;
          continue;
        }

        alive = true;
        drawPiece(p);
      }

      if (!alive || elapsed > maxDuration) {
        finish();
        return;
      }

      requestAnimationFrame(frame);
    }

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      window.removeEventListener('resize', resize);
      // Плавно убираем canvas
      canvas.style.transition = 'opacity .4s ease';
      canvas.style.opacity = '0';
      window.setTimeout(function () {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }, 420);
    }

    requestAnimationFrame(frame);
  }
})();
