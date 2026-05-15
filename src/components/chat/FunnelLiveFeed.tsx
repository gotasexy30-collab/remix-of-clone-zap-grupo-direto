import React, { useEffect, useState, useRef } from 'react';
import { Activity, Radio, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type StageKey = 'Visited' | 'ChatStarted' | 'InitiateCheckout' | 'PixGenerated' | 'PixCopied' | 'TutorialOpened' | 'AlreadyPaid' | 'Purchase';

const STAGES: { key: StageKey; label: string; color: string; emoji: string }[] = [
  { key: 'Visited',          label: 'Visitou',            color: '#8696a0', emoji: '👀' },
  { key: 'ChatStarted',      label: 'Iniciou o chat',     color: '#53bdeb', emoji: '💬' },
  { key: 'InitiateCheckout', label: 'Abriu pagamento',    color: '#FFA500', emoji: '🛒' },
  { key: 'PixGenerated',     label: 'Gerou PIX',          color: '#1877F2', emoji: '🔳' },
  { key: 'PixCopied',        label: 'Copiou código PIX',  color: '#a855f7', emoji: '📋' },
  { key: 'TutorialOpened',   label: 'Viu "Como pagar"',   color: '#ec4899', emoji: '🎬' },
  { key: 'AlreadyPaid',      label: 'Clicou "Já paguei"', color: '#eab308', emoji: '✋' },
  { key: 'Purchase',         label: 'Pagou (aprovado)',   color: '#16A349', emoji: '💰' },
];

const RANGES = [
  { key: 'today', label: 'Hoje', hours: 24, useToday: true },
  { key: '7d',    label: '7 dias', hours: 24*7, useToday: false },
  { key: '30d',   label: '30 dias', hours: 24*30, useToday: false },
] as const;

type FeedItem = { id: string; event: string; session: string; time: Date };

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfHoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000);

const fmtTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const FunnelLiveFeed: React.FC = () => {
  const [range, setRange] = useState<typeof RANGES[number]['key']>('today');
  const [counts, setCounts] = useState<Record<StageKey, number>>({
    Visited: 0, ChatStarted: 0, InitiateCheckout: 0, PixGenerated: 0,
    PixCopied: 0, TutorialOpened: 0, AlreadyPaid: 0, Purchase: 0,
  });
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  const fromDate = () => {
    const r = RANGES.find(x => x.key === range)!;
    return r.useToday ? startOfToday() : startOfHoursAgo(r.hours);
  };

  const fetchAllPaged = async <T,>(builder: (from: number, to: number) => any): Promise<T[]> => {
    const PAGE = 1000;
    let from = 0;
    const all: T[] = [];
    while (true) {
      const { data, error } = await builder(from, from + PAGE - 1);
      if (error || !data) break;
      all.push(...(data as T[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  const loadCounts = async () => {
    setLoading(true);
    const fromIso = fromDate().toISOString();

    // Visitas (sessões únicas) — paginado para passar do limite de 1000
    const visits = await fetchAllPaged<{ session_id: string }>((f, t) =>
      supabase.from('page_visits').select('session_id').gte('visited_at', fromIso).range(f, t)
    );
    const uniqueVisits = new Set(visits.map(v => v.session_id).filter(Boolean)).size;

    // Eventos rastreados (sessões únicas por evento)
    const events = await fetchAllPaged<{ event_name: string; session_id: string }>((f, t) =>
      supabase.from('tracked_events').select('event_name, session_id').gte('created_at', fromIso).range(f, t)
    );

    const uniqueByEvent: Record<string, Set<string>> = {};
    events.forEach(e => {
      if (!uniqueByEvent[e.event_name]) uniqueByEvent[e.event_name] = new Set();
      if (e.session_id) uniqueByEvent[e.event_name].add(e.session_id);
    });

    // Compras aprovadas (sessões únicas + vendas sem session_id contam como 1 cada)
    const purchases = await fetchAllPaged<{ session_id: string | null }>((f, t) =>
      supabase.from('purchases').select('session_id').gte('approved_at', fromIso).eq('status', 'approved').range(f, t)
    );
    const sessionsWithId = new Set(purchases.map(p => p.session_id).filter((s): s is string => !!s)).size;
    const purchasesWithoutSession = purchases.filter(p => !p.session_id).length;
    const uniquePurchases = sessionsWithId + purchasesWithoutSession;

    setCounts({
      Visited: uniqueVisits,
      ChatStarted: uniqueByEvent['ChatStarted']?.size || 0,
      InitiateCheckout: uniqueByEvent['InitiateCheckout']?.size || 0,
      PixGenerated: uniqueByEvent['PixGenerated']?.size || 0,
      PixCopied: uniqueByEvent['PixCopied']?.size || 0,
      TutorialOpened: uniqueByEvent['TutorialOpened']?.size || 0,
      AlreadyPaid: uniqueByEvent['AlreadyPaid']?.size || 0,
      Purchase: uniquePurchases || (uniqueByEvent['Purchase']?.size || 0),
    });
    setLoading(false);
  };

  const loadInitialFeed = async () => {
    const { data } = await supabase
      .from('tracked_events')
      .select('id, event_name, session_id, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) {
      setFeed(data.map(e => ({
        id: e.id,
        event: e.event_name,
        session: e.session_id || '—',
        time: new Date(e.created_at),
      })));
    }
  };

  useEffect(() => { loadCounts(); }, [range]);
  useEffect(() => {
    loadInitialFeed();
    const interval = setInterval(() => loadCounts(), 15000);

    // Realtime: novos eventos
    const ch = supabase
      .channel('funnel-live-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tracked_events' }, (payload) => {
        const r: any = payload.new;
        setFeed(prev => [{
          id: r.id,
          event: r.event_name,
          session: r.session_id || '—',
          time: new Date(r.created_at),
        }, ...prev].slice(0, 50));
        // Atualiza contador se for evento conhecido
        loadCounts();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'page_visits' }, () => loadCounts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'purchases' }, () => loadCounts())
      .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(ch); };
  }, []);

  const max = Math.max(1, ...STAGES.map(s => counts[s.key]));
  const stageMeta = (k: StageKey) => STAGES.find(s => s.key === k)!;

  return (
    <div className="space-y-5">
      {/* Filtro de período */}
      <div className="flex items-center gap-2">
        {RANGES.map(r => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${
              range === r.key ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
        {loading && <span className="text-[10px] text-[#8696a0] ml-auto">carregando...</span>}
      </div>

      {/* Funil em barras */}
      <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowDown size={14} className="text-[#00a884]" />
          <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Jornada do Lead (sessões únicas)</span>
        </div>
        <div className="space-y-2">
          {STAGES.map((stage, i) => {
            const value = counts[stage.key];
            const pct = (value / max) * 100;
            const prev = i === 0 ? null : counts[STAGES[i - 1].key];
            const conv = prev && prev > 0 ? ((value / prev) * 100) : null;
            const drop = prev && prev > 0 ? prev - value : null;
            const dropPct = prev && prev > 0 ? (((prev - value) / prev) * 100) : null;
            const isBigDrop = dropPct !== null && dropPct >= 50 && prev! >= 5;
            return (
              <div key={stage.key}>
                <div className="flex items-center justify-between mb-1 text-[11px]">
                  <span className="flex items-center gap-1.5 text-white/90 font-semibold">
                    <span>{stage.emoji}</span> {stage.label}
                  </span>
                  <span className="flex items-center gap-2">
                    {conv !== null && (
                      <span className={`text-[10px] font-bold ${conv >= 70 ? 'text-[#16A349]' : conv >= 40 ? 'text-[#FFA500]' : 'text-red-400'}`}>
                        {conv.toFixed(1)}%
                      </span>
                    )}
                    <span className="font-mono font-black text-white tabular-nums">{value}</span>
                  </span>
                </div>
                <div className="relative h-7 bg-[#0b141a] rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${stage.color}30, ${stage.color})` }}
                  />
                  {isBigDrop && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                      ⚠️ -{drop} ({dropPct!.toFixed(0)}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-[#8696a0] italic mt-3 leading-relaxed">
          % = conversão da etapa anterior. Etapas com queda &gt;= 50% são destacadas.
        </p>
      </div>

      {/* Feed ao vivo */}
      <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <Radio size={14} className="text-red-400" />
          <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Movimentação ao vivo</span>
        </div>
        <div ref={feedRef} className="max-h-[320px] overflow-y-auto space-y-1.5">
          {feed.length === 0 && (
            <div className="text-center text-[11px] text-[#8696a0] py-6">
              <Activity size={20} className="mx-auto mb-2 opacity-40" />
              Aguardando eventos... abra o site em outra aba para testar.
            </div>
          )}
          {feed.map(item => {
            const meta = STAGES.find(s => s.key === item.event);
            const color = meta?.color || '#8696a0';
            const emoji = meta?.emoji || '•';
            const label = meta?.label || item.event;
            const sessionShort = item.session.slice(0, 6);
            return (
              <div key={item.id} className="flex items-center gap-2 bg-[#0b141a] rounded-lg p-2 text-[11px] animate-fadeIn">
                <span className="text-base">{emoji}</span>
                <span className="font-mono text-[#8696a0] tabular-nums w-[68px] shrink-0">{fmtTime(item.time)}</span>
                <span className="font-mono text-[10px] text-[#8696a0] bg-[#2a3942] px-1.5 py-0.5 rounded shrink-0">#{sessionShort}</span>
                <span className="font-bold truncate" style={{ color }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
