const API_BASE = "https://api.counterapi.dev/v1";

const getSlug = () => {
  try {
    const path = window.location.pathname;
    const cleanPath = path.replace(/\/painel\/?$/, '').replace(/\/$/, '');
    const parts = cleanPath.split('/').filter(p => p.length > 0);
    const slug = parts.length > 0 ? parts[parts.length - 1] : 'main';
    return slug;
  } catch {
    return 'main';
  }
};

const getNamespace = () => {
  const slug = getSlug();
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `vott_v4_${cleanSlug}`;
};

export const trackEvent = async (key: 'h1' | 'h2' | 'h3' | 'h4' | 'h5') => {
  const namespace = getNamespace();
  const targetUrl = `${API_BASE}/${namespace}/${key}/up`;

  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&_=${Date.now()}`;
    await fetch(proxyUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    console.log(`[Track] Evento ${key} disparado com sucesso.`);
  } catch {
    console.warn(`[Track] Falha silenciosa no evento ${key}`);
  }
};

export const getStats = async () => {
  const namespace = getNamespace();
  const keys = ['h1', 'h2', 'h3', 'h4', 'h5'];

  try {
    const results = await Promise.all(
      keys.map(async (key) => {
        try {
          const targetUrl = `${API_BASE}/${namespace}/${key}`;
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&_=${Date.now()}`;
          const res = await fetch(proxyUrl);
          if (!res.ok) return { count: 0 };
          const wrapper = await res.json();
          const data = JSON.parse(wrapper.contents);
          return { count: data.count || 0 };
        } catch {
          return { count: 0 };
        }
      })
    );

    return {
      visits: Number(results[0]?.count || 0),
      chat: Number(results[1]?.count || 0),
      checkout: Number(results[2]?.count || 0),
      sale1: Number(results[3]?.count || 0),
      sale2: Number(results[4]?.count || 0),
    };
  } catch (e) {
    console.error("[Dashboard] Erro ao buscar estatísticas:", e);
    return { visits: 0, chat: 0, checkout: 0, sale1: 0, sale2: 0 };
  }
};
