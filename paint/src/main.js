import { CANVAS_WIDTH, CanvasEditor } from "./canvas-editor.js";
import { PaintNetwork } from "./network.js";

const elements = {
  workspace: document.querySelector("#workspace"),
  canvasArea: document.querySelector("#canvasArea"),
  canvas: document.querySelector("#paintCanvas"),
  canvasFrame: document.querySelector("#canvasFrame"),
  brushCursor: document.querySelector("#brushCursor"),
  brushTool: document.querySelector("#brushTool"),
  eraserTool: document.querySelector("#eraserTool"),
  swatches: document.querySelector("#swatches"),
  colorPicker: document.querySelector("#colorPicker"),
  brushSize: document.querySelector("#brushSize"),
  sizeOutput: document.querySelector("#sizeOutput"),
  undoButton: document.querySelector("#undoButton"),
  redoButton: document.querySelector("#redoButton"),
  clearButton: document.querySelector("#clearButton"),
  networkButton: document.querySelector("#networkButton"),
  networkButtonText: document.querySelector("#networkButtonText"),
  saveButton: document.querySelector("#saveButton"),
  statusText: document.querySelector("#statusText"),
  historyText: document.querySelector("#historyText"),
  networkStatus: document.querySelector("#networkStatus"),
  networkStatusText: document.querySelector("#networkStatusText"),
  networkDialog: document.querySelector("#networkDialog"),
  closeNetworkDialog: document.querySelector("#closeNetworkDialog"),
  dialogStatus: document.querySelector("#dialogStatus"),
  dialogStatusText: document.querySelector("#dialogStatusText"),
  dialogMessage: document.querySelector("#dialogMessage"),
  hostTab: document.querySelector("#hostTab"),
  joinTab: document.querySelector("#joinTab"),
  hostPanel: document.querySelector("#hostPanel"),
  joinPanel: document.querySelector("#joinPanel"),
  hostPassword: document.querySelector("#hostPassword"),
  joinPassword: document.querySelector("#joinPassword"),
  createOfferButton: document.querySelector("#createOfferButton"),
  offerField: document.querySelector("#offerField"),
  offerOutput: document.querySelector("#offerOutput"),
  copyOfferButton: document.querySelector("#copyOfferButton"),
  shareOfferButton: document.querySelector("#shareOfferButton"),
  answerInput: document.querySelector("#answerInput"),
  submitAnswerButton: document.querySelector("#submitAnswerButton"),
  offerInput: document.querySelector("#offerInput"),
  createAnswerButton: document.querySelector("#createAnswerButton"),
  answerField: document.querySelector("#answerField"),
  answerOutput: document.querySelector("#answerOutput"),
  copyAnswerButton: document.querySelector("#copyAnswerButton"),
  reconnectButton: document.querySelector("#reconnectButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  chatPanel: document.querySelector("#chatPanel"),
  chatStatus: document.querySelector("#chatStatus"),
  chatMessages: document.querySelector("#chatMessages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatSendButton: document.querySelector("#chatSendButton"),
  exportChatButton: document.querySelector("#exportChatButton"),
  hideChatButton: document.querySelector("#hideChatButton"),
  chatToggleButton: document.querySelector("#chatToggleButton"),
  chatUnread: document.querySelector("#chatUnread"),
};

let network;
let connectedDialogTimer = 0;
const chatMessages = [];
let unreadChatCount = 0;

const editor = new CanvasEditor(elements.canvas, {
  onChange: updateInterface,
  onStrokeStarted: (stroke) => {
    network?.sharePreviewStart(stroke);
  },
  onStrokePoints: (strokeId, points) => {
    network?.sharePreviewPoints(strokeId, points);
  },
  onStrokeCommitted: (stroke) => {
    network?.shareStroke(stroke);
  },
});

network = new PaintNetwork(editor, {
  onStatusChange: updateNetworkStatus,
  onError: handleNetworkError,
  onChatMessage: receiveChatMessage,
});

function updateInterface(state) {
  elements.undoButton.disabled = !state.canUndo;
  elements.redoButton.disabled = !state.canRedo;
  elements.historyText.textContent = `${state.strokeCount} 笔`;

  const toolName = state.tool === "eraser" ? "橡皮" : "画笔";
  elements.statusText.textContent = `${toolName} · ${state.brushSize} px`;

  elements.brushTool.classList.toggle("is-active", state.tool === "brush");
  elements.eraserTool.classList.toggle("is-active", state.tool === "eraser");
  elements.brushTool.setAttribute(
    "aria-pressed",
    String(state.tool === "brush"),
  );
  elements.eraserTool.setAttribute(
    "aria-pressed",
    String(state.tool === "eraser"),
  );

  elements.brushCursor.classList.toggle(
    "is-eraser",
    state.tool === "eraser",
  );
  updateBrushCursorSize(state.brushSize);
}

function updateNetworkStatus({ status, label }) {
  setStatusElement(elements.networkStatus, elements.networkStatusText, {
    status,
    label,
  });
  setStatusElement(elements.dialogStatus, elements.dialogStatusText, {
    status,
    label,
  });
  updateChatConnectionState({ status, label });

  elements.networkButton.dataset.state = status;
  elements.networkButton.classList.toggle("is-connected", status === "connected");
  elements.networkButtonText.textContent = status === "connected"
    ? "已连接"
    : status === "reconnecting"
      ? "重连中"
      : status === "reconnect"
        ? "需重连"
        : "联机";

  elements.disconnectButton.disabled =
    status === "idle" || status === "error";
  elements.reconnectButton.hidden =
    status !== "reconnecting" && status !== "reconnect";

  if (status === "connected") {
    elements.hostPassword.value = "";
    elements.joinPassword.value = "";
    setDialogMessage("连接已建立");
    window.clearTimeout(connectedDialogTimer);
    connectedDialogTimer = window.setTimeout(() => {
      if (elements.networkDialog.open) {
        elements.networkDialog.close();
      }
    }, 650);
  } else if (status === "waiting" && network.role === "host") {
    setDialogMessage("等待回答码");
  } else if (status === "waiting") {
    setDialogMessage("等待房主连接");
  } else if (status === "syncing") {
    setDialogMessage("正在同步画布");
  } else if (status === "reconnecting") {
    setDialogMessage("正在自动重连");
  } else if (status === "reconnect") {
    setDialogMessage("连接已中断");
  } else if (status === "idle") {
    setDialogMessage("");
  }
}

function setStatusElement(element, textElement, { status, label }) {
  element.dataset.state = status;
  textElement.textContent = label;
}

function setDialogMessage(message, isError = false) {
  elements.dialogMessage.textContent = message;
  elements.dialogMessage.classList.toggle("is-error", isError);
}

function handleNetworkError(error, connectionError = false) {
  console.error(error);

  if (connectionError) {
    updateNetworkStatus({
      status: "reconnect",
      label: "需要重新连接",
    });
  }

  const message = error?.message || "联机失败。";
  setDialogMessage(message, true);
}

function openNetworkDialog(tab = "host") {
  switchNetworkTab(tab);

  if (!elements.networkDialog.open) {
    elements.networkDialog.showModal();
  }
}

function switchNetworkTab(tab) {
  const isHost = tab === "host";

  elements.hostTab.classList.toggle("is-active", isHost);
  elements.joinTab.classList.toggle("is-active", !isHost);
  elements.hostTab.setAttribute("aria-selected", String(isHost));
  elements.joinTab.setAttribute("aria-selected", String(!isHost));
  elements.hostPanel.hidden = !isHost;
  elements.joinPanel.hidden = isHost;
}

function setTool(tool) {
  editor.setTool(tool);
}

function setColor(color) {
  editor.setColor(color);
  elements.colorPicker.value = color;

  for (const swatch of elements.swatches.querySelectorAll(".swatch")) {
    swatch.classList.toggle("is-active", swatch.dataset.color === color);
  }
}

function updateBrushCursorSize(size) {
  const canvasBounds = elements.canvas.getBoundingClientRect();
  const displayScale = canvasBounds.width / CANVAS_WIDTH;
  const cursorSize = Math.max(5, size * displayScale);

  elements.brushCursor.style.width = `${cursorSize}px`;
  elements.brushCursor.style.height = `${cursorSize}px`;
}

function moveBrushCursor(event) {
  if (event.pointerType === "touch") {
    elements.brushCursor.classList.remove("is-visible");
    return;
  }

  const frameBounds = elements.canvasFrame.getBoundingClientRect();
  const left = event.clientX - frameBounds.left;
  const top = event.clientY - frameBounds.top;

  elements.brushCursor.style.left = `${left}px`;
  elements.brushCursor.style.top = `${top}px`;
  elements.brushCursor.classList.add("is-visible");
}

function fitCanvasFrame() {
  const bounds = elements.canvasArea.getBoundingClientRect();

  if (bounds.width <= 0 || bounds.height <= 0) {
    return;
  }

  const scale = Math.min(bounds.width / 1600, bounds.height / 1000);
  const width = Math.max(1, Math.floor(1600 * scale));
  const height = Math.max(1, Math.floor(1000 * scale));

  elements.canvasFrame.style.width = `${width}px`;
  elements.canvasFrame.style.height = `${height}px`;
}

function updateChatConnectionState({ status, label }) {
  elements.chatStatus.dataset.state = status;
  elements.chatStatus.textContent =
    status === "connected" ? "已连接" : label;

  const connected = status === "connected";
  elements.chatInput.disabled = !connected;
  elements.chatSendButton.disabled = !connected;
}

function setChatOpen(open) {
  elements.workspace.classList.toggle("has-chat", open);
  elements.chatToggleButton.setAttribute("aria-pressed", String(open));

  if (open) {
    unreadChatCount = 0;
    updateUnreadBadge();
    window.requestAnimationFrame(() => {
      fitCanvasFrame();
      if (!elements.chatInput.disabled) {
        elements.chatInput.focus();
      }
    });
  } else {
    fitCanvasFrame();
  }
}

function updateUnreadBadge() {
  elements.chatUnread.hidden =
    unreadChatCount === 0 ||
    elements.workspace.classList.contains("has-chat");
  elements.chatUnread.textContent =
    unreadChatCount > 99 ? "99+" : String(unreadChatCount);
}

function sendChatMessage() {
  const text = elements.chatInput.value.trim();

  if (!text || !network.connected) {
    return;
  }

  const message = {
    id: createChatMessageId(),
    sentAt: new Date().toISOString(),
    sender: "我",
    text,
  };

  if (!network.sendChatMessage(message)) {
    return;
  }

  chatMessages.push(message);
  elements.chatInput.value = "";
  resizeChatInput();
  renderChatMessages(true);
}

function receiveChatMessage(message) {
  chatMessages.push({
    id: message.id,
    sentAt: message.sentAt,
    sender: message.senderRole === "host" ? "房主" : "访客",
    text: message.text,
  });

  if (!elements.workspace.classList.contains("has-chat")) {
    unreadChatCount += 1;
  }

  updateUnreadBadge();
  renderChatMessages(true);
}

function renderChatMessages(forceScroll = false) {
  const wasNearBottom =
    elements.chatMessages.scrollHeight -
      elements.chatMessages.scrollTop -
      elements.chatMessages.clientHeight <
    48;

  elements.chatMessages.replaceChildren();

  if (chatMessages.length === 0) {
    const empty = document.createElement("span");
    empty.className = "chat-empty";
    empty.textContent = "暂无消息";
    elements.chatMessages.append(empty);
  } else {
    for (const message of chatMessages) {
      const article = document.createElement("article");
      article.className = "chat-message";

      if (message.sender === "我") {
        article.classList.add("is-local");
      }

      const meta = document.createElement("div");
      meta.className = "chat-message-meta";

      const sender = document.createElement("span");
      sender.className = "chat-message-sender";
      sender.textContent = message.sender;

      const time = document.createElement("time");
      time.dateTime = message.sentAt;
      time.textContent = formatChatTime(message.sentAt, false);

      const body = document.createElement("div");
      body.className = "chat-message-body";
      body.textContent = message.text;

      meta.append(sender, time);
      article.append(meta, body);
      elements.chatMessages.append(article);
    }
  }

  elements.exportChatButton.disabled = chatMessages.length === 0;

  if (forceScroll || wasNearBottom) {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }
}

function resizeChatInput() {
  elements.chatInput.style.height = "auto";
  elements.chatInput.style.height = `${Math.min(
    elements.chatInput.scrollHeight,
    116,
  )}px`;
}

function exportChat() {
  if (chatMessages.length === 0) {
    return;
  }

  const content = chatMessages
    .map((message) => formatChatExportLine(message))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${content}\r\n`], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
    "-",
    padNumber(date.getHours()),
    padNumber(date.getMinutes()),
  ].join("");

  link.href = url;
  link.download = `paint-chat-${stamp}.txt`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatChatExportLine(message) {
  const lines = String(message.text).replace(/\r\n?/g, "\n").split("\n");
  const firstLine = lines.shift() || "";
  const continuation = lines
    .map((line) => `\n    ${line}`)
    .join("");

  return `[${formatChatTime(
    message.sentAt,
    true,
  )}] ${message.sender}: ${firstLine}${continuation}`;
}

function formatChatTime(timestamp, includeDate) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return includeDate ? "0000-00-00 00:00:00" : "--:--";
  }

  const time = [
    padNumber(date.getHours()),
    padNumber(date.getMinutes()),
    includeDate ? padNumber(date.getSeconds()) : null,
  ]
    .filter((part) => part !== null)
    .join(":");

  if (!includeDate) {
    return time;
  }

  return `${date.getFullYear()}-${padNumber(
    date.getMonth() + 1,
  )}-${padNumber(date.getDate())} ${time}`;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function createChatMessageId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function copyText(text, button, successLabel = "已复制") {
  if (!text) {
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
  } catch {
    fallbackCopy(text);
  }

  const originalLabel = button.textContent;
  button.textContent = successLabel;
  button.disabled = true;

  window.setTimeout(() => {
    button.textContent = originalLabel;
    button.disabled = false;
  }, 1200);
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function shareInviteLink() {
  const inviteSignal = elements.offerOutput.value.trim();

  if (!inviteSignal) {
    return;
  }

  const link = network.createInviteLink(inviteSignal);

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Paint 邀请",
        url: link,
      });
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
    }
  }

  await copyText(link, elements.shareOfferButton, "链接已复制");
}

function resetSignalControls() {
  elements.offerField.hidden = true;
  elements.answerField.hidden = true;
  elements.offerOutput.value = "";
  elements.answerInput.value = "";
  elements.answerOutput.value = "";
  elements.submitAnswerButton.disabled = true;
  setDialogMessage("");
}

async function createHostInvite() {
  const password = elements.hostPassword.value.trim();

  if (!password && !network.hasSessionPassword) {
    setDialogMessage("请先设置密码", true);
    elements.hostPassword.focus();
    return;
  }

  resetSignalControls();
  elements.createOfferButton.disabled = true;
  elements.createOfferButton.textContent = "生成中";
  setDialogMessage("正在生成邀请码");

  try {
    const inviteSignal = await network.createHostOffer(
      password || undefined,
    );
    elements.offerOutput.value = inviteSignal;
    elements.offerField.hidden = false;
    elements.submitAnswerButton.disabled = false;
  } catch (error) {
    handleNetworkError(error, true);
  } finally {
    elements.createOfferButton.disabled = false;
    elements.createOfferButton.textContent = "创建邀请";
  }
}

function loadInviteFromHash() {
  if (!window.location.hash.startsWith("#join=")) {
    return;
  }

  const parameters = new URLSearchParams(window.location.hash.slice(1));
  const inviteSignal = parameters.get("join");

  if (!inviteSignal) {
    return;
  }

  elements.offerInput.value = inviteSignal;
  openNetworkDialog("join");
  elements.joinPassword.focus();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`,
  );
}

elements.brushTool.addEventListener("click", () => setTool("brush"));
elements.eraserTool.addEventListener("click", () => setTool("eraser"));

elements.swatches.addEventListener("click", (event) => {
  const swatch = event.target.closest(".swatch");

  if (!swatch) {
    return;
  }

  setColor(swatch.dataset.color);
});

elements.colorPicker.addEventListener("input", (event) => {
  setColor(event.target.value);
});

elements.brushSize.addEventListener("input", (event) => {
  const size = Number(event.target.value);
  editor.setBrushSize(size);
  elements.sizeOutput.value = String(size);
});

elements.undoButton.addEventListener("click", () => {
  if (editor.undo()) {
    network.shareState("undo");
  }
});

elements.redoButton.addEventListener("click", () => {
  if (editor.redo()) {
    network.shareState("redo");
  }
});

elements.clearButton.addEventListener("click", () => {
  if (editor.hasStrokes && window.confirm("清空整张画布？")) {
    if (editor.clear()) {
      network.shareState("clear");
    }
  }
});

elements.saveButton.addEventListener("click", async () => {
  try {
    await editor.exportPNG();
  } catch (error) {
    console.error(error);
    window.alert("导出失败，请重试。");
  }
});

elements.networkButton.addEventListener("click", () => {
  openNetworkDialog(network.role === "guest" ? "join" : "host");
});

elements.closeNetworkDialog.addEventListener("click", () => {
  elements.networkDialog.close();
});

elements.hostTab.addEventListener("click", () => switchNetworkTab("host"));
elements.joinTab.addEventListener("click", () => switchNetworkTab("join"));

elements.createOfferButton.addEventListener("click", async () => {
  await createHostInvite();
});

elements.copyOfferButton.addEventListener("click", () => {
  copyText(
    elements.offerOutput.value,
    elements.copyOfferButton,
    "邀请码已复制",
  );
});

elements.shareOfferButton.addEventListener("click", () => {
  shareInviteLink().catch(handleNetworkError);
});

elements.submitAnswerButton.addEventListener("click", async () => {
  const answerSignal = elements.answerInput.value.trim();

  if (!answerSignal) {
    setDialogMessage("请填写回答码", true);
    return;
  }

  elements.submitAnswerButton.disabled = true;
  elements.submitAnswerButton.textContent = "连接中";

  try {
    await network.acceptHostAnswer(answerSignal);
    setDialogMessage("正在建立连接");
  } catch (error) {
    elements.submitAnswerButton.disabled = false;
    handleNetworkError(error, true);
  } finally {
    elements.submitAnswerButton.textContent = "完成连接";
  }
});

elements.createAnswerButton.addEventListener("click", async () => {
  const inviteSignal = elements.offerInput.value.trim();
  const password = elements.joinPassword.value.trim();

  if (!inviteSignal) {
    setDialogMessage("请填写邀请码", true);
    return;
  }

  if (password.length < 6 && !network.hasSessionPassword) {
    setDialogMessage("密码至少需要 6 个字符", true);
    elements.joinPassword.focus();
    return;
  }

  elements.createAnswerButton.disabled = true;
  elements.createAnswerButton.textContent = "生成中";

  try {
    const answerSignal = await network.createGuestAnswer(
      inviteSignal,
      password || undefined,
    );
    elements.answerOutput.value = answerSignal;
    elements.answerField.hidden = false;
    elements.offerInput.value = "";
    elements.joinPassword.value = "";
  } catch (error) {
    handleNetworkError(error, true);
  } finally {
    elements.createAnswerButton.disabled = false;
    elements.createAnswerButton.textContent = "生成回答码";
  }
});

elements.copyAnswerButton.addEventListener("click", () => {
  copyText(
    elements.answerOutput.value,
    elements.copyAnswerButton,
    "回答码已复制",
  );
});

elements.disconnectButton.addEventListener("click", () => {
  network.disconnect();
  resetSignalControls();
});

elements.reconnectButton.addEventListener("click", async () => {
  if (network.role === "guest") {
    switchNetworkTab("join");
    resetSignalControls();
    setDialogMessage("等待新的邀请码");
    elements.offerInput.focus();
    return;
  }

  switchNetworkTab("host");
  await createHostInvite();
});

elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendChatMessage();
});

