import { useAudioRecorder } from "../hooks/useAudioRecorder";

type Props = {
  onSave: (blob: Blob) => Promise<void> | void;
};

export function VoiceNoteRecorder({ onSave }: Props) {
  const { isRecording, audioBlob, startRecording, stopRecording, resetRecording } =
    useAudioRecorder();

  const handleSave = async () => {
    if (!audioBlob) return;
    await onSave(audioBlob);
    resetRecording();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {!isRecording && (
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex items-center justify-center rounded-md bg-[#3A6FF8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#315cce]"
          >
            🎙️ Start recording
          </button>
        )}
        {isRecording && (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
          >
            ⏹ Stop
          </button>
        )}
      </div>

      {audioBlob && (
        <div className="flex flex-col gap-2">
          <audio controls src={URL.createObjectURL(audioBlob)} className="w-full" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm font-semibold"
            >
              💾 Save note
            </button>
            <button
              type="button"
              onClick={resetRecording}
              className="inline-flex items-center justify-center rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm text-[#6B7280]"
            >
              ❌ Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
