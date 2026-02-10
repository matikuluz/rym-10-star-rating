const DEFAULTS = { enabled: true };

const getSettings = () =>
  new Promise((resolve) => chrome.storage.sync.get(DEFAULTS, resolve));

const setSettings = (patch) =>
  new Promise((resolve) => chrome.storage.sync.set(patch, resolve));

(async () => {
  const enabledEl = document.getElementById("enabled");
  const s = await getSettings();

  enabledEl.checked = !!s.enabled;

  enabledEl.addEventListener("change", async () => {
    await setSettings({ enabled: enabledEl.checked });
  });
})();
