// src/lib/audio.ts
import { writeFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { v4 as uuid } from "uuid";

/** Start recording; call returned MediaRecorder.stop() to finish. */
export async function recordVoice(onStop: (filePath: string, duration: number) => void) {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err: any) {
    const message = err?.message ?? "Microphone access was denied";
    throw new Error(message);
  }

  const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
  const chunks: BlobPart[] = [];
  let startedAt = 0;
  const releaseStream = () => {
    stream.getTracks().forEach((track) => {
      if (track.readyState !== "ended") {
        try { track.stop(); } catch {}
      }
    });
  };

  rec.onstart = () => {
    console.log("[recording] MediaRecorder started");
    startedAt = Date.now();
  };
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.onstop = async () => {
    console.log("[recording] MediaRecorder onstop triggered", { chunkCount: chunks.length });
    try {
      console.log("[recording] preparing to create blob");
      const blob = new Blob(chunks, { type: "audio/webm" });
      console.log("[recording] creating blob", { size: blob.size, type: blob.type });
      const arr = new Uint8Array(await blob.arrayBuffer());
      const id = uuid();

      // ensure app-data/voice exists, then save file
      const dir = "voice";
      try {
        await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
      } catch {}
      const path = `${dir}/${id}.webm`;
      await writeFile(path, arr, { baseDir: BaseDirectory.AppData });

      const duration = Math.round((Date.now() - startedAt) / 1000);
      console.log("[recording] invoking onStop callback", { path, duration });
      await onStop(path, duration);
    } catch (err) {
      console.error("[recording] error while processing recording", err);
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
