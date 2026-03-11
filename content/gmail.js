console.log("ReplyMate Gmail script loaded");

// Keys used by the popup UI (chrome.storage.local).
const REPLYMATE_TONE_KEY = "replymateTone";
const REPLYMATE_LENGTH_KEY = "replymateLength";
const REPLYMATE_USER_NAME_KEY = "replymateUserName";

// Default values if nothing has been saved yet.
const DEFAULT_TONE = "polite";
const DEFAULT_LENGTH = "medium";

// Load tone/length/name settings saved by the popup.
function loadReplyMateSettings() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(
        [REPLYMATE_TONE_KEY, REPLYMATE_LENGTH_KEY, REPLYMATE_USER_NAME_KEY],
        (result) => {
        const tone = result?.[REPLYMATE_TONE_KEY] || DEFAULT_TONE;
        const length = result?.[REPLYMATE_LENGTH_KEY] || DEFAULT_LENGTH;
          const userName = result?.[REPLYMATE_USER_NAME_KEY] || "";
          resolve({ tone, length, userName });
        }
      );
    } catch {
      // If chrome.storage isn't available for any reason, fall back to defaults.
      resolve({ tone: DEFAULT_TONE, length: DEFAULT_LENGTH, userName: "" });
    }
  });
}

// Generate a sample reply based on tone + length.
function generateReplyText({ tone, length }) {
  const t = (tone || DEFAULT_TONE).toLowerCase();
  const l = (length || DEFAULT_LENGTH).toLowerCase();

  const greetings = {
    professional: "Hello,",
    polite: "Hello,",
    friendly: "Hi there,",
  };

  const signoffs = {
    professional: ["Sincerely,", "Taeyun"],
    polite: ["Best regards,", "Taeyun"],
    friendly: ["Thanks again,", "Taeyun"],
  };

  const bodiesByToneAndLength = {
    professional: {
      short: ["Thank you for your email. I will follow up soon."],
      medium: [
        "Thank you for your email.",
        "I have received your message and will follow up with you soon.",
      ],
      long: [
        "Thank you for your email.",
        "I have received your message and will review the details.",
        "I will follow up with you soon with next steps.",
      ],
    },
    polite: {
      short: ["Thank you for your email. I will get back to you soon."],
      medium: [
        "Thank you for your email.",
        "I will get back to you soon.",
      ],
      long: [
        "Thank you for your email.",
        "I appreciate you reaching out.",
        "I will get back to you soon once I’ve had a chance to review this.",
      ],
    },
    friendly: {
      short: ["Thanks for your email! I’ll get back to you soon."],
      medium: [
        "Thanks for your email!",
        "I’ll get back to you soon.",
      ],
      long: [
        "Thanks for your email!",
        "I really appreciate the note.",
        "I’ll get back to you soon after I take a quick look at the details.",
      ],
    },
  };

  const greeting = greetings[t] || greetings[DEFAULT_TONE];
  const bodyLines =
    bodiesByToneAndLength[t]?.[l] ||
    bodiesByToneAndLength[DEFAULT_TONE][DEFAULT_LENGTH];
  const signoffLines = signoffs[t] || signoffs[DEFAULT_TONE];

  return [greeting, "", ...bodyLines, "", ...signoffLines].join("\n");
}


// Finds the reply editor associated with a clicked ReplyMate button.
function findEditorForButton(button) {
  // Reply editors typically live inside the opened conversation thread area.
  // We first try to stay within the same conversation / reply container as the button.
  const replyContainer =
    button.closest("div[aria-label='Message Body']") ||
    button.closest("div[role='region']") ||
    button.closest("div[role='dialog']") ||
    button.parentElement;

  if (!replyContainer) return null;

  return replyContainer.querySelector(
    'div[aria-label="Message Body"], div[role="textbox"][g_editable="true"]'
  );
}

