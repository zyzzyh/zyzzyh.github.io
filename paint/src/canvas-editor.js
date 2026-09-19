import { History } from "./history.js";

export const DEFAULT_CANVAS_WIDTH = 1600;
export const DEFAULT_CANVAS_HEIGHT = 1000;
export const MIN_CANVAS_SIZE = 320;
export const MAX_CANVAS_SIZE = 4096;

const MIN_POINT_DISTANCE = 0.65;
const MAX_DEVICE_PIXEL_RATIO = 3;
const TARGET_MAX_RENDER_PIXELS = 16000000;

export class CanvasEditor {
  constructor(
    canvas,
    {
      onChange = () => {},
      onStrokeStarted = () => {},
      onStrokePoints = () => {},
      onStrokeCommitted = () => {},
    } = {},
  ) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.onChange = onChange;
    this.onStrokeStarted = onStrokeStarted;
    this.onStrokePoints = onStrokePoints;
    this.onStrokeCommitted = onStrokeCommitted;

    this.strokes = [];
    this.remotePreviews = new Map();
    this.activeStroke = null;
    this.stateBeforeStroke = null;
    this.activePointerId = null;
    this.tool = "brush";
    this.color = "#1f2622";
    this.brushSize = 7;
    this.width = DEFAULT_CANVAS_WIDTH;
    this.height = DEFAULT_CANVAS_HEIGHT;
    this.devicePixelRatio = 1;
    this.history = new History();

