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
      <div className="rounded-3xl bg-gradient-to-r from-[#1c1635] via-[#1d1f3f] to-[#0f172a] px-5 py-6 text-white shadow-2xl sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.35em] text-white/70">Mapas mentais</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Visual moderno inspirado no MindMeister</h1>
            <p className="max-w-2xl text-sm text-white/80 sm:text-base">
              Crie mapas, organogramas e fluxos em segundos. Tudo salvo automaticamente no seu navegador para edição rápida.
            </p>
          </div>
          <Button onClick={() => handleCreate(creatingTemplate)} className="self-start rounded-full bg-white/10 px-5 py-3 text-base text-white shadow-lg backdrop-blur hover:bg-white/20">
            Criar mapa
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/80">
          {MINDMAP_TEMPLATES.map((template) => (
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Modelos MindMeister</h2>
              <p className="text-sm text-slate-500 dark:text-zenko-muted">Escolha um modelo pronto para começar.</p>
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
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {MINDMAP_TEMPLATES.map((template, index) => (
              <div
                key={template.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br p-4 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10"
                style={{ background: `linear-gradient(135deg, ${template.bg}, #ffffff)` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Modelo</p>
                    <h3 className="text-lg font-semibold text-slate-900">{template.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{template.description}</p>
                  </div>
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-md"
                    style={{ background: template.accent }}
                  >
                    {index + 1}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[13px] text-slate-600">
                  {template.starter?.map((item) => (
                    <span key={item} className="rounded-full bg-white/70 px-3 py-1 shadow-sm">
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleCreate(template.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900/90 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <span>Criar mapa</span>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  </button>
                  <span className="text-xs text-slate-500">Estilo suave pastel</span>
                </div>
              </div>
            ))}
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