// Heuristic: determine whether a given editor looks like a REPLY editor
// (in an opened email thread) rather than a standalone "New message" compose window.
function isReplyEditor(editor) {
  const dialog = editor.closest("div[role='dialog']");

  if (dialog) {
    // For this project, we want to focus on reply areas inside opened threads,
    // and avoid standalone compose dialogs as much as possible.
    return false;
  }

  // Inline reply areas often live directly inside the conversation region.
  const conversationRegion = editor.closest("div[role='region']");
  if (conversationRegion) {
    return true;
  }

  // Fallback: treat as non-reply to avoid over-injecting.
  return false;
}

function createReplyMateButton() {
  const button = document.createElement("button");
  button.textContent = "AI Reply";
  button.className = "replymate-generate-button";

  button.style.marginLeft = "8px";
  button.style.padding = "6px 10px";
  button.style.backgroundColor = "#1a73e8";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "6px";
  button.style.cursor = "pointer";
  button.style.fontSize = "12px";

  // When clicked, load settings and insert a generated reply into the correct editor.
  button.addEventListener("click", async (event) => {
    const targetButton = event.currentTarget;
    const editor = findEditorForButton(targetButton);
    if (!editor) {
      return;
    }

    const settings = await loadReplyMateSettings();
    const replyText = generateReplyText(settings);
    insertReplyIntoEditor(editor, replyText);
  });

  return button;
}

// Insert the provided reply text into a Gmail rich-text editor (contenteditable).
function insertReplyIntoEditor(editor, replyText) {
  if (!(editor instanceof HTMLElement)) return;

  const safeText = typeof replyText === "string" ? replyText : "";

  // Convert text into HTML with <br> to preserve line breaks.
  const html = safeText
    .split("\n")
    .map((line) => {
      if (line === "") return "<br>";
      return line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    })
    .join("<br>");

  editor.focus();
  editor.innerHTML = html;

  // Trigger input/change so Gmail notices the content update.
  editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
  editor.dispatchEvent(new Event("change", { bubbles: true }));
}

// Extract information about the currently opened Gmail thread (subject, messages, names).
// This is a best-effort DOM scrape and falls back safely if elements are not found.
function extractThreadContext() {
  try {
    const main = document.querySelector("div[role='main']") || document.body;

    // Subject: Gmail usually renders it with class "hP" inside the thread header.
    let subject = "";
    let subjectEl =
      main.querySelector("h2.hP") ||
      main.querySelector("h1.hP") ||
      main.querySelector("h2[role='heading']") ||
      main.querySelector("h1[role='heading']");

    if (subjectEl && subjectEl.textContent) {
      subject = subjectEl.textContent.trim();
    }

    // Collect visible message containers in the thread.
    const rawContainers = Array.from(
      main.querySelectorAll("div[data-message-id], div[role='listitem'], div[role='article']")
    );

    const visibleMessages = [];

    for (const container of rawContainers) {
      if (!(container instanceof HTMLElement)) continue;
      if (container.offsetParent === null) continue;

      // Approximate message body: Gmail often uses div[dir="ltr"] for content.
      const bodyEl = container.querySelector("div[dir='ltr']") || container;
      const text = (bodyEl.innerText || bodyEl.textContent || "").trim();

      if (!text) continue;

      visibleMessages.push({
        container,
        text,
      });
    }

    let latestMessage = "";
    let previousMessages = [];
    let recipientName = "";

    if (visibleMessages.length > 0) {
      const latest = visibleMessages[visibleMessages.length - 1];
      latestMessage = latest.text;

      // Up to 3 previous messages, in chronological order.
      const prev = visibleMessages
        .slice(Math.max(0, visibleMessages.length - 4), visibleMessages.length - 1)
        .map((item) => item.text);
      previousMessages = prev;

      // Try to find a display name near the latest message.
      const nameElInLatest =
        latest.container.querySelector("span[email]") ||
        latest.container.querySelector("span[role='link'][tabindex='-1']");

      if (nameElInLatest && nameElInLatest.textContent) {
        recipientName = nameElInLatest.textContent.trim();
      }
    }

    // Fallback: try to find any visible sender/recipient name in the thread.
    if (!recipientName) {
      const anyNameEl =
        main.querySelector("span[email]") ||
        main.querySelector("span[role='link'][tabindex='-1']");
      if (anyNameEl && anyNameEl.textContent) {
        recipientName = anyNameEl.textContent.trim();
      }
    }

    return {
      subject: subject || "",
      latestMessage: latestMessage || "",
      previousMessages: previousMessages || [],
      recipientName: recipientName || "",
    };
  } catch {
    // Always return a safe object even if the DOM structure is unexpected.
    return {
      subject: "",
      latestMessage: "",
      previousMessages: [],
      recipientName: "",
    };
  }
}

