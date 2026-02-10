(() => {
  const EXT_TAG = "[RYM ratings to /10]";

  // These are the main “release page” rating nodes you already targeted
  const TARGETS = [
    { selector: "span.avg_rating", kind: "value" },
    { selector: "span.avg_rating_friends", kind: "value" },
    { selector: "[id^='rating_num_l_']", kind: "user" },
    { selector: ".page_charts_section_charts_item_details_average_num", kind: "value" }
  ];

  // Containers where the rating number is often nested:
  const MAX_RATING_CONTAINER = ".max_rating"; // the "5.0" part next to the slash
  const TRACK_STATS_CONTAINER = ".page_release_section_tracks_songs_song_stats"; // per-track right-side stats

  const DEFAULTS = { enabled: true };
  let ENABLED = true;

  const loadEnabled = () =>
    new Promise((resolve) => {
      if (!chrome?.storage?.sync) return resolve(true);
      chrome.storage.sync.get(DEFAULTS, (s) => resolve(!!s.enabled));
    });

  const format2 = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const format1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const formatCompact = (n) => {
    const s = (Math.round(n * 100) / 100).toFixed(2);
    return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  };

  // Parse values from /5 scale. Returns null if not a 0..5 number.
  const parseMaybe5 = (txt) => {
    const t = (txt || "").trim();
    // allow "3.42" or "3.42/5"
    const m = t.match(/^([0-5](?:\.\d{1,2})?)(?:\s*\/\s*5(?:\.0{1,2})?)?$/);
    if (!m) return null;
    const v = Number(m[1]);
    if (!Number.isFinite(v) || v < 0 || v > 5) return null;
    return { value: v, raw: t };
  };

  const convertElement = (el, kind) => {
    if (!el) return;

    // Idempotence: if we already converted THIS element, skip.
    if (el.dataset.rym10Done === "1") return;

    const rawText = (el.textContent || "").trim();
    if (!rawText) return;

    // If it already clearly looks like a /10 display, skip.
    if (rawText.includes("/10")) return;

    const parsed = parseMaybe5(rawText);
    if (!parsed) return;

    el.dataset.rym10Done = "1";
    el.dataset.rymOriginal5 = parsed.raw;

    if (kind === "max") {
      // Max is always 5.x → 10.x
      el.textContent = format2(10);
      return;
    }

    // Normal rating value (avg, friends, etc.)
    const converted =
      kind === "track"
        ? format1(parsed.value * 2)
        : kind === "user"
          ? format1(parsed.value * 2)
          : format2(parsed.value * 2);
    el.textContent = converted;

    const prevTitle = el.getAttribute("title");
    const hint = `Original: ${format2(parsed.value)}/5`;
    el.setAttribute("title", prevTitle ? `${prevTitle} • ${hint}` : hint);
  };

  // Convert direct targets
  const convertTargets = () => {
    for (const t of TARGETS) {
      document.querySelectorAll(t.selector).forEach((el) => convertElement(el, t.kind));
    }
  };

  // Convert nested max rating (the "5.0" next to slash) WITHOUT breaking layout:
  // Only touch leaf elements inside .max_rating that contain just the number.
  const convertMaxRating = () => {
    document.querySelectorAll(MAX_RATING_CONTAINER).forEach((container) => {
      // If container itself is leaf, convert it
      if (container.children.length === 0) convertElement(container, "max");

      // Convert leaf descendants
      container.querySelectorAll("*").forEach((el) => {
        if (el.children.length === 0) convertElement(el, "max");
      });
    });
  };

  // Convert tracklist ratings (right side of each track row)
  // Again: only touch leaf elements inside the track stats container.
  const convertTracklistRatings = () => {
    document.querySelectorAll(TRACK_STATS_CONTAINER).forEach((container) => {
      if (container.children.length === 0) convertElement(container, "track");
      container.querySelectorAll("*").forEach((el) => {
        if (el.children.length === 0) convertElement(el, "track");
      });
    });
  };

  const restoreAll = () => {
    document
      .querySelectorAll("[data-rym10-done='1'], [data-rym10done='1']")
      .forEach((el) => {
        // Support either attribute casing if you ever changed it; your code uses rym10Done
        const original = el.dataset.rymOriginal5;
        if (!original) return;

        // Put back the original text
        el.textContent = original;

        // Clear marker so it can be converted again later
        delete el.dataset.rym10Done;
        delete el.dataset.rymOriginal5;

        // Optional: clean title hint if you want; safest is to leave existing title alone
      });
  };

  const run = () => {
    if (!ENABLED) return;
    convertTargets();
    convertMaxRating();
    convertTracklistRatings();
  };

  // Initial run
  (async () => {
    ENABLED = await loadEnabled();

    if (ENABLED) run();
    console.log(`${EXT_TAG} enabled=${ENABLED}`);

    // React to popup changes live
    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync") return;
        if (!changes.enabled) return;

        ENABLED = !!changes.enabled.newValue;

        if (!ENABLED) restoreAll();
        else run();
      });
    }
  })();

  // Dynamic updates
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (ENABLED) run();
    });
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
