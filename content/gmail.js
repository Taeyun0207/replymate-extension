console.log("ReplyMate Gmail script loaded");

function addTestButton() {
  if (document.getElementById("replymate-test-button")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "replymate-test-button";
  button.textContent = "Generate Reply";
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.zIndex = "9999";
  button.style.padding = "10px 14px";
  button.style.backgroundColor = "#1a73e8";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "8px";
  button.style.cursor = "pointer";
  button.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";

  button.addEventListener("click", () => {
    alert("ReplyMate test button clicked!");
  });

  document.body.appendChild(button);
}

addTestButton();