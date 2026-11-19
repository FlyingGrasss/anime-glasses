#!/usr/bin/env node
/**
 * Copies the MediaPipe Tasks Vision WASM runtime and the Face Landmarker model
 * into public/mediapipe so the demo can run fully offline.
 *
 * Usage:
 *   node scripts/prepare-mediapipe.mjs          # copy missing assets, download model
 *   node scripts/prepare-mediapipe.mjs --check  # verify assets only, no network
 */
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceWasmDir = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const publicDir = path.join(root, "public", "mediapipe");
const targetWasmDir = path.join(publicDir, "wasm");
const modelPath = path.join(publicDir, "face_landmarker.task");
const manifestPath = path.join(publicDir, "manifest.json");

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MODEL_MIN_BYTES = 3_000_000;

const checkOnly = process.argv.includes("--check");

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyWasm() {
  if (!(await exists(sourceWasmDir))) {
    throw new Error(
      "MediaPipe wasm klasörü bulunamadı. Önce `pnpm install` çalıştırın.",
    );
  }

  await mkdir(targetWasmDir, { recursive: true });
  const entries = await readdir(sourceWasmDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  let copied = 0;

  for (const file of files) {
    const source = path.join(sourceWasmDir, file.name);
    const target = path.join(targetWasmDir, file.name);
    if (!(await exists(target))) {
      await copyFile(source, target);
      copied += 1;
    }
  }

  return { total: files.length, copied };
}

async function downloadModel() {
  if (await exists(modelPath)) {
    const info = await stat(modelPath);
    if (info.size >= MODEL_MIN_BYTES) {
      return { downloaded: false, bytes: info.size };
    }
  }

  console.log("Face Landmarker modeli indiriliyor (yaklaşık 3.6 MB)…");
  const response = await fetch(MODEL_URL, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Model indirilemedi: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < MODEL_MIN_BYTES) {
    throw new Error(`Model dosyası beklenenden küçük: ${buffer.byteLength} bayt`);
  }

  await mkdir(publicDir, { recursive: true });
  await writeFile(modelPath, buffer);
  return { downloaded: true, bytes: buffer.byteLength };
}

async function writeManifest(washInfo, modelInfo) {
  const wasmFiles = await readdir(targetWasmDir);
  const modelBuffer = await readFile(modelPath);
  const manifest = {
    generatedBy: "scripts/prepare-mediapipe.mjs",
    mediapipePackage: "@mediapipe/tasks-vision@1.2.3",
    model: {
      file: "face_landmarker.task",
      source: MODEL_URL,
      bytes: modelInfo.bytes,
      sha256: createHash("sha256").update(modelBuffer).digest("hex"),
    },
    wasmFiles,
    note: "Bu dosyalar yereldir; tarayıcı hiçbir görüntüyü sunucuya göndermez.",
    wasmSourceFiles: washInfo.total,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function verify() {
  const failures = [];
  const wasmFiles = (await exists(targetWasmDir))
    ? await readdir(targetWasmDir)
    : [];

  for (const required of [
    "vision_wasm_internal.js",
    "vision_wasm_internal.wasm",
  ]) {
    if (!wasmFiles.includes(required)) {
      failures.push(`public/mediapipe/wasm/${required}`);
    }
  }

  if (!(await exists(modelPath))) {
    failures.push("public/mediapipe/face_landmarker.task");
  } else {
    const info = await stat(modelPath);
    if (info.size < MODEL_MIN_BYTES) {
      failures.push(`public/mediapipe/face_landmarker.task (${info.size} bayt)`);
    }
  }

  if (failures.length > 0) {
    console.error("Eksik MediaPipe varlıkları:");
    for (const failure of failures) console.error(` - ${failure}`);
    console.error("Düzeltmek için: pnpm prepare:mediapipe");
    return false;
  }

  console.log(`MediaPipe varlıkları hazır (${wasmFiles.length} wasm dosyası + model).`);
  return true;
}

async function main() {
  if (checkOnly) {
    const ok = await verify();
    process.exitCode = ok ? 0 : 1;
    return;
  }

  const wasmInfo = await copyWasm();
  let modelInfo;
  try {
    modelInfo = await downloadModel();
  } catch (error) {
    console.warn(
      `Model indirilemedi: ${error instanceof Error ? error.message : error}`,
    );
    console.warn(
      "Uygulama yine açılır, ancak yüz algılama yerine basit mod kullanılır.",
    );
    console.warn("Modeli daha sonra `pnpm prepare:mediapipe` ile indirebilirsin.");
    return;
  }

  await writeManifest(wasmInfo, modelInfo);

  console.log(
    `WASM: ${wasmInfo.total} dosya hazır (${wasmInfo.copied} yeni kopyalandı).`,
  );
  console.log(
    `Model: ${modelInfo.downloaded ? "indirildi" : "zaten mevcut"} (${modelInfo.bytes} bayt).`,
  );
  console.log("Konum: public/mediapipe/");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(
    "Model indirilemezse uygulama yine açılır; ancak yüz algılama yerine basit mod kullanılır.",
  );
  process.exitCode = 1;
});
