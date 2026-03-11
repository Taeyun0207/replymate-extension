const TONE_KEY = "replymateTone";
const LENGTH_KEY = "replymateLength";
const USER_NAME_KEY = "replymateUserName";

const DEFAULT_TONE = "polite";
const DEFAULT_LENGTH = "medium";

document.addEventListener("DOMContentLoaded", () => {
  const toneSelect = document.getElementById("toneSelect");
  const lengthSelect = document.getElementById("lengthSelect");
  const userNameInput = document.getElementById("userNameInput");
  const saveButton = document.getElementById("saveButton");
  const statusMessage = document.getElementById("statusMessage");

  if (!toneSelect || !lengthSelect || !userNameInput || !saveButton || !statusMessage) {
    return;
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

  // Save all settings together when the user clicks Save.
  saveButton.addEventListener("click", () => {
    saveButton.disabled = true;

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
        statusMessage.classList.add("visible");

        setTimeout(() => {
          statusMessage.classList.remove("visible");
          saveButton.disabled = false;
        }, 1200);
      }
    );
  });
});