import type { FaceGeometry } from "@/lib/anime";

const TAU = Math.PI * 2;

export type AnimeLayerKey = "eyes" | "blush" | "sparkles" | "ears" | "bubble";

export interface SparkleParticle {
  /** Horizontal offset relative to the face bounding box. */
  ox: number;
  /** Vertical offset relative to the face bounding box. */
  oy: number;
  /** Radius relative to the face width. */
  size: number;
  phase: number;
  speed: number;
}

export interface AnimeEffectOptions {
  layers: Record<AnimeLayerKey, boolean>;
  /** 0..1 */
  intensity: number;
  mirrored: boolean;
  sourceWidth: number;
  sourceHeight: number;
  phrase: string;
  timeMs: number;
  reduceMotion: boolean;
  sparkles: readonly SparkleParticle[];
}

export const MAX_SPARKLES = 8;

/**
 * Builds the capped sparkle set. There are always at most eight particles;
 * positions are stable for a session so they do not jump between detections.
 */
export function createSparkleParticles(
  random: () => number = Math.random,
): SparkleParticle[] {
  return Array.from({ length: MAX_SPARKLES }, () => ({
    ox: -0.2 + random() * 1.4,
    oy: -0.18 + random() * 1.05,
    size: 0.035 + random() * 0.06,
    phase: random() * TAU,
    speed: 0.6 + random() * 1.1,
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number,
  intensity: number,
): void {
  if (rx < 1 || ry < 1) return;
  const scale = 0.82 + intensity * 0.32;
  const eyeRx = rx * scale;
  const eyeRy = ry * scale;
  const lineWidth = Math.max(1.4, Math.min(eyeRx, eyeRy) * 0.09);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.55 + intensity * 0.45;

  // Sclera
  ctx.beginPath();
  ctx.ellipse(0, 0, eyeRx, eyeRy, 0, 0, TAU);
  ctx.fillStyle = "#fffdfb";
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = "#27272a";
  ctx.stroke();

  // Iris and pupil, clipped to the eye shape.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, eyeRx, eyeRy, 0, 0, TAU);
  ctx.clip();

  const iris = ctx.createLinearGradient(0, -eyeRy * 0.8, 0, eyeRy * 0.9);
  iris.addColorStop(0, "#fda4af");
  iris.addColorStop(0.45, "#e11d48");
  iris.addColorStop(1, "#7f1d1d");
  ctx.beginPath();
  ctx.ellipse(0, eyeRy * 0.08, eyeRx * 0.62, eyeRy * 0.74, 0, 0, TAU);
  ctx.fillStyle = iris;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, eyeRy * 0.12, eyeRx * 0.24, eyeRy * 0.4, 0, 0, TAU);
  ctx.fillStyle = "#18181b";
  ctx.fill();

  // Lower iris glow.
  ctx.beginPath();
  ctx.ellipse(0, eyeRy * 0.5, eyeRx * 0.36, eyeRy * 0.14, 0, 0, Math.PI);
  ctx.fillStyle = "rgba(255, 228, 230, 0.65)";
  ctx.fill();
  ctx.restore();

  // Glossy highlights.
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-eyeRx * 0.25, -eyeRy * 0.3, eyeRx * 0.2, eyeRy * 0.24, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.ellipse(eyeRx * 0.27, eyeRy * 0.28, eyeRx * 0.09, eyeRy * 0.12, 0, 0, TAU);
  ctx.fill();

  // Upper lash line and two small wings.
  ctx.globalAlpha = 0.55 + intensity * 0.45;
  ctx.lineWidth = Math.max(2, eyeRx * 0.14);
  ctx.strokeStyle = "#18181b";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(0, 0, eyeRx, eyeRy, 0, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();

  ctx.lineWidth = Math.max(1.2, eyeRx * 0.06);
  ctx.beginPath();
  ctx.moveTo(-eyeRx * 0.82, -eyeRy * 0.55);
  ctx.lineTo(-eyeRx * 1.04, -eyeRy * 0.8);
  ctx.moveTo(eyeRx * 0.82, -eyeRy * 0.55);
  ctx.lineTo(eyeRx * 1.04, -eyeRy * 0.8);
  ctx.stroke();

  ctx.restore();
}

function drawBlush(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number,
  intensity: number,
): void {
  if (rx < 1 || ry < 1) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.08 + intensity * 0.38;
  ctx.fillStyle = "#fb7185";
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = 0.12 + intensity * 0.32;
  ctx.strokeStyle = "#e11d48";
  ctx.lineWidth = Math.max(1, rx * 0.05);
  ctx.lineCap = "round";
  for (const offset of [-0.38, 0, 0.38]) {
    ctx.beginPath();
    ctx.moveTo(offset * rx - rx * 0.06, -ry * 0.22);
    ctx.lineTo(offset * rx + rx * 0.06, ry * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCatEar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  tilt: number,
  intensity: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.globalAlpha = 0.55 + intensity * 0.45;

  ctx.beginPath();
  ctx.moveTo(-width / 2, 0);
  ctx.lineTo(width / 2, 0);
  ctx.lineTo(0, -height);
  ctx.closePath();
  ctx.fillStyle = "#27272a";
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, width * 0.05);
  ctx.strokeStyle = "#18181b";
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-width * 0.26, -height * 0.1);
  ctx.lineTo(width * 0.26, -height * 0.1);
  ctx.lineTo(0, -height * 0.66);
  ctx.closePath();
  ctx.fillStyle = "#fb7185";
  ctx.globalAlpha = 0.35 + intensity * 0.35;
  ctx.fill();
  ctx.restore();
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.quadraticCurveTo(x + radius * 0.16, y - radius * 0.16, x + radius, y);
  ctx.quadraticCurveTo(x + radius * 0.16, y + radius * 0.16, x, y + radius);
  ctx.quadraticCurveTo(x - radius * 0.16, y + radius * 0.16, x - radius, y);
  ctx.quadraticCurveTo(x - radius * 0.16, y - radius * 0.16, x, y - radius);
  ctx.closePath();
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
  faceCenterX: number,
  phrase: string,
): void {
  const base = Math.min(width, height);
  const fontSize = clamp(base * 0.038, 15, 40);
  const paddingX = fontSize * 0.72;
  const paddingY = fontSize * 0.5;
  const bubbleHeight = fontSize * 2 + paddingY * 2;

  ctx.save();
  ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  const textWidth = ctx.measureText(phrase).width;
  const bubbleWidth = textWidth + paddingX * 2;
  const margin = Math.max(8, base * 0.02);

  let x = anchorX - bubbleWidth / 2;
  let y = anchorY - bubbleHeight - fontSize * 0.5;
  x = clamp(x, margin, Math.max(margin, width - bubbleWidth - margin));
  y = clamp(y, margin, Math.max(margin, height - bubbleHeight - margin));

  const tailBase = clamp(faceCenterX, x + bubbleWidth * 0.24, x + bubbleWidth * 0.76);
  const tailTipY = Math.min(height - margin, y + bubbleHeight + fontSize * 0.8);
  const tailTipX = clamp(faceCenterX, x + bubbleWidth * 0.15, x + bubbleWidth * 0.85);

  // Tail first, so the body covers its base while the outline stays visible.
  ctx.beginPath();
  ctx.moveTo(tailBase - fontSize * 0.32, y + bubbleHeight - 1);
  ctx.lineTo(tailTipX, tailTipY);
  ctx.lineTo(tailBase + fontSize * 0.32, y + bubbleHeight - 1);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, fontSize * 0.06);
  ctx.strokeStyle = "#27272a";
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.shadowColor = "rgba(0, 0, 0, 0.16)";
  ctx.shadowBlur = fontSize * 0.7;
  ctx.shadowOffsetY = fontSize * 0.18;
  roundedRect(ctx, x, y, bubbleWidth, bubbleHeight, fontSize * 0.6);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = Math.max(1.2, fontSize * 0.06);
  ctx.strokeStyle = "#27272a";
  ctx.stroke();

  ctx.fillStyle = "#18181b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(phrase, x + bubbleWidth / 2, y + bubbleHeight / 2 + fontSize * 0.03);
  ctx.restore();
}

/**
 * Draws the complete anime layer for one face. Coordinates are mapped from the
 * detection source (video pixels) into the current target canvas.
 */
export function drawAnimeEffects(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  face: FaceGeometry,
  options: AnimeEffectOptions,
): void {
  if (width <= 0 || height <= 0 || options.sourceWidth <= 0 || options.sourceHeight <= 0) {
    return;
  }

  const sx = width / options.sourceWidth;
  const sy = height / options.sourceHeight;
  const tx = (x: number) => (options.mirrored ? width - x * sx : x * sx);
  const ty = (y: number) => y * sy;
  const angle = (value: number) => (options.mirrored ? -value : value);
  const intensity = clamp(options.intensity, 0, 1);
  const faceWidth = (face.bounds.right - face.bounds.left) * sx;
  const faceHeight = (face.bounds.bottom - face.bounds.top) * sy;
  const faceCenterX = tx((face.bounds.left + face.bounds.right) / 2);

  if (options.layers.ears) {
    const size = 0.85 + intensity * 0.25;
    const earWidth = face.earWidth * sx * size;
    const earHeight = face.earHeight * sy * size;
    drawCatEar(
      ctx,
      tx(face.leftEar.x),
      ty(face.leftEar.y),
      earWidth,
      earHeight,
      angle(face.tilt),
      intensity,
    );
    drawCatEar(
      ctx,
      tx(face.rightEar.x),
      ty(face.rightEar.y),
      earWidth,
      earHeight,
      angle(face.tilt),
      intensity,
    );
  }

  if (options.layers.blush) {
    drawBlush(
      ctx,
      tx(face.leftCheek.cx),
      ty(face.leftCheek.cy),
      face.leftCheek.rx * sx,
      face.leftCheek.ry * sy,
      angle(face.tilt),
      intensity,
    );
    drawBlush(
      ctx,
      tx(face.rightCheek.cx),
      ty(face.rightCheek.cy),
      face.rightCheek.rx * sx,
      face.rightCheek.ry * sy,
      angle(face.tilt),
      intensity,
    );
  }

  if (options.layers.eyes) {
    drawEye(
      ctx,
      tx(face.leftEye.cx),
      ty(face.leftEye.cy),
      face.leftEye.rx * sx,
      face.leftEye.ry * sy,
      angle(face.leftEye.angle),
      intensity,
    );
    drawEye(
      ctx,
      tx(face.rightEye.cx),
      ty(face.rightEye.cy),
      face.rightEye.rx * sx,
      face.rightEye.ry * sy,
      angle(face.rightEye.angle),
      intensity,
    );
  }

  if (options.layers.sparkles) {
    const particles = options.sparkles.slice(0, MAX_SPARKLES);
    const seconds = options.timeMs / 1000;
    const baseSize = Math.min(faceWidth, faceHeight);
    for (const particle of particles) {
      const drift = options.reduceMotion
        ? 0
        : Math.sin(seconds * particle.speed + particle.phase) * faceHeight * 0.025;
      const twinkle = options.reduceMotion
        ? 1
        : 0.5 + 0.5 * Math.sin(seconds * particle.speed * 1.7 + particle.phase);
      const x = tx(face.bounds.left + particle.ox * (face.bounds.right - face.bounds.left));
      const y = ty(face.bounds.top + particle.oy * (face.bounds.bottom - face.bounds.top)) + drift;
      const radius = baseSize * particle.size * (0.75 + twinkle * 0.35);

      ctx.save();
      ctx.globalAlpha = (0.2 + intensity * 0.7) * twinkle;
      drawSparkle(ctx, x, y, Math.max(2, radius));
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.lineWidth = Math.max(0.7, radius * 0.09);
      ctx.strokeStyle = "rgba(24, 24, 27, 0.45)";
      ctx.stroke();
      ctx.restore();
    }
  }

  if (options.layers.bubble) {
    drawSpeechBubble(
      ctx,
      width,
      height,
      tx(face.bubble.x),
      ty(face.bubble.y),
      faceCenterX,
      options.phrase,
    );
  }
}

/** Dashed oval shown in fallback mode before the user aligns their face. */
export function drawSimpleGuide(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  face: FaceGeometry,
): void {
  const cx = ((face.bounds.left + face.bounds.right) / 2);
  const cy = ((face.bounds.top + face.bounds.bottom) / 2);
  const rx = (face.bounds.right - face.bounds.left) / 2;
  const ry = (face.bounds.bottom - face.bounds.top) / 2;
  const dash = Math.max(6, width * 0.009);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.setLineDash([]);
  ctx.lineWidth = Math.max(4, width * 0.006);
  ctx.strokeStyle = "rgba(9, 9, 11, 0.35)";
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.setLineDash([dash, dash * 0.7]);
  ctx.lineWidth = Math.max(1.5, width * 0.0025);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.stroke();
  ctx.restore();
}
