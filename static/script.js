let currentThreadId = null;

window.selectThread = async function(threadId) {
  currentThreadId = threadId;
  document.getElementById("active-thread-id").value = threadId;
  document.getElementById("chatbox").innerHTML = "";

  document.querySelectorAll(".thread-link").forEach(link => link.classList.remove("active"));
  const activeLink = document.querySelector(`#thread-${threadId} .thread-link`);
  if (activeLink) activeLink.classList.add("active");

  try {
    const res = await fetch(`/chat/${threadId}/history`);
    const data = await res.json();
    if (data.messages) {
      for (const msg of data.messages) {
        appendMessage(msg.role, msg.content);
      }
    }
  } catch (err) {
    appendMessage("assistant", "[Error loading history]");
    console.error(err);
  }
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
      li.id = `thread-${data.thread_id}`;
      li.className = "thread-entry";

      const link = document.createElement("a");
      link.href = "#";
      link.textContent = data.title;
      link.className = "thread-link";
      link.onclick = () => selectThread(data.thread_id);

      const del = document.createElement("button");
      del.innerHTML = "🗑";
      del.onclick = () => deleteThread(data.thread_id);

      li.appendChild(link);
      li.appendChild(del);
      threadList.insertBefore(li, threadList.firstChild);

      selectThread(data.thread_id);
    } else {
      alert("Could not create thread.");
    }
  } catch (err) {
    console.error("Failed to create thread", err);
  }
};

window.deleteThread = async function(threadId) {
  if (!confirm("Delete this thread? This cannot be undone.")) return;
  const res = await fetch(`/delete_thread/${threadId}`, { method: "POST" });
  const data = await res.json();
  if (data.success) {
    document.getElementById(`thread-${threadId}`).remove();
    if (currentThreadId === threadId) {
      currentThreadId = null;
      document.getElementById("chatbox").innerHTML = "";
    }
  } else {
    alert("Could not delete thread.");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("chat-form");
  form.addEventListener("submit", sendMessage);

  const firstLink = document.querySelector("#thread-list .thread-link");
  if (firstLink) firstLink.click();
});

async function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById("message");
  const text = input.value.trim();
  if (!text || !currentThreadId) return;

  appendMessage("user", text);
  input.value = "";
  setStatus("Waiting for GPT response...");

  try {
    const res = await fetch(`/chat/${currentThreadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    clearStatus();
    if (data.reply) {
      appendMessage("assistant", data.reply);
    } else {
      appendMessage("assistant", "[Error: " + (data.error || "Unknown error") + "]");
    }
  } catch (err) {
    clearStatus();
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
function setStatus(message) {
  document.getElementById("status").textContent = message;
}

function clearStatus() {
  document.getElementById("status").textContent = "";
}