// Small polling helper for dynamic Gmail UI: repeatedly tries `getValue()` until
// it returns a truthy value or times out.
function poll(getValue, { timeoutMs = 8000, intervalMs = 200 } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();

    const tick = () => {
      let value = null;
      try {
        value = getValue();
      } catch {
        value = null;
      }

      if (value) {
        resolve(value);
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }

      setTimeout(tick, intervalMs);
    };

    tick();
  });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  function scrollMainThreadDown() {
    const main = document.querySelector("div[role='main']");
    if (!main) return;
  
    // Gmail 읽기 화면을 아래로 조금씩 내려서 Reply 버튼이 보이게 유도
    main.scrollBy({
      top: 800,
      left: 0,
      behavior: "instant",
    });
  }
  
  function getVisibleReplyCandidates() {
    const main = document.querySelector("div[role='main']") || document.body;
  
    const candidates = Array.from(
      main.querySelectorAll("div[role='button'], span[role='button'], td[role='button'], button, span, div")
    );
  
    return candidates.filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.offsetParent === null) return false;
  
      const ariaLabel = (el.getAttribute("aria-label") || "").trim().toLowerCase();
      const dataTooltip = (el.getAttribute("data-tooltip") || "").trim().toLowerCase();
      const text = (el.textContent || "").trim().toLowerCase();
  
      const looksLikeReply =
        ariaLabel === "reply" ||
        ariaLabel.startsWith("reply") ||
        dataTooltip === "reply" ||
        dataTooltip.startsWith("reply") ||
        text === "reply";
  
      if (!looksLikeReply) return false;
  
      const looksWrong =
        ariaLabel.includes("forward") ||
        ariaLabel.includes("reply all") ||
        dataTooltip.includes("forward") ||
        dataTooltip.includes("reply all") ||
        text === "forward" ||
        text === "reply all";
  
      if (looksWrong) return false;
  
      return true;
    });
  }

// Find a "Reply" action button in the currently opened thread view.
// Gmail is heavily dynamic, so we try a few reasonable selectors.
function findReplyButtonInThread() {
    const candidates = getVisibleReplyCandidates();
  
    if (!candidates.length) return null;
  
    // 화면 아래쪽에 있는 Reply 버튼이 실제로 우리가 원하는 inline reply일 가능성이 큼
    candidates.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectB.top - rectA.top; // 더 아래에 있는 버튼 우선
    });
  
    return candidates[0] || null;
  }

  function clickElementLikeUser(element) {
    if (!(element instanceof Element)) return;
  
    const eventInit = { bubbles: true, cancelable: true, view: window };
  
    element.dispatchEvent(new MouseEvent("mouseover", eventInit));
    element.dispatchEvent(new MouseEvent("mousedown", eventInit));
    element.dispatchEvent(new MouseEvent("mouseup", eventInit));
    element.dispatchEvent(new MouseEvent("click", eventInit));
  }

// Find the reply editor that appears after clicking Reply.
function findActiveReplyEditor() {
  const main = document.querySelector("div[role='main']") || document.body;
  const editors = main.querySelectorAll(
    'div[aria-label="Message Body"], div[role="textbox"][g_editable="true"]'
  );

  for (const editor of editors) {
    if (!(editor instanceof HTMLElement)) continue;
    if (editor.offsetParent === null) continue;
    if (!isReplyEditor(editor)) continue;
    return editor;
  }

  return null;
}

// ------------------------------
// Inbox / message list hover UI
// ------------------------------

