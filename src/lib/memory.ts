// Netlify 函数运行环境无本地持久存储，这里提供进程内兜底，仅用于未配置 Supabase 时的基础演示。
const photoStore = new Map<string, { data: ArrayBuffer; contentType: string }>();

export const supabaseStorage = {
  isConfigured(): boolean {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  savePhoto(id: string, data: ArrayBuffer, contentType: string) {
    photoStore.set(id, { data, contentType });
    return `memory:${id}`;
  },
  getPhotoUrl(id: string) {
    const key = id.replace("memory:", "");
    return `/api/photos/raw/${encodeURIComponent(key)}`;
  },
  getPhoto(key: string) {
    return photoStore.get(key);
  },
};
