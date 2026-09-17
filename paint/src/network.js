const DATA_CHANNEL_LABEL = "paint";
const MAX_CHUNK_LENGTH = 12000;
const ICE_GATHERING_TIMEOUT = 6500;

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
    const compressedStream = new Blob([bytes])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    const compressed = new Uint8Array(
      await new Response(compressedStream).arrayBuffer(),
    );

    return `1.${bytesToBase64Url(compressed)}`;
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

  if (version === "1") {
    if (typeof DecompressionStream !== "function") {
      throw new Error("当前浏览器无法读取该邀请码。");
    }

    const decompressedStream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    bytes = new Uint8Array(
      await new Response(decompressedStream).arrayBuffer(),
    );
  } else if (version !== "0") {
    throw new Error("邀请码版本不受支持。");
  }

  return new TextDecoder().decode(bytes);
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
    } = {},
  ) {
    this.editor = editor;
    this.onStatusChange = onStatusChange;
    this.onError = onError;

    this.peer = null;
    this.channel = null;
    this.role = null;
    this.sequence = 0;
    this.lastSequence = 0;
    this.ready = false;
    this.status = "idle";
    this.closedByUser = false;
    this.incomingChunks = new Map();
    this.chunkId = 0;
  }

  get connected() {
    return this.ready && this.channel?.readyState === "open";
  }

  async createHostOffer() {
    this.resetConnection({ keepStatus: true });
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

    const signal = await encodeSignal(peer.localDescription.sdp);
    this.setStatus("waiting", "等待回答码");
    return signal;
  }

  async acceptHostAnswer(answerSignal) {
    if (!this.peer || this.role !== "host") {
      throw new Error("请先创建邀请。");
    }

    const sdp = await decodeSignal(answerSignal);
    await this.peer.setRemoteDescription({ type: "answer", sdp });
    this.setStatus("connecting", "正在建立连接");
  }

  async createGuestAnswer(offerSignal) {
    this.resetConnection({ keepStatus: true });
    this.role = "guest";
    this.setStatus("connecting", "正在生成回答码");

    const sdp = await decodeSignal(offerSignal);
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

    const signal = await encodeSignal(peer.localDescription.sdp);
    this.setStatus("waiting", "等待房主连接");
    return signal;
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
        this.setStatus("error", "连接失败");
      } else if (peer.connectionState === "disconnected") {
        this.setStatus("connecting", "连接暂时中断");
      }
    });

    return peer;
  }

  configureChannel(channel) {
    this.channel = channel;

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
        this.setStatus("disconnected", "连接已断开");
      }
    });

    channel.addEventListener("error", () => {
      if (this.channel !== channel) {
        return;
      }

      if (!this.closedByUser) {
        this.setStatus("error", "连接发生错误");
      }
    });
  }

  sendSnapshot() {
    this.sendMessage({
      type: "snapshot",
      seq: this.sequence,
      snapshot: this.editor.getSnapshot(),
    });
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
      default:
        break;
    }
  }

  applySnapshot(message) {
    if (!this.editor.replaceSnapshot(message.snapshot)) {
      return;
    }

    this.lastSequence = Number(message.seq) || 0;

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
    this.incomingChunks.clear();

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
