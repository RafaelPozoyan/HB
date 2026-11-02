// Тортик со свечками: задувание через микрофон.
// Порог срабатывания подстраивается под шум комнаты и отмечен на индикаторе —
// свечи гаснут только при настоящем дутье, а не от фоновых звуков.
(function () {
  'use strict';

  var cake = document.getElementById('cake');
  var candlesWrap = document.getElementById('cake-candles');
  var micBtn = document.getElementById('cake-mic');
  var meter = document.getElementById('cake-meter');
  var meterFill = document.getElementById('cake-meter-fill');
  var meterMark = document.getElementById('cake-meter-mark');
  var statusEl = document.getElementById('cake-status');

  if (!cake || !candlesWrap || !micBtn) return;

  var CANDLE_COUNT = 5;

  // Минимальный порог (RMS): тихий фон его не пробивает.
  // Если в комнате шумно, порог поднимается выше (см. calibrate())
  var THRESHOLD_FLOOR = 0.25;
  var NOISE_FACTOR = 6;      // порог = фон × 6
  var THRESHOLD_CAP = 0.8;
  // Сколько замеров ПОДРЯД (каждые 50 мс) должны быть выше порога —
  // то есть дуть нужно непрерывно около полусекунды
  var LOUD_FRAMES_NEEDED = 10;
  // Шкала индикатора: порог × 1.6 соответствует 100%
  var METER_FACTOR = 1.6;

  var audioCtx = null;
  var stream = null;
  var analyser = null;
  var buffer = null;
  var micTimer = null;
  var blown = false;
  var threshold = THRESHOLD_FLOOR;
  var loudFrames = 0;

  function buildCandles() {
    candlesWrap.innerHTML = '';
    for (var i = 0; i < CANDLE_COUNT; i++) {
      var candle = document.createElement('span');
      candle.className = 'candle';
      var flame = document.createElement('span');
      flame.className = 'candle__flame';
      candle.appendChild(flame);
      candlesWrap.appendChild(candle);
    }
  }

  function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = 'cake-status' + (type ? ' is-' + type : '');
  }

  // Метка порога на индикаторе — видно, до куда нужно додуть
  function updateMark() {
    if (!meterMark) return;
    meterMark.style.left = (100 / METER_FACTOR).toFixed(1) + '%';
  }

  function relight() {
    blown = false;
    loudFrames = 0;
    threshold = THRESHOLD_FLOOR;
    updateMark();
    cake.classList.remove('is-out');
    buildCandles();
    micBtn.textContent = 'Дунуть в микрофон 🎤';
    setStatus('');
  }

  function stopMic() {
    if (micTimer) { clearInterval(micTimer); micTimer = null; }
    if (stream) {
      stream.getTracks().forEach(function (track) { track.stop(); });
      stream = null;
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(function () {});
    }
    audioCtx = null;
    analyser = null;
    meter.hidden = true;
    meterFill.style.width = '0%';
  }

  function blowOut() {
    if (blown) return;
    blown = true;
    cake.classList.add('is-out');
    setStatus('', 'ok');
    burstConfetti();
    stopMic();
    micBtn.textContent = 'Загадать желание ещё раз';
  }

  // Громкость (RMS) текущего замера.
  // Важно: сначала вычитаем постоянную составляющую — у некоторых микрофонов
  // сигнал смещён, и без этого шум в тишине выглядел бы как громкое дутьё
  function level() {
    analyser.getFloatTimeDomainData(buffer);
    var n = buffer.length;
    var sum = 0;
    var i;
    for (i = 0; i < n; i++) sum += buffer[i];
    var mean = sum / n;

    var acc = 0;
    for (i = 0; i < n; i++) {
      var d = buffer[i] - mean;
      acc += d * d;
    }
    return Math.sqrt(acc / n);
  }

  // Сначала ~1.2 с слушаем комнату: если шумно, порог автоматически поднимается,
  // чтобы свечи не гасли от посторонних звуков
  function calibrate() {
    var samples = [];
    var started = performance.now();

    setStatus('Слушаю фон в комнате…');

    micTimer = setInterval(function () {
      if (!analyser) { clearInterval(micTimer); micTimer = null; return; }
      samples.push(level());

      if (performance.now() - started < 1200) return;

      clearInterval(micTimer);
      micTimer = null;

      samples.sort(function (a, b) { return a - b; });
      var ambient = samples[Math.floor(samples.length / 2)] || 0;

      threshold = Math.min(THRESHOLD_CAP, Math.max(THRESHOLD_FLOOR, ambient * NOISE_FACTOR));
      updateMark();
      setStatus('Дуй!');
      listen();
    }, 50);
  }

  function listen() {
    micTimer = setInterval(function () {
      if (!analyser || blown) {
        clearInterval(micTimer);
        micTimer = null;
        return;
      }

      var value = level();
      meterFill.style.width =
        Math.min(100, (value / (threshold * METER_FACTOR)) * 100).toFixed(0) + '%';

      if (value > threshold) {
        loudFrames++;
        if (loudFrames >= LOUD_FRAMES_NEEDED) blowOut();
      } else {
        // Любой тихий замер обнуляет серию: одиночные всплески шума не накопятся
        loudFrames = 0;
      }
    }, 50);
  }

  function startMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Микрофон не поддерживается — попробуй открыть страницу в другом браузере.', 'error');
      return;
    }

    setStatus('Жду разрешение на микрофон…');

    // Если окно с разрешением не появилось, через 8 с сообщаем об этом
    var timeoutId = setTimeout(function () {
      setStatus('Не получили доступ к микрофону — нажми кнопку ещё раз.', 'error');
    }, 8000);

    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }).then(function (micStream) {
      clearTimeout(timeoutId);
      stream = micStream;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // Браузеры могут создать контекст в состоянии suspended — будим его
      if (audioCtx.state === 'suspended' && audioCtx.resume) {
        audioCtx.resume().catch(function () {});
      }

      var source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      buffer = new Float32Array(analyser.fftSize);

      meter.hidden = false;
      meterFill.style.width = '0%';
      threshold = THRESHOLD_FLOOR;
      updateMark();
      calibrate();
    }).catch(function () {
      clearTimeout(timeoutId);
      setStatus('Нет доступа к микрофону. Разреши его в настройках браузера и попробуй снова.', 'error');
    });
  }

  // Небольшой конфетти-залп после того, как свечи погасли
  function burstConfetti() {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = window.innerWidth;
    var H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var colors = ['#a3ebb1', '#c9f5d2', '#d6c2e4', '#f3effa', '#7fd894'];
    var pieces = [];
    var count = reduced ? 40 : 140;

    for (var i = 0; i < count; i++) {
      pieces.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.5,
        y: H * 0.45,
        vx: (Math.random() - 0.5) * 9,
        vy: -6 - Math.random() * 7,
        size: 4 + Math.random() * 7,
        color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3
      });
    }

    var started = performance.now();

    (function frame(now) {
      ctx.clearRect(0, 0, W, H);
      pieces.forEach(function (p) {
        p.vy += 0.22;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });

      if (now - started < 2600) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    })(started);
  }

  micBtn.addEventListener('click', function () {
    if (blown) {
      relight();
      startMic();
      return;
    }
    startMic();
  });

  buildCandles();
  updateMark();
})();
