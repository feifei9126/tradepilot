import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { downloadPublicImage } from "./safe-image.mjs";

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegInstaller.path, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-4000) || `ffmpeg exited with ${code}`));
    });
  });
}

async function firstAvailable(paths) {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // Try the next platform font.
    }
  }
  return "";
}

function dimensions(aspectRatio) {
  if (aspectRatio === "16:9") return { width: 854, height: 480 };
  if (aspectRatio === "1:1") return { width: 640, height: 640 };
  return { width: 480, height: 854 };
}

function wrapText(value, charactersPerLine, maxLines) {
  const characters = Array.from(String(value || "").replace(/\s+/g, " ").trim());
  const lines = [];
  for (let index = 0; index < characters.length && lines.length < maxLines; index += charactersPerLine) {
    const line = characters.slice(index, index + charactersPerLine).join("");
    const hasMore = index + charactersPerLine < characters.length;
    lines.push(hasMore && lines.length === maxLines - 1 ? `${line.slice(0, -1)}…` : line);
  }
  return lines.join("\n");
}

const jobFile = readArg("--job-file");
const outputDir = readArg("--output-dir");
if (!jobFile || !outputDir) throw new Error("--job-file and --output-dir are required");

await mkdir(outputDir, { recursive: true });
const handoff = JSON.parse(await readFile(jobFile, "utf8"));
const payload = handoff.payload || {};
const product = payload.product || {};
const video = payload.video || {};
const duration = Math.min(Math.max(Number(video.duration) || 15, 3), 60);
const { width, height } = dimensions(video.aspectRatio);
const outputPath = join(outputDir, "final.mp4");
const thumbnailPath = join(outputDir, "thumbnail.jpg");
const titlePath = join(outputDir, "title.txt");
const subtitlePath = join(outputDir, "subtitle.txt");
const fontPath = await firstAvailable([
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]);
const sourceImagePath = await downloadPublicImage(video.sourceImages?.[0], outputDir);

await writeFile(titlePath, wrapText(product.name || "Product showcase", 13, 2));
await writeFile(
  subtitlePath,
  wrapText(video.brief || product.description || "Built for global business", 28, 3),
);

const filters = sourceImagePath ? [
  `scale=${width}:${height}:force_original_aspect_ratio=increase`,
  `crop=${width}:${height}`,
  `zoompan=z='min(zoom+0.00045,1.12)':d=${duration * 24}:s=${width}x${height}:fps=24`,
  "drawbox=x=0:y=0:w=iw:h=ih:color=0x020617@0.42:t=fill",
  "drawbox=x=0:y=0:w=iw:h=ih*0.025:color=0x14b8a6:t=fill",
  `drawbox=x='mod(t*90\\,iw+iw/2)-iw/2':y=ih*0.73:w=iw/2:h=ih*0.18:color=0x14b8a6@0.24:t=fill`,
  `drawbox=x=0:y=ih-10:w='t/${duration}*iw':h=10:color=0xf59e0b:t=fill`,
] : [
  "drawbox=x=0:y=0:w=iw:h=ih*0.025:color=0x0f766e:t=fill",
  `drawbox=x='mod(t*90\\,iw+iw/2)-iw/2':y=ih*0.73:w=iw/2:h=ih*0.18:color=0x14b8a6@0.16:t=fill`,
  `drawbox=x=0:y=ih-10:w='t/${duration}*iw':h=10:color=0xf59e0b:t=fill`,
];

if (fontPath) {
  const primaryText = sourceImagePath ? "0xffffff" : "0x111827";
  const secondaryText = sourceImagePath ? "0xe2e8f0" : "0x475569";
  filters.push(
    `drawtext=fontfile='${fontPath}':textfile='${titlePath}':fontcolor=${primaryText}:fontsize=${Math.round(width * 0.065)}:x=(w-text_w)/2:y=h*0.33`,
    `drawtext=fontfile='${fontPath}':textfile='${subtitlePath}':fontcolor=${secondaryText}:fontsize=${Math.round(width * 0.032)}:x=(w-text_w)/2:y=h*0.46`,
    `drawtext=fontfile='${fontPath}':text='TRADEPILOT / PRODUCT FILM':fontcolor=${sourceImagePath ? "0x5eead4" : "0x0f766e"}:fontsize=${Math.round(width * 0.022)}:x=(w-text_w)/2:y=h*0.12`,
  );
}

const inputArgs = sourceImagePath
  ? ["-loop", "1", "-i", sourceImagePath, "-t", String(duration)]
  : ["-f", "lavfi", "-i", `color=c=0xf8fafc:s=${width}x${height}:d=${duration}:r=24`];

await runFfmpeg([
  "-y",
  ...inputArgs,
  "-vf", filters.join(","),
  "-c:v", "libx264",
  "-preset", "veryfast",
  "-crf", "24",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  outputPath,
]);

await runFfmpeg([
  "-y", "-ss", "1", "-i", outputPath,
  "-frames:v", "1", "-q:v", "3", thumbnailPath,
]);

const script = [
  `开场：呈现 ${product.name || "产品"} 与品牌定位。`,
  `核心信息：${video.brief || product.description || "展示产品核心价值与采购场景。"}`,
  "结尾：展示询盘行动引导。",
].join("\n");

await writeFile(join(outputDir, "result.json"), JSON.stringify({
  status: "completed",
  progress: 100,
  pipeline: "local-renderer",
  script,
  videoUrl: `/assets/${encodeURIComponent(handoff.id)}/final.mp4`,
  thumbnailUrl: `/assets/${encodeURIComponent(handoff.id)}/thumbnail.jpg`,
}, null, 2));
