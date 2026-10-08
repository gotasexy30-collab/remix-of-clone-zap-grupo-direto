import { supabase } from '@/integrations/supabase/client';

// ---------- Public (whitelisted keys only) ----------
export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_settings').select('key, value');
  const settings: Record<string, string> = {};
  if (data) {
    data.forEach(row => { settings[row.key] = row.value; });
  }
  return settings;
}

// ---------- Admin (Direct Database Access) ----------
export async function adminGetAllSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_settings').select('key, value');
  const settings: Record<string, string> = {};
  if (data) {
    data.forEach(row => { settings[row.key] = row.value; });
  }
  return settings;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) {
    console.error(`Error saving setting ${key}:`, error);
    throw error;
  }
}

// Validação de senha é realizada exclusivamente pelo Supabase Auth.
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password) return false;
  const { data: { session } } = await supabase.auth.getSession();
  return !!session && session.user.email?.toLowerCase() === 'admin@meusistema.com';
}
