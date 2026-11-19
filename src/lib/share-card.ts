import type { Archetype } from "./anime";

export interface ShareCardInput {
  imageUrl: string;
  archetype: Archetype;
  phrase: string;
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

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Anlık görüntü yüklenemedi."));
    image.src = source;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  let truncated = false;

  for (const word of words) {
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || current.length === 0) {
      current = candidate;
      continue;
    }

    if (lines.length === maxLines - 1) {
      truncated = true;
      break;
    }
    lines.push(current);
    current = word;
  }

  if (current.length > 0) lines.push(current);

  const lastIndex = lines.length - 1;
  if (truncated && lastIndex >= 0) {
    let last = lines[lastIndex];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[lastIndex] = `${last}…`;
  }

  return lines;
}

/**
 * Composes the downloadable personality card locally. The result is a
 * 1080×1350 PNG; no network request or server rendering is involved.
 */
export async function createShareCardBlob(input: ShareCardInput): Promise<Blob> {
  const image = await loadImage(input.imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kart tuvali oluşturulamadı.");

  const fontFamily = '"Segoe UI", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Photo
  const photoX = 80;
  const photoY = 150;
  const photoWidth = 920;
  const photoHeight = 520;
  ctx.save();
  roundedRect(ctx, photoX, photoY, photoWidth, photoHeight, 24);
  ctx.clip();
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(photoX, photoY, photoWidth, photoHeight);
  drawImageCover(ctx, image, photoX, photoY, photoWidth, photoHeight);
  ctx.restore();
  roundedRect(ctx, photoX, photoY, photoWidth, photoHeight, 24);
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Brand row
  ctx.fillStyle = "#e11d48";
  ctx.beginPath();
  ctx.arc(88, 88, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#18181b";
  ctx.font = `600 26px ${fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("ANİME GÖZLÜK", 106, 89);

  const dateLabel = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  ctx.fillStyle = "#71717a";
  ctx.font = `400 22px ${fontFamily}`;
  ctx.textAlign = "right";
  ctx.fillText(dateLabel, 1000, 89);

  // Archetype
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e11d48";
  ctx.font = `600 22px ${fontFamily}`;
  ctx.fillText("KİŞİLİK KARTI", 80, 742);

  ctx.fillStyle = "#18181b";
  ctx.font = `700 88px ${fontFamily}`;
  ctx.fillText(input.archetype.name, 80, 834);

  ctx.fillStyle = "#3f3f46";
  ctx.font = `400 34px ${fontFamily}`;
  const taglineLines = wrapText(ctx, input.archetype.tagline, 920, 3);
  taglineLines.forEach((line, index) => {
    ctx.fillText(line, 80, 900 + index * 48);
  });

  // Speech phrase
  ctx.font = `600 30px ${fontFamily}`;
  const phraseWidth = ctx.measureText(input.phrase).width;
  const pillWidth = phraseWidth + 64;
  const pillY = 1088;
  roundedRect(ctx, 80, pillY, pillWidth, 64, 32);
  ctx.fillStyle = "#fff1f2";
  ctx.fill();
  ctx.strokeStyle = "#fecdd3";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#9f1239";
  ctx.textBaseline = "middle";
  ctx.fillText(input.phrase, 112, pillY + 33);

  // Footer
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 1230);
  ctx.lineTo(1000, 1230);
  ctx.stroke();

  ctx.fillStyle = "#71717a";
  ctx.font = `400 22px ${fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Görüntü cihazdan ayrılmadı.", 80, 1275);
  ctx.textAlign = "right";
  ctx.fillText("Tarayıcıda üretildi", 1000, 1275);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Kart PNG olarak oluşturulamadı."));
    }, "image/png");
  });
}

function two(value: number): string {
  return String(value).padStart(2, "0");
}

export function timestampedFileName(prefix: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}-${two(
    now.getHours(),
  )}${two(now.getMinutes())}`;
  return `${prefix}-${stamp}.png`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
