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
  // Study pages: bottom bar stays page-local. Cross-page jumps live in the top bar only.
  const onStudy = Boolean(document.body.dataset.study);
  const opener = document.querySelector('.hall-open-atlas');
  const atlas = document.querySelector('#hall-experience-atlas');
  if (!onStudy && opener && atlas) {
    opener.setAttribute('aria-controls', 'hall-experience-atlas');
    opener.setAttribute('aria-expanded', 'false');
    opener.addEventListener('click', () => {
      document.body.classList.add('hall-experiences');
      opener.setAttribute('aria-expanded', 'true');
      revealCurrent();
      document.querySelector('.hall-close-atlas')?.focus({preventScroll:true});
    });
    const closeAtlas = () => {
      document.body.classList.remove('hall-experiences');
      opener.setAttribute('aria-expanded', 'false');
      opener.focus({preventScroll:true});
      revealCurrent();
    };
    document.querySelector('.hall-close-atlas')?.addEventListener('click', closeAtlas);
    document.addEventListener('keydown', e => {
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape' && document.body.classList.contains('hall-experiences')) {
        e.preventDefault();
        e.stopPropagation();
        closeAtlas();
      } else if (e.target.closest('.hall-modes,.hall-atlas,.hall-open-atlas,.study-footer')) {
        e.stopPropagation();
      }
    });
  } else {
    document.body.classList.remove('hall-experiences');
    document.addEventListener('keydown', e => {
      if (e.target.closest('.hall-modes,.study-footer')) e.stopPropagation();
    });
  }
  window.addEventListener('resize', revealCurrent);
  revealCurrent();
})();
