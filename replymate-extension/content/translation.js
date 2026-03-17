/**
 * ReplyMate Translation Panel
 * Lightweight translation feature for Gmail UI.
 * Uses existing app language as target. No auto-translate; all actions are user-initiated.
 */
(function () {
  "use strict";

  // Only run in main Gmail frame
  if (typeof window !== "undefined" && window !== window.top) return;

  const TRANSLATION_ICON_ID = "replymate-translation-icon";
  const TRANSLATION_PANEL_ID = "replymate-translation-panel";
  const TRANSLATION_TOAST_ID = "replymate-translation-toast";
  const BACKEND_BASE = "https://replymate-backend-bot8.onrender.com";

  /**
   * Get the most recent email message from Gmail thread (DOM parsing).
   */
  function getLatestMessage() {
    try {
      const ctx = typeof extractThreadContext === "function" ? extractThreadContext() : null;
      return (ctx && ctx.latestMessage) ? String(ctx.latestMessage).trim() : "";
    } catch (e) {
      console.warn("[ReplyMate Translation] getLatestMessage error:", e);
      return "";
    }
  }

  /**
   * Get content from Gmail reply textarea (AI-generated reply).
   */
  function getReplyText() {
    try {
      const editor = typeof findActiveReplyEditor === "function" ? findActiveReplyEditor() : null;
      if (!editor || !(editor instanceof HTMLElement)) return "";
      const text = (editor.innerText || editor.textContent || "").trim();
      return text;
    } catch (e) {
      console.warn("[ReplyMate Translation] getReplyText error:", e);
      return "";
    }
  }

  // Use gmail.js detectLanguage when available (same content script context)
  const _gmailDetectLanguage = typeof detectLanguage === "function" ? detectLanguage : null;

  /**
   * Detect language from text. Uses existing detectLanguage from gmail.js when available.
   */
  function detectLanguageForTranslation(text) {
    if (!text || typeof text !== "string") return "english";
    if (_gmailDetectLanguage) return _gmailDetectLanguage(text);
    const lowerText = text.toLowerCase();
    if (/[가-힣ㅋㅌㅎㅏ-ㅑㅒㅓㅔㅕㅟㅠㅢㅣㅡㅢㅥㅤㅦㅨㅧㅮㅯㅰㅱㅲㅴㅶㅷㅇㅈㅏㅑㅓㅒㅔㅕㅟㅠㅢㅣㅡㅢㅥㅤㅦㅨㅧㅮㅯㅰㅱㅲㅴㅶㅷㅇ]/.test(text)) return "korean";
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "japanese";
    if (/[ñáéíóúü]/.test(lowerText) || /\b(gracias|por favor|que|para|con|estoy|tengo|hola|buenos|días|noche|favor)\b/i.test(lowerText)) return "spanish";
    return "english";
  }

  /**
   * Map app language to API target code.
   */
  function mapToTargetCode(lang) {
    const m = { english: "en", korean: "ko", japanese: "ja", spanish: "es" };
    return m[lang] || "en";
  }

  /**
   * Call translation API.
   */
  async function translateText(text, targetLang) {
    const token = typeof getAccessToken === "function" ? await getAccessToken() : null;
    if (!token) throw new Error("Sign in required");
    const targetCode = typeof targetLang === "string" ? mapToTargetCode(targetLang) : mapToTargetCode("english");
    const res = await fetch(`${BACKEND_BASE}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, targetLang: targetCode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Translation failed");
    return data.translated || "";
  }

  /**
   * Show temporary toast message.
   */
  function showToast(message) {
    let toast = document.getElementById(TRANSLATION_TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TRANSLATION_TOAST_ID;
      toast.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:2147483647;opacity:0;transition:opacity 0.2s;pointer-events:none;";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";
    setTimeout(() => { toast.style.opacity = "0"; }, 1500);
  }

  /**
   * Copy text to clipboard.
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    }
  }

  /**
   * Create and inject the translation panel UI.
   */
  function createPanel() {
    if (document.getElementById(TRANSLATION_PANEL_ID)) return document.getElementById(TRANSLATION_PANEL_ID);

    const panel = document.createElement("div");
    panel.id = TRANSLATION_PANEL_ID;
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 420px;
      max-width: 95vw;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 2147483646;
      font-family: 'Google Sans', Roboto, sans-serif;
      font-size: 14px;
      overflow: hidden;
      display: none;
    `;

    panel.innerHTML = `
      <div style="padding:16px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:600;color:#1f1f1f;">ReplyMate Translate</span>
        <button id="replymate-translate-close" style="background:none;border:none;cursor:pointer;font-size:18px;color:#5f6368;padding:4px;">&times;</button>
      </div>
      <div style="padding:16px;">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <button id="replymate-translate-latest" style="padding:10px 14px;background:#7943f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;text-align:left;">Translate latest message</button>
          <button id="replymate-translate-reply" style="padding:10px 14px;background:#7943f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;text-align:left;">Translate reply</button>
          <div>
            <textarea id="replymate-translate-input" placeholder="Paste text to translate..." rows="3" style="width:100%;padding:10px 12px;border:1px solid #dadce0;border-radius:8px;font-size:14px;box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>
            <button id="replymate-translate-manual" style="margin-top:8px;padding:10px 14px;background:#7943f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Translate</button>
          </div>
          <div id="replymate-translate-result" style="min-height:80px;padding:12px;border:1px solid #e8eaed;border-radius:8px;background:#f8f9fa;white-space:pre-wrap;word-break:break-word;font-size:13px;color:#202124;"></div>
          <div style="display:flex;gap:8px;">
            <button id="replymate-translate-copy" style="padding:8px 14px;background:#e8eaed;color:#3c4043;border:none;border-radius:8px;cursor:pointer;font-size:13px;">Copy</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    return panel;
  }

  /**
   * Update panel labels with current language.
   */
  async function updatePanelLabels(panel) {
    const lang = typeof getCurrentLanguage === "function" ? await getCurrentLanguage() : "english";
    const t = (key) => (typeof getTranslation === "function" ? getTranslation(key, lang) : key);

    const els = {
      latest: document.getElementById("replymate-translate-latest"),
      reply: document.getElementById("replymate-translate-reply"),
      manual: document.getElementById("replymate-translate-manual"),
      input: document.getElementById("replymate-translate-input"),
      copy: document.getElementById("replymate-translate-copy"),
      close: document.getElementById("replymate-translate-close")
    };

    if (els.latest) els.latest.textContent = t("translateLatestMessage");
    if (els.reply) els.reply.textContent = t("translateReply");
    if (els.manual) els.manual.textContent = t("translateManual");
    if (els.input) els.input.placeholder = t("translateInputPlaceholder");
    if (els.copy) els.copy.textContent = t("translateCopy");
    if (els.close) els.close.title = t("translateClose");
  }

  /**
   * Set result area content.
   */
  function setResult(panel, text, isError = false) {
    const el = panel && panel.querySelector("#replymate-translate-result");
    if (el) {
      el.textContent = text || "";
      el.style.color = isError ? "#d93025" : "#202124";
    }
  }

  /**
   * Run translation flow: detect language, skip if same, else translate.
   */
  async function runTranslateFlow(sourceText, panel) {
    if (!sourceText || !sourceText.trim()) {
      setResult(panel, "");
      return;
    }

    const lang = typeof getCurrentLanguage === "function" ? await getCurrentLanguage() : "english";
    const t = (key) => (typeof getTranslation === "function" ? getTranslation(key, lang) : key);

    const detected = detectLanguageForTranslation(sourceText);
    if (detected === lang) {
      setResult(panel, t("alreadyInYourLanguage"));
      return;
    }

    setResult(panel, "...");
    try {
      const translated = await translateText(sourceText, lang);
      setResult(panel, translated);
    } catch (err) {
      setResult(panel, t("translateError") + (err.message || String(err)), true);
    }
  }

  /**
   * Initialize translation UI: icon + panel + handlers.
   */
  async function init() {
    if (document.getElementById(TRANSLATION_ICON_ID)) return;

    const icon = document.createElement("button");
    icon.id = TRANSLATION_ICON_ID;
    icon.innerHTML = "&#x1F4DD;";
    icon.title = "ReplyMate Translate";
    icon.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #7943f1;
      color: #fff;
      border: none;
      font-size: 22px;
      cursor: pointer;
      z-index: 2147483645;
      box-shadow: 0 2px 12px rgba(121,67,241,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    icon.addEventListener("mouseenter", () => {
      icon.style.background = "#b794f6";
      icon.style.transform = "scale(1.05)";
    });
    icon.addEventListener("mouseleave", () => {
      icon.style.background = "#7943f1";
      icon.style.transform = "scale(1)";
    });

    const panel = createPanel();
    await updatePanelLabels(panel);

    icon.addEventListener("click", async () => {
      const isVisible = panel.style.display === "block";
      panel.style.display = isVisible ? "none" : "block";
      if (!isVisible) await updatePanelLabels(panel);
    });

    document.getElementById("replymate-translate-close").addEventListener("click", () => {
      panel.style.display = "none";
    });

    document.getElementById("replymate-translate-latest").addEventListener("click", async () => {
      const text = getLatestMessage();
      const lang = typeof getCurrentLanguage === "function" ? await getCurrentLanguage() : "english";
      const t = (key) => (typeof getTranslation === "function" ? getTranslation(key, lang) : key);
      if (!text) {
        setResult(panel, t("noMessageFound"));
        return;
      }
      await runTranslateFlow(text, panel);
    });

    document.getElementById("replymate-translate-reply").addEventListener("click", async () => {
      const lang = typeof getCurrentLanguage === "function" ? await getCurrentLanguage() : "english";
      const t = (key) => (typeof getTranslation === "function" ? getTranslation(key, lang) : key);
      const text = getReplyText();
      if (!text) {
        setResult(panel, t("noReplyFound"));
        return;
      }
      await runTranslateFlow(text, panel);
    });

    document.getElementById("replymate-translate-manual").addEventListener("click", async () => {
      const input = document.getElementById("replymate-translate-input");
      const text = (input && input.value) ? String(input.value).trim() : "";
      await runTranslateFlow(text, panel);
    });

    document.getElementById("replymate-translate-copy").addEventListener("click", async () => {
      const resultEl = panel.querySelector("#replymate-translate-result");
      const text = resultEl ? resultEl.textContent : "";
      if (!text) return;
      const lang = typeof getCurrentLanguage === "function" ? await getCurrentLanguage() : "english";
      const t = (key) => (typeof getTranslation === "function" ? getTranslation(key, lang) : key);
      await copyToClipboard(text);
      showToast(t("copied"));
    });

    document.body.appendChild(icon);
  }

  // Expose for tests / reuse
  window.ReplyMateTranslation = {
    getLatestMessage,
    getReplyText,
    detectLanguage: detectLanguageForTranslation,
    translateText,
    copyToClipboard,
    showToast
  };

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1500));
  } else {
    setTimeout(init, 1500);
  }
})();
