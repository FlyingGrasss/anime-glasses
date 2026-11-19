/**
 * Pure anime-effect domain logic.
 *
 * This module intentionally has no imports and no browser dependencies so it
 * can be exercised from `scripts/check-lib.mjs` with plain Node.
 */

export interface Point {
  x: number;
  y: number;
}

export interface EyeShape {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Radians, normalised to [-π/2, π/2] for a natural eye tilt. */
  angle: number;
}

export interface CheekShape {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface FaceBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FaceGeometry {
  leftEye: EyeShape;
  rightEye: EyeShape;
  leftCheek: CheekShape;
  rightCheek: CheekShape;
  leftEar: Point;
  rightEar: Point;
  earWidth: number;
  earHeight: number;
  bubble: Point;
  tilt: number;
  bounds: FaceBounds;
}

export interface Archetype {
  id: string;
  name: string;
  tagline: string;
}

export const ARCHETYPES: readonly Archetype[] = [
  {
    id: "tsundere",
    name: "Tsundere",
    tagline: "Sana aldırış etmiyorum… ama bu kareyi silmeye de kıyamam.",
  },
  {
    id: "kuudere",
    name: "Kuudere",
    tagline: "Duygularımı göstermem. Kanıt mı? İşte, bu fotoğraf.",
  },
  {
    id: "genki",
    name: "Genki",
    tagline: "Enerji seviyesi: sonsuz! Bir poz daha, hadi!",
  },
  {
    id: "dandere",
    name: "Dandere",
    tagline: "Utandım… ama kapüşonumun altından gülümsüyorum.",
  },
  {
    id: "yandere",
    name: "Yandere",
    tagline: "Bu kare artık benim. Sonsuza kadar benim.",
  },
  {
    id: "chuunibyou",
    name: "Chuunibyou",
    tagline: "Karanlık güçler bu pozu asla unutmayacak!",
  },
  {
    id: "neko",
    name: "Neko",
    tagline: "Miyav! Kulaklar sadece aksesuar, yemin ederim.",
  },
  {
    id: "himedere",
    name: "Himedere",
    tagline: "Bu poz bir prensese yakışır. Tabii ki bana.",
  },
];

export const PHRASES: readonly string[] = [
  "Nani?!",
  "Sugoi!",
  "Baka!",
  "Yosh!",
  "Kawaii!",
  "Yatta!",
  "Nyaa~",
  "Itadakimasu!",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pickFrom<T>(items: readonly T[], random: () => number): T {
  const raw = random();
  const safe = Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0;
  return items[Math.floor(safe * items.length)];
}

/** Picks an archetype with an injectable random source for repeatable tests. */
export function pickArchetype(random: () => number = Math.random): Archetype {
  return pickFrom(ARCHETYPES, random);
}

/** Picks a speech-bubble phrase with an injectable random source. */
export function pickPhrase(random: () => number = Math.random): string {
  return pickFrom(PHRASES, random);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface EyeCorners {
  outer: Point;
  inner: Point;
  top: Point;
  bottom: Point;
}

function eyeShapeFromCorners(corners: EyeCorners): EyeShape {
  const dx = corners.inner.x - corners.outer.x;
  const dy = corners.inner.y - corners.outer.y;
  let angle = Math.atan2(dy, dx);

  // The two eyes use opposite outer-to-inner directions. Normalise both so a
  // level head produces an angle near zero instead of a 180° flip.
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;

  const eyeWidth = distance(corners.outer, corners.inner);
  const eyeHeight = distance(corners.top, corners.bottom);
  const center = midpoint(corners.outer, corners.inner);
  const rx = Math.max(1, eyeWidth * 0.72);
  const ry = Math.max(1, Math.max(rx * 1.05, eyeHeight * 1.1));

  return {
    cx: center.x,
    cy: center.y - ry * 0.08,
    rx,
    ry,
    angle: clamp(angle, -0.5, 0.5),
  };
}

/**
 * Converts MediaPipe face landmarks (normalised 0..1) into a drawable,
 * pixel-space anime face. Returns null when the required landmarks are absent
 * or the face is too small to be useful.
 */
export function computeFaceGeometry(
  landmarks: readonly Point[],
  width: number,
  height: number,
): FaceGeometry | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const requiredIndices = [10, 33, 133, 159, 145, 152, 234, 362, 263, 386, 374, 454];
  if (
    landmarks.length <= Math.max(...requiredIndices) ||
    requiredIndices.some((index) => {
      const point = landmarks[index];
      return !point || !Number.isFinite(point.x) || !Number.isFinite(point.y);
    })
  ) {
    return null;
  }

  const toPixels = (index: number): Point => ({
    x: landmarks[index].x * width,
    y: landmarks[index].y * height,
  });

  const forehead = toPixels(10);
  const chin = toPixels(152);
  const faceLeft = toPixels(234);
  const faceRight = toPixels(454);

  const faceWidth = Math.max(distance(faceLeft, faceRight), Math.abs(faceRight.x - faceLeft.x));
  const faceHeight = Math.abs(chin.y - forehead.y);
  if (faceWidth < 8 || faceHeight < 8) return null;

  const eyeA = eyeShapeFromCorners({
    outer: toPixels(33),
    inner: toPixels(133),
    top: toPixels(159),
    bottom: toPixels(145),
  });
  const eyeB = eyeShapeFromCorners({
    outer: toPixels(362),
    inner: toPixels(263),
    top: toPixels(386),
    bottom: toPixels(374),
  });

  const maxRx = faceWidth * 0.24;
  const maxRy = faceHeight * 0.2;
  const leftEye = eyeA.cx <= eyeB.cx ? eyeA : eyeB;
  const rightEye = eyeA.cx <= eyeB.cx ? eyeB : eyeA;

  for (const eye of [leftEye, rightEye]) {
    eye.rx = clamp(eye.rx, faceWidth * 0.08, maxRx);
    eye.ry = clamp(eye.ry, faceWidth * 0.08, maxRy);
    eye.cy = clamp(eye.cy, forehead.y, chin.y);
  }

  const centerX = (faceLeft.x + faceRight.x) / 2;
  const eyeMidY = (leftEye.cy + rightEye.cy) / 2;
  const cheekY = clamp(eyeMidY + faceHeight * 0.24, eyeMidY + faceHeight * 0.08, chin.y);
  const cheekRx = faceWidth * 0.115;
  const cheekRy = faceWidth * 0.07;
  const tilt = clamp(
    Math.atan2(rightEye.cy - leftEye.cy, rightEye.cx - leftEye.cx),
    -0.5,
    0.5,
  );

  const bubble = {
    x: rightEye.cx + faceWidth * 0.32,
    y: forehead.y - faceHeight * 0.06,
  };

  return {
    leftEye,
    rightEye,
    leftCheek: {
      cx: centerX - faceWidth * 0.26,
      cy: cheekY,
      rx: cheekRx,
      ry: cheekRy,
    },
    rightCheek: {
      cx: centerX + faceWidth * 0.26,
      cy: cheekY,
      rx: cheekRx,
      ry: cheekRy,
    },
    leftEar: {
      x: centerX - faceWidth * 0.28,
      y: forehead.y + faceHeight * 0.015,
    },
    rightEar: {
      x: centerX + faceWidth * 0.28,
      y: forehead.y + faceHeight * 0.015,
    },
    earWidth: faceWidth * 0.24,
    earHeight: faceHeight * 0.26,
    bubble,
    tilt,
    bounds: {
      left: Math.min(faceLeft.x, faceRight.x),
      top: forehead.y,
      right: Math.max(faceLeft.x, faceRight.x),
      bottom: chin.y,
    },
  };
}

/**
 * Builds the fallback face used by "basit mod": a centred oval that the user
 * aligns manually. It deliberately needs no model or landmark data.
 */
export function createCenteredFaceGeometry(width: number, height: number): FaceGeometry {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const faceWidth = Math.min(safeWidth * 0.5, safeHeight * 0.44);
  const faceHeight = faceWidth * 1.3;
  const centerX = safeWidth / 2;
  const faceTop = safeHeight * 0.46 - faceHeight / 2;
  const eyeY = faceTop + faceHeight * 0.39;
  const eyeOffset = faceWidth * 0.22;
  const eyeRx = faceWidth * 0.13;
  const eyeRy = eyeRx * 1.12;
  const cheekY = faceTop + faceHeight * 0.61;

  return {
    leftEye: {
      cx: centerX - eyeOffset,
      cy: eyeY,
      rx: eyeRx,
      ry: eyeRy,
      angle: -0.06,
    },
    rightEye: {
      cx: centerX + eyeOffset,
      cy: eyeY,
      rx: eyeRx,
      ry: eyeRy,
      angle: 0.06,
    },
    leftCheek: {
      cx: centerX - faceWidth * 0.31,
      cy: cheekY,
      rx: faceWidth * 0.11,
      ry: faceWidth * 0.065,
    },
    rightCheek: {
      cx: centerX + faceWidth * 0.31,
      cy: cheekY,
      rx: faceWidth * 0.11,
      ry: faceWidth * 0.065,
    },
    leftEar: {
      x: centerX - faceWidth * 0.29,
      y: faceTop + faceHeight * 0.015,
    },
    rightEar: {
      x: centerX + faceWidth * 0.29,
      y: faceTop + faceHeight * 0.015,
    },
    earWidth: faceWidth * 0.25,
    earHeight: faceHeight * 0.25,
    bubble: {
      x: centerX + faceWidth * 0.53,
      y: faceTop - faceHeight * 0.02,
    },
    tilt: 0,
    bounds: {
      left: centerX - faceWidth / 2,
      top: faceTop,
      right: centerX + faceWidth / 2,
      bottom: faceTop + faceHeight,
    },
  };
}

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

function lerpPoint(a: Point, b: Point, alpha: number): Point {
  return { x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha) };
}

/** Exponential smoothing that keeps the overlay calm despite landmark jitter. */
export function smoothFaceGeometry(
  previous: FaceGeometry | null,
  next: FaceGeometry,
  alpha = 0.35,
): FaceGeometry {
  if (!previous) return next;
  const t = clamp(alpha, 0, 1);

  const smoothEye = (a: EyeShape, b: EyeShape): EyeShape => ({
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    rx: lerp(a.rx, b.rx, t),
    ry: lerp(a.ry, b.ry, t),
    angle: lerp(a.angle, b.angle, t),
  });
  const smoothCheek = (a: CheekShape, b: CheekShape): CheekShape => ({
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    rx: lerp(a.rx, b.rx, t),
    ry: lerp(a.ry, b.ry, t),
  });

  return {
    leftEye: smoothEye(previous.leftEye, next.leftEye),
    rightEye: smoothEye(previous.rightEye, next.rightEye),
    leftCheek: smoothCheek(previous.leftCheek, next.leftCheek),
    rightCheek: smoothCheek(previous.rightCheek, next.rightCheek),
    leftEar: lerpPoint(previous.leftEar, next.leftEar, t),
    rightEar: lerpPoint(previous.rightEar, next.rightEar, t),
    earWidth: lerp(previous.earWidth, next.earWidth, t),
    earHeight: lerp(previous.earHeight, next.earHeight, t),
    bubble: lerpPoint(previous.bubble, next.bubble, t),
    tilt: lerp(previous.tilt, next.tilt, t),
    bounds: {
      left: lerp(previous.bounds.left, next.bounds.left, t),
      top: lerp(previous.bounds.top, next.bounds.top, t),
      right: lerp(previous.bounds.right, next.bounds.right, t),
      bottom: lerp(previous.bounds.bottom, next.bounds.bottom, t),
    },
  };
}
