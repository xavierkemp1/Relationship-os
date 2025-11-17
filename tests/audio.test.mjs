import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

import { recordVoice } from "../dist-tests/lib/audio.js";

const tempRoot = path.join(os.tmpdir(), "relationship-os-audio-tests");

const resetTempDir = async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
};

test.beforeEach(async () => {
  await resetTempDir();
});

test("recordVoice saves the blob and notifies the UI callback", async () => {
  const track = {
    readyState: "live",
    stopped: false,
    stop() {
      this.readyState = "ended";
      this.stopped = true;
    },
  };
  const fakeStream = {
    getTracks: () => [track],
  };

  class FakeMediaRecorder {
    onstart = null;
    ondataavailable = null;
    onstop = null;
    onerror = null;

    constructor(stream, options) {
      this.stream = stream;
      this.options = options;
    }

    start() {
      this.onstart?.();
    }

    stop() {
      try {
        const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" });
        this.ondataavailable?.({ data: blob });
        this.onstop?.();
      } catch (error) {
        this.onerror?.(error);
      }
    }
  }

  let clock = 0;
  const now = () => {
    clock += 1000;
    return clock;
  };

  let resolveSaved;
  const savedPromise = new Promise((resolve) => {
    resolveSaved = resolve;
  });
  const savedNotes = [];

  const deps = {
    requestStream: async () => fakeStream,
    mediaRecorderFactory: (stream, options) =>
      new FakeMediaRecorder(stream, options),
    mkdir: async (dir) => {
      await fs.mkdir(path.join(tempRoot, dir), { recursive: true });
    },
    writeFile: async (filePath, contents) => {
      const target = path.join(tempRoot, filePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, Buffer.from(contents));
    },
    idFactory: () => "test-id",
    now,
    isTauriEnv: true,
  };

  const recorder = await recordVoice(async (filePath, duration) => {
    savedNotes.push({ filePath, duration });
    resolveSaved?.();
  }, deps);

  recorder.stop();
  await savedPromise;

  assert.equal(savedNotes.length, 1);
  assert.equal(savedNotes[0].filePath, "voice/test-id.webm");
  assert.equal(savedNotes[0].duration, 1);
  const storedBuffer = await fs.readFile(path.join(tempRoot, savedNotes[0].filePath));
  assert(storedBuffer.byteLength > 0);
  assert.equal(track.stopped, true);
});