// Class name used for the hover button so we can avoid duplicates.
const REPLYMATE_HOVER_BUTTON_CLASS = "replymate-hover-generate-button";

// Try to identify a Gmail message list row in a safe, conservative way.
// Gmail commonly uses either:
// - `tr.zA` rows (legacy table layout), or
// - `div[role="row"]` inside `div[role="grid"]` (newer layouts)
function findMessageListRowFromTarget(target) {
  if (!(target instanceof Element)) return null;

  const legacyRow = target.closest("tr.zA");
  if (legacyRow) return legacyRow;

  const ariaRow = target.closest("div[role='row']");
  if (ariaRow && ariaRow.closest("div[role='grid']")) return ariaRow;

  return null;
}



// Safely open the email thread for a given row by simulating a user click.
// Gmail sometimes relies on mouse events rather than just calling `.click()`.
function openThreadForRow(row) {
  if (!(row instanceof Element)) return;

  // Prefer a direct link if one exists (more deterministic than clicking the whole row).
  const links = row.querySelectorAll("a[href]");
  for (const link of links) {
    const href = link.getAttribute("href") || "";

    // Gmail thread links typically use a hash route (e.g. "/mail/u/0/#inbox/...").
    // Avoid mailto and other non-navigation links that might exist in the row.
    if (href.includes("#") && !href.startsWith("mailto:")) {
      link.click();
      return;
    }
  }

  // Fallback: dispatch a small sequence of mouse events on the row.
  const eventInit = { bubbles: true, cancelable: true, view: window };
  row.dispatchEvent(new MouseEvent("mousedown", eventInit));
  row.dispatchEvent(new MouseEvent("mouseup", eventInit));
  row.dispatchEvent(new MouseEvent("click", eventInit));
}

