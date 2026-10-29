// Контроль доступа к закрытым страницам.
// Сейчас закрыта страница «Запись на свидание с Рафулей» (date.html) —
// доступ только у пользователя Alina. Подключается на всех страницах.
(function () {
  'use strict';

  var PROTECTED = {
    'date.html': 'date'   // имя файла страницы -> ключ доступа
  };

  var NO_ACCESS_TEXT = 'У вас нет доступа к данной странице';

  // --- Текущий пользователь / права ---
  function getUser() {
    if (window.AlinaGate && typeof window.AlinaGate.getSessionUser === 'function') {
      return window.AlinaGate.getSessionUser();
    }
    // Резервное чтение, если по какой-то причине API ещё не готово
    try {
      var raw = sessionStorage.getItem('alinaGateUser');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* игнорируем */ }
    return null;
  }

  function hasAccess(pageKey) {
    if (window.AlinaGate && typeof window.AlinaGate.hasAccess === 'function') {
      return window.AlinaGate.hasAccess(pageKey);
    }
    var user = getUser();
    return !!(user && Array.isArray(user.access) && user.access.indexOf(pageKey) !== -1);
  }

  // --- Определяем ключ текущей страницы по имени файла ---
  function currentPageKey() {
    var path = location.pathname;
    var file = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    return PROTECTED[file] || null;
  }

  // --- Затемнение и блокировка ссылок в навигации ---
  var navDecorated = false;

  function decorateNavLinks() {
    if (navDecorated) return;
    navDecorated = true;

    var links = document.querySelectorAll('a[href]');
    links.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var file = href.substring(href.lastIndexOf('/') + 1);
      var key = PROTECTED[file];
      if (!key) return;

      if (hasAccess(key)) return;

      // Пользователь без доступа: затемняем и блокируем переход
      link.classList.add('is-locked');
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('title', NO_ACCESS_TEXT);

      link.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        showNoAccess();
      });
    });
  }

  // --- Сообщение о недоступности ---
  function showNoAccess() {
    var toast = document.getElementById('alina-no-access-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'alina-no-access-toast';
      toast.className = 'alina-toast';
      toast.setAttribute('role', 'alert');
      toast.textContent = NO_ACCESS_TEXT;
      document.body.appendChild(toast);
    } else {
      toast.textContent = NO_ACCESS_TEXT;
    }

    // Перезапускаем анимацию показа
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');

    if (toast._hideTimer) clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2600);
  }

  // --- Защита самой закрытой страницы ---
  var pageProtected = false;

  function protectCurrentPage() {
    if (pageProtected) return false;
    var key = currentPageKey();
    if (!key) return false;
    if (hasAccess(key)) return false;
    pageProtected = true;

    // Нет доступа: заменяем содержимое страницы сообщением
    document.title = 'Нет доступа';

    function render() {
      // Прячем всё, кроме навигации и нашего сообщения
      var nav = document.querySelector('.site-nav');
      var message = document.createElement('main');
      message.className = 'page no-access-page';
      message.innerHTML =
        '<div class="no-access-card">' +
          '<div class="no-access-emoji">🔒</div>' +
          '<h1>Доступ закрыт</h1>' +
          '<p>' + NO_ACCESS_TEXT + '</p>' +
          '<a class="back-link" href="' + rootIndex() + '">← На главную</a>' +
        '</div>';

      // Очищаем body, но сохраняем навигацию (если есть)
      var body = document.body;
      body.innerHTML = '';
      if (nav) body.appendChild(nav);
      body.appendChild(message);

      // Слой декора/фон не нужен на странице-заглушке
      document.documentElement.classList.remove('gate-locked');
      body.style.overflow = '';
    }

    if (document.body) {
      render();
    } else {
      document.addEventListener('DOMContentLoaded', render);
    }
    return true;
  }

  function rootIndex() {
    // date.html всегда в /pages, но на всякий случай проверим
    return location.pathname.indexOf('/pages/') !== -1 ? '../index.html' : 'index.html';
  }

  // --- Запуск ---
  function init() {
    // Если гейт активен (не вошли) — не трогаем, гейт сам всё скроет.
    // Проверим, вошёл ли пользователь.
    var user = getUser();
    if (!user) {
      // Пользователь ещё не определён (гейт покажет форму). Подождём события.
      document.addEventListener('alina:unlocked', function () {
        decorateNavLinks();
        protectCurrentPage();
      });
      document.addEventListener('alina:session-ready', function () {
        decorateNavLinks();
        protectCurrentPage();
      });
      // На случай, если страница открыта без гейта и без сессии — тоже затемним
      // по умолчанию (гость без доступа), но дадим гейту отработать.
      applyGuestLockdown();
      return;
    }

    decorateNavLinks();
    protectCurrentPage();
  }

  // Для гостя/неавторизованного: затемнить закрытые ссылки (но не блокировать
  // саму страницу, пока гейт не решил — protectCurrentPage вызовется после входа).
  function applyGuestLockdown() {
    // Не запускаем, если гейт сейчас на экране (body скрыт) — сделаем после входа.
    if (document.documentElement.classList.contains('gate-locked')) {
      var onChange = function () {
        if (!document.documentElement.classList.contains('gate-locked')) {
          decorateNavLinks();
          protectCurrentPage();
          observer && observer.disconnect();
        }
      };
      var observer = null;
      if ('MutationObserver' in window) {
        observer = new MutationObserver(onChange);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      }
      return;
    }
    decorateNavLinks();
    protectCurrentPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
