'use strict';
(() => {
  const root = document.querySelector('#gameplay');
  if (!root) return;
  const rail = document.querySelector('#hc-gallery-rail');
  const slides = [...rail.querySelectorAll('.hc-gallery-slide')];
  const thumbs = [...document.querySelectorAll('[data-thumb]')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  const count = document.querySelector('#hc-gallery-count');
  const prev = document.querySelector('#hc-gallery-prev');
  const next = document.querySelector('#hc-gallery-next');
  const dialog = document.querySelector('#hc-gallery-dialog');
  const modalImage = document.querySelector('#hc-gallery-modal-img');
  const modalCaption = document.querySelector('#hc-gallery-modal-caption');
  const modalIndex = document.querySelector('#hc-gallery-modal-index');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeGroup = 'All';
  let visible = [...slides];
  let current = 0;
  let openButton = null;
  let ticking = false;
  let touchStart = null;

  function currentSlide() {
    return visible[current];
  }
  function repaint(shouldScroll = false) {
    if (!visible.length) return;
    slides.forEach(slide => slide.classList.toggle('is-active', slide === currentSlide()));
    thumbs.forEach((thumb, i) => {
      const selected = Number(thumb.dataset.thumb) === Number(currentSlide().dataset.index);
      thumb.classList.toggle('is-active', selected);
      thumb.setAttribute('aria-pressed', String(selected));
    });
    count.textContent = (current + 1) + ' / ' + visible.length;
    if (shouldScroll) {
      const target = currentSlide();
      const left = target.offsetLeft - rail.offsetLeft - (rail.clientWidth - target.clientWidth) / 2;
      rail.scrollTo({left: Math.max(0, left), behavior: reduceMotion ? 'instant' : 'smooth'});
      const currentThumb = thumbs[Number(target.dataset.index)];
      const thumbRail = document.querySelector('#hc-gallery-thumbnails');
      if (currentThumb && !currentThumb.hidden) {
        thumbRail.scrollTo({left: Math.max(0,currentThumb.offsetLeft-thumbRail.offsetLeft-(thumbRail.clientWidth-currentThumb.clientWidth)/2),behavior:reduceMotion?'instant':'smooth'});
      }
    }
  }
  function activate(index, scroll = true) {
    if (!visible.length) return;
    current = (index % visible.length + visible.length) % visible.length;
    repaint(scroll);
    if (dialog.open) updateDialog();
  }
  function step(direction) {
    activate(current + direction);
  }
  function updateDialog() {
    const slide = currentSlide();
    const img = slide.querySelector('img');
    modalImage.src = img.getAttribute('src');
    modalImage.alt = img.alt;
    modalCaption.textContent = slide.querySelector('h3').textContent + ' — ' + slide.querySelector('p').textContent;
    modalIndex.textContent = (current+1) + ' / ' + visible.length;
  }
  function openModal(button) {
    openButton = button;
    updateDialog();
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }
  function setGroup(group) {
    activeGroup = group;
    visible = slides.filter(slide => group === 'All' || slide.dataset.category === group);
    slides.forEach(slide => { slide.hidden = !visible.includes(slide); });
    thumbs.forEach(thumb => {
      thumb.hidden = !visible.some(slide => Number(slide.dataset.index) === Number(thumb.dataset.thumb));
    });
    filters.forEach(button => {
      const chosen = button.dataset.filter === activeGroup;
      button.classList.toggle('is-active', chosen);
      button.setAttribute('aria-pressed', String(chosen));
    });
    rail.scrollLeft = 0;
    activate(0, true);
  }
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  filters.forEach(button => button.addEventListener('click', () => setGroup(button.dataset.filter)));
  thumbs.forEach(button => button.addEventListener('click', () => {
    const target = visible.findIndex(slide => Number(slide.dataset.index) === Number(button.dataset.thumb));
    if (target >= 0) activate(target);
  }));
  slides.forEach(slide => slide.querySelector('[data-open]').addEventListener('click', event => {
    const i = visible.indexOf(slide);
    if (i >= 0) { activate(i, false); openModal(event.currentTarget); }
  }));
  rail.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
      let best = current, min = Infinity;
      visible.forEach((slide,i) => {
        const box = slide.getBoundingClientRect();
        const distance = Math.abs(box.left + box.width / 2 - center);
        if (distance < min) {min=distance;best=i;}
      });
      if (best !== current) activate(best, false);
    });
  }, {passive:true});
  rail.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); step(e.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  document.querySelector('#hc-gallery-close').addEventListener('click', () => dialog.close());
  document.querySelector('#hc-gallery-modal-prev').addEventListener('click', () => step(-1));
  document.querySelector('#hc-gallery-modal-next').addEventListener('click', () => step(1));
  dialog.addEventListener('close', () => { if (openButton) openButton.focus({preventScroll:true}); });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {e.preventDefault();step(e.key === 'ArrowRight'?1:-1);}
  });
  dialog.addEventListener('touchstart', e => { if(e.touches.length===1)touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY}; }, {passive:true});
  dialog.addEventListener('touchend', e => {
    if (!touchStart || !e.changedTouches.length) return;
    const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;
    touchStart=null;
    if (Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.35) step(dx<0?1:-1);
  }, {passive:true});
  repaint();
})();
