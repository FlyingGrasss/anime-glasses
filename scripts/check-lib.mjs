#!/usr/bin/env node
/**
 * Small dependency-free unit check for the pure helpers in src/lib/anime.ts.
 * The TypeScript source is transpiled with the installed compiler and imported
 * from a data URL, so this works without a test runner or bundler.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const sourceUrl = new URL("../src/lib/anime.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    isolatedModules: true,
  },
  fileName: "anime.ts",
}).outputText;

const lib = await import(
  `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
);
const {
  ARCHETYPES,
  PHRASES,
  pickArchetype,
  pickPhrase,
  computeFaceGeometry,
  createCenteredFaceGeometry,
  smoothFaceGeometry,
} = lib;

let checks = 0;
function check(name, fn) {
  try {
    fn();
    checks += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
}

console.log("Anime Gözlük — src/lib/anime.ts kontrolleri");

check("en az 6 benzersiz kişilik arketipi var", () => {
  assert.ok(ARCHETYPES.length >= 6);
  assert.equal(new Set(ARCHETYPES.map((item) => item.id)).size, ARCHETYPES.length);
  for (const item of ARCHETYPES) {
    assert.ok(item.name.trim().length > 0);
    assert.ok(item.tagline.trim().length > 0);
  }
});

check("pickArchetype deterministik ve sınırlarda güvenli", () => {
  assert.equal(pickArchetype(() => 0).id, ARCHETYPES[0].id);
  assert.equal(pickArchetype(() => 0.5).id, ARCHETYPES[Math.floor(ARCHETYPES.length / 2)].id);
  assert.equal(pickArchetype(() => 1).id, ARCHETYPES[ARCHETYPES.length - 1].id);
  assert.equal(pickArchetype(() => Number.NaN).id, ARCHETYPES[0].id);
  assert.equal(pickArchetype(() => -2).id, ARCHETYPES[0].id);
  assert.equal(pickArchetype(() => 2).id, ARCHETYPES[ARCHETYPES.length - 1].id);
});

check("konuşma balonu replikleri istenen ifadeleri içeriyor", () => {
  for (const phrase of ["Nani?!", "Sugoi!", "Baka!", "Yosh!"]) {
    assert.ok(PHRASES.includes(phrase), `${phrase} eksik`);
  }
  assert.equal(pickPhrase(() => 0), PHRASES[0]);
  assert.equal(pickPhrase(() => 1), PHRASES[PHRASES.length - 1]);
});

const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
const setLandmark = (index, x, y) => {
  landmarks[index] = { x, y };
};
setLandmark(33, 0.35, 0.42);
setLandmark(133, 0.43, 0.42);
setLandmark(159, 0.39, 0.4);
setLandmark(145, 0.39, 0.44);
setLandmark(362, 0.57, 0.42);
setLandmark(263, 0.65, 0.42);
setLandmark(386, 0.61, 0.4);
setLandmark(374, 0.61, 0.44);
setLandmark(10, 0.5, 0.25);
setLandmark(152, 0.5, 0.78);
setLandmark(234, 0.3, 0.5);
setLandmark(454, 0.7, 0.5);
setLandmark(1, 0.5, 0.55);
setLandmark(61, 0.42, 0.68);
setLandmark(291, 0.58, 0.68);

check("landmark'lardan göz geometrisi doğru sırada üretiliyor", () => {
  const face = computeFaceGeometry(landmarks, 1000, 1000);
  assert.ok(face, "geometri null olmamalı");
  assert.ok(face.leftEye.cx < face.rightEye.cx);
  assert.ok(Math.abs(face.leftEye.cx - 390) < 1);
  assert.ok(Math.abs(face.rightEye.cx - 610) < 1);
  assert.ok(face.leftEye.rx > 40 && face.leftEye.rx < 100);
  assert.ok(face.leftEye.ry >= face.leftEye.rx);
  assert.ok(face.leftCheek.cx < 500 && face.rightCheek.cx > 500);
  assert.ok(face.leftEar.y < face.bounds.top + 30);
  assert.ok(face.earWidth > 0 && face.earHeight > 0);
  assert.ok(Number.isFinite(face.tilt));
  assert.ok(face.bounds.bottom > face.bounds.top);
});

check("eksik landmark verisi null döndürüyor", () => {
  assert.equal(computeFaceGeometry([], 1000, 1000), null);
  assert.equal(computeFaceGeometry(landmarks, 0, 1000), null);
  assert.equal(computeFaceGeometry(landmarks.slice(0, 30), 1000, 1000), null);
});

check("basit modun merkezli yüzü geçerli ve tuval içinde", () => {
  const face = createCenteredFaceGeometry(1280, 720);
  assert.ok(face.leftEye.rx > 0 && face.leftEye.ry > 0);
  assert.ok(face.leftEye.cx < face.rightEye.cx);
  assert.ok(face.leftCheek.cx < 640 && face.rightCheek.cx > 640);
  assert.ok(face.bounds.left > 0 && face.bounds.right < 1280);
  assert.ok(face.bounds.top > 0 && face.bounds.bottom < 720);
  assert.ok(face.leftEar.y - face.earHeight > 0, "kedi kulağı tuvalin dışına taşmamalı");
});

check("geometri yumuşatma sınır değerlerinde doğru", () => {
  const a = createCenteredFaceGeometry(1000, 1000);
  const b = createCenteredFaceGeometry(1000, 1000);
  b.leftEye.cx += 100;
  b.leftEye.cy += 40;

  assert.equal(smoothFaceGeometry(null, b), b);
  assert.equal(smoothFaceGeometry(a, b, 0).leftEye.cx, a.leftEye.cx);
  assert.equal(smoothFaceGeometry(a, b, 1).leftEye.cx, b.leftEye.cx);

  const middle = smoothFaceGeometry(a, b, 0.5);
  assert.ok(Math.abs(middle.leftEye.cx - (a.leftEye.cx + 50)) < 1e-9);
  assert.ok(middle.rightEye.cx === a.rightEye.cx);
});

console.log(`\n${checks} kontrol geçti.`);
