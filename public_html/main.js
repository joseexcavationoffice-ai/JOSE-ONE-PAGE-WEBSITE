document.documentElement.classList.add('js');
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Site evaluation form (home and /estimate/): inline validation before the browser posts to Web3Forms,
// which redirects to /thanks/. Radio and checkbox groups are validated by name.
(function () {
  var form = document.getElementById('form01');
  if (!form) return;

  var rules = {
    name: function (v) { return v.trim().length >= 2 || 'Enter your name.'; },
    phone: function (v) { return v.replace(/\D/g, '').length >= 10 || 'Enter a 10-digit phone number.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Enter an email like name@example.com.'; },
    zip: function (v) { return /^\d{5}(-\d{4})?$/.test(v.trim()) || 'Enter the 5-digit ZIP code of the job site.'; },
    role: function (v) { return v !== '' || 'Tell us who you are on this project.'; },
    service: function (v) { return v !== '' || 'Choose the work you need.'; },
    services: function (v) { return v !== '' || 'Pick at least one type of work.'; },
    timeline: function (v) { return v !== '' || 'Pick when you want to break ground.'; }
  };

  function valueOf(name) {
    var el = form.elements[name];
    if (!el) return null;
    if (el.length !== undefined && !el.tagName) { // RadioNodeList
      return [].filter.call(el, function (i) { return i.checked; }).map(function (i) { return i.value; }).join(', ');
    }
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? el.value : '';
    return el.value;
  }
  function holder(name) {
    var el = form.elements[name];
    if (el && el.length !== undefined && !el.tagName) return el[0].closest('fieldset');
    return el;
  }
  function check(name) {
    var rule = rules[name], el = holder(name), value = valueOf(name);
    if (!rule || value === null || !el) return true;
    var result = rule(value), ok = result === true;
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    var error = document.getElementById('e-' + name);
    if (error) error.textContent = ok ? '' : result;
    return ok;
  }
  function fieldName(target) { return target && target.name in rules ? target.name : null; }

  // ZIP outside Massachusetts (010-027, 055): not an error, just a heads-up that keeps out-of-area leads honest
  var zipNote = document.getElementById('n-zip');
  function noteZip() {
    if (!zipNote || !form.elements.zip) return;
    var z = form.elements.zip.value.trim();
    var ma = /^(0(1\d|2[0-7])|055)\d{2}/.test(z);
    zipNote.textContent = /^\d{5}/.test(z) && !ma ? 'That ZIP looks outside Massachusetts. Send it anyway and we’ll confirm the distance when we call.' : '';
  }

  form.addEventListener('blur', function (e) {
    var n = fieldName(e.target);
    if (n && e.target.value !== '' && e.target.type !== 'radio' && e.target.type !== 'checkbox') check(n);
    if (e.target.name === 'zip') noteZip();
  }, true);
  form.addEventListener('input', function (e) {
    var n = fieldName(e.target);
    if (!n) return;
    var h = holder(n);
    if (h && h.getAttribute('aria-invalid') === 'true') check(n);
  });
  form.addEventListener('change', function (e) {
    var n = fieldName(e.target);
    if (n && (e.target.type === 'radio' || e.target.type === 'checkbox' || e.target.tagName === 'SELECT')) check(n);
  });

  // keep the ad / campaign source with the lead
  try {
    var params = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'gclid'].forEach(function (k) {
      var v = params.get(k) || sessionStorage.getItem(k);
      if (!v) return;
      sessionStorage.setItem(k, v);
      var input = document.createElement('input');
      input.type = 'hidden'; input.name = k; input.value = v;
      form.appendChild(input);
    });
  } catch (err) {}

  function focusField(el) { (el.tagName === 'FIELDSET' ? el.querySelector('input') : el).focus(); }

  // Multi-step version (home page): one question group at a time, contact details last.
  var goToStep = null;
  if (form.hasAttribute('data-steps')) {
    var steps = [].slice.call(form.querySelectorAll('.fstep'));
    var stepRules = { 1: ['service'], 2: ['zip', 'role', 'timeline'], 3: ['name', 'phone', 'email'] };
    var track = [].slice.call(form.querySelectorAll('.fs-track li'));
    var countEl = form.querySelector('[data-fs-current]');
    var bar = form.querySelector('[data-fs-bar]');
    var backBtn = form.querySelector('[data-fs-back]');
    var nextBtn = form.querySelector('[data-fs-next]');
    var submitBtn = form.querySelector('button[type="submit"]');
    var statusEl = form.querySelector('.form-status');
    var current = 1;

    goToStep = function (n, focus, silent) {
      current = n;
      steps.forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== n; });
      track.forEach(function (li, i) { li.classList.toggle('is-on', i + 1 <= n); li.classList.toggle('is-done', i + 1 < n); });
      countEl.textContent = n;
      bar.style.width = (n / steps.length * 100) + '%';
      backBtn.hidden = n === 1;
      nextBtn.hidden = n === steps.length;
      submitBtn.hidden = n !== steps.length;
      statusEl.textContent = '';
      if (focus) form.querySelector('.fstep[data-step="' + n + '"] .fs-title').focus({ preventScroll: true });
      // funnel event only when the visitor actually moves between steps (not on page load)
      if (!silent) (window.dataLayer = window.dataLayer || []).push({ event: 'form_step', form_id: 'form01', form_step: n });
    };
    function stepValid(n) {
      var bad = null;
      stepRules[n].forEach(function (name) { if (!check(name) && !bad) bad = holder(name); });
      if (bad) focusField(bad);
      return !bad;
    }
    nextBtn.addEventListener('click', function () { if (stepValid(current)) goToStep(current + 1, true); });
    backBtn.addEventListener('click', function () { goToStep(current - 1, true); });
    // picking a service is the whole first step: move on by itself
    form.querySelectorAll('input[name="service"]').forEach(function (r) {
      r.addEventListener('change', function () {
        check('service');
        if (current === 1) setTimeout(function () { goToStep(2, true); }, 280);
      });
    });
    // Enter in a field goes to the next step instead of submitting early
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || current === steps.length || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      nextBtn.click();
    });
    form.classList.add('is-stepped');
    goToStep(1, false, true);
  }

  form.addEventListener('submit', function (e) {
    var firstBad = null;
    Object.keys(rules).forEach(function (name) {
      if (!check(name) && !firstBad) firstBad = holder(name);
    });
    var status = form.querySelector('.form-status');
    if (firstBad) {
      e.preventDefault();
      var step = goToStep && firstBad.closest('.fstep');
      if (step && step.hidden) goToStep(Number(step.getAttribute('data-step')), false);
      status.textContent = 'Check the highlighted fields, then send again.';
      focusField(firstBad);
      return;
    }
    status.textContent = '';
    // repeated checkbox names can arrive as only the last value: send the list as one field too
    if (form.elements.services && !form.elements.work_needed) {
      var joined = document.createElement('input');
      joined.type = 'hidden'; joined.name = 'work_needed'; joined.value = valueOf('services');
      form.appendChild(joined);
    }
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending your request…';
  });

  // "Get an excavation estimate" links pre-select the matching service
  document.querySelectorAll('[data-pick-service]').forEach(function (a) {
    a.addEventListener('click', function () {
      var want = a.getAttribute('data-pick-service');
      var sel = form.elements.service;
      if (!sel) return;
      if (sel.tagName === 'SELECT') {
        [].forEach.call(sel.options, function (o) { if (o.text === want) sel.value = o.value || o.text; });
      } else {
        form.querySelectorAll('input[name="service"]').forEach(function (r) { r.checked = r.value === want; });
        if (goToStep) goToStep(2, false);
      }
      check('service');
    });
  });
})();