elements.chatInput.addEventListener("input", resizeChatInput);

elements.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
});

elements.exportChatButton.addEventListener("click", exportChat);

elements.hideChatButton.addEventListener("click", () => {
  setChatOpen(false);
});

elements.chatToggleButton.addEventListener("click", () => {
  setChatOpen(!elements.workspace.classList.contains("has-chat"));
});

elements.canvasFrame.addEventListener("pointerenter", (event) => {
  if (event.pointerType !== "touch") {
    elements.brushCursor.classList.add("is-visible");
  }
});

elements.canvasFrame.addEventListener("pointermove", moveBrushCursor);

elements.canvasFrame.addEventListener("pointerleave", () => {
  elements.brushCursor.classList.remove("is-visible");
});

window.addEventListener("pointerup", (event) => {
  if (event.pointerType === "touch") {
    elements.brushCursor.classList.remove("is-visible");
  }
});

window.addEventListener("hashchange", loadInviteFromHash);

window.addEventListener("keydown", (event) => {
  const isEditingControl =
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement;

  if (isEditingControl) {
    return;
  }

  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (modifier && key === "z" && !event.shiftKey) {
    event.preventDefault();
    if (editor.undo()) {
      network.shareState("undo");
    }
    return;
  }

  if (modifier && (key === "y" || (key === "z" && event.shiftKey))) {
    event.preventDefault();
    if (editor.redo()) {
      network.shareState("redo");
    }
    return;
  }

  if (modifier && key === "s") {
    event.preventDefault();
    editor.exportPNG().catch((error) => console.error(error));
    return;
  }

  if (modifier || event.altKey || elements.networkDialog.open) {
    return;
  }

  if (key === "b") {
    setTool("brush");
  }

  if (key === "e") {
    setTool("eraser");
  }
});

const resizeObserver = new ResizeObserver(() => {
  fitCanvasFrame();
  editor.resize();
  updateBrushCursorSize(editor.brushSize);
});

resizeObserver.observe(elements.canvasArea);

window.addEventListener("resize", () => {
  fitCanvasFrame();
  updateBrushCursorSize(editor.brushSize);
});

const compactLayout = window.matchMedia("(max-width: 980px)");

if (compactLayout.matches) {
  setChatOpen(false);
}

compactLayout.addEventListener("change", (event) => {
  if (event.matches) {
    setChatOpen(false);
  }
});

elements.sizeOutput.value = String(editor.brushSize);
elements.disconnectButton.disabled = true;

updateInterface({
  strokeCount: 0,
  canUndo: false,
  canRedo: false,
  tool: editor.tool,
  brushSize: editor.brushSize,
});

updateNetworkStatus({
  status: "idle",
  label: "未连接",
});

renderChatMessages(false);
updateUnreadBadge();
fitCanvasFrame();
loadInviteFromHash();
