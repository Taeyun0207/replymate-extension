const TONE_KEY = "replymateTone";
const LENGTH_KEY = "replymateLength";
const USER_NAME_KEY = "replymateUserName";
const LANGUAGE_KEY = "replymateLanguage";
const USAGE_CACHE_KEY = "replymate_usage_cache";
const USAGE_CACHE_TTL = 30000; // 30 seconds

const DEFAULT_TONE = "polite";
const DEFAULT_LENGTH = "medium";
const DEFAULT_LANGUAGE = "english";

// Get or create a persistent ReplyMate user ID (reused from gmail.js)
function getReplyMateUserId() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(["replymate_user_id"], (result) => {
        if (result.replymate_user_id) {
          resolve(result.replymate_user_id);
        } else {
          const newUserId = crypto.randomUUID();
          chrome.storage.local.set({ replymate_user_id: newUserId }, () => {
            resolve(newUserId);
          });
        }
      });
    } catch {
      // Fallback to a simple ID if crypto.randomUUID() or storage fails
      const fallbackId = "fallback_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      resolve(fallbackId);
    }
  });
}

// Get cached usage data if still valid
function getCachedUsage() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([USAGE_CACHE_KEY], (result) => {
        if (result && result[USAGE_CACHE_KEY]) {
          const { data, timestamp } = result[USAGE_CACHE_KEY];
          if (Date.now() - timestamp < USAGE_CACHE_TTL) {
            resolve(data);
            return;
          }
        }
        resolve(null);
      });
    } catch (error) {
      console.warn("[ReplyMate] Failed to get cached usage:", error);
      resolve(null);
    }
  });
}

// Cache usage data with timestamp
function setCachedUsage(usageData) {
  try {
    const cacheData = {
      data: usageData,
      timestamp: Date.now()
    };
    chrome.storage.local.set({ [USAGE_CACHE_KEY]: cacheData });
  } catch (error) {
    console.warn("[ReplyMate] Failed to cache usage:", error);
  }
}

// Shared function to fetch usage from backend
async function fetchUsageFromBackend() {
  try {
    const userId = await getReplyMateUserId();
    
    const response = await fetch("https://replymate-backend-bot8.onrender.com/usage", {
      method: "GET",
      headers: {
        "X-User-ID": userId
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch usage');
    }

    const data = await response.json();
    
    // Cache the fresh data
    setCachedUsage(data);
    
    return data;
  } catch (error) {
    console.error("[ReplyMate] Failed to fetch usage:", error);
    return null;
  }
}

// Shared function to get usage (cache first, then backend)
async function getUsageData() {
  // Try cache first
  const cached = await getCachedUsage();
  if (cached) {
    return cached;
  }
  
  // Fetch fresh data
  return await fetchUsageFromBackend();
}

// Update plan and usage display
function updatePlanUsageDisplay(usageData) {
  const planUsageEl = document.querySelector(".plan-usage");
  
  if (!planUsageEl) return;

  if (!usageData) {
    planUsageEl.textContent = "Usage unavailable";
    return;
  }

  const planNames = {
    'free': 'Free Plan',
    'pro': 'Pro Plan',
    'pro_plus': 'Pro+ Plan'
  };

  const planName = planNames[usageData.plan] || 'Free Plan';
  const limit = usageData.limit; // Only use backend limit, no fallback
  const remaining = usageData.remaining !== undefined ? usageData.remaining : 0;

  // If no limit from backend, don't display anything
  if (limit === undefined) {
    planUsageEl.textContent = "Usage unavailable";
    return;
  }

  planUsageEl.textContent = `${planName} · ${remaining} / ${limit} replies left`;
}

// Update upgrade link based on current plan
function updateUpgradeLink(plan) {
  const upgradeLink = document.getElementById("upgradeLink");
  const upgradeTitle = document.querySelector(".upgrade-title");
  const upgradeBox = document.querySelector(".upgrade-box");
  
  if (!upgradeLink || !upgradeTitle || !upgradeBox) return;

  if (plan === 'pro_plus') {
    upgradeTitle.textContent = "Enjoy your ReplyMate!";
    upgradeLink.textContent = "Manage subscription";
    upgradeBox.style.display = "none"; // Hide upgrade box for highest plan
  } else if (plan === 'pro') {
    upgradeTitle.textContent = "Unlock unlimited replies with Pro+";
    upgradeLink.textContent = "Upgrade to Pro+";
    upgradeBox.style.display = "block";
  } else {
    upgradeTitle.textContent = "Unlock more replies with Pro";
    upgradeLink.textContent = "Upgrade to Pro";
    upgradeBox.style.display = "block";
  }
}

// Listen for usage updates from Gmail content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "USAGE_UPDATED" && message.data) {
    // Update popup display with fresh data from Gmail
    updatePlanUsageDisplay(message.data);
    updateUpgradeLink(message.data.plan);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const toneSelect = document.getElementById("toneSelect");
  const lengthSelect = document.getElementById("lengthSelect");
  const userNameInput = document.getElementById("userNameInput");
  const languageSelect = document.getElementById("languageSelect");
  const saveButton = document.getElementById("saveButton");
  const statusMessage = document.getElementById("statusMessage");
  const upgradeLink = document.getElementById("upgradeLink");

  if (!toneSelect || !lengthSelect || !userNameInput || !languageSelect || !saveButton || !statusMessage) {
    return;
  }

  // Add click handler for upgrade link
  if (upgradeLink) {
    upgradeLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.open("https://replymate.ai/upgrade", "_blank");
    });
  }

  // Load saved values (tone, length, user name, and language) when the popup opens.
  chrome.storage.local.get([TONE_KEY, LENGTH_KEY, USER_NAME_KEY, LANGUAGE_KEY], (result) => {
    const tone = result[TONE_KEY] || DEFAULT_TONE;
    const length = result[LENGTH_KEY] || DEFAULT_LENGTH;
    const userName = result[USER_NAME_KEY] || "";
    const language = result[LANGUAGE_KEY] || DEFAULT_LANGUAGE;

    toneSelect.value = tone;
    lengthSelect.value = length;
    userNameInput.value = userName;
    languageSelect.value = language;
  });

  // Load usage data when popup opens
  loadUsageData();

  // Save all settings together when the user clicks Save.
  saveButton.addEventListener("click", () => {
    const originalText = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = "Saved!";

    const tone = toneSelect.value;
    const length = lengthSelect.value;
    const userName = userNameInput.value || "";
    const language = languageSelect.value;

    chrome.storage.local.set(
      {
        [TONE_KEY]: tone,
        [LENGTH_KEY]: length,
        [USER_NAME_KEY]: userName,
        [LANGUAGE_KEY]: language,
      },
      () => {
        // Reset button after 1 second
        setTimeout(() => {
          saveButton.textContent = originalText;
          saveButton.disabled = false;
        }, 1000);
      }
    );
  });
});

// Load usage data and update UI
async function loadUsageData() {
  const usageData = await getUsageData();
  
  if (usageData) {
    updatePlanUsageDisplay(usageData);
    updateUpgradeLink(usageData.plan);
  } else {
    // Fallback display
    updatePlanUsageDisplay(null);
    updateUpgradeLink('free');
  }
}