document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

// Header: shadow once the page scrolls, mobile menu, underline the section in view; phones get the call bar after the hero.
(function () {
  var header = document.querySelector('.site-header');
  var callbar = document.querySelector('.callbar');
  if (!header) return;
  // the call bar steps aside while the visitor is on the form (it would cover the step buttons and the keyboard)
  var onForm = false;
  var quoteForm = document.getElementById('form01');
  if (callbar && quoteForm && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onForm = entries[0].isIntersecting;
      onScroll();
    }, { rootMargin: '0px 0px -25% 0px' }).observe(quoteForm);
  }
  var onScroll = function () {
    var y = window.scrollY;
    header.classList.toggle('is-stuck', y > 40);
    if (callbar) callbar.classList.toggle('is-on', y > 480 && !onForm);
    if (y < 200) header.querySelectorAll('.nav a.is-active').forEach(function (a) { a.classList.remove('is-active'); });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var btn = header.querySelector('.menu-btn');
  if (btn) {
    var setOpen = function (open) {
      header.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    btn.addEventListener('click', function () { setOpen(!header.classList.contains('is-open')); });
    header.querySelectorAll('.nav a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && header.classList.contains('is-open')) { setOpen(false); btn.focus(); } });
    document.addEventListener('click', function (e) { if (header.classList.contains('is-open') && !header.contains(e.target)) setOpen(false); });
  }

  if (!('IntersectionObserver' in window)) return;
  var links = {};
  header.querySelectorAll('.nav a[href^="#"]:not([data-no-spy])').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var link = links[entry.target.id];
      if (!link || !entry.isIntersecting) return;
      Object.keys(links).forEach(function (id) { links[id].classList.remove('is-active'); });
      link.classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
})();

// Hero badge: tilts toward the pointer on desktop (a light 3D feel without a 3D library).
(function () {
  var badge = document.querySelector('[data-tilt]');
  if (!badge || reduceMotion.matches || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var inner = badge.querySelector('.hero-badge-inner');
  var hero = badge.closest('.hero');
  var frame = null;
  hero.addEventListener('pointermove', function (e) {
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = null;
      var r = badge.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) / r.width;
      var y = (e.clientY - (r.top + r.height / 2)) / r.height;
      inner.style.transform = 'rotateY(' + (x * 14).toFixed(2) + 'deg) rotateX(' + (-y * 12).toFixed(2) + 'deg)';
    });
  });
  hero.addEventListener('pointerleave', function () { inner.style.transform = ''; });
})();

