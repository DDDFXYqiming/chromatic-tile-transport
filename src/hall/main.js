(() => {
  const menu = document.querySelector('.hall-menu');
  const revealCurrent = () => {
    const strip = document.querySelector('.hall-strip');
    const current = strip?.querySelector('[aria-current]');
    if (current) strip.scrollLeft = current.offsetLeft - strip.offsetLeft - (strip.clientWidth - current.clientWidth) / 2;
  };
  document.querySelector('.hall-open-atlas')?.addEventListener('click', () => {
    document.body.classList.add('hall-experiences');
    revealCurrent();
    document.querySelector('.hall-close-atlas').focus({preventScroll:true});
  });
  document.querySelector('.hall-close-atlas')?.addEventListener('click', () => {
    document.body.classList.remove('hall-experiences');
    document.querySelector('.hall-open-atlas').focus({preventScroll:true});
  });
  document.addEventListener('click', e => { if (menu && !menu.contains(e.target)) menu.open = false; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu?.open) { menu.open = false; menu.querySelector('summary').focus(); }
    if (e.code === 'Space' && e.target.closest('.hall-menu summary')) e.stopPropagation();
  });
  window.addEventListener('resize', revealCurrent);
  revealCurrent();
})();
