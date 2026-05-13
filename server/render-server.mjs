import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const renderRoot = path.join(projectRoot, ".tmp", "trip-clip-renders");
const publicRoot = path.join(renderRoot, "public");
const port = Number(process.env.PORT ?? 4321);

const ratioSize = {
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
  "3:4": { width: 1080, height: 1440 }
};

const musicFiles = {
  calm: path.join(projectRoot, "assets", "audio", "calm.wav"),
  city: path.join(projectRoot, "assets", "audio", "city.wav"),
  summer: path.join(projectRoot, "assets", "audio", "summer.wav"),
  night: path.join(projectRoot, "assets", "audio", "night.wav"),
  minimal: path.join(projectRoot, "assets", "audio", "minimal.wav")
};

const getCustomMusicExtension = (fileName = "", mimeType = "") => {
  const cleanName = fileName.split("?")[0].toLowerCase();
  const match = cleanName.match(/\.([a-z0-9]+)$/);
  if (match?.[1]) {
    return match[1];
  }

  if (mimeType.includes("wav")) {
    return "wav";
  }

  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return "mp3";
  }

  if (mimeType.includes("aac")) {
    return "aac";
  }

  if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
    return "m4a";
  }

  return "mp3";
};

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });

const run = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `${command} exited with ${code}`));
    });
  });

const getFrameFilter = ({ width, height, template, transition, duration }) => {
  if (template === "film-log") {
    return `scale=${Math.round(width * 0.86)}:${Math.round(height * 0.86)}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
  }

  const fit = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  if (transition === "zoom") {
    const frames = Math.max(15, Math.round(duration * 30));
    return `${fit},zoompan=z='min(zoom+0.0015,1.08)':d=${frames}:s=${width}x${height}:fps=30`;
  }

  return fit;
};

const getTransitionName = (transition) => {
  if (transition === "fade") {
    return "fade";
  }

  if (transition === "slide") {
    return "slideleft";
  }

  return null;
};

const mergeSegments = async ({
  segments,
  durations,
  transition,
  transitionDuration,
  workDir,
  outputPath
}) => {
  const transitionName = getTransitionName(transition);
  const safeTransitionDuration = Math.min(
    Math.max(0.2, Number(transitionDuration) || 0.45),
    Math.max(0.2, Math.min(...durations) / 2)
  );

  if (!transitionName || segments.length < 2 || safeTransitionDuration <= 0) {
    const concatFile = path.join(workDir, "concat.txt");
    await writeFile(
      concatFile,
      segments
        .map((segment) => segment.replace(/\\/g, "/").replaceAll("'", "'\\''"))
        .map((segment) => `file '${segment}'`)
        .join("\n")
    );

    await run("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatFile,
      "-c",
      "copy",
      outputPath
    ], workDir);
    return;
  }

  const args = ["-y", ...segments.flatMap((segment) => ["-i", segment])];
  let cumulative = durations[0];
  const filters = [];
  let previousLabel = "0:v";

  for (let index = 1; index < segments.length; index += 1) {
    const outputLabel = `v${index}`;
    const offset = Math.max(0, cumulative - safeTransitionDuration);
    filters.push(
      `[${previousLabel}][${index}:v]xfade=transition=${transitionName}:duration=${safeTransitionDuration.toFixed(2)}:offset=${offset.toFixed(2)}[${outputLabel}]`
    );
    cumulative += durations[index] - safeTransitionDuration;
    previousLabel = outputLabel;
  }

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${previousLabel}]`,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    outputPath
  );

  await run("ffmpeg", args, workDir);
};

const renderTripClip = async (payload, origin) => {
  if (!payload.frames?.length) {
    throw new Error("At least one frame is required.");
  }

  const size = ratioSize[payload.ratio] ?? ratioSize["9:16"];
  const renderId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const workDir = path.join(renderRoot, renderId);
  await mkdir(workDir, { recursive: true });
  await mkdir(publicRoot, { recursive: true });

  const segments = [];
  const durations = [];

  for (let index = 0; index < payload.frames.length; index += 1) {
    const frame = payload.frames[index];
    const duration = Math.max(0.5, Number(frame.duration) || 2.5);
    const extension = frame.mimeType === "image/png" ? "png" : "jpg";
    const imagePath = path.join(workDir, `frame-${index}.${extension}`);
    const segmentPath = path.join(workDir, `segment-${index}.mp4`);
    await writeFile(imagePath, Buffer.from(frame.base64, "base64"));

    const filter = getFrameFilter({
      width: size.width,
      height: size.height,
      template: payload.template,
      transition: payload.transition,
      duration
    });

    await run("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-t",
      String(duration),
      "-i",
      imagePath,
      "-vf",
      `${filter},format=yuv420p`,
      "-r",
      "30",
      "-an",
      segmentPath
    ], workDir);

    segments.push(segmentPath);
    durations.push(duration);
  }

  const videoOnlyPath = path.join(workDir, "video-only.mp4");
  await mergeSegments({
    segments,
    durations,
    transition: payload.transition,
    transitionDuration: payload.transitionDuration,
    workDir,
    outputPath: videoOnlyPath
  });

  const fileName = `trip-clip-${renderId}.mp4`;
  const outputPath = path.join(publicRoot, fileName);
  let musicPath = musicFiles[payload.musicId];

  if (payload.musicId === "custom" && payload.customMusic?.base64) {
    const extension = getCustomMusicExtension(
      payload.customMusic.fileName,
      payload.customMusic.mimeType
    );
    musicPath = path.join(workDir, `custom-music.${extension}`);
    await writeFile(musicPath, Buffer.from(payload.customMusic.base64, "base64"));
  }

  if (musicPath && existsSync(musicPath)) {
    await run("ffmpeg", [
      "-y",
      "-i",
      videoOnlyPath,
      "-i",
      musicPath,
      "-filter:a",
      `volume=${Math.max(0, Math.min(1, Number(payload.volume) || 0.7))}`,
      "-shortest",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      outputPath
    ], workDir);
  } else {
    await run("ffmpeg", ["-y", "-i", videoOnlyPath, "-c", "copy", outputPath], workDir);
  }

  await rm(workDir, { recursive: true, force: true });

  return {
    videoUrl: `${origin}/videos/${fileName}`,
    fileName
  };
};

const send = (response, status, body, headers = {}) => {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    ...headers
  });
  response.end(body);
};

createServer(async (request, response) => {
  const origin = `http://${request.headers.host}`;

  if (request.method === "OPTIONS") {
    send(response, 204, "");
    return;
  }

  try {
    const url = new URL(request.url ?? "/", origin);

    if (request.method === "GET" && url.pathname.startsWith("/videos/")) {
      const fileName = path.basename(url.pathname);
      const file = await readFile(path.join(publicRoot, fileName));
      send(response, 200, file, { "Content-Type": "video/mp4" });
      return;
    }

    if (request.method === "POST" && url.pathname === "/render-trip-clip") {
      const payload = await readJsonBody(request);
      const result = await renderTripClip(payload, origin);
      send(response, 200, JSON.stringify(result), {
        "Content-Type": "application/json"
      });
      return;
    }

    send(response, 404, "Not found");
  } catch (error) {
    send(response, 500, error instanceof Error ? error.message : "Render failed");
  }
}).listen(port, () => {
  console.log(`Trip Clip render server listening on http://localhost:${port}`);
});
