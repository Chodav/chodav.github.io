(() => {
  const NAV = [
    {
      id: "about",
      href: "index.html",
      label: "About",
      icon: '<path d="M4 10.5L12 4l8 6.5V20H4z"/><path d="M9 20v-6h6v6"/>',
    },
    {
      id: "projects",
      href: "projects.html",
      label: "Projects",
      icon: '<path d="M8 7h8M8 12h8M8 17h5"/><rect x="4" y="4" width="16" height="16" rx="1"/>',
    },
    {
      id: "writing",
      href: "writing.html",
      label: "Writing",
      icon: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4"/>',
    },
    {
      id: "music",
      href: "music.html",
      label: "Music",
      icon: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
    },
    {
      id: "interests",
      href: "interests.html",
      label: "Interests",
      icon: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    },
    {
      id: "inspirations",
      href: "inspirations.html",
      label: "Inspirations",
      icon: '<path d="M12 3l2.2 4.5L19 8.2l-3.5 3.4.8 4.9L12 14.2 7.7 16.5l.8-4.9L5 8.2l4.8-.7z"/>',
    },
    {
      id: "log",
      href: "log.html",
      label: "Log",
      icon: '<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M8 14h2M12 14h2M16 14h2M8 17h2M12 17h2"/>',
    },
  ];

  const activePage = document.body.getAttribute("data-page") || "about";
  const showMobileHome =
    document.body.getAttribute("data-show-mobile-home") === "true";

  const sunIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
    </svg>
  `.trim();

  const moonIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z"/>
    </svg>
  `.trim();

  function navClass(id) {
    return id === activePage ? ' class="active"' : "";
  }

  function sideNavLinks() {
    return NAV.map(
      (item) =>
        `<a${navClass(item.id)} href="${item.href}">${item.label}</a>`
    ).join("\n");
  }

  function drawerNavLinks() {
    return NAV.map(
      (item) => `
        <a${navClass(item.id)} href="${item.href}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg>
          ${item.label}
        </a>
      `.trim()
    ).join("\n");
  }

  const quote = `
    <blockquote class="quote">
      “Every Moleskine notebook is a book yet to be written.”
      <cite>— Maria Sebregondi</cite>
    </blockquote>
  `.trim();

  function mount(selector, html) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.outerHTML = html;
  }

  mount(
    "[data-chrome]",
    `
      <header class="mobile-header">
        <button class="icon-btn menu-toggle" type="button" aria-label="Open menu" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <a class="mobile-brand" href="index.html">David Cho</a>
        <button class="icon-btn theme-toggle" type="button" aria-label="Toggle dark mode">
          ${sunIcon}
        </button>
      </header>
      <aside class="drawer" id="drawer" aria-hidden="true">
        <button class="drawer-close menu-toggle" type="button" aria-label="Close menu">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <nav class="drawer-nav" aria-label="Primary">
          ${drawerNavLinks()}
        </nav>
        <div class="drawer-utils">
          <button class="theme-toggle" type="button">
            ${moonIcon}
            Dark mode
          </button>
        </div>
        <div class="sticky" data-sticky="drawer" aria-hidden="true"></div>
      </aside>
      <div class="drawer-backdrop" id="drawer-backdrop"></div>
    `.trim()
  );

  mount(
    "[data-page-left]",
    `
      <aside class="page page-left">
        <div class="brand">
          <p class="brand-name">David Cho</p>
          <p class="brand-tagline">programmer | writer | life-long learner</p>
          <div class="sticky" data-sticky="brand" aria-hidden="true"></div>
        </div>
        <nav class="side-nav" aria-label="Primary">
          ${sideNavLinks()}
        </nav>
        <div data-recent-notes></div>
        ${quote}
      </aside>
    `.trim()
  );

  mount(
    "[data-content-meta]",
    `
      <div class="content-meta">
        <button class="theme-toggle desktop-theme" type="button" aria-label="Toggle dark mode">
          ${sunIcon}
        </button>
        <time class="content-date" datetime=""></time>
      </div>
    `.trim()
  );

  mount(
    '[data-mount="mobile-home"]',
    showMobileHome
      ? `
          <div class="mobile-home">
            <div class="brand">
              <p class="brand-name">David Cho</p>
              <p class="brand-tagline">student • builder • curious</p>
              <div class="sticky" data-sticky="brand" aria-hidden="true"></div>
            </div>
            <nav class="side-nav" aria-label="Sections">
              ${sideNavLinks()}
            </nav>
            <div data-recent-notes></div>
            ${quote}
          </div>
        `.trim()
      : ""
  );

  const root = document.documentElement;
  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const menuToggles = document.querySelectorAll(".menu-toggle");
  const themeToggles = document.querySelectorAll(".theme-toggle");

  const THEME_KEY = "notebook-theme";

  function getPreferredTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // Storage can throw (Safari private mode, blocked cookies).
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Theme still applies this session even if persistence fails.
    }
  }

  applyTheme(getPreferredTheme());

  themeToggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      const next =
        root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  });

  function setMenuOpen(open) {
    if (!drawer || !backdrop) return;
    drawer.classList.toggle("open", open);
    backdrop.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("menu-open", open);
    menuToggles.forEach((btn) => {
      if (btn.classList.contains("icon-btn")) {
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      }
    });
  }

  menuToggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      setMenuOpen(!drawer.classList.contains("open"));
    });
  });

  if (backdrop) {
    backdrop.addEventListener("click", () => setMenuOpen(false));
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenuOpen(false);
  });

  function formatPageDate(date) {
    const months = [
      "Jan.",
      "Feb.",
      "Mar.",
      "Apr.",
      "May",
      "Jun.",
      "Jul.",
      "Aug.",
      "Sep.",
      "Oct.",
      "Nov.",
      "Dec.",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function formatISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const today = new Date();
  document.querySelectorAll(".content-date").forEach((el) => {
    el.textContent = formatPageDate(today);
    el.setAttribute("datetime", formatISODate(today));
  });

  // Edit recent notes here — rendered into every [data-recent-notes] mount.
  const RECENT_NOTES = [
    { date: "09.02", title: "Senior year at Yale", tag: "school" },
    { date: "08.21", title: "Summer at Bloomberg", tag: "work" },
    { date: "06.07", title: "Swan Lake at Met Opera", tag: "music" },
  ];

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderRecentNotes(mountEl) {
    const items = RECENT_NOTES.map(
      (note) => `
        <li>
          <span class="note-date">${escapeHtml(note.date)}</span>
          <span class="note-title">${escapeHtml(note.title)}</span>
          <span class="note-tag">${escapeHtml(note.tag)}</span>
        </li>
      `.trim()
    ).join("\n");

    mountEl.outerHTML = `
      <section class="recent" aria-label="Recent notes">
        <h2 class="recent-heading">Recent notes</h2>
        <ul class="note-list">
          ${items}
        </ul>
      </section>
    `.trim();
  }

  document.querySelectorAll("[data-recent-notes]").forEach(renderRecentNotes);

  // Edit sticky notes here — rendered into every [data-sticky] mount.
  const STICKY_NOTES = {
    drawer: {
      label: "Notes",
      text: '"What I cannot create, I do not understand."',
    },
    brand: {
      label: "Notes",
      text: "forsan et haec olim meminisse iuvabit",
    },
  };

  function renderSticky(mountEl) {
    const key = mountEl.getAttribute("data-sticky");
    const note = STICKY_NOTES[key];
    if (!note) return;

    mountEl.classList.add("sticky");
    mountEl.setAttribute("aria-hidden", "true");
    mountEl.innerHTML = `<span class="sticky-label">${escapeHtml(note.label)}</span>${escapeHtml(note.text)}`;
  }

  document.querySelectorAll("[data-sticky]").forEach(renderSticky);

  document.querySelectorAll("[data-photo]").forEach((el) => {
    const src = el.getAttribute("data-photo");
    if (!src) return;
    el.style.backgroundImage = `url("${src.replaceAll('"', "")}")`;
  });
})();
