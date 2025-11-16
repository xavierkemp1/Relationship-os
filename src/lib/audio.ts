// src/lib/audio.ts
import { writeFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { v4 as uuid } from "uuid";

type RecorderFactory = (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder;
export type RecordVoiceDependencies = {
  requestStream?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  mediaRecorderFactory?: RecorderFactory;
  mkdir?: typeof mkdir;
  writeFile?: typeof writeFile;
  baseDir?: BaseDirectory;
  idFactory?: () => string;
  now?: () => number;
};

const defaultRequestStream = (constraints: MediaStreamConstraints) =>
  navigator.mediaDevices.getUserMedia(constraints);

const defaultRecorderFactory: RecorderFactory = (stream, options) => new MediaRecorder(stream, options);

// ✅ helper to detect Tauri vs browser
const isTauriEnv =
  typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);

/** Start recording; call returned MediaRecorder.stop() to finish. */
export async function recordVoice(
  onStop: (filePath: string, duration: number) => void | Promise<void>,
  deps: RecordVoiceDependencies = {}
) {
  const {
    requestStream = defaultRequestStream,
    mediaRecorderFactory = defaultRecorderFactory,
    mkdir: mkdirFn = mkdir,
    writeFile: writeFileFn = writeFile,
    baseDir = BaseDirectory.AppData,
    idFactory = uuid,
    now = Date.now,
  } = deps;

  let stream: MediaStream;
  try {
    stream = await requestStream({ audio: true });
  } catch (err: any) {
    const message = err?.message ?? "Microphone access was denied";
    throw new Error(message);
  }

  const rec = mediaRecorderFactory(stream, { mimeType: "audio/webm;codecs=opus" });
  const chunks: BlobPart[] = [];
  let startedAt = 0;

  const releaseStream = () => {
    stream.getTracks().forEach((track) => {
      if (track.readyState !== "ended") {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
    });
  };

  rec.onstart = () => {
    console.log("[recording] MediaRecorder started");
    startedAt = now();
  };

  rec.ondataavailable = (e) => chunks.push(e.data);

  rec.onstop = async () => {
    console.log("[recording] MediaRecorder onstop triggered", { chunkCount: chunks.length });
    try {
      console.log("[recording] preparing to create blob");
      const blob = new Blob(chunks, { type: "audio/webm" });
      console.log("[recording] creating blob", { size: blob.size, type: blob.type });

      const duration = Math.round((now() - startedAt) / 1000);

      // ✅ BROWSER FALLBACK: no Tauri FS, just use a blob URL as the "filepath"
      if (!isTauriEnv) {
        const url = URL.createObjectURL(blob);
        console.log("[recording] non-Tauri environment, using blob URL", { url, duration });
        await onStop(url, duration);
        releaseStream();
        return;
      }

      // ✅ TAURI PATH: write to app data with plugin-fs
      const arr = new Uint8Array(await blob.arrayBuffer());
      const id = idFactory();

      const dir = "voice";
      try {
        await mkdirFn(dir, { baseDir, recursive: true });
      } catch {
        // ignore if it already exists
      }

      const path = `${dir}/${id}.webm`;
      await writeFileFn(path, arr, { baseDir });

      const filePath = path;
      console.log("[recording] invoking onStop callback", { filePath, duration });
      await onStop(filePath, duration);
    } catch (err) {
      console.error("[recording] error while processing recording", err);
      // we still rethrow for debugging, but UI now handles state better
      throw err;
    } finally {
      releaseStream();
    }
  };

  rec.onerror = (event) => {
    console.error("[recording] MediaRecorder error", event);
    releaseStream();
  };

  rec.start();
  return rec; // call rec.stop() from UI
}
