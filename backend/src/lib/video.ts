import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Transcodifica un video a MP4 (H.264 + AAC) compatible con todos los navegadores,
// incluido Safari de iOS, que NO reproduce WebM (VP8/VP9 + Opus).
// - pix_fmt yuv420p: requerido por Safari/QuickTime para decodificar H.264.
// - movflags +faststart: mueve el índice al inicio para permitir streaming/seek por Range.
export async function transcodeToMp4(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-c:a", "aac",
    "-b:a", "128k",
    outputPath,
  ]);
}
