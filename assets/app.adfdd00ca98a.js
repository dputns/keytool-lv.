document.documentElement.classList.add('js');
document.querySelectorAll('.motion-slideshow').forEach(banner => {
  const slides = [...banner.querySelectorAll('.motion-slide')];
  const dots = [...banner.querySelectorAll('.slide-dot')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let timer;
  const show = index => {
    current = index;
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-pressed', String(i === index));
    });
  };
  const schedule = () => {
    clearTimeout(timer);
    if (banner.classList.contains('paused') || document.hidden || reducedMotion.matches) return;
    timer = setTimeout(() => { show((current + 1) % slides.length); schedule(); }, 3000);
  };
  dots.forEach((dot, index) => dot.addEventListener('click', () => { show(index); schedule(); }));
  banner.addEventListener('motionpausechange', schedule);
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', schedule);
  schedule();
});
document.querySelectorAll('.motion-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const paused = toggle.closest('.motion-banner').classList.toggle('paused');
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Atsākt banera animāciju' : 'Apturēt banera animāciju');
    toggle.querySelector('span').textContent = paused ? '▶' : 'Ⅱ';
    toggle.closest('.motion-banner').dispatchEvent(new Event('motionpausechange'));
  });
});
const button = document.querySelector('.menu');
const links = document.querySelector('.nav-links');
if (button && links) {
  const close = () => { links.classList.remove('open'); button.setAttribute('aria-expanded', 'false'); };
  button.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
  });
  links.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && links.classList.contains('open')) { close(); button.focus(); } });
}
