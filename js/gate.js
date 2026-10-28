// Гейт доступа: обратный отсчёт до 00:00 6 ноября 2026 по МСК, затем вход по логину/паролю.
// Подключается на всех страницах сайта.
(function () {
  'use strict';

  // Момент открытия: 6 ноября 2026, 00:00 по московскому времени (UTC+3)
  const UNLOCK_DATE = new Date('2026-11-06T00:00:00+03:00');

  // Временно хардкод для удобства (не безопасность, а занавеска)
  const VALID_LOGIN = '1';
  const VALID_PASSWORD = '1';

  const SESSION_KEY = 'alinaGateUnlockedSession';

  // Уже открыт доступ в этой сессии? — не показываем гейт вовсе
  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    return;
  }

  // --- Разметка гейта ---
  const gate = document.createElement('div');
  gate.className = 'gate';
  gate.innerHTML = `
    <div class="gate__card">
      <div class="gate__emoji">💜</div>

      <div id="gate-countdown-view">
        <h1 class="gate__title">Ещё чуть-чуть…</h1>
        <p class="gate__subtitle">Этот сайт откроется в твой день рождения</p>

        <div class="gate__countdown" aria-live="polite">
          <div class="gate__unit"><span class="gate__num" data-unit="days">00</span><span class="gate__label">дней</span></div>
          <div class="gate__unit"><span class="gate__num" data-unit="hours">00</span><span class="gate__label">часов</span></div>
          <div class="gate__unit"><span class="gate__num" data-unit="minutes">00</span><span class="gate__label">минут</span></div>
          <div class="gate__unit"><span class="gate__num" data-unit="seconds">00</span><span class="gate__label">секунд</span></div>
        </div>

        <p class="gate__date">6 ноября 2026 · 00:00 МСК</p>

        <button type="button" class="gate__skip" id="gate-skip">Пропустить отсчёт →</button>
      </div>

      <div id="gate-login-view" class="gate__hidden">
        <h1 class="gate__title">Добро пожаловать</h1>
        <p class="gate__subtitle">Введи логин и пароль, чтобы войти</p>

        <form class="gate__form" id="gate-form" autocomplete="off">
          <label for="gate-login" class="gate__hidden">Логин</label>
          <input id="gate-login" class="gate__field" type="text" placeholder="Логин" autocomplete="username" required>

          <label for="gate-password" class="gate__hidden">Пароль</label>
          <input id="gate-password" class="gate__field" type="password" placeholder="Пароль" autocomplete="current-password" required>

          <button type="submit" class="gate__btn">Открыть сайт ✨</button>
          <p class="gate__error" id="gate-error" role="alert" aria-live="polite"></p>
        </form>
      </div>
    </div>
  `;

  // Прячем страницу, пока идёт проверка (без мигания контента)
  document.documentElement.classList.add('gate-locked');

  // --- Подключение к DOM ---
  function mount() {
    document.body.appendChild(gate);
    document.body.style.overflow = 'hidden';

    // Кнопка «Пропустить» — вешаем через делегирование один раз
    bindSkip();

    // Запускаем логику гейта
    runGate();
  }

  function runGate() {
    const now = Date.now();
    const params = new URLSearchParams(location.search);
    const demoMode = params.get('demo') === '1';
    const testMode = params.has('test');

    if (now < UNLOCK_DATE.getTime() || demoMode || testMode) {
      startCountdown();
    } else {
      // Дата уже наступила — сразу показываем форму входа
      showLogin();
    }
  }

  // --- Обратный отсчёт ---
  let timerId = null;

  function startCountdown() {
    const nums = {
      days: gate.querySelector('[data-unit="days"]'),
      hours: gate.querySelector('[data-unit="hours"]'),
      minutes: gate.querySelector('[data-unit="minutes"]'),
      seconds: gate.querySelector('[data-unit="seconds"]')
    };

    const demoMode = new URLSearchParams(location.search).get('demo') === '1';
    // ?test=N — отладка: до открытия остаётся N секунд (чтобы увидеть, как срабатывает ноль)
    const testParam = new URLSearchParams(location.search).get('test');
    // В демо-режиме стартуем от «30 дней до даты», даже если реальная дата прошла
    const baseUnlock = testParam
      ? Date.now() + parseInt(testParam, 10) * 1000
      : UNLOCK_DATE.getTime();
    const demoStart = UNLOCK_DATE.getTime() - 30 * 86400 * 1000;
    const startedAt = Date.now();

    function currentNow() {
      if (!demoMode) return Date.now();
      return demoStart + (Date.now() - startedAt);
    }

    function finishCountdown() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      // Когда время вышло — показываем форму входа (доступ открылся)
      showLogin();
    }

    function tick() {
      const diff = baseUnlock - currentNow();

      if (diff <= 0) {
        finishCountdown();
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      nums.days.textContent = String(days).padStart(2, '0');
      nums.hours.textContent = String(hours).padStart(2, '0');
      nums.minutes.textContent = String(minutes).padStart(2, '0');
      nums.seconds.textContent = String(seconds).padStart(2, '0');
    }

    tick();
    timerId = setInterval(tick, 1000);
  }

  // --- Кнопка «Пропустить отсчёт»: сразу открывает основной сайт ---
  let skipBound = false;

  function bindSkip() {
    if (skipBound) return;
    skipBound = true;

    document.addEventListener('click', function (event) {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;

      const btn = target.closest('#gate-skip');
      if (btn) {
        event.preventDefault();
        unlock();
      }
    });
  }

  // --- Форма входа ---
  function showLogin() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }

    const countdownView = gate.querySelector('#gate-countdown-view');
    const loginView = gate.querySelector('#gate-login-view');

    if (countdownView) countdownView.classList.add('gate__hidden');
    if (loginView) loginView.classList.remove('gate__hidden');

    const loginInput = gate.querySelector('#gate-login');
    if (loginInput) loginInput.focus();

    bindLoginForm();
  }

  let formBound = false;

  function bindLoginForm() {
    if (formBound) return;
    formBound = true;

    const form = gate.querySelector('#gate-form');
    const errorEl = gate.querySelector('#gate-error');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      const loginInput = gate.querySelector('#gate-login');
      const passwordInput = gate.querySelector('#gate-password');

      const login = loginInput ? loginInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (login === VALID_LOGIN && password === VALID_PASSWORD) {
        if (errorEl) errorEl.textContent = '';
        unlock();
      } else {
        if (errorEl) errorEl.textContent = 'Неверный логин или пароль. Попробуй ещё раз.';
        if (passwordInput) {
          passwordInput.value = '';
          passwordInput.focus();
        }
      }
    });
  }

  // --- Открыть сайт ---
  function unlock() {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch (e) { /* приватный режим — игнорируем */ }

    document.documentElement.classList.remove('gate-locked');
    document.body.style.overflow = '';

    // Гарантированно показываем содержимое страницы
    gate.classList.add('is-hidden');
    setTimeout(function () {
      if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
    }, 600);
  }

  // --- Запуск (в самом конце, после всех объявлений — чтобы не было TDZ) ---
  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }
})();
