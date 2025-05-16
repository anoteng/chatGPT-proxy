let currentThreadId = null;

window.selectThread = function(threadId) {
  currentThreadId = threadId;
  document.getElementById("active-thread-id").value = threadId;
  document.getElementById("chatbox").innerHTML = "";

  // Optional: fetch and show message history for threadId
  // You can implement a GET /chat/<thread_id>/history endpoint to enable this
};

window.createThread = async function () {
  const title = prompt("Thread title:");
  if (!title) return;

  try {
    const res = await fetch("/new_thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });
    const data = await res.json();

    if (data.thread_id) {
      const threadList = document.getElementById("thread-list");
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = data.title;
      link.onclick = () => selectThread(data.thread_id);
      li.appendChild(link);
      threadList.insertBefore(li, threadList.firstChild);

      selectThread(data.thread_id);
    } else {
      alert("Could not create thread.");
    }
  } catch (err) {
    console.error("Failed to create thread", err);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("script.js loaded");

  const form = document.getElementById("chat-form");
  form.addEventListener("submit", sendMessage);

  // Auto-select first thread if available
  const firstLink = document.querySelector("#thread-list a");
  if (firstLink) firstLink.click();
});

async function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById("message");
  const text = input.value.trim();
  if (!text || !currentThreadId) return;

  appendMessage("user", text);
  input.value = "";

  try {
    const res = await fetch(`/chat/${currentThreadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (data.reply) {
      appendMessage("assistant", data.reply);
    } else {
      appendMessage("assistant", "[Error: " + (data.error || "Unknown error") + "]");
    }
  } catch (err) {
    appendMessage("assistant", "[Error sending message]");
    console.error(err);
  }
}

function appendMessage(role, content) {
  const div = document.createElement("div");
  div.className = "message " + role;
  div.textContent = (role === "user" ? "You: " : "GPT: ") + content;
  const chatbox = document.getElementById("chatbox");
  chatbox.appendChild(div);
  chatbox.scrollTop = chatbox.scrollHeight;
}