// Full workflow for the hover button:
// 1) open the email thread
// 2) wait for thread UI, find & click Reply
// 3) wait for reply editor
// 4) insert the sample reply
async function runHoverGenerateReplyWorkflow(row) {
    if (!(row instanceof Element)) return;
  
    if (row.dataset.replymateWorkflowRunning === "1") return;
    row.dataset.replymateWorkflowRunning = "1";
  
    try {
      openThreadForRow(row);
  
      // 메일 열리는 시간 잠깐 대기
      await sleep(1200);
  
      // Reply 버튼이 스레드 아래쪽에 있을 수 있어서 스크롤 보정
      for (let i = 0; i < 4; i++) {
        scrollMainThreadDown();
        await sleep(400);
      }
  
      const replyButton = await poll(() => {
        scrollMainThreadDown();
        return findReplyButtonInThread();
      }, {
        timeoutMs: 12000,
        intervalMs: 400,
      });
  
      if (!replyButton) {
        console.log("[ReplyMate] Reply button not found");
        return;
      }
  
      console.log("[ReplyMate] Reply button found:", replyButton);
  
      // 화면에 잘 보이게 한 뒤 클릭
      replyButton.scrollIntoView({
        behavior: "instant",
        block: "center",
        inline: "nearest",
      });
  
      await sleep(300);
      clickElementLikeUser(replyButton);
  
      const replyEditor = await poll(() => findActiveReplyEditor(), {
        timeoutMs: 12000,
        intervalMs: 300,
      });
  
      if (!replyEditor) {
        console.log("[ReplyMate] Reply editor not found");
        return;
      }
  
      console.log("[ReplyMate] Reply editor found:", replyEditor);
  
      replyEditor.scrollIntoView({
        behavior: "instant",
        block: "center",
        inline: "nearest",
      });
  
      await sleep(200);

      // Load user settings (tone, length, and user name).
      const settings = await loadReplyMateSettings();

      // Extract context from the currently opened Gmail thread.
      const threadContext = extractThreadContext();

      // Build the payload that would be sent to an AI backend.
      const payload = {
        subject: threadContext.subject || "",
        latestMessage: threadContext.latestMessage || "",
        recipientName: threadContext.recipientName || "",
        userName: settings.userName || "",
        tone: settings.tone || DEFAULT_TONE,
        length: settings.length || DEFAULT_LENGTH,
      };

      // Only include previousMessages when we actually have some.
      if (Array.isArray(threadContext.previousMessages) && threadContext.previousMessages.length > 0) {
        payload.previousMessages = threadContext.previousMessages;
      }

      console.log("[ReplyMate payload]", payload);

      // For now, still insert a locally generated sample reply.
      const replyText = generateReplyText(settings);
      insertReplyIntoEditor(replyEditor, replyText);
    } finally {
      row.dataset.replymateWorkflowRunning = "0";
    }
  }
  
  function createHoverGenerateButton(row) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "AI Reply";
    button.className = REPLYMATE_HOVER_BUTTON_CLASS;

    button.style.padding = "4px 10px";
    button.style.backgroundColor = "#1a73e8";
    button.style.color = "white";
    button.style.border = "none";
    button.style.borderRadius = "6px";
    button.style.cursor = "pointer";
    button.style.fontSize = "12px";
    button.style.lineHeight = "1";
    button.style.height = "28px";
    button.style.whiteSpace = "nowrap";

    button.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      runHoverGenerateReplyWorkflow(row);
    });

    return button;
  }

  function findVisibleRightSideControls(row) {
    if (!(row instanceof Element)) return [];
  
    const rowRect = row.getBoundingClientRect();
    const actionZoneStart = rowRect.left + rowRect.width * 0.45;
  
    const candidates = Array.from(
      row.querySelectorAll(
        "[role='button'], button, a, span[role='button'], span[role='link'], div[role='button']"
      )
    );
  
    return candidates.filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.offsetParent === null) return false;
      if (el.classList.contains(REPLYMATE_HOVER_BUTTON_CLASS)) return false;
  
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
  
      // See reply / Unsubscribe 같은 큰 버튼도 허용
      if (rect.width > 260 || rect.height > 80) return false;
  
      // 오른쪽 액션 영역만 보기
      if (rect.right < actionZoneStart) return false;
  
      const text = (el.textContent || "").trim();
  
      // 긴 제목/본문 snippet 제외
      const looksLikeLongMessageText =
        text.length > 40 && rect.left < rowRect.left + rowRect.width * 0.75;
  
      if (looksLikeLongMessageText) return false;
  
      return true;
    });
  }

  function findVisibleDefaultGmailActionControls(row) {
    if (!(row instanceof Element)) return [];
  
    const selectors = [
      "[aria-label='Archive']",
      "[data-tooltip='Archive']",
      "[aria-label='Delete']",
      "[data-tooltip='Delete']",
      "[aria-label='Snooze']",
      "[data-tooltip='Snooze']",
      "[aria-label='Mark as read']",
      "[data-tooltip='Mark as read']",
      "[aria-label='Mark as unread']",
      "[data-tooltip='Mark as unread']",
      "[aria-label='Move to']",
      "[data-tooltip='Move to']",
      "[aria-label='Labels']",
      "[data-tooltip='Labels']"
    ];
  
    return selectors
      .flatMap((selector) => Array.from(row.querySelectorAll(selector)))
      .filter((el) => el instanceof HTMLElement && el.offsetParent !== null);
  }
  
  function positionHoverButton(row, button) {
    let controls = findVisibleRightSideControls(row);
  
    // 부가 버튼 포함 일반 탐지 실패 시, Gmail 기본 아이콘만 따로 탐지
    if (controls.length === 0) {
      controls = findVisibleDefaultGmailActionControls(row);
    }
  
    if (controls.length > 0) {
      const rowRect = row.getBoundingClientRect();
  
      const leftmost = controls.reduce((minEl, el) => {
        const rect = el.getBoundingClientRect();
        const minRect = minEl.getBoundingClientRect();
        return rect.left < minRect.left ? el : minEl;
      });
  
      const leftmostRect = leftmost.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
  
      const gap = 10;
      let left = leftmostRect.left - rowRect.left - buttonRect.width - gap;
      let top =
        leftmostRect.top -
        rowRect.top +
        (leftmostRect.height - buttonRect.height) / 2;
  
      left = Math.max(8, left);
      top = Math.max(4, top);
  
      button.style.left = `${left}px`;
      button.style.top = `${top}px`;
      button.style.right = "auto";
      button.style.transform = "none";
  
      return true;
    }
  
    return false;
  }

  function showHoverButtonForRow(row) {
    if (!(row instanceof Element)) return;
    if (row.querySelector(`.${REPLYMATE_HOVER_BUTTON_CLASS}`)) return;
  
    const button = createHoverGenerateButton(row);
  
    const computed = window.getComputedStyle(row);
    if (computed.position === "static") {
      row.style.position = "relative";
    }
  
    button.style.position = "absolute";
    button.style.visibility = "hidden";
    button.style.zIndex = "9999";
    button.style.transform = "none";
    row.appendChild(button);
  
    let attempts = 0;
    const maxAttempts = 16;
  
    const tryPlace = () => {
      // row에서 버튼이 이미 사라졌으면 중단
      if (!document.body.contains(button)) return;
  
      const positioned = positionHoverButton(row, button);
  
      if (positioned) {
        button.style.visibility = "visible";
        return;
      }
  
      attempts += 1;
  
      if (attempts < maxAttempts) {
        setTimeout(tryPlace, 50);
        return;
      }
  
      // fallback
      button.style.right = "24px";
      button.style.top = "50%";
      button.style.left = "auto";
      button.style.transform = "translateY(-50%)";
      button.style.visibility = "visible";
    };
  
    tryPlace();
  }
  
  function hideHoverButtonForRow(row) {
    if (!(row instanceof Element)) return;
  
    const existingButton = row.querySelector(`.${REPLYMATE_HOVER_BUTTON_CLASS}`);
    if (existingButton) {
      existingButton.remove();
    }
  }  

