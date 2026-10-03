(() => {
  const revealItem = (strip, current) => {
    if (current) {
      const bounds = strip.getBoundingClientRect(), item = current.getBoundingClientRect();
      strip.scrollLeft += item.left - bounds.left - (strip.clientWidth - item.width) / 2;
    }
  };
  const revealCurrent = () => {
    document.querySelectorAll('.hall-modes,.hall-strip,.study-strip').forEach(strip => {
      revealItem(strip, strip.querySelector('[aria-current]'));
    });
  };
  document.querySelector('.hall-modes')?.addEventListener('focusin', e => {
    if (e.target.matches('a:focus-visible')) revealItem(e.currentTarget, e.target);
  });
  const opener = document.querySelector('.hall-open-atlas');
  opener?.setAttribute('aria-controls', 'hall-experience-atlas');
  opener?.setAttribute('aria-expanded', 'false');
  opener?.addEventListener('click', () => {
    document.body.classList.add('hall-experiences');
    opener.setAttribute('aria-expanded', 'true');
    revealCurrent();
    document.querySelector('.hall-close-atlas').focus({preventScroll:true});
  });
  const closeAtlas = () => {
    document.body.classList.remove('hall-experiences');
    opener?.setAttribute('aria-expanded', 'false');
    opener?.focus({preventScroll:true});
    revealCurrent();
  };
  document.querySelector('.hall-close-atlas')?.addEventListener('click', closeAtlas);
  document.addEventListener('keydown', e => {
    // Native dialogs own Escape before the underlying experience atlas.
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape' && document.body.classList.contains('hall-experiences')) {
      e.preventDefault();
      e.stopPropagation();
      closeAtlas();
    } else if (e.target.closest('.hall-modes,.hall-atlas,.hall-open-atlas,.study-footer')) {
      // Let links/buttons keep native keyboard activation without also invoking
      // a legacy page's global playback or chapter shortcuts.
      e.stopPropagation();
    }
  });
  window.addEventListener('resize', revealCurrent);
  revealCurrent();
})();
