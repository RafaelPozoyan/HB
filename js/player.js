// Музыкальная панель сайта.
// Сама создаёт мини-бар слева от главного и вставляет себя в документ,
// поэтому на любой странице достаточно одной строки подключения.
// Список песен раскрывается внутри самой панели.
// Трек и позиция сохраняются в localStorage — музыка продолжается
// при переходе между страницами.
(function () {
  'use strict';

  var STORAGE_KEY = 'alinaMusicPlayer';

  // Пути считаем от самого скрипта, чтобы работало и из корня, и из /pages
  var self = document.currentScript;
  var base = self && self.src ? self.src.replace(/js\/player\.js.*$/, '') : './';

  var TRACKS = [
    { title: 'West Coast', artist: 'Lana Del Rey', file: 'Lana Del Rey - West Coast.mp3' },
    { title: 'Self Aware', artist: 'Temper City', file: 'Temper City - Self Aware (новая музыка 2026).mp3' },
    { title: 'Сверчки', artist: 'Zoloto', file: 'Zoloto - Сверчки.mp3' },
    { title: 'Magic', artist: 'Coldplay', file: 'Coldplay - Magic.mp3' }
  ];

  // ---------------------------------------------------------------- разметка

  var PLAYER_HTML =
    '<div class="nav-player__row">' +
      '<button type="button" class="nav-player__play" aria-label="Включить музыку">' +
        '<span class="nav-player__icon">▶</span>' +
      '</button>' +
      '<div class="nav-player__eq" aria-hidden="true"><span></span><span></span><span></span></div>' +
      '<button type="button" class="nav-player__pick" aria-haspopup="true" aria-expanded="false"' +
        ' aria-label="Выбрать песню">' +
        '<span class="nav-player__label">Музыка</span>' +
        '<span class="nav-player__caret" aria-hidden="true">▼</span>' +
      '</button>' +
    '</div>' +
    '<div class="nav-player__list" role="group" aria-label="Список песен"></div>';

  // Место под плеер уже есть в разметке страницы (пустая заглушка) —
  // поэтому бар не сдвигается, пока скрипт не заполнит панель.
  var root = document.querySelector('.top-dock > .nav-player');
  if (root) {
    root.removeAttribute('aria-hidden');
    root.innerHTML = PLAYER_HTML;
  } else {
    root = document.createElement('div');
    root.className = 'nav-player';
    root.innerHTML = PLAYER_HTML;
  }

  var listEl = root.querySelector('.nav-player__list');

  // Кнопки треков живут прямо в панели и раскрываются вместе с ней
  var items = TRACKS.map(function (track, i) {
    var item = document.createElement('button');
    item.type = 'button';
    item.className = 'nav-player__track';
    item.dataset.index = String(i);
    item.textContent = track.title;
    item.title = track.artist + ' — ' + track.title;
    listEl.appendChild(item);
    return item;
  });

  // Вставляем панель [плеер] [главный бар] в документ.
  // Функция идемпотентна: её же вызывает наблюдатель, если страница
  // перерисовала <body> (например, экран «Доступ закрыт»).
  var dockEl = null;

  function mount() {
    // на обычной странице док и панель уже стоят в разметке
    if (document.body.contains(root)) {
      dockEl = root.closest('.top-dock');
      return;
    }

    var nav = document.querySelector('.site-nav') || document.querySelector('nav.glass');
    if (!nav) return;

    var dock = nav.closest('.top-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.className = 'top-dock';
      // Если бар был приклеен к верху (position: sticky), «плавающей» делаем всю панель
      if (window.getComputedStyle(nav).position === 'sticky') {
        dock.className += ' is-sticky';
      }
      nav.parentNode.insertBefore(dock, nav);
      dock.appendChild(nav);
    }

    dock.insertBefore(root, dock.firstChild);
    dockEl = dock;
  }

  mount();

  if ('MutationObserver' in window) {
    new MutationObserver(mount).observe(document.body, { childList: true });
  }

  var playBtn = root.querySelector('.nav-player__play');
  var iconEl = root.querySelector('.nav-player__icon');
  var pickBtn = root.querySelector('.nav-player__pick');
  var labelEl = root.querySelector('.nav-player__label');

  // ---------------------------------------------------------------- состояние

  var audio = new Audio();
  audio.preload = 'metadata';
  audio.loop = false;

  var current = -1;
  var waitingGesture = false;

  // В выпадающем списке текст каждой песни чередуется:
  // 3 с — название трека, 3 с — исполнитель, и так по кругу
  var CHIP_SWAP_MS = 3000;
  var chipsShowArtist = false;

  function paintChips() {
    items.forEach(function (item, i) {
      item.textContent = chipsShowArtist ? TRACKS[i].artist : TRACKS[i].title;
    });
  }

  setInterval(function () {
    chipsShowArtist = !chipsShowArtist;
    paintChips();
  }, CHIP_SWAP_MS);

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.i !== 'number' || data.i < 0 || data.i >= TRACKS.length) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        i: current,
        t: audio.currentTime || 0,
        p: !audio.paused && !audio.ended
      }));
    } catch (e) { /* приватный режим — просто не сохраняем */ }
  }

  function trackUrl(index) {
    return base + 'assets/music/' + encodeURI(TRACKS[index].file);
  }

  function markActive(index) {
    items.forEach(function (item, i) {
      item.classList.toggle('is-active', i === index);
    });
    if (index >= 0) {
      // в баре всегда название песни, исполнитель показывается в списке
      labelEl.textContent = TRACKS[index].title;
      // короткая анимация «подпрыгивания» при смене трека
      labelEl.classList.remove('is-pop');
      void labelEl.offsetWidth;
      labelEl.classList.add('is-pop');
    } else {
      labelEl.textContent = 'Музыка';
    }
  }

  function setPlayingUI(playing) {
    iconEl.textContent = playing ? '❚❚' : '▶';
    playBtn.classList.toggle('is-playing', playing);
    playBtn.setAttribute('aria-label', playing ? 'Пауза' : 'Включить музыку');
  }

  function loadTrack(index, autoplay, startAt) {
    current = index;
    markActive(index);
    audio.src = trackUrl(index);

    if (startAt > 0) {
      // ждём метаданные, иначе currentTime не выставится
      audio.addEventListener('loadedmetadata', function once() {
        audio.removeEventListener('loadedmetadata', once);
        try { audio.currentTime = startAt; } catch (e) { /* сервер без Range */ }
      });
    }

    if (autoplay) play();
    else setPlayingUI(false);
  }

  // Если браузер не разрешил автозапуск на новой странице,
  // включаем музыку при первом же действии пользователя
  function armGestureResume() {
    if (waitingGesture) return;
    waitingGesture = true;
    setPlayingUI(false);

    function resume() {
      waitingGesture = false;
      document.removeEventListener('pointerdown', resume, true);
      document.removeEventListener('keydown', resume, true);
      document.removeEventListener('touchstart', resume, true);
      if (audio.paused) play();
    }

    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown', resume, true);
    document.addEventListener('touchstart', resume, true);
  }

  function play() {
    if (current === -1) {
      loadTrack(0, true);
      return;
    }
    var started = audio.play();
    if (started && typeof started.catch === 'function') {
      started.catch(function () {
        armGestureResume();
      });
    }
  }

  function toggle() {
    if (current === -1) {
      loadTrack(0, true);
      return;
    }
    if (audio.paused) play();
    else audio.pause();
  }

  // ------------------------------------------- раскрытие списка внутри бара

  function openList() {
    hideHint();
    root.classList.add('is-open');
    if (dockEl) dockEl.classList.add('is-open');
    pickBtn.setAttribute('aria-expanded', 'true');
  }

  function closeList() {
    root.classList.remove('is-open');
    if (dockEl) dockEl.classList.remove('is-open');
    pickBtn.setAttribute('aria-expanded', 'false');
  }

  pickBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (root.classList.contains('is-open')) closeList();
    else openList();
  });

  items.forEach(function (item) {
    item.addEventListener('click', function () {
      var index = parseInt(item.dataset.index, 10);
      if (index === current) {
        toggle();
        closeList();
        return;
      }
      loadTrack(index, true);
      closeList();
    });
  });

  document.addEventListener('click', function (e) {
    if (root.classList.contains('is-open') && !root.contains(e.target)) closeList();
    if (root.classList.contains('has-hint') && !root.contains(e.target)) hideHint();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('is-open')) closeList();
    if (e.key === 'Escape') hideHint();
  });

  playBtn.addEventListener('click', toggle);

  // ------------------------------------------------- подсказка «включи музыку»

  // Показываем подсказку один раз за сессию: после входа на сайт она
  // анимированно появляется под плеером и мягко исчезает сама.
  var HINT_SEEN_KEY = 'alinaMusicHintSeen';
  var hintEl = null;
  var hintTimer = null;

  function hintWasShown() {
    try { return sessionStorage.getItem(HINT_SEEN_KEY) === '1'; } catch (e) { return false; }
  }

  function markHintShown() {
    try { sessionStorage.setItem(HINT_SEEN_KEY, '1'); } catch (e) { /* приватный режим */ }
  }

  function ensureHint() {
    if (hintEl) return hintEl;

    hintEl = document.createElement('button');
    hintEl.type = 'button';
    hintEl.className = 'nav-player__hint';
    hintEl.innerHTML =
      '<span class="nav-player__hint-notes" aria-hidden="true">' +
        '<span>♪</span><span>♫</span><span>♩</span>' +
      '</span>' +
      '<span class="nav-player__hint-text">Включи музыку</span>' +
      '<span class="nav-player__hint-wave" aria-hidden="true">' +
        '<span></span><span></span><span></span>' +
      '</span>';

    hintEl.addEventListener('click', function (e) {
      e.stopPropagation();
      hideHint();
      play();
    });

    root.appendChild(hintEl);
    return hintEl;
  }

  function showHint() {
    if (hintWasShown()) return;
    if (!audio.paused) { markHintShown(); return; }
    if (!document.body.contains(root)) return;                       // док ещё не смонтирован
    if (document.documentElement.classList.contains('gate-locked')) return; // ждём вход

    markHintShown();
    ensureHint();
    root.classList.add('has-hint');

    hintTimer = setTimeout(hideHint, 11000);
  }

  function hideHint() {
    if (!hintEl || !root.classList.contains('has-hint')) return;
    clearTimeout(hintTimer);
    root.classList.remove('has-hint');
  }

  function scheduleHint() {
    if (hintWasShown()) return;
    if (!audio.paused) return;

    // Если сайт ещё закрыт гейтом — подсказываем только после входа
    if (document.documentElement.classList.contains('gate-locked')) {
      document.addEventListener('alina:unlocked', function () {
        setTimeout(showHint, 900);   // даём гейту раствориться
      }, { once: true });
      return;
    }

    setTimeout(showHint, 900);
  }

  // ---------------------------------------------------------------- аудио

  audio.addEventListener('play', function () {
    setPlayingUI(true);
    hideHint();
    saveState();
  });

  audio.addEventListener('pause', function () {
    setPlayingUI(false);
    saveState();
  });

  audio.addEventListener('timeupdate', function () {
    // сохраняем не чаще раза в секунду
    if (!audio.lastSaved || audio.currentTime - audio.lastSaved > 1 || audio.currentTime < audio.lastSaved) {
      audio.lastSaved = audio.currentTime;
      saveState();
    }
  });

  audio.addEventListener('ended', function () {
    var next = (current + 1) % TRACKS.length;
    loadTrack(next, true);
  });

  // Сохраняем позицию перед уходом со страницы
  window.addEventListener('pagehide', saveState);
  window.addEventListener('beforeunload', saveState);

  // ---------------------------------------------------------------- восстановление

  var saved = readState();
  if (saved) {
    loadTrack(saved.i, false, saved.t || 0);
    if (saved.p) {
      // продолжаем с того же места; если браузер запретит автозапуск —
      // включим при первом действии пользователя
      audio.addEventListener('loadedmetadata', function () {
        play();
      }, { once: true });
    }
  } else {
    markActive(-1);
    setPlayingUI(false);
  }

  // Подсказка о музыке — после того как состояние плеера восстановлено
  scheduleHint();
})();
