/**
 * Minimal vanilla JS chat client that talks to the Django backend.
 * The Django API is assumed to be reachable under /api/.
 */

const DEFAULT_API_BASE = "/api";
const metaApiBase = document
  .querySelector('meta[name="chat-api-base"]')
  ?.content?.trim();
const API_BASE =
  (typeof window !== "undefined" && window.CHAT_API_BASE) ||
  metaApiBase ||
  DEFAULT_API_BASE;
const conversationListEl = document.getElementById("conversation-list");
const chatLogEl = document.getElementById("chat-log");
const chatFormEl = document.getElementById("chat-form");
const chatInputEl = document.getElementById("chat-input");
const newConversationBtn = document.getElementById("new-conversation");
const emptyStateHtml =
  '<div class="message system">Select a conversation or start a new one to chat with your local model.</div>';

let conversations = [];
let currentConversationId = null;
let isSending = false;

function updateSendButton() {
  const hasText = chatInputEl.value.trim().length > 0;
  const hasConversation = currentConversationId !== null;
  const button = chatFormEl.querySelector('button[type="submit"]');
  button.disabled = !hasText || !hasConversation || isSending;
  console.log("updateSendButton:", {
    hasText,
    hasConversation,
    isSending,
    disabled: button.disabled,
  });
}

async function request(path, options = {}) {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(options.headers || {}),
    },
    credentials: "same-origin",
    ...options,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `Request failed with status ${resp.status}`);
  }

  if (resp.status === 204) return null;
  return resp.json();
}

function renderConversationList() {
  conversationListEl.innerHTML = "";

  if (!conversations.length) {
    const empty = document.createElement("div");
    empty.style.padding = "1rem";
    empty.style.color = "#94a3b8";
    empty.textContent = "No conversations yet.";
    conversationListEl.appendChild(empty);
    return;
  }

  conversations.forEach((conv) => {
    const row = document.createElement("div");
    row.className = "conversation-item";

    const btn = document.createElement("button");
    btn.className = "select";
    btn.textContent = conv.title || `Conversation #${conv.id}`;
    btn.classList.toggle("is-active", conv.id === currentConversationId);
    btn.addEventListener("click", () => selectConversation(conv.id));

    const del = document.createElement("button");
    del.className = "delete";
    del.setAttribute("aria-label", "Delete conversation");
    del.textContent = "×";
    del.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteConversation(conv.id);
    });

    row.appendChild(btn);
    row.appendChild(del);
    conversationListEl.appendChild(row);
  });
}

function renderMessages(messages = []) {
  chatLogEl.innerHTML = "";

  if (!messages.length) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "message system";
    emptyMsg.textContent = "No messages yet. Say hi!";
    chatLogEl.appendChild(emptyMsg);
    return;
  }

  messages.forEach((msg) => {
    const bubble = document.createElement("div");
    bubble.className = `message ${msg.role}`;
    if (msg.role === "assistant") {
      bubble.innerHTML = marked.parse(msg.content);
    } else {
      bubble.textContent = msg.content;
    }
    chatLogEl.appendChild(bubble);
  });

  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function resetChatView() {
  chatLogEl.innerHTML = emptyStateHtml;
  chatInputEl.value = "";
  chatInputEl.disabled = true;
  currentConversationId = null;
  updateSendButton();
}

async function loadConversations() {
  try {
    const data = await request("/conversations/");
    conversations = data;
    renderConversationList();

    if (currentConversationId == null && conversations.length) {
      await selectConversation(conversations[0].id);
    }
  } catch (err) {
    notifyError(err.message || "Failed to load conversations.");
  }
}

async function selectConversation(conversationId) {
  console.log("selectConversation:", conversationId);
  currentConversationId = conversationId;
  renderConversationList();
  chatInputEl.disabled = false;
  updateSendButton();
  chatInputEl.focus();

  try {
    const messages = await request(
      `/conversations/${conversationId}/messages/`,
    );
    renderMessages(messages);
  } catch (err) {
    notifyError(err.message || "Failed to load messages.");
  }
}

async function createConversation() {
  try {
    const payload = { title: `Conversation ${new Date().toLocaleString()}` };
    const conv = await request("/conversations/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    conversations.unshift(conv);
    await loadConversations();
    await selectConversation(conv.id);
  } catch (err) {
    notifyError(err.message || "Failed to create conversation.");
  }
}

async function sendMessage(content) {
  if (!currentConversationId) return;
  if (isSending) return;
  isSending = true;
  setFormState(true);

  try {
    const messages = await request(
      `/conversations/${currentConversationId}/send/`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
    );
    renderMessages(messages);
    chatInputEl.value = "";
    updateSendButton();
  } catch (err) {
    notifyError(err.message || "Failed to send message.");
  } finally {
    isSending = false;
    setFormState(false);
  }
}

async function deleteConversation(conversationId) {
  const confirmed = window.confirm(
    "Delete this conversation and its messages? This cannot be undone.",
  );
  if (!confirmed) return;

  try {
    await request(`/conversations/${conversationId}/`, { method: "DELETE" });
    conversations = conversations.filter((c) => c.id !== conversationId);

    if (currentConversationId === conversationId) {
      if (conversations.length) {
        await selectConversation(conversations[0].id);
      } else {
        resetChatView();
        renderConversationList();
      }
    } else {
      renderConversationList();
    }
  } catch (err) {
    notifyError(err.message || "Failed to delete conversation.");
  }
}

function setFormState(disabled) {
  chatInputEl.disabled = disabled;
  updateSendButton();
}

function notifyError(message) {
  const banner = document.createElement("div");
  banner.textContent = message;
  banner.style.position = "fixed";
  banner.style.bottom = "1rem";
  banner.style.right = "1rem";
  banner.style.padding = "0.75rem 1rem";
  banner.style.borderRadius = "8px";
  banner.style.background = "#dc2626";
  banner.style.color = "#fff";
  banner.style.boxShadow = "0 10px 40px rgba(0,0,0,0.35)";
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 4000);
}

chatFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInputEl.value.trim();
  if (!text) return;
  sendMessage(text);
});

chatInputEl.addEventListener("input", () => {
  console.log("textarea input event");
  updateSendButton();
});

newConversationBtn.addEventListener("click", () => {
  console.log("new conversation clicked");
  createConversation();
});

// Initial load
console.log("initial load");
loadConversations().then(() => {
  if (!conversations.length) {
    resetChatView();
  }
});
