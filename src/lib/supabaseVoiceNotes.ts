// src/lib/supabaseVoiceNotes.ts
import { supabase } from "./supabaseClient";

export type VoiceNote = {
  id: string;
  person_id: string;
  storage_path: string;
  created_at: string;
  playbackUrl: string; // signed URL for <audio />
};

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Not authenticated");
  }
  return data.user.id;
}

// Upload audio blob -> storage + table
export async function uploadVoiceNote(personId: string, blob: Blob): Promise<VoiceNote> {
  const userId = await getCurrentUserId();
  const noteId = crypto.randomUUID();
  const fileExt = "webm";
  const storagePath = `${userId}/${noteId}.${fileExt}`;

  // 1) upload file to Storage
  const { error: uploadError } = await supabase.storage
    .from("voice-notes")
    .upload(storagePath, blob, {
      contentType: "audio/webm",
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload failed", uploadError);
    throw uploadError;
  }

  // 2) insert metadata row into voice_notes
  const { data, error: insertError } = await supabase
    .from("voice_notes")
    .insert({
      user_id: userId,
      person_id: personId,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (insertError || !data) {
    console.error("Insert voice_notes failed", insertError);
    throw insertError || new Error("Insert failed");
  }

  // 3) create a signed URL for playback
  const { data: signed, error: signedError } = await supabase.storage
    .from("voice-notes")
    .createSignedUrl(storagePath, 60 * 60); // valid 1h

  if (signedError || !signed) {
    console.error("Signed URL failed", signedError);
    throw signedError || new Error("Signed URL failed");
  }

  return {
    id: data.id,
    person_id: data.person_id,
    storage_path: data.storage_path,
    created_at: data.created_at,
    playbackUrl: signed.signedUrl,
  };
}

// List notes for one person
export async function listVoiceNotes(personId: string): Promise<VoiceNote[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("voice_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("person_id", personId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("List voice_notes failed", error);
    return [];
  }

  const results: VoiceNote[] = [];

  for (const row of data) {
    const { data: signed, error: signedError } = await supabase.storage
      .from("voice-notes")
      .createSignedUrl(row.storage_path, 60 * 60);

    if (signedError || !signed) {
      console.error("Signed URL failed", signedError);
      continue;
    }

    results.push({
      id: row.id,
      person_id: row.person_id,
      storage_path: row.storage_path,
      created_at: row.created_at,
      playbackUrl: signed.signedUrl,
    });
  }

  return results;
}

// Delete note (table row + file)
export async function deleteVoiceNote(note: VoiceNote): Promise<void> {
  const userId = await getCurrentUserId();

  // delete row
  const { error: deleteRowError } = await supabase
    .from("voice_notes")
    .delete()
    .eq("id", note.id)
    .eq("person_id", note.person_id)
    .eq("user_id", userId);

  if (deleteRowError) {
    console.error("Delete row failed", deleteRowError);
    throw deleteRowError;
  }

  // delete file from Storage (non-fatal if this fails)
  const { error: deleteFileError } = await supabase.storage
    .from("voice-notes")
    .remove([note.storage_path]);

  if (deleteFileError) {
    console.error("Delete file failed", deleteFileError);
  }
}
