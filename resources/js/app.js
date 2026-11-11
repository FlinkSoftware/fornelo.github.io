// Navigation: on the home page the link of the section you are reading lights up as you scroll. A link
// covers the sections up to the next link's. Other pages get their current link from the template. A tap in
// the mobile menu closes it.
(function(){
  const GROUPS = [
    ['home', ['hero-section', 'app-band', 'process-section']],
    ['features', ['feature-section', 'family-section']],
    ['pricing', ['pricing-section', 'faq-section', 'share-section']],
  ];

  function setupNavigation(){
    const links = Array.from(document.querySelectorAll('[data-nav]'));
    const menu = document.getElementById('mobile-menu');
    links.forEach((link) => link.addEventListener('click', () => {
      if (menu && menu.open) menu.close();
    }));

    const sections = [];
    GROUPS.forEach(([key, ids]) => ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) sections.push({ key, element });
    }));
    if (!sections.some((section) => section.key !== 'home')) return;

    let current = null;
    function mark(key){
      if (key === current) return;
      current = key;
      links.forEach((link) => {
        if (link.dataset.nav === key) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function update(){
      const line = window.innerHeight / 3;
      let key = sections[0].key;
      for (const section of sections) {
        if (section.element.getBoundingClientRect().top <= line) key = section.key;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        key = sections[sections.length - 1].key;
      }
      mark(key);
    }

    let queued = false;
    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; update(); });
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupNavigation);
  } else {
    setupNavigation();
  }
})();

// Dialogs: the mobile menu and the ideas window are native <dialog>s. Buttons with command/commandfor open
// and close them; browsers that know those attributes do it themselves, the others get this click handler.
// A tap beside the panel closes it.
(function(){
  function setupDialogs(){
    const nativeCommands = 'command' in HTMLButtonElement.prototype;
    document.querySelectorAll('button[commandfor]').forEach((button) => {
      if (nativeCommands) return;
      button.addEventListener('click', () => {
        const dialog = document.getElementById(button.getAttribute('commandfor'));
        if (!dialog) return;
        if (button.getAttribute('command') === 'show-modal') dialog.showModal();
        else if (button.getAttribute('command') === 'close') dialog.close();
      });
    });
    document.querySelectorAll('dialog:not(:has([data-dialog-backdrop]))').forEach((dialog) => {
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    });
    // Lightbox: a screenshot opens full size in the one #lightbox dialog, with its alt text as the caption. The
    // image is cleared on close, so the next one does not flash the previous.
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
      const image = lightbox.querySelector('[data-lightbox-image]');
      const caption = lightbox.querySelector('[data-lightbox-caption]');
      document.querySelectorAll('[data-lightbox-src]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
          image.src = trigger.dataset.lightboxSrc;
          image.alt = trigger.dataset.lightboxAlt || '';
          caption.textContent = trigger.dataset.lightboxAlt || '';
          lightbox.showModal();
        });
      });
      lightbox.addEventListener('close', () => { image.removeAttribute('src'); image.alt = ''; });
    }
    // A mailto link does nothing without a mail app, and a page cannot ask whether there is one. When a mail app
    // opens, this window loses focus; if it still has it after a moment, say so and point at copying or Gmail.
    document.querySelectorAll('[data-mail-app]').forEach((link) => {
      const hint = link.closest('dialog')?.querySelector('[data-no-mail-app]');
      if (!hint) return;
      link.addEventListener('click', () => {
        let left = false;
        const onBlur = () => { left = true; };
        window.addEventListener('blur', onBlur, { once: true });
        setTimeout(() => {
          window.removeEventListener('blur', onBlur);
          if (!left && document.hasFocus()) hint.hidden = false;
        }, 1500);
      });
    });
    // Copy buttons: the text to the clipboard, and a moment of "copied" on the button
    document.querySelectorAll('[data-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(button.dataset.copy); } catch (error) { return; }
        const note = button.querySelector('.share-copied');
        if (note) {
          note.hidden = false;
          setTimeout(() => { note.hidden = true; }, 2000);
          return;
        }
        const label = button.textContent;
        button.textContent = button.dataset.copied || label;
        setTimeout(() => { button.textContent = label; }, 2000);
      });
    });
    document.querySelectorAll('[data-dialog-backdrop]').forEach((backdrop) => {
      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) backdrop.closest('dialog')?.close();
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDialogs);
  } else {
    setupDialogs();
  }
})();

// Share: on phones (and browsers with a share sheet) one "Share…" button opens the device's own sheet, with all
// the apps the visitor has; the network buttons stay for everyone else.
(function(){
  function setupShare(){
    if (typeof navigator.share !== 'function') return;
    document.querySelectorAll('[data-share-native]').forEach((button) => {
      const box = button.closest('[data-share-url]');
      if (!box) return;
      button.hidden = false;
      button.addEventListener('click', () => {
        navigator.share({ title: document.title, text: box.dataset.shareText, url: box.dataset.shareUrl + '?utm_source=native&utm_medium=share' })
          .catch(() => {});
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupShare);
  } else {
    setupShare();
  }
})();

// Share band: "Ken je iemand die …" types a phrase, leaves it to read, crosses it out, and types the next; every
// phrase gets the same time, the last one (with a wink) included, then it all starts over. Runs only while the
// band is on screen; with reduced motion the last phrase stays as the page shows it.
(function(){
  const TYPE = 45, DELETE = 22, READ = 1800, STRUCK = 900;
  function setupStrikeTyping(){
    const el = document.querySelector('[data-strike-phrases]');
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let phrases;
    try { phrases = JSON.parse(el.dataset.strikePhrases); } catch (error) { return; }
    if (!Array.isArray(phrases) || phrases.length < 2) return;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let visible = false;
    const shown = () => new Promise((resolve) => {
      if (visible && !document.hidden) return resolve();
      const check = setInterval(() => { if (visible && !document.hidden) { clearInterval(check); resolve(); } }, 300);
    });
    new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting); }).observe(el);

    async function type(text){
      el.classList.add('is-typing');
      const chars = Array.from(text);
      for (let i = 1; i <= chars.length; i++) { el.textContent = chars.slice(0, i).join(''); await wait(TYPE); }
      el.classList.remove('is-typing');
    }
    async function erase(){
      el.classList.add('is-typing');
      el.classList.remove('is-struck');
      const chars = Array.from(el.textContent);
      for (let i = chars.length - 1; i >= 0; i--) { el.textContent = chars.slice(0, i).join(''); await wait(DELETE); }
    }
    async function run(){
      el.textContent = '';
      for (;;) {
        for (let i = 0; i < phrases.length; i++) {
          await shown();
          await type(phrases[i]);
          await wait(READ);
          el.classList.add('is-struck');
          await wait(STRUCK);
          await erase();
        }
      }
    }
    run();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupStrikeTyping);
  } else {
    setupStrikeTyping();
  }
})();

