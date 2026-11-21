(() => {
  'use strict';

  /* ---------------------------------------------------------------
   * Header — switches to a blurred surface once the page scrolls
   * --------------------------------------------------------------- */
  const header = document.getElementById('header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------------------------------------------------------
   * Scroll reveals
   * --------------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------------------------------------------------------------
   * Waitlist
   *
   * Real signups are captured by Netlify Forms — detected from the
   * form's data-netlify attribute in index.html the moment this site
   * is deployed on Netlify, no backend code required. Submissions land
   * in Site configuration → Forms in the Netlify dashboard.
   *
   * The seat counter and "already joined" state below are still kept
   * in localStorage (per-browser) purely to drive the on-page demo —
   * that's separate from where the email itself ends up.
   * --------------------------------------------------------------- */
  const submitToNetlify = (fields) => fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });

  const STORAGE = {
    joined: 'effyx_waitlist_joined',
    email: 'effyx_waitlist_email',
    count: 'effyx_waitlist_count',
  };

  const SEED_COUNT = 247;
  const TOTAL_SEATS = 500;

  const form = document.getElementById('waitlist-form');
  const input = document.getElementById('email');
  const note = document.getElementById('waitlist-note');
  const success = document.getElementById('waitlist-success');
  const successEmail = document.getElementById('success-email');
  const claimedCountEl = document.getElementById('claimed-count');
  const totalCountEl = document.getElementById('total-count');
  const fillEl = document.getElementById('scarcity-fill');
  const scarcity = document.querySelector('.scarcity');

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  totalCountEl.textContent = TOTAL_SEATS;

  const getStoredCount = () => {
    const parsed = parseInt(localStorage.getItem(STORAGE.count) || '', 10);
    return Number.isFinite(parsed) ? parsed : SEED_COUNT;
  };

  const setStoredCount = (value) => localStorage.setItem(STORAGE.count, String(value));

  const paintCount = (value) => {
    claimedCountEl.textContent = value;
    fillEl.style.width = `${Math.min((value / TOTAL_SEATS) * 100, 100)}%`;
  };

  const animateCount = (from, to) => {
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      paintCount(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // Animate the seat counter up the first time it scrolls into view
  if (scarcity && 'IntersectionObserver' in window) {
    let animated = false;
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !animated) {
          animated = true;
          animateCount(0, getStoredCount());
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counterObserver.observe(scarcity);
  } else {
    paintCount(getStoredCount());
  }

  const showSuccess = (email) => {
    form.classList.add('is-hidden');
    note.classList.add('is-hidden');
    success.classList.remove('is-hidden');
    successEmail.textContent = email;
  };

  const setError = (message) => {
    input.classList.add('has-error');
    note.classList.add('is-error');
    note.textContent = message;
  };

  const clearError = () => {
    input.classList.remove('has-error');
    note.classList.remove('is-error');
    note.textContent = 'No spam — one email when your cohort opens. Unsubscribe anytime.';
  };

  // Returning visitor who already joined — skip straight to the success state
  if (localStorage.getItem(STORAGE.joined) === 'true') {
    const storedEmail = localStorage.getItem(STORAGE.email);
    if (storedEmail) showSuccess(storedEmail);
  }

  const recordJoin = (email) => {
    const previous = getStoredCount();
    const next = Math.min(previous + 1, TOTAL_SEATS);
    localStorage.setItem(STORAGE.joined, 'true');
    localStorage.setItem(STORAGE.email, email);
    setStoredCount(next);
    animateCount(previous, next);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = input.value.trim();

    if (!isValidEmail(email)) {
      setError("That doesn't look like a valid email — mind trying again?");
      input.focus();
      return;
    }

    clearError();
    form.querySelector('button[type="submit"]').disabled = true;

    // Netlify intercepts this POST in production and stores the submission —
    // see Site configuration → Forms in the dashboard. There's no Netlify
    // proxy during local preview, so this rejects silently here; the
    // localStorage record below keeps the on-page demo working either way.
    submitToNetlify({ 'form-name': 'waitlist', email }).catch(() => {});

    recordJoin(email);
    showSuccess(email);
  });

  input.addEventListener('input', () => {
    if (input.classList.contains('has-error')) clearError();
  });
})();
