import { supabase } from '@/integrations/supabase/client';

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { data: existing } = await supabase
    .from('app_settings')
    .select('id')
    .eq('key', key)
    .maybeSingle();

  if (existing) {
    await supabase.from('app_settings').update({ value }).eq('key', key);
  } else {
    await supabase.from('app_settings').insert({ key, value });
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_settings').select('key, value');
  const settings: Record<string, string> = {};
  if (data) {
    data.forEach(row => { settings[row.key] = row.value; });
  }
  return settings;
}
