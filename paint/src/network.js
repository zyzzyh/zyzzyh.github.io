const DATA_CHANNEL_LABEL = "paint";
const MAX_CHUNK_LENGTH = 12000;
const ICE_GATHERING_TIMEOUT = 6500;
const RECOVERY_DELAY = 700;
const PBKDF2_ITERATIONS = 250000;

const ICE_SERVERS = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun.cloudflare.com:3478",
    ],
  },
];

export async function encodeSignal(sdp) {
  const bytes = new TextEncoder().encode(sdp);

  if (typeof CompressionStream === "function") {
    return `1.${bytesToBase64Url(await compressBytes(bytes))}`;
  }

  return `0.${bytesToBase64Url(bytes)}`;
}

export async function decodeSignal(signal) {
  const code = extractInviteCode(signal);
  const separatorIndex = code.indexOf(".");

  if (separatorIndex < 1) {
    throw new Error("邀请码格式无效。");
  }

  const version = code.slice(0, separatorIndex);
  const payload = code.slice(separatorIndex + 1).replace(/\s/g, "");
  let bytes = base64UrlToBytes(payload);

  if (version === "2") {
    throw new Error("该邀请码需要密码。");
  }

  if (version === "1") {
    bytes = await decompressBytes(bytes);
  } else if (version !== "0") {
    throw new Error("邀请码版本不受支持。");
  }

  return new TextDecoder().decode(bytes);
}

export async function encryptSignal(sdp, password) {
  const useCompression = typeof CompressionStream === "function";
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(password, salt);
  const encoded = new TextEncoder().encode(sdp);
  const compressed = useCompression
    ? await compressBytes(encoded)
    : encoded;
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    compressed,
  );

  return [
    "2",
    useCompression ? "1" : "0",
    bytesToBase64Url(salt),
    bytesToBase64Url(iv),
    bytesToBase64Url(new Uint8Array(encrypted)),
  ].join(".");
}

export async function decryptSignal(signal, password) {
  const code = extractInviteCode(signal);
  const parts = code.split(".");

  if (parts.length !== 5 || parts[0] !== "2") {
    throw new Error("邀请码格式无效。");
  }

  if (!password) {
    throw new Error("请输入密码。");
  }

  const useCompression = parts[1] === "1";
  const salt = base64UrlToBytes(parts[2]);
  const iv = base64UrlToBytes(parts[3]);
  const encrypted = base64UrlToBytes(parts[4]);
  const key = await deriveEncryptionKey(password, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      encrypted,
    );
    const decryptedBytes = new Uint8Array(decrypted);
    const decoded = useCompression
      ? await decompressBytes(decryptedBytes)
      : decryptedBytes;
    return new TextDecoder().decode(decoded);
  } catch {
    throw new Error("密码错误或联机信息已损坏。");
  }
}

export function extractInviteCode(value) {
  const input = String(value || "").trim();

  if (!input) {
    return "";
  }

  const hashIndex = input.indexOf("#");

  if (hashIndex >= 0) {
    const hash = input.slice(hashIndex + 1);
    const parameters = new URLSearchParams(hash);
    const code = parameters.get("join");

    if (code) {
      return code.trim();
    }
  }

  return input;
}

export class PaintNetwork {
  constructor(
    editor,
    {
      onStatusChange = () => {},
      onError = () => {},
      onChatMessage = () => {},
    } = {},
  ) {
    this.editor = editor;
    this.onStatusChange = onStatusChange;
    this.onError = onError;
    this.onChatMessage = onChatMessage;

    this.peer = null;
    this.channel = null;
    this.role = null;
    this.sequence = 0;
    this.lastSequence = 0;
    this.ready = false;
    this.status = "idle";
    this.closedByUser = false;
    this.hadDisconnect = false;
    this.recoveryTimer = 0;
    this.sessionPassword = "";
    this.incomingChunks = new Map();
    this.seenChatIds = new Set();
    this.chunkId = 0;
  }

  get connected() {
    return this.ready && this.channel?.readyState === "open";
  }

  get hasSessionPassword() {
    return this.sessionPassword.length >= 6;
  }

