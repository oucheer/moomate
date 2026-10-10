import { supabaseStorage } from "./memory";

export async function uploadPhoto(
  roomId: string,
  participantId: string,
  file: ArrayBuffer,
  contentType: string
): Promise<string> {
  if (!supabaseStorage.isConfigured()) {
    return supabaseStorage.savePhoto(participantId, file, contentType);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key);
  const path = `photos/${roomId}/${participantId}`;
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const { error } = await sb.storage
    .from("photos")
    .upload(`${path}.${ext}`, file, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  return `${path}.${ext}`;
}

export async function createSignedUrl(path: string): Promise<string> {
  if (!supabaseStorage.isConfigured()) {
    return supabaseStorage.getPhotoUrl(path);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb.storage.from("photos").createSignedUrl(path, 60 * 10);
  if (error || !data) throw new Error("无法生成照片访问链接");
  return data.signedUrl;
}