    this.resize();
    this.bindEvents();
  }

  resize() {
    const requestedPixelRatio = Math.min(
      Math.max(window.devicePixelRatio || 1, 1),
      MAX_DEVICE_PIXEL_RATIO,
    );
    const pixelLimitRatio = Math.sqrt(
      TARGET_MAX_RENDER_PIXELS / (this.width * this.height),
    );

    this.devicePixelRatio = Math.max(
      1,
      Math.min(requestedPixelRatio, pixelLimitRatio),
    );

    const pixelWidth = Math.round(this.width * this.devicePixelRatio);
    const pixelHeight = Math.round(this.height * this.devicePixelRatio);

    if (
      this.canvas.width !== pixelWidth ||
      this.canvas.height !== pixelHeight
    ) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.redraw();
    }

    this.context.setTransform(
      this.devicePixelRatio,
      0,
      0,
      this.devicePixelRatio,
      0,
      0,
    );
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) =>
      this.handlePointerDown(event),
    );
    this.canvas.addEventListener("pointermove", (event) =>
      this.handlePointerMove(event),
    );
    this.canvas.addEventListener("pointerup", (event) =>
      this.handlePointerEnd(event),
    );
    this.canvas.addEventListener("pointercancel", (event) =>
      this.handlePointerEnd(event),
    );
  }

  handlePointerDown(event) {
    const isPrimaryMouseButton =
      event.pointerType !== "mouse" || event.button === 0;

    if (!event.isPrimary || !isPrimaryMouseButton || this.activeStroke) {
      return;
    }

    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    this.activePointerId = event.pointerId;
    this.stateBeforeStroke = [...this.strokes];

    const point = this.pointFromEvent(event);
    this.activeStroke = {
      id: this.createStrokeId(),
      tool: this.tool,
      color: this.color,
      width: this.brushSize,
      points: [point],
    };

    this.onStrokeStarted(this.cloneStroke(this.activeStroke));
    this.drawStroke(this.activeStroke);
  }

  handlePointerMove(event) {
    if (
      !this.activeStroke ||
      event.pointerId !== this.activePointerId
    ) {
      return;
    }

    event.preventDefault();

    const events =
      typeof event.getCoalescedEvents === "function"
        ? event.getCoalescedEvents()
        : [event];

    const addedPoints = [];

    for (const pointerEvent of events) {
      const point = this.pointFromEvent(pointerEvent);
      const previousPoint =
        this.activeStroke.points[this.activeStroke.points.length - 1];

      if (this.distanceBetween(previousPoint, point) < MIN_POINT_DISTANCE) {
        continue;
      }

      this.activeStroke.points.push(point);
      addedPoints.push(point);
      this.drawSegment(previousPoint, point, this.activeStroke);
    }

    if (addedPoints.length > 0) {
      this.onStrokePoints(
        this.activeStroke.id,
        addedPoints.map((point) => ({ ...point })),
      );
    }
  }

  handlePointerEnd(event) {
    if (
      !this.activeStroke ||
      event.pointerId !== this.activePointerId
    ) {
      return;
    }

    event.preventDefault();

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    const completedStroke = this.activeStroke;
    const previousState = this.stateBeforeStroke;

    this.activeStroke = null;
    this.stateBeforeStroke = null;
    this.activePointerId = null;

    if (completedStroke && completedStroke.points.length > 0) {
      this.history.record(previousState);
      this.strokes.push(completedStroke);
      this.onStrokeCommitted(completedStroke);
      this.notifyChange();
    }
  }

  pointFromEvent(event) {
    const bounds = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * this.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * this.height;

    return {
      x: Math.max(0, Math.min(this.width, x)),
      y: Math.max(0, Math.min(this.height, y)),
      pressure:
        event.pointerType === "pen"
          ? Math.max(0.05, Math.min(1, event.pressure || 0.5))
          : 0.5,
    };
  }

  drawSegment(from, to, stroke) {
    const context = this.context;

    context.save();
    this.applyStrokeStyle(context, stroke);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.restore();
  }

  drawStroke(stroke) {
    this.drawStrokeOnContext(this.context, stroke);
  }

  drawStrokeOnContext(context, stroke) {
    if (!stroke || stroke.points.length === 0) {
      return;
    }

    const points = stroke.points;

    context.save();
    this.applyStrokeStyle(context, stroke);

    if (points.length === 1) {
      context.beginPath();
      context.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);

    for (let index = 1; index < points.length - 1; index += 1) {
      const currentPoint = points[index];
      const nextPoint = points[index + 1];
      const midpointX = (currentPoint.x + nextPoint.x) / 2;
      const midpointY = (currentPoint.y + nextPoint.y) / 2;

      context.quadraticCurveTo(
        currentPoint.x,
        currentPoint.y,
        midpointX,
        midpointY,
      );
    }

    const lastPoint = points[points.length - 1];
    context.lineTo(lastPoint.x, lastPoint.y);
    context.stroke();
    context.restore();
  }

  applyStrokeStyle(context, stroke) {
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = stroke.width;
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
  }

  redraw() {
    this.context.save();
    this.context.setTransform(
      this.devicePixelRatio,
      0,
      0,
      this.devicePixelRatio,
      0,
      0,
    );
    this.context.clearRect(0, 0, this.width, this.height);

    for (const stroke of this.strokes) {
      this.drawStrokeOnContext(this.context, stroke);
    }

    for (const preview of this.remotePreviews.values()) {
      this.drawStrokeOnContext(this.context, preview);
    }

    if (this.activeStroke) {
      this.drawStrokeOnContext(this.context, this.activeStroke);
    }

    this.context.restore();
  }

  setTool(tool) {
    if (tool !== "brush" && tool !== "eraser") {
      throw new Error(`Unsupported tool: ${tool}`);
    }

    this.tool = tool;
    this.notifyChange();
  }

  setColor(color) {
    this.color = color;
    if (this.tool === "eraser") {
      this.tool = "brush";
    }
    this.notifyChange();
  }

  setBrushSize(size) {
    const numericSize = Number(size);
    this.brushSize = Math.max(1, Math.min(64, numericSize));
    this.notifyChange();
  }

  undo() {
    const previousState = this.history.undo([...this.strokes]);

    if (!previousState) {
      return false;
    }

    this.strokes = previousState;
    this.redraw();
    this.notifyChange();
    return true;
  }

  redo() {
    const nextState = this.history.redo([...this.strokes]);

    if (!nextState) {
      return false;
    }

    this.strokes = nextState;
    this.redraw();
    this.notifyChange();
    return true;
  }

  clear() {
    if (this.strokes.length === 0) {
      return false;
    }

    this.history.record([...this.strokes]);
    this.strokes = [];
    this.redraw();
    this.notifyChange();
    return true;
  }

  get hasStrokes() {
    return this.strokes.length > 0;
  }

  hasStroke(strokeId) {
    return this.strokes.some((stroke) => stroke.id === strokeId);
  }

  addRemoteStroke(strokePayload) {
    const stroke = this.normalizeStroke(strokePayload);

    if (!stroke || this.hasStroke(stroke.id)) {
      return false;
    }

    this.history.record([...this.strokes]);
    this.strokes.push(stroke);
    this.remotePreviews.delete(stroke.id);
    this.redraw();
    this.notifyChange();
    return true;
  }

  replaceSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.strokes)) {
      return false;
    }

    const width = this.normalizeCanvasDimension(
      snapshot.width,
      DEFAULT_CANVAS_WIDTH,
    );
    const height = this.normalizeCanvasDimension(
      snapshot.height,
      DEFAULT_CANVAS_HEIGHT,
    );

    this.setCanvasSize(width, height, {
      clear: true,
      notify: false,
    });

    const strokes = snapshot.strokes
      .map((stroke) => this.normalizeStroke(stroke))
      .filter(Boolean);

    this.strokes = strokes;
    this.redraw();
    this.notifyChange();
    return true;
  }

  setCanvasSize(
    width,
    height,
    {
      clear = true,
      notify = true,
    } = {},
  ) {
    const nextWidth = this.normalizeCanvasDimension(width, this.width);
    const nextHeight = this.normalizeCanvasDimension(height, this.height);

    if (
      nextWidth === this.width &&
      nextHeight === this.height &&
      !clear
    ) {
      return false;
    }

    this.discardActiveStroke();
    this.width = nextWidth;
    this.height = nextHeight;

    if (clear) {
      this.strokes = [];
      this.remotePreviews.clear();
      this.history.reset();
    }

    this.resize();
    this.redraw();

    if (notify) {
      this.notifyChange();
    }

    return true;
  }

  startRemotePreview(strokePayload) {
    const stroke = this.normalizeStroke(strokePayload);

    if (!stroke || this.hasStroke(stroke.id)) {
      return false;
    }

    this.remotePreviews.set(stroke.id, stroke);
    this.redraw();
    return true;
  }

  appendRemotePreview(strokeId, pointsPayload) {
    const preview = this.remotePreviews.get(strokeId);

    if (!preview || !Array.isArray(pointsPayload)) {
      return false;
    }

    for (const pointPayload of pointsPayload) {
      const point = this.normalizePoint(pointPayload);

      if (!point) {
        continue;
      }

      const previousPoint = preview.points[preview.points.length - 1];

      if (
        previousPoint &&
        this.distanceBetween(previousPoint, point) < MIN_POINT_DISTANCE
      ) {
        continue;
      }

      preview.points.push(point);

      if (previousPoint) {
        this.drawSegment(previousPoint, point, preview);
      }
    }

    return true;
  }

  getSnapshot() {
    return {
      version: 2,
      width: this.width,
      height: this.height,
      strokes: this.strokes.map((stroke) => this.cloneStroke(stroke)),
    };
  }

  async exportPNG() {
    const paintCanvas = document.createElement("canvas");
    paintCanvas.width = this.width;
    paintCanvas.height = this.height;

    const paintContext = paintCanvas.getContext("2d");

    for (const stroke of this.strokes) {
      this.drawStrokeOnContext(paintContext, stroke);
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = this.width;
    exportCanvas.height = this.height;

    const exportContext = exportCanvas.getContext("2d");
    exportContext.fillStyle = "#ffffff";
    exportContext.fillRect(0, 0, this.width, this.height);
    exportContext.drawImage(paintCanvas, 0, 0);

    const blob = await new Promise((resolve) => {
      exportCanvas.toBlob(resolve, "image/png");
    });

    if (!blob) {
      throw new Error("PNG export failed.");
    }

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = downloadUrl;
    link.download = `paint-${date}.png`;
    link.click();

    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  notifyChange() {
    this.onChange({
      strokeCount: this.strokes.length,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      tool: this.tool,
      brushSize: this.brushSize,
      canvasWidth: this.width,
      canvasHeight: this.height,
    });
  }

  createStrokeId() {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  normalizeStroke(stroke) {
    if (
      !stroke ||
      typeof stroke.id !== "string" ||
      !Array.isArray(stroke.points) ||
      stroke.points.length === 0
    ) {
      return null;
    }

    const tool = stroke.tool === "eraser" ? "eraser" : "brush";
    const width = Number(stroke.width);

    if (!Number.isFinite(width)) {
      return null;
    }

    const points = stroke.points
      .map((point) => this.normalizePoint(point))
      .filter(Boolean);

    if (points.length === 0) {
      return null;
    }

    return {
      id: stroke.id,
      tool,
      color:
        typeof stroke.color === "string" ? stroke.color : "#1f2622",
      width: Math.max(1, Math.min(64, width)),
      points,
    };
  }

  cloneStroke(stroke) {
    return {
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    };
  }

  normalizePoint(point) {
    if (!point) {
      return null;
    }

    const x = Number(point.x);
    const y = Number(point.y);
    const pressure = Number(point.pressure);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    return {
      x: Math.max(0, Math.min(this.width, x)),
      y: Math.max(0, Math.min(this.height, y)),
      pressure: Number.isFinite(pressure)
        ? Math.max(0, Math.min(1, pressure))
        : 0.5,
    };
  }

  normalizeCanvasDimension(value, fallback) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    return Math.max(
      MIN_CANVAS_SIZE,
      Math.min(MAX_CANVAS_SIZE, Math.round(numericValue)),
    );
  }

  discardActiveStroke() {
    if (
      this.activePointerId !== null &&
      this.canvas.hasPointerCapture(this.activePointerId)
    ) {
      this.canvas.releasePointerCapture(this.activePointerId);
    }

    this.activeStroke = null;
    this.stateBeforeStroke = null;
    this.activePointerId = null;
  }

  distanceBetween(firstPoint, secondPoint) {
    return Math.hypot(
      secondPoint.x - firstPoint.x,
      secondPoint.y - firstPoint.y,
    );
  }
}
