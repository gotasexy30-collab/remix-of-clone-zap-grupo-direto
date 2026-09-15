import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zfkixusybzbtnvufufrm.supabase.co";
const supabasePublishableKey = "sb_publishable_OQ67IOpGyHRHoBHO73MuJQ_M-b6rZRQ";
const memory = new Map<string, string>();
const resilientStorage = {
  getItem(key: string) {
    try { return window.localStorage.getItem(key); } catch { return memory.get(key) ?? null; }
  },
  setItem(key: string, value: string) {
    try { window.localStorage.setItem(key, value); } catch { memory.set(key, value); }
  },
  removeItem(key: string) {
    try { window.localStorage.removeItem(key); } catch { memory.delete(key); }
  },
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: resilientStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
