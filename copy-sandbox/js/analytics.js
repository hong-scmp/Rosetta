/*
 * Copy Sandbox — analytics (GoatCounter, privacy-friendly, cookie-free)
 * -------------------------------------------------------------------
 * SETUP (one-time):
 *   1. Sign up free at https://www.goatcounter.com/  (pick a code, e.g. "scmp-copy-sandbox")
 *   2. Put your endpoint below — it's  https://<your-code>.goatcounter.com/count
 *   3. Commit & push. Done — every page counts visits, and the buttons fire
 *      "used it" events you can see under Dashboard → Events.
 *
 * Until GC_ENDPOINT is filled in, this file is a no-op (nothing is tracked
 * and nothing external is loaded), so it's safe to ship as-is.
 */
var GC_ENDPOINT = ""; // e.g. "https://scmp-copy-sandbox.goatcounter.com/count"

(function () {
  if (!GC_ENDPOINT) return; // analytics stays off until configured
  var s = document.createElement("script");
  s.async = true;
  s.src = "//gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", GC_ENDPOINT);
  document.head.appendChild(s);
})();

// Fire a custom event (e.g. "png-paywall", "edit-subscription").
// No-op until GoatCounter is configured and loaded.
window.csTrack = function (name) {
  try {
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: name, title: name, event: true });
    }
  } catch (e) {}
};