  async createHostOffer(password) {
    const effectivePassword = this.resolvePassword(password);
    this.resetConnection({ keepStatus: true });
    this.sessionPassword = effectivePassword;
    this.role = "host";
    this.setStatus("creating", "正在创建邀请");

    const peer = this.createPeerConnection();
    const channel = peer.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });

    this.configureChannel(channel);

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIceGathering(peer);

    if (!peer.localDescription) {
      throw new Error("无法生成邀请码。");
    }

    const signal = await encryptSignal(
      peer.localDescription.sdp,
      effectivePassword,
    );
    this.setStatus("waiting", "等待回答码");
    return signal;
  }

  async acceptHostAnswer(answerSignal, password) {
    if (!this.peer || this.role !== "host") {
      throw new Error("请先创建邀请。");
    }

    const effectivePassword = this.resolvePassword(
      password || this.sessionPassword,
    );
    const sdp = await decryptSignal(answerSignal, effectivePassword);
    this.sessionPassword = effectivePassword;
    await this.peer.setRemoteDescription({ type: "answer", sdp });
    this.setStatus("connecting", "正在建立连接");
  }

  async createGuestAnswer(offerSignal, password) {
    const effectivePassword = this.resolvePassword(password);
    this.resetConnection({ keepStatus: true });
    this.role = "guest";
    this.setStatus("connecting", "正在生成回答码");

    const sdp = await decryptSignal(offerSignal, effectivePassword);
    this.sessionPassword = effectivePassword;
    const peer = this.createPeerConnection();

    peer.addEventListener("datachannel", (event) => {
      this.configureChannel(event.channel);
    });

    await peer.setRemoteDescription({ type: "offer", sdp });
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await waitForIceGathering(peer);

    if (!peer.localDescription) {
      throw new Error("无法生成回答码。");
    }

    const signal = await encryptSignal(
      peer.localDescription.sdp,
      effectivePassword,
    );
    this.setStatus("waiting", "等待房主连接");
    return signal;
  }

  resolvePassword(password) {
    const value = String(password || this.sessionPassword || "").trim();

    if (value.length < 6) {
      throw new Error("密码至少需要 6 个字符。");
    }

    return value;
  }

  createInviteLink(inviteSignal) {
    const url = new URL(window.location.href);
    url.hash = `join=${inviteSignal}`;
    return url.toString();
  }

  shareStroke(stroke) {
    if (!this.connected) {
      return false;
    }

    if (this.role === "host") {
      this.sequence += 1;
      this.sendMessage({
        type: "stroke",
        seq: this.sequence,
        stroke,
      });
    } else {
      this.sendMessage({
        type: "stroke-request",
        stroke,
      });
    }

    return true;
  }

  sharePreviewStart(stroke) {
    if (!this.connected) {
      return false;
    }

    this.sendMessage({
      type: "preview-start",
      stroke,
    });
    return true;
  }

  sharePreviewPoints(strokeId, points) {
    if (!this.connected || points.length === 0) {
      return false;
    }

    this.sendMessage({
      type: "preview-points",
      strokeId,
      points,
    });
    return true;
  }

  sendChatMessage({ id, sentAt, text }) {
    if (!this.connected) {
      return false;
    }

    return this.sendMessage({
      type: "chat-message",
      id,
      sentAt,
      text,
      senderRole: this.role,
    });
  }

  shareState(reason) {
    if (!this.connected) {
      return false;
    }

    const message = {
      type: "state",
      snapshot: this.editor.getSnapshot(),
      reason,
    };

    if (this.role === "host") {
      this.sequence += 1;
      this.sendMessage({ ...message, seq: this.sequence });
    } else {
      this.sendMessage({
        type: "state-request",
        snapshot: message.snapshot,
        reason,
      });
    }

    return true;
  }

  disconnect() {
    this.closedByUser = true;
    window.clearTimeout(this.recoveryTimer);
    this.resetConnection();
    this.setStatus("idle", "未连接");
  }

  createPeerConnection() {
    if (typeof RTCPeerConnection !== "function") {
      throw new Error("当前浏览器不支持 WebRTC。");
    }

    const peer = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    this.peer = peer;

    peer.addEventListener("connectionstatechange", () => {
      if (this.peer !== peer || this.closedByUser) {
        return;
      }

      if (peer.connectionState === "failed") {
        this.hadDisconnect = true;
        window.clearTimeout(this.recoveryTimer);
        this.setStatus("reconnect", "需要重新连接");
      } else if (peer.connectionState === "disconnected") {
        this.hadDisconnect = true;
        this.setStatus("reconnecting", "正在自动重连");
      } else if (
        peer.connectionState === "connected" &&
        this.hadDisconnect
      ) {
        this.handleRecoveredConnection(peer);
      }
    });

    return peer;
  }

  configureChannel(channel) {
    this.channel = channel;
    this.incomingChunks.clear();

    channel.addEventListener("open", () => {
      if (this.channel !== channel) {
        return;
      }

      this.ready = true;

      if (this.role === "host") {
        this.sendSnapshot();
        this.setStatus("connected", "已连接");
      } else {
        this.setStatus("syncing", "正在同步画布");
      }
    });

    channel.addEventListener("message", (event) => {
      if (this.channel !== channel) {
        return;
      }

      this.handleRawMessage(event.data);
    });

    channel.addEventListener("close", () => {
      if (this.channel !== channel) {
        return;
      }

      this.ready = false;

      if (!this.closedByUser) {
        this.hadDisconnect = true;
        this.setStatus("reconnecting", "正在自动重连");
        this.scheduleChannelRecovery();
      }
    });

    channel.addEventListener("error", () => {
      if (this.channel !== channel) {
        return;
      }

      if (!this.closedByUser) {
        this.hadDisconnect = true;
        this.setStatus("reconnecting", "正在自动重连");
        this.scheduleChannelRecovery();
      }
    });
  }

  sendSnapshot() {
    const sent = this.sendMessage({
      type: "snapshot",
      seq: this.sequence,
      snapshot: this.editor.getSnapshot(),
    });

    if (sent) {
      this.hadDisconnect = false;
    }

    return sent;
  }

  handleRecoveredConnection(peer) {
    if (peer !== this.peer) {
      return;
    }

    window.clearTimeout(this.recoveryTimer);

    if (this.channel?.readyState === "open") {
      this.ready = true;

      if (this.role === "host") {
        this.sendSnapshot();
        this.setStatus("connected", "已连接");
      } else {
        this.sendMessage({ type: "resync-request" });
        this.setStatus("syncing", "正在同步画布");
      }

      return;
    }

    if (this.role === "host") {
      this.createHostChannel(peer);
    } else {
      this.setStatus("syncing", "正在恢复连接");
    }
  }

  scheduleChannelRecovery() {
    window.clearTimeout(this.recoveryTimer);

    this.recoveryTimer = window.setTimeout(() => {
      if (this.closedByUser) {
        return;
      }

      if (
        this.role === "host" &&
        this.peer?.connectionState === "connected"
      ) {
        this.createHostChannel(this.peer);
      } else if (this.peer?.connectionState === "failed") {
        this.setStatus("reconnect", "需要重新连接");
      }
    }, RECOVERY_DELAY);
  }

  createHostChannel(peer = this.peer) {
    if (
      !peer ||
      this.role !== "host" ||
      this.channel?.readyState === "open" ||
      this.channel?.readyState === "connecting"
    ) {
      return;
    }

    const channel = peer.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });

    this.setStatus("connecting", "正在恢复连接");
    this.configureChannel(channel);
  }

  sendMessage(message) {
    if (!this.connected) {
      return false;
    }

    const serialized = JSON.stringify(message);

    if (serialized.length <= MAX_CHUNK_LENGTH) {
      this.channel.send(serialized);
      return true;
    }

    this.chunkId += 1;
    const transferId = `${this.role}-${this.chunkId}`;
    const totalChunks = Math.ceil(serialized.length / MAX_CHUNK_LENGTH);

    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * MAX_CHUNK_LENGTH;
      const chunk = serialized.slice(start, start + MAX_CHUNK_LENGTH);

      this.channel.send(
        JSON.stringify({
          type: "__chunk",
          transferId,
          index,
          totalChunks,
          chunk,
        }),
      );
    }

    return true;
  }

  handleRawMessage(rawMessage) {
    if (typeof rawMessage !== "string") {
      return;
    }

    let message;

    try {
      message = JSON.parse(rawMessage);
    } catch {
      return;
    }

    if (message.type === "__chunk") {
      this.handleChunk(message);
      return;
    }

    this.handleMessage(message);
  }

  handleChunk(message) {
    let transfer = this.incomingChunks.get(message.transferId);

    if (!transfer) {
      transfer = {
        chunks: new Array(message.totalChunks),
        received: 0,
      };
      this.incomingChunks.set(message.transferId, transfer);
    }

    if (
      typeof message.index !== "number" ||
      typeof message.chunk !== "string" ||
      message.index < 0 ||
      message.index >= message.totalChunks
    ) {
      return;
    }

    if (typeof transfer.chunks[message.index] === "string") {
      return;
    }

    transfer.chunks[message.index] = message.chunk;
    transfer.received += 1;

    if (transfer.received !== message.totalChunks) {
      return;
    }

    this.incomingChunks.delete(message.transferId);

    try {
      this.handleMessage(JSON.parse(transfer.chunks.join("")));
    } catch {
      this.reportError(new Error("收到的联机数据无法解析。"));
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case "snapshot":
        this.applySnapshot(message);
        break;
      case "stroke-request":
        this.handleStrokeRequest(message);
        break;
      case "preview-start":
        this.editor.startRemotePreview(message.stroke);
        break;
      case "preview-points":
        this.editor.appendRemotePreview(message.strokeId, message.points);
        break;
      case "stroke":
        this.handleStroke(message);
        break;
      case "state-request":
        this.handleStateRequest(message);
        break;
      case "state":
        this.handleState(message);
        break;
      case "resync-request":
        if (this.role === "host") {
          this.sendSnapshot();
        }
        break;
      case "chat-message":
        this.handleChatMessage(message);
        break;
      default:
        break;
    }
  }

  applySnapshot(message) {
    if (!this.editor.replaceSnapshot(message.snapshot)) {
      return;
    }

    this.lastSequence = Number(message.seq) || 0;
    this.hadDisconnect = false;

    if (this.role === "guest") {
      this.setStatus("connected", "已连接");
    }
  }

  handleStrokeRequest(message) {
    if (this.role !== "host" || !message.stroke) {
      return;
    }

    this.editor.addRemoteStroke(message.stroke);
    this.sequence += 1;

    this.sendMessage({
      type: "stroke",
      seq: this.sequence,
      stroke: message.stroke,
    });
  }

  handleStroke(message) {
    if (
      this.role !== "guest" ||
      !message.stroke ||
      !Number.isFinite(message.seq) ||
      message.seq <= this.lastSequence
    ) {
      return;
    }

    this.lastSequence = message.seq;
    this.editor.addRemoteStroke(message.stroke);
  }

  handleStateRequest(message) {
    if (this.role !== "host" || !message.snapshot) {
      return;
    }

    this.editor.replaceSnapshot(message.snapshot);
    this.sequence += 1;

    this.sendMessage({
      type: "state",
      seq: this.sequence,
      snapshot: message.snapshot,
      reason: message.reason,
    });
  }

  handleState(message) {
    if (
      this.role !== "guest" ||
      !message.snapshot ||
      !Number.isFinite(message.seq) ||
      message.seq <= this.lastSequence
    ) {
      return;
    }

    this.lastSequence = message.seq;
    this.editor.replaceSnapshot(message.snapshot);
  }

  handleChatMessage(message) {
    if (
      !message.id ||
      typeof message.id !== "string" ||
      typeof message.text !== "string" ||
      message.text.trim().length === 0 ||
      message.text.length > 2000 ||
      message.senderRole === this.role ||
      this.seenChatIds.has(message.id)
    ) {
      return;
    }

    this.seenChatIds.add(message.id);
    this.onChatMessage({
      id: message.id,
      sentAt: message.sentAt,
      text: message.text,
      senderRole: message.senderRole,
    });
  }

  setStatus(status, label) {
    this.status = status;
    this.onStatusChange({ status, label });
  }

  reportError(error) {
    this.onError(error);
  }

  resetConnection({ keepStatus = false } = {}) {
    this.closedByUser = true;
    const channel = this.channel;
    const peer = this.peer;

    this.peer = null;
    this.channel = null;
    this.role = null;
    this.sequence = 0;
    this.lastSequence = 0;
    this.ready = false;
    this.hadDisconnect = false;
    window.clearTimeout(this.recoveryTimer);
    this.recoveryTimer = 0;
    this.incomingChunks.clear();
    this.seenChatIds.clear();

    if (channel) {
      channel.close();
    }

    if (peer) {
      peer.close();
    }

    this.closedByUser = false;

    if (!keepStatus) {
      this.setStatus("idle", "未连接");
    }
  }
}

function waitForIceGathering(peer) {
  if (peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let timeoutId;

    const finish = () => {
      window.clearTimeout(timeoutId);
      peer.removeEventListener("icegatheringstatechange", handleStateChange);
      resolve();
    };

    const handleStateChange = () => {
      if (peer.iceGatheringState === "complete") {
        finish();
      }
    };

    peer.addEventListener("icegatheringstatechange", handleStateChange);
    timeoutId = window.setTimeout(finish, ICE_GATHERING_TIMEOUT);
  });
}

async function compressBytes(bytes) {
  if (typeof CompressionStream !== "function") {
    return bytes;
  }

  const compressedStream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));

  return new Uint8Array(
    await new Response(compressedStream).arrayBuffer(),
  );
}

async function decompressBytes(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("当前浏览器无法读取该邀请码。");
  }

  const decompressedStream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));

  return new Uint8Array(
    await new Response(decompressedStream).arrayBuffer(),
  );
}

async function deriveEncryptionKey(password, salt) {
  const passwordBytes = new TextEncoder().encode(password);
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToBase64Url(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
