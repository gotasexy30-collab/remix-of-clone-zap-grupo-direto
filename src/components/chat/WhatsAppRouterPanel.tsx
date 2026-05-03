import React, { useEffect, useState } from "react";
import { Smartphone, Plus, Trash2, Loader2, Pause, Play, Save, X, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSetting } from "../../services/settings";

interface WaNumber {
  id: string;
  phone: string;
  label: string;
  link: string;
  status: string;
  manually_disabled: boolean;
  hourly_limit: number;
  total_leads: number;
  last_lead_at: string | null;
  leads_last_hour?: number;
  leads_today?: number;
}

export const WhatsAppRouterPanel: React.FC = () => {
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "", phone: "", link: "", hourly_limit: 30 });
  const [editing, setEditing] = useState<Record<string, Partial<WaNumber>>>({});

  const callAdmin = async (action: string, payload: Record<string, unknown> = {}) => {
    const password = await getSetting("admin_password");
    const { data, error } = await supabase.functions.invoke("whatsapp-router", {
      body: { action, password, ...payload },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await callAdmin("list_numbers");
      const fresh: WaNumber[] = data?.numbers || [];
      setNumbers((prev) => {
        if (prev.length === 0) return fresh;
        // Merge: mantém a ordem antiga e só atualiza métricas/status dos itens existentes.
        // Adiciona novos no final e remove os que sumiram.
        const freshMap = new Map(fresh.map((n) => [n.id, n]));
        const merged = prev
          .filter((p) => freshMap.has(p.id))
          .map((p) => {
            const f = freshMap.get(p.id)!;
            freshMap.delete(p.id);
            return {
              ...p,
              status: f.status,
              manually_disabled: f.manually_disabled,
              total_leads: f.total_leads,
              last_lead_at: f.last_lead_at,
              leads_last_hour: f.leads_last_hour,
              leads_today: f.leads_today,
              hourly_limit: f.hourly_limit,
              label: f.label,
              phone: f.phone,
              link: f.link,
            };
          });
        return [...merged, ...Array.from(freshMap.values())];
      });
    } catch (e) {
      console.error(e);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    load();
    const i = setInterval(() => load(true), 30000);
    return () => clearInterval(i);
  }, []);

  const handleAdd = async () => {
    if (!form.phone || !form.link) return;
    setAdding(true);
    try {
      await callAdmin("add_number", form);
      setForm({ label: "", phone: "", link: "", hourly_limit: 30 });
      setShowForm(false);
      await load();
    } catch (e) {
      console.error(e);
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deletar este número?")) return;
    await callAdmin("delete_number", { id });
    await load();
  };

  const handleToggle = async (n: WaNumber) => {
    await callAdmin("update_number", {
      id: n.id,
      manually_disabled: !n.manually_disabled,
      status: !n.manually_disabled ? "inactive" : "active",
    });
    await load();
  };

  const handleSaveEdit = async (id: string) => {
    const changes = editing[id];
    if (!changes) return;
    setSavingId(id);
    try {
      await callAdmin("update_number", { id, ...changes });
      setEditing((e) => {
        const c = { ...e };
        delete c[id];
        return c;
      });
      await load();
    } catch (e) {
      console.error(e);
    }
    setSavingId(null);
  };

  const updateField = (id: string, field: keyof WaNumber, value: string | number) => {
    setEditing((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));
  };

  const totalLeadsHour = numbers.reduce((s, n) => s + (n.leads_last_hour || 0), 0);
  const totalLeadsToday = numbers.reduce((s, n) => s + (n.leads_today || 0), 0);
  const activeCount = numbers.filter((n) => !n.manually_disabled && n.status !== "inactive").length;

  return (
    <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-[#00a884]" />
          <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">
            Roteador de WhatsApp
          </span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[#00a884] text-xs font-bold flex items-center gap-1 hover:opacity-80"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancelar" : "Adicionar"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[#2a3942] rounded-lg p-2 text-center">
          <div className="text-[9px] text-[#8696a0] font-bold uppercase">Ativos</div>
          <div className="text-lg font-black text-[#00a884]">{activeCount}</div>
        </div>
        <div className="bg-[#2a3942] rounded-lg p-2 text-center">
          <div className="text-[9px] text-[#8696a0] font-bold uppercase">Hoje</div>
          <div className="text-lg font-black text-[#00a884]">{totalLeadsToday}</div>
        </div>
        <div className="bg-[#2a3942] rounded-lg p-2 text-center">
          <div className="text-[9px] text-[#8696a0] font-bold uppercase">Total</div>
          <div className="text-lg font-black text-[#00a884]">
            {numbers.reduce((s, n) => s + (n.total_leads || 0), 0)}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-[#2a3942] rounded-xl p-3 mb-3 space-y-2">
          <input
            placeholder="Rótulo (ex: Chip Vivo 01)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full bg-[#202c33] text-[#e9edef] px-3 py-2 rounded-lg text-xs outline-none border border-white/5 focus:border-[#00a884]"
          />
          <input
            placeholder="Telefone (ex: 5538991407356)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full bg-[#202c33] text-[#e9edef] px-3 py-2 rounded-lg text-xs outline-none border border-white/5 focus:border-[#00a884]"
          />
          <input
            placeholder="Link completo (ex: https://wa.me/55...?text=...)"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            className="w-full bg-[#202c33] text-[#e9edef] px-3 py-2 rounded-lg text-xs outline-none border border-white/5 focus:border-[#00a884]"
          />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-[#8696a0] font-bold">Limite/hora:</label>
            <input
              type="number"
              min={1}
              value={form.hourly_limit}
              onChange={(e) => setForm({ ...form, hourly_limit: parseInt(e.target.value) || 30 })}
              className="w-20 bg-[#202c33] text-[#e9edef] px-2 py-1 rounded text-xs outline-none border border-white/5"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !form.phone || !form.link}
              className="ml-auto bg-[#00a884] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50"
            >
              {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Salvar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-[#00a884]" />
        </div>
      ) : numbers.length === 0 ? (
        <p className="text-center text-xs text-[#8696a0] py-4 italic">
          Nenhum número cadastrado. Adicione um para ativar o roteador.
        </p>
      ) : (
        <div className="space-y-2">
          {numbers.map((n) => {
            const isActive = !n.manually_disabled && n.status !== "inactive";
            const isPaused = n.status === "auto_paused";
            const edited = editing[n.id];
            const hasChanges = !!edited && Object.keys(edited).length > 0;
            return (
              <div key={n.id} className="bg-[#2a3942] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${isActive ? (isPaused ? "bg-yellow-400" : "bg-green-400") : "bg-red-400"}`} />
                  <input
                    value={edited?.label ?? n.label}
                    onChange={(e) => updateField(n.id, "label", e.target.value)}
                    placeholder="Rótulo"
                    className="bg-transparent text-[#e9edef] text-xs font-bold outline-none flex-1 min-w-0"
                  />
                  <span className="text-[9px] text-[#8696a0] flex items-center gap-1">
                    <Activity size={10} /> {n.leads_last_hour || 0}/{n.hourly_limit}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] text-[#8696a0]">Hoje (00h–23h59):</span>
                  <span className="text-[11px] font-black text-[#00a884]">{n.leads_today || 0} leads</span>
                </div>
                <input
                  value={edited?.phone ?? n.phone}
                  onChange={(e) => updateField(n.id, "phone", e.target.value)}
                  placeholder="Telefone"
                  className="w-full bg-[#202c33] text-[#e9edef] px-2 py-1.5 rounded text-[11px] outline-none mb-1 border border-white/5"
                />
                <input
                  value={edited?.link ?? n.link}
                  onChange={(e) => updateField(n.id, "link", e.target.value)}
                  placeholder="Link"
                  className="w-full bg-[#202c33] text-[#e9edef] px-2 py-1.5 rounded text-[11px] outline-none mb-2 border border-white/5"
                />
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-[#8696a0]">Limite:</label>
                  <input
                    type="number"
                    min={1}
                    value={edited?.hourly_limit ?? n.hourly_limit}
                    onChange={(e) => updateField(n.id, "hourly_limit", parseInt(e.target.value) || 30)}
                    className="w-16 bg-[#202c33] text-[#e9edef] px-2 py-1 rounded text-[11px] outline-none border border-white/5"
                  />
                  <span className="text-[9px] text-[#8696a0] ml-auto">Total: {n.total_leads}</span>
                  {hasChanges && (
                    <button
                      onClick={() => handleSaveEdit(n.id)}
                      disabled={savingId === n.id}
                      className="bg-[#00a884] text-white p-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50"
                      title="Salvar"
                    >
                      {savingId === n.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    </button>
                  )}
                  <button
                    onClick={() => handleToggle(n)}
                    className={`p-1.5 rounded-lg ${isActive ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}`}
                    title={isActive ? "Pausar" : "Ativar"}
                  >
                    {isActive ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="bg-red-500/20 text-red-400 p-1.5 rounded-lg"
                    title="Deletar"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-[#8696a0] mt-3 italic">
        O botão "Liberar Acesso" usa o roteador automaticamente. Se nenhum número estiver disponível, usa o link de pagamento como fallback.
      </p>
    </div>
  );
};
