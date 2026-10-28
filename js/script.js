// Интерактивность, анимации и эффекты сайта
// Плавное появление секций при прокрутке
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.18 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // Полоса прогресса прокрутки и активный пункт меню
  const progress = document.getElementById('progress');
  const sections = [...document.querySelectorAll('section')];
  const links = [...document.querySelectorAll('nav a')];
  function updateScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? scrollY / max * 100 : 0) + '%';
    let current = sections[0].id;
    sections.forEach(s => { if (s.getBoundingClientRect().top < innerHeight * .45) current = s.id; });
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
  }
  addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  // Звёздное небо на canvas
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  let stars = [];
  function resizeStars() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({length: Math.min(150, Math.floor(innerWidth / 8))}, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      r: Math.random() * 1.5 + .25, phase: Math.random() * Math.PI * 2,
      speed: Math.random() * .018 + .004
    }));
  }
  function drawStars() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const t = performance.now();
    stars.forEach(s => {
      const alpha = .25 + (Math.sin(t * s.speed + s.phase) + 1) * .32;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(238, 220, 255, ${alpha})`; ctx.fill();
    });
    requestAnimationFrame(drawStars);
  }
  addEventListener('resize', resizeStars);
  resizeStars(); drawStars();

  // Искры вокруг клика
  function sparkleBurst(x, y, count = 24) {
    const icons = ['✦', '✧', '♥', '✨', '·'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'sparkle';
      el.textContent = icons[Math.floor(Math.random() * icons.length)];
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.color = ['#ff9dce', '#c5b3ff', '#83e7f5'][i % 3];
      el.style.setProperty('--dx', (Math.random() - .5) * 240 + 'px');
      el.style.setProperty('--dy', (Math.random() - .5) * 240 + 'px');
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    }
  }
  document.addEventListener('click', e => {
    if (e.target.closest('a, button')) sparkleBurst(e.clientX, e.clientY, 12);
  });
  // document.getElementById('magic').addEventListener('click', e => {
  //   sparkleBurst(innerWidth / 2, innerHeight / 2, 65);
  //   e.currentTarget.textContent = 'Пусть сбудется! 💫';
  //   setTimeout(() => e.currentTarget.textContent = 'Загадай ещё одно желание ✨', 2600);
  // });

  document.addEventListener("DOMContentLoaded", () => {
  const showWishButton = document.getElementById("show-wish");
  const wishForm = document.getElementById("wish-form");
  const wishInput = document.getElementById("wish-input");
  const sendWishButton = document.getElementById("send-wish");
  const wishStatus = document.getElementById("wish-status");

  if (
    !showWishButton ||
    !wishForm ||
    !wishInput ||
    !sendWishButton ||
    !wishStatus
  ) {
    return;
  }

  // Показываем поле после нажатия на первую кнопку
  showWishButton.addEventListener("click", () => {
    showWishButton.style.display = "none";
    wishForm.hidden = false;

    wishInput.focus();
  });

  // Обрабатываем отправку желания
  sendWishButton.addEventListener("click", () => {
    const wish = wishInput.value.trim();

    if (!wish) {
      wishStatus.textContent = "Сначала напиши своё желание 💜";
      wishInput.focus();
      return;
    }

    wishStatus.innerHTML =
      'Желание принято! Оно будет напрямую переадресовано <a href="https://t.me/sladkiyraf" target="_blank" rel="noopener noreferrer">Рафуле</a> 💜';
    wishInput.value = "";
  });
});