// Hero cards and footer links jump to a service card and flash it.
(function () {
  var map = { excavation: 'svc-excavation', foundations: 'svc-foundations', rebar: 'svc-rebar', basement: 'svc-basement' };
  document.querySelectorAll('[data-open-svc]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var card = document.getElementById(map[a.getAttribute('data-open-svc')]);
      if (!card) return;
      e.preventDefault();
      card.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
      card.classList.add('is-flash');
      setTimeout(function () { card.classList.remove('is-flash'); }, 1800);
    });
  });
})();

// Reviews: the empty state stays until /api/reviews.php answers with real Google reviews.
(function () {
  var sec = document.querySelector('[data-reviews-api]');
  if (!sec) return;
  var track = sec.querySelector('[data-rv-track]');
  var carousel = sec.querySelector('[data-rv-carousel]');
  var empty = sec.querySelector('[data-rv-empty]');
  var gLogo = sec.querySelector('.g-logo');
  var prev = sec.querySelector('[data-rv-step="-1"]'), next = sec.querySelector('[data-rv-step="1"]');

  function stars(n) {
    var s = document.createElement('span');
    s.className = 'rv-rating'; s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'Rated ' + n + ' out of 5');
    for (var i = 0; i < n; i++) s.appendChild(document.createElement('i'));
    return s;
  }
  function initials(name) {
    var p = name.trim().split(/\s+/);
    return ((p[0] || '')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function month(iso) {
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  function cardStep() {
    var c = track.querySelectorAll('.rv-card');
    return c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : 300;
  }
  function updateArrows() {
    prev.disabled = track.scrollLeft < 8;
    next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
  }
  function setupMore() {
    track.querySelectorAll('.rv-card').forEach(function (card) {
      var text = card.querySelector('.rv-text'), btn = card.querySelector('.rv-more');
      btn.hidden = !(text.scrollHeight > text.clientHeight + 2) && !card.classList.contains('is-open');
    });
  }
  [prev, next].forEach(function (b) {
    b.addEventListener('click', function () { track.scrollBy({ left: Number(b.getAttribute('data-rv-step')) * cardStep(), behavior: 'smooth' }); });
  });
  track.addEventListener('scroll', updateArrows, { passive: true });
  track.addEventListener('click', function (e) {
    var btn = e.target.closest('.rv-more');
    if (!btn) return;
    var open = btn.closest('.rv-card').classList.toggle('is-open');
    btn.textContent = open ? 'Show less' : 'Read more';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  function render(data) {
    var list = (data.reviews || []).filter(function (r) { return r.text && r.text.trim(); });
    if (!list.length) return;
    track.textContent = '';
    list.forEach(function (r) {
      var li = document.createElement('li'); li.className = 'rv-card';
      var top = document.createElement('div'); top.className = 'rv-card-top';
      var av = document.createElement('span'); av.className = 'rv-avatar'; av.setAttribute('aria-hidden', 'true');
      if (r.photo) { var im = document.createElement('img'); im.src = r.photo; im.alt = ''; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; av.appendChild(im); }
      else av.textContent = initials(r.author || '?');
      var who = document.createElement('span'); who.className = 'rv-who';
      var nm = document.createElement('strong'); nm.textContent = r.author || 'Google user';
      var tm = document.createElement('time'); tm.dateTime = r.date || ''; tm.textContent = r.when || month(r.date || '');
      who.append(nm, tm);
      top.append(av, who, gLogo.cloneNode(true));
      var text = document.createElement('div'); text.className = 'rv-text';
      r.text.split('\n').filter(Boolean).forEach(function (t) { var p = document.createElement('p'); p.textContent = t; text.appendChild(p); });
      var more = document.createElement('button'); more.className = 'rv-more'; more.type = 'button'; more.hidden = true; more.textContent = 'Read more';
      li.append(top, stars(Math.round(r.rating || 5)), text, more);
      track.appendChild(li);
    });
    if (data.rating && data.total) {
      var sum = sec.querySelector('[data-rv-summary]');
      sum.textContent = '';
      var b = document.createElement('b'); b.textContent = Number(data.rating).toFixed(1);
      var lbl = document.createElement('span'); lbl.textContent = 'from ' + data.total + ' Google reviews';
      sum.append(gLogo.cloneNode(true), b, stars(Math.round(data.rating)), lbl);
    }
    if (data.url) sec.querySelectorAll('[data-rv-link]').forEach(function (a) { a.href = data.url; });
    empty.hidden = true;
    carousel.hidden = false;
    setupMore(); updateArrows();
    window.addEventListener('resize', function () { updateArrows(); setupMore(); });
  }

  // only real JSON counts (a static host serves the .php source or a 404)
  function load() {
    fetch(sec.getAttribute('data-reviews-api'), { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok || (r.headers.get('content-type') || '').indexOf('json') < 0) throw new Error('no data');
      return r.json();
    }).then(render).catch(function () {});
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '400px 0px' });
    io.observe(sec);
  } else load();
})();

// Service-area map: Leaflet + OpenStreetMap, loaded only when the section gets close (nothing on first paint).
// The town list is plain text in the page; tapping a town flies the map to its pin.
(function () {
  var el = document.querySelector('[data-map]');
  if (!el) return;
  var BASE = [42.1398, -71.5162];
  var towns = {
    Milford: [42.1398, -71.5162], Hopedale: [42.1307, -71.5412], Mendon: [42.1054, -71.5523], Upton: [42.1745, -71.6023],
    Hopkinton: [42.2287, -71.5226], Holliston: [42.2001, -71.4245], Medway: [42.1418, -71.3962], Bellingham: [42.0868, -71.4745],
    Franklin: [42.0834, -71.3967], Framingham: [42.2793, -71.4162], Natick: [42.2834, -71.3495], Ashland: [42.2612, -71.4634],
    Marlborough: [42.3459, -71.5523], Southborough: [42.3057, -71.5245], Westborough: [42.2695, -71.6162], Sudbury: [42.3834, -71.4162],
    Wellesley: [42.2968, -71.2924], Worcester: [42.2626, -71.8023], Shrewsbury: [42.2959, -71.7128], Grafton: [42.207, -71.6856],
    Northbridge: [42.1515, -71.6495], Uxbridge: [42.0773, -71.6298], Boston: [42.3601, -71.0589], Newton: [42.337, -71.2092],
    Needham: [42.2809, -71.2378], Norwood: [42.1945, -71.1995], Walpole: [42.1418, -71.2495]
  };
  var chips = [].slice.call(document.querySelectorAll('[data-town]'));
  var map = null, markers = {}, pending = null, loading = false;

  function load(done) {
    if (map) { done(); return; }
    pending = done;
    if (loading) return;
    loading = true;
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = function () { init(); if (pending) pending(); };
    js.onerror = function () { el.classList.add('map--failed'); };
    document.head.appendChild(js);
  }

  function pin(base) {
    return L.divIcon({
      className: 'pin-wrap',
      html: '<span class="pin' + (base ? ' pin--base' : '') + '"></span>',
      iconSize: base ? [40, 40] : [28, 28], iconAnchor: base ? [20, 40] : [14, 28], popupAnchor: [0, base ? -38 : -26]
    });
  }

  function init() {
    var touch = window.matchMedia('(pointer: coarse)').matches;
    map = L.map(el, { scrollWheelZoom: false, dragging: !touch, zoomSnap: 0.5, zoomControl: false });
    // controls live top-right: the bottom of the map sits under the footer's call-to-action card
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    map.attributionControl.setPosition('topright');
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 15, minZoom: 7,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);
    L.circle(BASE, { radius: 80467, color: '#f26b1d', weight: 2, dashArray: '6 8', fillColor: '#f26b1d', fillOpacity: 0.05, interactive: false }).addTo(map);
    L.circle(BASE, { radius: 40234, color: '#f26b1d', weight: 1, opacity: 0.45, dashArray: '2 6', fill: false, interactive: false }).addTo(map);

    Object.keys(towns).forEach(function (name) {
      var base = name === 'Milford';
      var m = L.marker(towns[name], { icon: pin(base), title: name + ', MA', zIndexOffset: base ? 1000 : 0, riseOnHover: true }).addTo(map);
      m.bindPopup('<strong>' + name + ', MA</strong>' + (base ? '<span>Our base</span>' : '<span>Excavation &amp; foundations</span>') +
        '<a href="#form01">Get a site evaluation</a>', { closeButton: false, className: 'town-pop' });
      m.on('click', function () { mark(name); });
      markers[name] = m;
    });
    // extra room at the bottom: the footer card overlaps the last ~95px of the map
    map.fitBounds(L.latLngBounds(Object.keys(towns).map(function (n) { return towns[n]; })), { paddingTopLeft: [60, 40], paddingBottomRight: [40, 150] });
    markers.Milford.bindTooltip('Milford · base', { permanent: true, direction: 'right', offset: [14, -20], className: 'base-tip' });
    el.classList.add('map--ready');
  }

  function mark(name) {
    chips.forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-town') === name); c.setAttribute('aria-pressed', c.getAttribute('data-town') === name ? 'true' : 'false'); });
  }

  var more = document.querySelector('.town-more');
  if (more) more.addEventListener('click', function () {
    var list = more.closest('.towns');
    var open = list.classList.toggle('is-open');
    more.setAttribute('aria-expanded', open ? 'true' : 'false');
    more.textContent = open ? 'Show fewer' : more.getAttribute('data-more-label');
  });

  chips.forEach(function (c) {
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', function () {
      var name = c.getAttribute('data-town');
      mark(name);
      load(function () {
        map.flyTo(towns[name], 12, { duration: reduceMotion.matches ? 0 : 0.8 });
        markers[name].openPopup();
        if (window.matchMedia('(max-width: 960px)').matches) el.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
      });
    });
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { io.disconnect(); load(function () {}); } }, { rootMargin: '500px 0px' });
    io.observe(el);
  } else load(function () {});
})();

