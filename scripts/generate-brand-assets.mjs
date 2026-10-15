import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// The editable mark and outlined wordmarks are the sources of truth.
// Sharp is already installed by Next.js; this script needs no network or secrets.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mark = await readFile(
  resolve(root, "public/brand/tradepilot-mark.svg"),
  "utf8",
);
const shapes = mark.match(/<path\b[^>]*\/>/g)?.join("\n");
if (!shapes) throw new Error("The brand mark has no vector paths");
const tile = (radius) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="#28624B"/>${shapes}</svg>`;
const render = (source, width) =>
  sharp(Buffer.from(source), { density: 288 })
    .resize({ width })
    .png()
    .toBuffer();
const wordmark = await readFile(
  resolve(root, "public/brand/tradepilot-wordmark.svg"),
  "utf8",
);
const wordShapes = wordmark.match(/<path\b[^>]*\/>/g)?.join("\n");
const wordWidth = Number(wordmark.match(/width="(\d+)"/)?.[1]);
if (!wordShapes || !wordWidth)
  throw new Error("The outlined wordmark is invalid");
for (const [name, textColor] of [
  ["tradepilot-logo", "#1E2E24"],
  ["tradepilot-logo-light", "#F4F1E6"],
]) {
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="${80 + wordWidth}" height="64" viewBox="0 0 ${80 + wordWidth} 64"><title>TradePilot — AI Sales &amp; Trade</title><rect width="64" height="64" rx="16" fill="#28624B"/>${shapes}<g transform="translate(80 10)">${wordShapes.replaceAll("#1E2E24", textColor)}</g></svg>`;
  await writeFile(resolve(root, `public/brand/${name}.svg`), logo + "\n");
}
await writeFile(
  resolve(root, "public/brand/tradepilot-mark-mono.svg"),
  mark.replace(/fill="#[a-f\d]{6}"/gi, 'fill="#28624B"'),
);
const icon = tile(16);
await writeFile(resolve(root, "public/icon.svg"), icon + "\n");
for (const size of [192, 512])
  await writeFile(
    resolve(root, `public/icon-${size}x${size}.png`),
    await render(icon, size),
  );
await writeFile(
  resolve(root, "public/icon-maskable-512x512.png"),
  await render(tile(0), 512),
);
await writeFile(
  resolve(root, "public/apple-touch-icon.png"),
  await render(tile(0), 180),
);
await writeFile(
  resolve(root, "public/brand/tradepilot-mark.png"),
  await render(mark, 1024),
);
for (const name of ["tradepilot-logo", "tradepilot-logo-light"]) {
  const logo = await readFile(
    resolve(root, `public/brand/${name}.svg`),
    "utf8",
  );
  await writeFile(
    resolve(root, `public/brand/${name}.png`),
    await render(logo, 1600),
  );
}

// Multi-size ICO with lossless PNG frames, supported by modern browser engines.
const sizes = [16, 32, 48, 64];
const frames = await Promise.all(sizes.map((size) => render(icon, size)));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(
  resolve(root, "src/app/favicon.ico"),
  Buffer.concat([header, ...frames]),
);
console.log(
  "Generated TradePilot SVG/PNG, mobile icons and 16/32/48/64px favicon from the brand sources.",
);
