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

// ---------- Admin (via edge function) ----------
function getAdminPassword(): string {
  return 'removed';
}

export async function adminGetAllSettings(): Promise<Record<string, string>> {
  const password = getAdminPassword();
  if (!password) return {};
  const { data, error } = await supabase.functions.invoke('whatsapp-router', {
    body: { action: 'admin_get_settings', password },
  });
  if (error || !data || data.error) return {};
  return data.settings || {};
}

export async function setSetting(key: string, value: string): Promise<void> {
  const password = getAdminPassword();
  if (!password) throw new Error('admin not authenticated');
  const { data, error } = await supabase.functions.invoke('whatsapp-router', {
    body: { action: 'admin_set_setting', password, key, value },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('whatsapp-router', {
    body: { action: 'verify_admin', password },
  });
  if (error || !data) return false;
  return !!data.ok;
}
