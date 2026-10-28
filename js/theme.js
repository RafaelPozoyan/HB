// Общий скрипт темы: сдержанный эффект появления фотографий при скролле.
// Работает на всех страницах, где подключён theme.css.
(function () {
  'use strict';

  function show(el) {
    el.classList.add('photo-in-view');
  }

  function initPhotoReveal() {
    var photos = document.querySelectorAll('.photo-reveal');
    if (!photos.length) return;

    // Если браузер не умеет IntersectionObserver — просто показываем всё
    if (!('IntersectionObserver' in window)) {
      photos.forEach(show);
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var delay = parseInt(entry.target.dataset.revealDelay || '0', 10);
          var el = entry.target;
          setTimeout(function () { show(el); }, isNaN(delay) ? 0 : delay);
          obs.unobserve(el);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -6% 0px'
    });

    photos.forEach(function (el) { observer.observe(el); });

    // Страховка: показать всё, что уже в зоне видимости, если observer
    // по какой-то причине не сработал.
    function ensureVisible() {
      photos.forEach(function (el) {
        if (el.classList.contains('photo-in-view')) return;
        var rect = el.getBoundingClientRect();
        var inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (inView) {
          show(el);
          try { observer.unobserve(el); } catch (e) {}
        }
      });
    }

    window.addEventListener('scroll', ensureVisible, { passive: true });
    window.addEventListener('resize', ensureVisible);
    window.addEventListener('load', ensureVisible);
    setTimeout(ensureVisible, 600);

    // Аварийный раскрыватель: к 6-й секунде показываем всё оставшееся
    setTimeout(function () {
      photos.forEach(show);
    }, 6000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPhotoReveal);
  } else {
    initPhotoReveal();
  }
})();
