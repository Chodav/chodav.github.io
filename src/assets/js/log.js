(() => {
  const GITHUB_USER = "Chodav";
  const MONTHS = [
    "Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.",
    "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec.",
  ];
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const root = document.querySelector("[data-page='log']");
  if (!root) return;

  const currentYear = new Date().getFullYear();
  const periods = Array.from({ length: currentYear - 2020 }, (_, i) => currentYear - i);

  const state = {
    period: currentYear,
    selected: null,
    focus: null,
    github: new Map(),
    githubError: false,
    reading: [],
    readingFile: null,
    writable: false,
  };

  const sections = {
    github: document.querySelector('[data-log="github"]'),
    reading: document.querySelector('[data-log="reading"]'),
  };

  const yearLabel = document.querySelector("[data-year-label]");
  const yearPrev = document.querySelector("[data-year-prev]");
  const yearNext = document.querySelector("[data-year-next]");

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function startOfDay(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseISODate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatLongDate(iso) {
    const date = parseISODate(iso);
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function clip(value, max) {
    return String(value || "").trim().slice(0, max);
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

  function isLoopback() {
    return location.hostname === "127.0.0.1" || location.hostname === "localhost";
  }

  function sanitizeEntry(item) {
    if (!item || typeof item !== "object") return null;
    const date = String(item.date || "");
    const title = clip(item.title, 160);
    const id = String(item.id || "").trim();
    if (!DATE_RE.test(date) || !title || !ID_RE.test(id)) return null;
    return {
      id,
      date,
      title,
      author: clip(item.author, 120),
      note: clip(item.note, 800),
    };
  }

  function buildCalendarDays(period) {
    const today = startOfDay(new Date());
    const rangeStart = new Date(period, 0, 1);
    rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());
    const rangeEnd = new Date(period, 11, 31);
    rangeEnd.setDate(rangeEnd.getDate() + (6 - rangeEnd.getDay()));

    const days = [];
    const cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      const iso = toISODate(cursor);
      const inRange = cursor.getFullYear() === period;
      days.push({
        iso,
        date: new Date(cursor),
        inRange,
        future: cursor > today,
        today: iso === todayISO(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  function monthLabels(days) {
    const labels = [];
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7);
      const firstOfMonth = week.find((day) => day.inRange && day.date.getDate() === 1);
      labels.push(firstOfMonth ? MONTHS_SHORT[firstOfMonth.date.getMonth()] : "");
    }
    return labels;
  }

  function levelFromCount(count, max) {
    if (count <= 0) return 0;
    if (max <= 1) return 2;
    const ratio = count / max;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }

  function countsInWindow(days, countForIso) {
    const map = new Map();
    let max = 0;
    days.forEach((day) => {
      if (!day.inRange || day.future) return;
      const count = countForIso(day.iso);
      map.set(day.iso, count);
      if (count > max) max = count;
    });
    return { map, max };
  }

  function streakStats(days, countForIso) {
    const eligible = days.filter((day) => day.inRange && !day.future);
    let longest = 0;
    let run = 0;
    let active = 0;
    let total = 0;

    eligible.forEach((day) => {
      const count = countForIso(day.iso);
      total += count;
      if (count > 0) {
        active += 1;
        run += 1;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    });

    let current = 0;
    for (let i = eligible.length - 1; i >= 0; i -= 1) {
      if (countForIso(eligible[i].iso) > 0) current += 1;
      else if (eligible[i].iso === todayISO()) continue;
      else break;
    }

    return { active, total, current, longest };
  }

  function githubCount(iso) {
    return state.github.get(iso)?.count || 0;
  }

  function githubLevel(iso) {
    const entry = state.github.get(iso);
    if (!entry || entry.count <= 0) return 0;
    return entry.level || levelFromCount(entry.count, 4);
  }

  function readingOn(iso) {
    return state.reading.filter((item) => item.date === iso);
  }

  function readingCount(iso) {
    return readingOn(iso).length;
  }

  function renderYearNav() {
    if (!yearLabel || !yearPrev || !yearNext) return;
    yearLabel.textContent = String(state.period);
    const index = periods.indexOf(state.period);
    yearPrev.disabled = index >= periods.length - 1;
    yearNext.disabled = index <= 0;
  }

  function renderGrid(section, days, getLevel, countForIso, nouns, keepScroll) {
    const mount = section.querySelector("[data-log-grid]");
    if (!mount) return;

    const kind = section.getAttribute("data-log");
    const labels = monthLabels(days);
    const months = labels
      .map((label) => `<span>${escapeHtml(label)}</span>`)
      .join("");

    const cells = days
      .map((day) => {
        if (!day.inRange) {
          return `<span class="log-cell log-cell--pad" aria-hidden="true"></span>`;
        }
        const count = countForIso(day.iso);
        const level = day.future ? 0 : getLevel(day.iso, count);
        const isSelected = state.focus === kind && state.selected === day.iso;
        const selected = isSelected ? " is-selected" : "";
        const today = day.today ? " is-today" : "";
        const label = day.future
          ? `${formatLongDate(day.iso)}`
          : `${formatLongDate(day.iso)}: ${count} ${count === 1 ? nouns.one : nouns.many}`;
        return `
          <button
            type="button"
            class="log-cell${selected}${today}"
            data-level="${level}"
            data-date="${day.iso}"
            ${day.future ? "disabled" : ""}
            aria-pressed="${isSelected ? "true" : "false"}"
            aria-label="${escapeHtml(label)}"
            title="${escapeHtml(label)}"
          ></button>
        `.trim();
      })
      .join("");

    mount.innerHTML = `
      <div class="log-calendar">
        <div class="log-weekdays" aria-hidden="true">
          <span></span>
          <span></span>
          <span>Mon</span>
          <span></span>
          <span>Wed</span>
          <span></span>
          <span>Fri</span>
          <span></span>
        </div>
        <div class="log-grid-scroll">
          <div class="log-months">${months}</div>
          <div class="log-cells">${cells}</div>
        </div>
      </div>
      <div class="log-foot">
        <span class="log-export-slot"></span>
        <div class="log-legend" aria-hidden="true">
          <span>Less</span>
          <span class="log-cell" data-level="0"></span>
          <span class="log-cell" data-level="1"></span>
          <span class="log-cell" data-level="2"></span>
          <span class="log-cell" data-level="3"></span>
          <span class="log-cell" data-level="4"></span>
          <span>More</span>
        </div>
      </div>
    `;

    const scroller = mount.querySelector(".log-grid-scroll");
    if (!scroller) return;
    if (keepScroll != null) scroller.scrollLeft = keepScroll;
    else scroller.scrollLeft = scroller.scrollWidth;
  }

  function renderStats(section, days, countForIso, extra) {
    const el = section.querySelector("[data-log-stats]");
    if (!el) return;
    const stats = streakStats(days, countForIso);
    const bits = [`${stats.active} day${stats.active === 1 ? "" : "s"}`];
    if (extra) bits.push(extra);
    if (stats.current > 0) bits.push(`${stats.current}-day streak`);
    else if (stats.longest > 0) bits.push(`best ${stats.longest}`);
    el.textContent = bits.join(" · ");
  }

  function renderGithubDetail() {
    const detail = sections.github.querySelector("[data-log-detail]");
    if (!detail) return;
    if (!state.selected || state.focus !== "github") {
      detail.hidden = true;
      detail.innerHTML = "";
      return;
    }
    const count = githubCount(state.selected);
    const label = count === 1 ? "contribution" : "contributions";
    detail.hidden = false;
    detail.innerHTML = `
      <p class="log-detail-date">${escapeHtml(formatLongDate(state.selected))}</p>
      <p class="log-detail-body">${count} ${label}.</p>
      <a class="inline-link" href="https://github.com/${GITHUB_USER}" target="_blank" rel="noopener noreferrer">github.com/${GITHUB_USER}</a>
    `;
  }

  function renderReadingDetail() {
    const detail = sections.reading.querySelector("[data-log-detail]");
    if (!detail) return;
    if (!state.selected || state.focus !== "reading") {
      detail.hidden = true;
      detail.innerHTML = "";
      return;
    }

    const all = readingOn(state.selected);
    const items = all.length
      ? `<ul class="log-entries">${all
          .map(
            (item) => `
              <li>
                <div>
                  <p class="log-entry-title">${escapeHtml(item.title || "Untitled")}</p>
                  ${item.author ? `<p class="log-entry-note">${escapeHtml(item.author)}</p>` : ""}
                  ${item.note ? `<p class="log-entry-note">${escapeHtml(item.note)}</p>` : ""}
                </div>
                ${
                  state.writable
                    ? `<button type="button" class="log-remove" data-remove-reading="${escapeHtml(item.id)}" aria-label="Remove entry">×</button>`
                    : ""
                }
              </li>
            `.trim()
          )
          .join("")}</ul>`
      : `<p class="log-detail-body">Nothing logged yet.</p>`;

    detail.hidden = false;
    detail.innerHTML = `
      <p class="log-detail-date">${escapeHtml(formatLongDate(state.selected))}</p>
      ${items}
      ${
        state.writable
          ? `<form class="log-form" data-reading-form>
        <label class="log-label">
          Title
          <input class="log-field" name="title" type="text" required maxlength="160" placeholder="What did you read?">
        </label>
        <label class="log-label">
          Author
          <input class="log-field" name="author" type="text" maxlength="120" placeholder="Optional">
        </label>
        <label class="log-label">
          Notes
          <textarea class="log-field log-field--area" name="note" rows="3" maxlength="800" placeholder="Pages, a line that stuck, a thought."></textarea>
        </label>
        <button class="log-submit" type="submit">Save entry</button>
      </form>`
          : ""
      }
    `;
  }

  function gridScroll(section) {
    return section.querySelector(".log-grid-scroll")?.scrollLeft;
  }

  function renderPersistHint() {
    const slot = sections.reading.querySelector(".log-export-slot");
    if (!slot) return;
    if (!state.writable) {
      slot.innerHTML = "";
      return;
    }
    const label =
      state.readingFile === true
        ? "saved locally — push to publish"
        : state.readingFile === false
          ? "couldn’t save"
          : "local editing";
    slot.innerHTML = `<span class="log-sync">${label}</span>`;
  }

  async function persistReading() {
    if (!state.writable) return false;
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: state.reading }),
      });
      state.readingFile = res.ok;
    } catch {
      state.readingFile = false;
    }
    return state.readingFile;
  }

  function renderAll(options = {}) {
    const page = document.querySelector(".page-right");
    const pageScroll = page?.scrollTop ?? 0;
    const days = buildCalendarDays(state.period);
    const readingWindow = countsInWindow(days, readingCount);
    const periodChanged = renderAll.lastPeriod !== state.period;
    const githubScroll = periodChanged ? null : gridScroll(sections.github);
    const readingScroll = periodChanged ? null : gridScroll(sections.reading);
    renderAll.lastPeriod = state.period;

    renderYearNav();

    if (state.githubError) {
      sections.github.querySelector("[data-log-stats]").textContent = "couldn’t load";
    }

    renderGrid(
      sections.github,
      days,
      (iso) => (state.githubError ? 0 : githubLevel(iso)),
      githubCount,
      { one: "contribution", many: "contributions" },
      githubScroll
    );
    if (!state.githubError) {
      const stats = streakStats(days, githubCount);
      renderStats(
        sections.github,
        days,
        githubCount,
        stats.total ? `${stats.total} contribution${stats.total === 1 ? "" : "s"}` : ""
      );
    }

    renderGrid(
      sections.reading,
      days,
      (iso, count) => levelFromCount(count, readingWindow.max),
      readingCount,
      { one: "entry", many: "entries" },
      readingScroll
    );
    renderStats(sections.reading, days, readingCount);
    renderPersistHint();
    renderGithubDetail();
    renderReadingDetail();

    if (page) page.scrollTop = pageScroll;
    if (options.revealDetail && state.focus) {
      sections[state.focus]
        ?.querySelector("[data-log-detail]:not([hidden])")
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  function shiftPeriod(delta) {
    const index = periods.indexOf(state.period);
    const next = index + delta;
    if (next < 0 || next >= periods.length) return;
    state.period = periods[next];
    if (state.selected) {
      const year = Number(state.selected.slice(0, 4));
      if (year !== Number(state.period)) state.selected = null;
    }
    renderAll();
  }

  async function addReading(fields) {
    if (!state.writable) return;
    const title = clip(fields.title, 160);
    const date = state.selected;
    if (!title || !date || !DATE_RE.test(date)) return;
    state.reading.push({
      id: crypto.randomUUID(),
      date,
      title,
      author: clip(fields.author, 120),
      note: clip(fields.note, 800),
    });
    await persistReading();
    renderAll({ revealDetail: true });
  }

  async function removeReading(id) {
    if (!state.writable) return;
    state.reading = state.reading.filter((item) => item.id !== id);
    await persistReading();
    renderAll({ revealDetail: true });
  }

  document.querySelector(".content-body").addEventListener("click", (event) => {
    const cell = event.target.closest(".log-cell[data-date]");
    if (cell && !cell.disabled) {
      const iso = cell.getAttribute("data-date");
      const focus = cell.closest("[data-log]")?.getAttribute("data-log") || null;
      if (state.selected === iso && state.focus === focus) {
        state.selected = null;
        state.focus = null;
        renderAll();
      } else {
        state.selected = iso;
        state.focus = focus;
        renderAll({ revealDetail: true });
      }
      return;
    }

    const readingId = event.target.closest("[data-remove-reading]")?.getAttribute("data-remove-reading");
    if (readingId && state.writable) removeReading(readingId);
  });

  document.querySelector(".content-body").addEventListener("submit", (event) => {
    const form = event.target.closest("[data-reading-form]");
    if (!form || !state.writable) return;
    event.preventDefault();
    const data = new FormData(form);
    addReading({
      title: String(data.get("title") || ""),
      author: String(data.get("author") || ""),
      note: String(data.get("note") || ""),
    });
  });

  yearPrev?.addEventListener("click", () => shiftPeriod(1));
  yearNext?.addEventListener("click", () => shiftPeriod(-1));

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Failed ${url}`);
    return res.json();
  }

  function ingestGithub(data) {
    (data.contributions || []).forEach((row) => {
      if (!row?.date) return;
      const next = {
        count: Number(row.count) || 0,
        level: Number(row.level) || 0,
      };
      const prev = state.github.get(row.date);
      // GitHub's calendar-year scrape can lag the last-12-months graph.
      if (!prev || next.count > prev.count) state.github.set(row.date, next);
    });
  }

  async function loadGithub() {
    const all = await fetchJson(
      `https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=all`
    );
    ingestGithub(all);
    try {
      const last = await fetchJson(
        `https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=last`,
        { cache: "no-store" }
      );
      ingestGithub(last);
    } catch {
      // All-years payload is enough if the rolling-year refresh is rate-limited.
    }
  }

  async function probeWritable() {
    if (!isLoopback()) {
      state.writable = false;
      return;
    }
    try {
      const data = await fetchJson("/api/reading", { cache: "no-store" });
      state.writable = Boolean(data && data.ok === true);
    } catch {
      state.writable = false;
    }
  }

  async function loadReading() {
    let published = [];
    try {
      const data = await fetchJson("assets/data/reading.json", { cache: "no-store" });
      published = Array.isArray(data.entries) ? data.entries : [];
    } catch {
      published = [];
    }
    state.reading = published.map(sanitizeEntry).filter(Boolean);
  }

  renderAll();

  Promise.all([
    loadGithub().catch(() => {
      state.githubError = true;
    }),
    probeWritable().then(loadReading),
  ]).then(renderAll);
})();
