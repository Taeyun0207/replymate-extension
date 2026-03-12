const TONE_KEY = "replymateTone";
const LENGTH_KEY = "replymateLength";
const USER_NAME_KEY = "replymateUserName";

const DEFAULT_TONE = "polite";
const DEFAULT_LENGTH = "medium";

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

// Fetch usage data from backend
async function fetchUsageData() {
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
    return data;
  } catch (error) {
    console.error("[ReplyMate] Failed to fetch usage:", error);
    return null;
  }
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

  const planLimits = {
    'free': 50,
    'pro': 300,
    'pro_plus': 1000
  };

  const planName = planNames[usageData.plan] || 'Free Plan';
  const limit = usageData.limit || planLimits[usageData.plan] || 50;
  const remaining = usageData.remaining !== undefined ? usageData.remaining : 0;

  planUsageEl.textContent = `${planName} · ${remaining} / ${limit} replies left`;
}

// Update upgrade link based on current plan
function updateUpgradeLink(plan) {
  const upgradeLink = document.getElementById("upgradeLink");
  const upgradeTitle = document.querySelector(".upgrade-title");
  const upgradeBox = document.querySelector(".upgrade-box");
  
  if (!upgradeLink || !upgradeTitle || !upgradeBox) return;

  if (plan === 'pro_plus') {
    upgradeTitle.textContent = "You're on the highest plan";
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

document.addEventListener("DOMContentLoaded", () => {
  const toneSelect = document.getElementById("toneSelect");
  const lengthSelect = document.getElementById("lengthSelect");
  const userNameInput = document.getElementById("userNameInput");
  const saveButton = document.getElementById("saveButton");
  const statusMessage = document.getElementById("statusMessage");
  const upgradeLink = document.getElementById("upgradeLink");

  if (!toneSelect || !lengthSelect || !userNameInput || !saveButton || !statusMessage) {
    return;
  }

  // Add click handler for upgrade link
  if (upgradeLink) {
    upgradeLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.open("https://replymate.ai/upgrade", "_blank");
    });
  }

  // Load saved values (tone, length, and user name) when the popup opens.
  chrome.storage.local.get([TONE_KEY, LENGTH_KEY, USER_NAME_KEY], (result) => {
    const tone = result[TONE_KEY] || DEFAULT_TONE;
    const length = result[LENGTH_KEY] || DEFAULT_LENGTH;
    const userName = result[USER_NAME_KEY] || "";

    toneSelect.value = tone;
    lengthSelect.value = length;
    userNameInput.value = userName;
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

    chrome.storage.local.set(
      {
        [TONE_KEY]: tone,
        [LENGTH_KEY]: length,
        [USER_NAME_KEY]: userName,
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
  const usageData = await fetchUsageData();
  
  if (usageData) {
    updatePlanUsageDisplay(usageData);
    updateUpgradeLink(usageData.plan);
  } else {
    // Fallback display
    updatePlanUsageDisplay(null);
    updateUpgradeLink('free');
  }
}