// Use event delegation so we don't have to attach listeners to every row instance.
// `mouseover` / `mouseout` bubble, which makes them ideal for delegation.
function setupMessageListHoverHandlers() {
  if (window.__replymateHoverHandlersInstalled) return;
  window.__replymateHoverHandlersInstalled = true;

  document.addEventListener(
    "mouseover",
    (event) => {
      const row = findMessageListRowFromTarget(event.target);
      if (!row) return;

      // Only treat it as "enter" if the mouse came from outside the row.
      if (event.relatedTarget && row.contains(event.relatedTarget)) return;

      showHoverButtonForRow(row);
    },
    true
  );

  document.addEventListener(
    "mouseout",
    (event) => {
      const row = findMessageListRowFromTarget(event.target);
      if (!row) return;

      // Only treat it as "leave" if the mouse is going outside the row.
      if (event.relatedTarget && row.contains(event.relatedTarget)) return;

      hideHoverButtonForRow(row);
    },
    true
  );
}

// Injects a single ReplyMate button per REPLY editor and avoids duplicates.
function injectButtonIntoComposeAreas() {
  const editors = document.querySelectorAll(
    'div[aria-label="Message Body"], div[role="textbox"][g_editable="true"]'
  );

  editors.forEach((editor) => {
    // Only target editors that look like reply editors, not generic compose.
    if (!isReplyEditor(editor)) {
      return;
    }

    const composeContainer = editor.closest("div[role='dialog']") || editor.parentElement;
    if (!composeContainer) return;

    // Skip if this compose already has a ReplyMate button.
    if (composeContainer.querySelector(".replymate-generate-button")) {
      return;
    }

    const button = createReplyMateButton();

    const buttonWrapper = document.createElement("div");
    buttonWrapper.style.marginTop = "8px";
    buttonWrapper.appendChild(button);

    editor.parentElement.appendChild(buttonWrapper);
  });
}

// Observe the Gmail DOM so that buttons are injected for new compose windows.
const observer = new MutationObserver(() => {
  injectButtonIntoComposeAreas();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial injection for compose editors that already exist on page load.
injectButtonIntoComposeAreas();
setupMessageListHoverHandlers();