// Projects filter: show one type of work at a time.
(function () {
  var btns = [].slice.call(document.querySelectorAll('.pf-btn'));
  var tiles = [].slice.call(document.querySelectorAll('.projects li[data-cat]'));
  if (!btns.length) return;
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-filter');
      btns.forEach(function (x) { var on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      tiles.forEach(function (t) {
        var show = f === 'all' || t.getAttribute('data-cat') === f;
        t.classList.toggle('is-out', !show);
        t.classList.remove('is-in');
        if (show) { void t.offsetWidth; t.classList.add('is-in'); }
      });
    });
  });
})();

// Lightbox: project photos and the job-site clips (videos load only when opened, never on page load).
(function () {
  var lb = document.getElementById('lightbox');
  if (!lb) return;
  var body = lb.querySelector('.lb-body');
  var closeBtn = lb.querySelector('[data-lb-close]');
  var last = null;

  function open(node, trigger) {
    body.textContent = '';
    body.appendChild(node);
    lb.hidden = false;
    requestAnimationFrame(function () { lb.classList.add('is-open'); });
    document.body.style.overflow = 'hidden';
    last = trigger;
    closeBtn.focus();
  }
  function close() {
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    var v = body.querySelector('video');
    if (v) v.pause();
    setTimeout(function () { lb.hidden = true; body.textContent = ''; }, 200);
    if (last) last.focus();
  }

  document.querySelectorAll('[data-gallery]').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var a = e.target.closest('[data-lb]');
      if (!a) return;
      e.preventDefault();
      var img = a.querySelector('img');
      var big = document.createElement('img');
      big.src = a.getAttribute('href'); big.alt = img ? img.alt : '';
      open(big, a);
    });
  });
  document.querySelectorAll('[data-video]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = document.createElement('video');
      v.src = b.getAttribute('data-video');
      v.poster = b.querySelector('img').src;
      v.muted = true; v.loop = true; v.playsInline = true; v.controls = true; v.autoplay = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('aria-label', b.getAttribute('aria-label').replace('Play video: ', ''));
      open(v, b);
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    });
  });

  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('[data-lb-close]')) close(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // keep focus inside: close button and video controls
      var f = [closeBtn].concat([].slice.call(body.querySelectorAll('video')));
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
})();
