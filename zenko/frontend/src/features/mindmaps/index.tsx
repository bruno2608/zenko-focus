import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { MINDMAP_TEMPLATES, MindmapTemplateId } from './models/mindmapModel';
import { useMindmap } from './hooks/useMindmap';

const pastelCards = ['from-indigo-100 to-indigo-50', 'from-cyan-100 to-sky-50', 'from-emerald-100 to-emerald-50', 'from-amber-100 to-orange-50'];

export default function MindmapsDashboard() {
  const navigate = useNavigate();
  const { mindmaps, createMindmap, isLoading } = useMindmap();
  const [search, setSearch] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState<MindmapTemplateId>('mindmap');

  const availableTemplates = MINDMAP_TEMPLATES.filter((template) => template.id === 'mindmap');
  const upcomingTemplates = MINDMAP_TEMPLATES.filter((template) => template.id !== 'mindmap');

  const filteredMindmaps = useMemo(() => {
    const term = search.toLowerCase();
    return mindmaps.filter((map) => map.title.toLowerCase().includes(term));
  }, [mindmaps, search]);

  const handleCreate = async (template: MindmapTemplateId) => {
    setCreatingTemplate(template);
    const map = await createMindmap(template, 'Novo mapa');
    navigate(`/mindmaps/${map.id}`);
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="rounded-3xl bg-gradient-to-r from-[#0b1222] via-[#11172a] to-[#0c162c] px-5 py-6 text-white shadow-2xl sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.35em] text-white/70">Mapas mentais</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Visual moderno inspirado no MindMeister</h1>
            <p className="max-w-2xl text-sm text-white/80 sm:text-base">
              Foque no formato de mapa mental com uma experiência fiel ao MindMeister. Tudo salvo automaticamente no seu navegador para edição rápida.
            </p>
          </div>
          <Button onClick={() => handleCreate(creatingTemplate)} className="self-start rounded-full bg-white/10 px-5 py-3 text-base text-white shadow-lg backdrop-blur hover:bg-white/20">
            Criar mapa
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/80">
          {availableTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => setCreatingTemplate(template.id)}
              className={`rounded-full border px-4 py-2 transition ${
                creatingTemplate === template.id
                  ? 'border-white/80 bg-white/15 text-white'
                  : 'border-white/10 bg-white/5 text-white/80 hover:border-white/30 hover:text-white'
              }`}
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr,1fr]">
        <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.25)] backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Mapa mental MindMeister</h2>
              <p className="text-sm text-slate-500 dark:text-zenko-muted">Interface fiel ao formato de mapa mental, com nós arredondados e cores pastel.</p>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="Buscar mapas"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-[240px] rounded-2xl border-slate-200 bg-white px-4 py-2 text-sm shadow-sm dark:border-white/10 dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[1.4fr,1fr]">
            <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 p-5 text-white shadow-[0_22px_44px_-28px_rgba(15,23,42,0.55)] dark:border-white/10">
              <div className="absolute right-6 top-6 flex items-center gap-2 text-xs text-white/80">
                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold shadow-md backdrop-blur">+ Zoom</span>
                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold shadow-md backdrop-blur">- Zoom</span>
                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold shadow-md backdrop-blur">Novo nó</span>
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(124,58,237,0.12),transparent_35%),radial-gradient(circle_at_70%_60%,rgba(56,189,248,0.12),transparent_40%)]" />
              <div className="relative flex min-h-[260px] items-center justify-center">
                <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-4">
                  <div className="col-start-2 flex flex-col items-center gap-3">
                    <div className="w-[180px] rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-500 px-4 py-3 text-left shadow-xl">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold">Entrada</span>
                        <span className="h-2 w-2 rounded-full bg-white/80" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/25 px-3 py-1 font-semibold">+ Subtópico</span>
                        <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">+ Irmão</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {["#a78bfa", "#60a5fa", "#34d399", "#fb7185", "#fbbf24", "#f472b6", "#38bdf8"].map((color) => (
                          <span key={color} className="h-3 w-3 rounded-full" style={{ background: color }} />
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-white/80">Sem ícone</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-[180px] translate-y-6 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 px-4 py-3 text-left shadow-xl">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold">Processar</span>
                        <span className="h-2 w-2 rounded-full bg-white/80" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/25 px-3 py-1 font-semibold">+ Subtópico</span>
                        <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">+ Irmão</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {["#a78bfa", "#60a5fa", "#34d399", "#fb7185", "#fbbf24", "#f472b6", "#38bdf8"].map((color) => (
                          <span key={color} className="h-3 w-3 rounded-full" style={{ background: color }} />
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-white/80">Sem ícone</div>
                    </div>
                  </div>
                  <div className="row-start-2 flex flex-col items-center gap-3">
                    <div className="w-[180px] -translate-y-6 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 px-4 py-3 text-left shadow-xl">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold">Saída</span>
                        <span className="h-2 w-2 rounded-full bg-white/80" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/25 px-3 py-1 font-semibold">+ Subtópico</span>
                        <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">+ Irmão</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {["#a78bfa", "#60a5fa", "#34d399", "#fb7185", "#fbbf24", "#f472b6", "#38bdf8"].map((color) => (
                          <span key={color} className="h-3 w-3 rounded-full" style={{ background: color }} />
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-white/80">Sem ícone</div>
                    </div>
                  </div>
                  <div className="col-start-1 row-start-2 flex flex-col items-center gap-3">
                    <div className="w-[180px] -translate-y-3 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/90 to-slate-900 px-4 py-3 text-left shadow-xl">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-white/90">Novo mapa</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/90">+ Subtópico</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {["#a78bfa", "#60a5fa", "#34d399", "#fb7185", "#fbbf24", "#f472b6", "#38bdf8"].map((color) => (
                          <span key={color} className="h-3 w-3 rounded-full" style={{ background: color }} />
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-white/70">Sem ícone</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-3xl bg-white/80 p-4 shadow-inner shadow-slate-200/70 dark:bg-white/5 dark:shadow-none">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Formato ativo</p>
                <p className="text-sm text-slate-500 dark:text-zenko-muted">Neste momento a experiência está focada no modelo de mapa mental.</p>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Disponível</p>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Mapa mental</h3>
                    <p className="text-sm text-slate-600 dark:text-white/70">Crie tópicos e sub-nós com arraste livre e cores pastel.</p>
                  </div>
                  <Button onClick={() => handleCreate('mindmap')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 hover:shadow-lg dark:bg-white dark:text-slate-900">
                    Abrir editor
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {upcomingTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex min-w-[140px] flex-1 items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900/40 dark:text-white/70"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-800">🔒</span>
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-white">{template.name}</p>
                      <p className="text-xs text-slate-500 dark:text-white/70">Em breve</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-3 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.25)] backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Mapas recentes</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-white/80">
              {mindmaps.length} mapas
            </span>
          </div>
          <div className="space-y-3">
            {isLoading && <p className="text-sm text-slate-500">Carregando mapas...</p>}
            {!isLoading && filteredMindmaps.length === 0 && <p className="text-sm text-slate-500">Nenhum mapa criado ainda.</p>}
            {filteredMindmaps.slice(0, 6).map((map, index) => (
              <Link
                to={`/mindmaps/${map.id}`}
                key={map.id}
                className={`flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-gradient-to-br ${pastelCards[index % pastelCards.length]} p-3 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10`}
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{map.template}</p>
                  <h3 className="text-base font-semibold text-slate-900">{map.title}</h3>
                  <p className="text-xs text-slate-500">Atualizado {new Date(map.updatedAt).toLocaleDateString()}</p>
                </div>
                <svg className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
