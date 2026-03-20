/**
 * Runs before the rest of the popup — applies cached theme from sessionStorage.
 * Must be external (MV3 CSP blocks inline scripts in extension pages).
 */
(function () {
  try {
    var ALLOWED = ["basic", "light", "sepia", "rose", "slate", "dark", "basic-dark"];
    var t = sessionStorage.getItem("replymate_popup_theme_cache");
    if (t && ALLOWED.indexOf(t) !== -1) {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {
    /* ignore */
  }
})();
