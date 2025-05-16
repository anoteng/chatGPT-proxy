document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("chat-form");
  const chatbox = document.getElementById("chatbox");
  const userId = document.getElementById("user-id").value;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("message");
    const text = input.value.trim();
    if (!text) return;

    appendMessage("user", text);
    input.value = "";

    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: userId, message: text })
    });

    const data = await response.json();
    if (data.reply) {
      appendMessage("assistant", data.reply);
    } else {
      appendMessage("assistant", "[Feil: " + (data.error || "Ukjent feil") + "]");
    }
  });

  function appendMessage(role, content) {
    const div = document.createElement("div");
    div.className = "message " + role;
    div.textContent = (role === "user" ? "Du: " : "GPT: ") + content;
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
  }
});

