// src/lib/audio.ts
import { writeFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { v4 as uuid } from "uuid";

/** Start recording; call returned MediaRecorder.stop() to finish. */
export async function recordVoice(onStop:(filePath:string, duration:number)=>void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
  const chunks: BlobPart[] = [];
  let startedAt = 0;

  rec.onstart = () => { startedAt = Date.now(); };
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.onstop = async () => {
    const blob = new Blob(chunks, { type: "audio/webm" });
    const arr = new Uint8Array(await blob.arrayBuffer());
    const id = uuid();

    // ensure app-data/voice exists, then save file
    const dir = "voice";
    try { await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true }); } catch {}
    const path = `${dir}/${id}.webm`;
    await writeFile(path, arr, { baseDir: BaseDirectory.AppData });

    const duration = Math.round((Date.now() - startedAt) / 1000);
    onStop(path, duration);
  };

  rec.start();
  return rec; // call rec.stop() from UI
}
