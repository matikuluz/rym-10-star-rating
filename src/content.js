(() => {
  const EXT_TAG = "[RYM ratings to /10]";

  // Stable selectors (less brittle than full #column_container_right > ... chains)
  const TARGETS = [
    { selector: "span.avg_rating", kind: "value" },
    { selector: "span.avg_rating_friends", kind: "value" },
    { selector: "span.max_rating", kind: "max" },
    { selector: "[id^='rating_num_l_']", kind: "value" }
  ];

  const format = (n, decimals) => {
    const s = n.toFixed(decimals);
    // trim trailing zeros nicely
    return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  };

  const parseMaybe = (txt) => {
    const t = (txt || "").trim();
    // allow "3.42", "5", "5.0", "3.42/5"
    const m = t.match(/^([0-5](?:\.\d{1,2})?)(?:\s*\/\s*5(?:\.0{1,2})?)?$/);
    if (!m) return null;
    const v = Number(m[1]);
    if (!Number.isFinite(v) || v < 0 || v > 5) return null;
    return { value: v, raw: t };
  };

  const convertNodeText = (el, kind) => {
    if (!el || el.dataset.rym10Done === "1") return;

    // Some RYM nodes are nested; read full text but only rewrite the element’s own textContent
    const rawText = (el.textContent || "").trim();
    if (!rawText || rawText.includes("/10")) return;

    const parsed = parseMaybe(rawText);
    if (!parsed) return;

    const decimals = (() => {
      const dot = rawText.indexOf(".");
      if (dot === -1) return 0;
      // keep 1–2 decimals depending on what was shown
      const d = rawText.length - dot - 1;
      return Math.min(Math.max(d, 1), 2);
    })();

    const doubled = parsed.value * 2;

    el.dataset.rym10Done = "1";
    el.dataset.rymOriginal5 = parsed.raw;

    // For max rating, we want 10 (or 10.0 if it was 5.0)
    if (kind === "max") {
      const maxDecimals = decimals; // preserve whether it showed 5 vs 5.0
      el.textContent = format(10, maxDecimals);
      return;
    }

    // For values, show the doubled number. We do NOT force "/10" here because on many pages
    // the "/5" is a separate element (span.max_rating) that we also convert to 10.
    el.textContent = format(doubled, decimals);

    // Helpful hover to confirm
    const prevTitle = el.getAttribute("title");
    const hint = `Original: ${parsed.value}${rawText.includes("/") ? "/5" : ""}`;
    el.setAttribute("title", prevTitle ? `${prevTitle} • ${hint}` : hint);
  };

  const run = () => {
    for (const t of TARGETS) {
      document.querySelectorAll(t.selector).forEach((el) => convertNodeText(el, t.kind));
    }
  };

  run();
  console.log(`${EXT_TAG} conversion active (selector-driven)`);

  // Handle dynamic updates
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