// Titles with words in turn: "Uit een kookboek." The word is erased and the next one typed, each left to read
// for a moment; only while the title is on screen. With reduced motion, or without JavaScript, the first word
// stays as the page shows it.
(function(){
  const TYPE = 55, DELETE = 28, READ = 2200;
  function setupWordTyping(){
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('[data-type-words]').forEach((el) => {
      let words;
      try { words = JSON.parse(el.dataset.typeWords); } catch (error) { return; }
      if (!Array.isArray(words) || words.length < 2) return;
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      let visible = false;
      const shown = () => new Promise((resolve) => {
        if (visible && !document.hidden) return resolve();
        const check = setInterval(() => { if (visible && !document.hidden) { clearInterval(check); resolve(); } }, 300);
      });
      new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting); }).observe(el);

      async function erase(){
        el.classList.add('is-typing');
        const chars = Array.from(el.textContent);
        for (let i = chars.length - 1; i >= 0; i--) { el.textContent = chars.slice(0, i).join(''); await wait(DELETE); }
      }
      async function type(text){
        const chars = Array.from(text);
        for (let i = 1; i <= chars.length; i++) { el.textContent = chars.slice(0, i).join(''); await wait(TYPE); }
        el.classList.remove('is-typing');
      }
      async function run(){
        for (let i = 1; ; i = (i + 1) % words.length) {
          await shown();
          await wait(READ);
          await erase();
          await type(words[i]);
        }
      }
      run();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupWordTyping);
  } else {
    setupWordTyping();
  }
})();

// Where visitors come from: the first source (utm_source, else the site that linked here) is kept, first touch
// wins, and goes along on every sign-up link so the app knows how someone found Fornelo.
(function(){
  const SOURCE = 'fornelo-source';
  function read(key){
    try { return JSON.parse(localStorage.getItem(key)); } catch (error) { return null; }
  }
  function write(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* private mode */ } }
  function setupSource(){
    const params = new URLSearchParams(window.location.search);
    if (!read(SOURCE)) {
      let source = params.get('utm_source');
      if (!source && document.referrer) {
        try {
          const host = new URL(document.referrer).hostname.replace(/^www\./, '');
          if (host && host !== window.location.hostname) source = host;
        } catch (error) { /* no usable referrer */ }
      }
      if (source) write(SOURCE, { value: source.trim().toLowerCase().slice(0, 64) });
    }
    const first = read(SOURCE);
    if (!first || !first.value) return;
    document.querySelectorAll('a[data-sign-up]').forEach((link) => {
      const url = new URL(link.href);
      url.searchParams.set('source', first.value);
      link.href = url.toString();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSource);
  } else {
    setupSource();
  }
})();

// Light or dark: the toggle in the navigation flips the class on <html> and remembers the choice in localStorage
// ("theme"); the layout's head applies that choice before the first paint. Without a choice the page follows the
// system setting, and keeps following it when that changes.
(function(){
  function setupTheme(){
    const root = document.documentElement;
    const toggles = document.querySelectorAll('.theme-toggle');
    if (!toggles.length) return;
    const label = () => {
      const dark = root.classList.contains('dark');
      toggles.forEach((button) => {
        const text = dark ? button.dataset.labelLight : button.dataset.labelDark;
        button.setAttribute('aria-label', text);
        button.setAttribute('title', text);
        button.setAttribute('aria-pressed', String(dark));
        const visible = button.querySelector('[data-theme-label]');
        if (visible) visible.textContent = text;
      });
    };
    toggles.forEach((button) => button.addEventListener('click', () => {
      const dark = root.classList.toggle('dark');
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (error) { /* private mode: the choice lasts this page */ }
      label();
    }));
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    system.addEventListener('change', (event) => {
      let choice = null;
      try { choice = localStorage.getItem('theme'); } catch (error) { /* then follow the system */ }
      if (choice) return;
      root.classList.toggle('dark', event.matches);
      label();
    });
    label();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupTheme);
  else setupTheme();
})();

// The scan clip in the features section plays, muted, while it is on screen and pauses out of sight; people who
// prefer reduced motion get the poster and play it themselves.
(function(){
  function setupClips(){
    const clips = document.querySelectorAll('video[data-autoplay-when-visible]');
    if (!clips.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clips.forEach((clip) => { clip.controls = true; });
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const clip = entry.target;
        if (entry.isIntersecting) { clip.play().catch(() => { clip.controls = true; }); }
        else clip.pause();
      });
    }, { threshold: 0.4 });
    clips.forEach((clip) => observer.observe(clip));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupClips);
  else setupClips();
})();
