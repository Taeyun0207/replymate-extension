/**
 * When auth session changes (popup sign-in/out), refresh mail UI without reloading the tab.
 * - Listens to chrome.storage for session keys (fires in every Gmail/Outlook iframe).
 * - Listens for REPLYMATE_AUTH_STATE_CHANGED from background (backup after popup login).
 */
(function () {
  const SESSION = "replymate_supabase_session";
  const USER = "replymate_auth_user";
  const CACHE = "replymate_usage_cache";

  let handler = null;

  function runHandler() {
    if (typeof handler === "function") {
      try {
        handler();
      } catch (_) {}
    }
  }

  function bustCacheAndRefresh() {
    try {
      chrome.storage.local.remove([CACHE], () => {
        runHandler();
      });
    } catch (_) {
      runHandler();
    }
  }

  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!changes[SESSION] && !changes[USER]) return;
      bustCacheAndRefresh();
    });
  }

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message && message.type === "REPLYMATE_AUTH_STATE_CHANGED") {
        bustCacheAndRefresh();
        sendResponse({ ok: true });
        return true;
      }
      return false;
    });
  }

  const g = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {};
  g.__replyMateSetAuthSyncHandler = function (fn) {
    handler = typeof fn === "function" ? fn : null;
  };
})();
