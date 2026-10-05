import { useCallback, useMemo, useRef, useState } from 'react';
import {
  User, MapPin, Package, Tv, Film, StickyNote, Link2, Trash2, Copy, Plus,
  Loader2, Wand2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Save, X,
} from 'lucide-react';
import type { Finding } from '@/lib/tools';
import type { Project, StudioData, Shot } from '@/lib/types';
import type { CanvasNode, CanvasEdge, CanvasNodeKind } from '@/lib/canvas-db';
import {
  createCanvasNode, updateCanvasNode, deleteCanvasNode,
  createCanvasEdge, deleteCanvasEdge,
} from '@/lib/canvas-db';
import { createScene, createShot } from '@/lib/db';
import { compileImagePrompt, compileVideoPrompt } from '@/lib/prompts';
import { buildCoverage, checkScene, pad } from '@/lib/tools';
import { Button, Modal, Field, EmptyState } from '@/components/ui';

interface Props {
  project: Project;
  data: StudioData;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  refresh: () => Promise<void>;
}

const KIND_STYLE: Record<CanvasNodeKind, { border: string; stripe: string; icon: JSX.Element }> = {
  episode: {
    border: 'border-violet-500/40 bg-violet-500/[0.07]',
    stripe: 'bg-violet-500',
    icon: <Tv size={10} />,
  },
  scene: {
    border: 'border-sky-500/40 bg-sky-500/[0.07]',
    stripe: 'bg-sky-500',
    icon: <Film size={10} />,
  },
  shot: {
    border: 'border-amber-500/40 bg-amber-500/[0.07]',
    stripe: 'bg-amber-500',
    icon: <Film size={10} />,
  },
  character: {
    border: 'border-emerald-500/40 bg-emerald-500/[0.07]',
    stripe: 'bg-emerald-500',
    icon: <User size={10} />,
  },
  note: {
    border: 'border-zinc-500/40 bg-white/[0.05]',
    stripe: 'bg-zinc-500',
    icon: <StickyNote size={10} />,
  },
};

const NW = 190;
const NH = 78;

export default function DirectorCanvas({ project, data, nodes, edges, refresh }: Props) {
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<CanvasNode | null>(null);
  const [noteModal, setNoteModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [qcing, setQcing] = useState(false);
  const [qcResult, setQcResult] = useState<string[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const onPointerDown = (e: React.PointerEvent, n: CanvasNode) => {
    if (linkFrom) {
      if (linkFrom !== n.id) {
        createCanvasEdge(project.id, linkFrom, n.id).then(refresh);
      }
      setLinkFrom(null);
      return;
    }
    const rect = wrapRef.current!.getBoundingClientRect();
    setDrag({ id: n.id, dx: e.clientX - rect.left - n.x, dy: e.clientY - rect.top - n.y });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - drag.dx, rect.width - NW));
    const y = Math.max(0, Math.min(e.clientY - rect.top - drag.dy, rect.height - NH));
    updateCanvasNode(drag.id, { x, y }).then(refresh);
  };

  const syncFromStudio = useCallback(async () => {
    const existingNodes = new Set(nodes.map((n) =>
      `${n.kind}:${n.episode_id ?? ''}:${n.scene_id ?? ''}:${n.shot_id ?? ''}:${n.character_id ?? ''}`));

    let charCol = 0;
    for (const c of data.characters) {
      const key = `character::::${c.id}`;
      if (existingNodes.has(key)) continue;
      await createCanvasNode(project.id, {
        kind: 'character', title: c.canonical_name,
        body: [c.role, c.age ? `${c.age} th` : '', c.identity.hair].filter(Boolean).join(' · '),
        meta: { hair: c.identity.hair, features: c.identity.features },
        status: c.role, character_id: c.id, x: 40 + charCol * (NW + 32), y: 40,
      });
      charCol += 1;
    }
    let col = 1;
    for (const ep of data.episodes) {
      const epKey = `episode:${ep.id}:::${ep.id}`;
      if (!existingNodes.has(epKey)) {
        await createCanvasNode(project.id, {
          kind: 'episode', title: `EP${pad(ep.number)} ${ep.title || ''}`.trim(),
          body: ep.hook || 'seret alur cerita di sini',
          meta: { number: ep.number },
          status: ep.status, episode_id: ep.id, x: 40 + col * (NW + 32), y: 40,
        });
        col += 1;
      }
      let row = 1;
      for (const sc of data.scenes.filter((s) => s.episode_id === ep.id)) {
        const scKey = `scene:${ep.id}:${sc.id}::${sc.id}`;
        if (!existingNodes.has(scKey)) {
          await createCanvasNode(project.id, {
            kind: 'scene', title: `SC${pad(sc.scene_number)}`,
            body: `${data.locations.find((l) => l.id === sc.location_id)?.name ?? 'tanpa lokasi'} · ${sc.time_of_day}`,
            meta: { objective: sc.objective }, status: 'scene',
            scene_id: sc.id, episode_id: ep.id,
            x: 40 + col * (NW + 32), y: 40 + row * (NH + 40),
          });
        }
        row += 1;
      }
    }
    await refresh();
  }, [project.id, data, nodes, refresh]);

  const generateSceneBoard = async () => {
    const firstEpisode = data.episodes[0];
    if (!firstEpisode) return;
    setGenerating(true);
    try {
      let sceneNumber = data.scenes.filter((s) => s.episode_id === firstEpisode.id).length + 1;
      const sc = await createScene(project.id, firstEpisode.id, sceneNumber, {
        objective: 'Scene dari canvas — perjelas objective di tab Episode.',
        time_of_day: 'malam',
      });
      sceneNumber += 1;
      const sceneChars = data.characters.slice(0, 2);
      const plan = buildCoverage(sc, sceneChars, data.props.slice(0, 1));
      let shotNumber = 1;
      for (const p of plan) {
        await createShot(project.id, sc.id, shotNumber, p);
        await createCanvasNode(project.id, {
          kind: 'shot', title: `SH${pad(shotNumber)} ${p.shot_size}`,
          body: p.action, meta: { plan: p }, status: 'draft',
          shot_id: null, scene_id: sc.id, episode_id: firstEpisode.id,
          x: 40 + shotNumber * (NW + 32), y: 240,
        });
        shotNumber += 1;
      }
      await createCanvasNode(project.id, {
        kind: 'scene', title: `SC${pad(sc.scene_number)}`,
        body: `Auto coverage · ${plan.length} shot`, meta: {},
        status: 'scene', scene_id: sc.id, episode_id: firstEpisode.id,
        x: 40, y: 240,
      });
      await refresh();
    } finally {
      setGenerating(false);
    }
  };

  const runCanvasQC = async () => {
    setQcing(true);
    try {
      const messages: string[] = [];
      const sceneNodes = nodes.filter((n) => n.kind === 'scene' && n.scene_id);
      for (const sn of sceneNodes) {
        const sc = data.scenes.find((s) => s.id === sn.scene_id);
        if (!sc) continue;
        const shots = data.shots.filter((s) => s.scene_id === sc.id);
        const location = data.locations.find((l) => l.id === sc.location_id);
        const findings: Finding[] = checkScene(sc, shots, data.characters, data.wardrobes, location);
        const worst = findings.some((f) => f.level === 'FAIL') ? 'fail'
          : findings.length ? 'warn' : 'pass';
        await updateCanvasNode(sn.id, {
          status: worst,
          body: findings.length
            ? findings.slice(0, 3).map((f) => f.message).join(' | ')
            : 'PASS — semua shot terikat kanon.',
        });
        for (const sh of shots) {
          const label = `SH${pad(sh.shot_number)}`;
          const shotFindings = findings.filter((f) => f.message.startsWith(label));
          const st = shotFindings.some((f) => f.level === 'FAIL') ? 'fail'
            : shotFindings.length ? 'warn' : 'pass';
          messages.push(`EP·SC${pad(sc.scene_number)}·${label}: ${st.toUpperCase()}${shotFindings.length ? ' — ' + shotFindings[0].message.replace(label + ': ', '') : ''}`);
        }
        messages.push(`SC${pad(sc.scene_number)}: ${worst.toUpperCase()} (${findings.length} temuan)`);
      }
      setQcResult(messages);
      await refresh();
    } finally {
      setQcing(false);
    }
  };

  const inspectShots = useMemo(() => {
    if (!inspecting) return [];
    if (inspecting.kind === 'scene' && inspecting.scene_id) {
      return data.shots.filter((s) => s.scene_id === inspecting.scene_id);
    }
    if (inspecting.kind === 'shot' && inspecting.scene_id) {
      return data.shots.filter((s) => s.scene_id === inspecting.scene_id)
        .slice(0, 1);
    }
    return [];
  }, [inspecting, data.shots]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">AI Canvas</h2>
          <p className="text-sm text-zinc-500">Papan produksi tersimpan di database: geser node, sambungkan alur cerita, jalankan QC.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="subtle" onClick={syncFromStudio}><Plus size={14} /> Sync Aset</Button>
          <Button variant="subtle" onClick={() => setNoteModal(true)}><StickyNote size={14} /> Catatan</Button>
          <Button variant="subtle" onClick={generateSceneBoard} disabled={generating || data.episodes.length === 0}>
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Auto Coverage
          </Button>
          <Button variant="subtle" onClick={runCanvasQC} disabled={qcing}>
            {qcing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} QC Scene
          </Button>
          <Button variant={linkFrom ? 'primary' : 'subtle'} onClick={() => setLinkFrom(linkFrom ? null : 'pick')}>
            <Link2 size={14} /> {linkFrom ? 'Klik node tujuan…' : 'Hubungkan'}
          </Button>
        </div>
      </div>

      {qcResult && (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">Hasil QC Canvas</span>
            <Button variant="ghost" className="!p-1" onClick={() => setQcResult(null)}><X size={14} /></Button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {qcResult.map((m, i) => (
              <p key={i} className={`text-[11px] font-mono ${m.includes('FAIL') ? 'text-red-400' : m.includes('WARN') ? 'text-amber-400' : 'text-emerald-400'}`}>{m}</p>
            ))}
          </div>
        </div>
      )}

      {nodes.length === 0 ? (
        <EmptyState icon={<Film size={32} />} title="Canvas masih kosong"
          hint="Klik Sync Aset untuk menaruh episode & karakter dari studio, atau Auto Coverage untuk membangun scene lengkap dengan shot list otomatis."
          action={<Button onClick={syncFromStudio}><Plus size={14} /> Sync Aset Sekarang</Button>} />
      ) : (
        <div ref={wrapRef}
          className="relative h-[560px] rounded-xl border border-white/10 overflow-hidden"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="rgba(251,191,36,0.8)" />
              </marker>
            </defs>
            {edges.map((e) => {
              const a = nodeById.get(e.source_id); const b = nodeById.get(e.target_id);
              if (!a || !b) return null;
              const x1 = a.x + NW; const y1 = a.y + NH / 2;
              const x2 = b.x; const y2 = b.y + NH / 2;
              const mx = Math.max(40, (x2 - x1) / 2);
              return (
                <g key={e.id}>
                  <path d={`M ${x1} ${y1} C ${x1 + mx} ${y1}, ${x2 - mx} ${y2}, ${x2} ${y2}`}
                    fill="none" stroke="rgba(251,191,36,0.55)" strokeWidth="1.5" markerEnd="url(#arr)" />
                  <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="9"
                    className="pointer-events-auto cursor-pointer" fill="rgba(0,0,0,0.65)"
                    onClick={() => deleteCanvasEdge(e.id).then(refresh)} />
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 3.5} textAnchor="middle"
                    fontSize="9" fill="#fbbf24" className="pointer-events-none">✕</text>
                </g>
              );
            })}
          </svg>

          {nodes.map((n) => {
            const st = KIND_STYLE[n.kind];
            const qc = n.kind === 'scene' ? n.status : null;
            return (
              <div key={n.id}
                onPointerDown={(e) => onPointerDown(e, n)}
                onDoubleClick={() => setInspecting(n)}
                style={{ left: n.x, top: n.y, width: NW, height: NH }}
                className={`absolute select-none cursor-grab active:cursor-grabbing rounded-lg border ${st.border} ${linkFrom === n.id ? 'ring-2 ring-amber-400' : ''} px-3 py-2 shadow-lg shadow-black/40 hover:shadow-black/60 transition-shadow`}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${st.stripe}`} />
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                  {st.icon}{n.kind}
                  {qc === 'pass' && <CheckCircle2 size={11} className="text-emerald-400 ml-auto" />}
                  {qc === 'warn' && <AlertTriangle size={11} className="text-amber-400 ml-auto" />}
                  {qc === 'fail' && <XCircle size={11} className="text-red-400 ml-auto" />}
                </div>
                <p className="text-xs font-semibold text-zinc-100 truncate mt-0.5">{n.title || '(tanpa judul)'}</p>
                <p className="text-[10px] text-zinc-500 line-clamp-2 leading-snug">{n.body || '—'}</p>
              </div>
            );
          })}

          <div className="absolute bottom-3 left-3 text-[10px] text-zinc-600 bg-black/50 rounded-lg px-2.5 py-1.5 backdrop-blur">
            geser node · klik dua kali untuk membuka · sambung: klik asal → tujuan · QC Scene menandai tiap scene
          </div>
        </div>
      )}

      {noteModal && (
        <NoteModal projectId={project.id} count={nodes.length}
          onClose={() => setNoteModal(false)} refresh={refresh} />
      )}

      {inspecting && (
        <NodeInspector node={inspecting} data={data} project={project}
          shots={inspectShots}
          onClose={() => setInspecting(null)} refresh={refresh} />
      )}
    </div>
  );
}

function NoteModal({ projectId, count, onClose, refresh }: {
  projectId: string; count: number; onClose: () => void; refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Catatan Baru" onClose={onClose}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        try {
          await createCanvasNode(projectId, {
            kind: 'note', title, body, meta: {}, status: 'note',
            x: 40 + (count % 4) * (NW + 32), y: 40 + Math.floor(count / 4) * (NH + 40),
          });
          await refresh();
          onClose();
        } finally { setSaving(false); }
      }}>
        <Field label="Judul Catatan" value={title} onChange={setTitle} placeholder="Ide cliffhanger" />
        <Field label="Isi" value={body} onChange={setBody} textarea rows={4}
          placeholder="Tulis ide, referensi visual, atau instruksi produksi…" />
        <div className="flex justify-end"><Button type="submit" disabled={saving}>Simpan Catatan</Button></div>
      </form>
    </Modal>
  );
}

function NodeInspector({ node, data, project, shots, onClose, refresh }: {
  node: CanvasNode;
  data: StudioData;
  project: Project;
  shots: Shot[];
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState(node.title);
  const [body, setBody] = useState(node.body);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const episode = node.episode_id ? data.episodes.find((e) => e.id === node.episode_id) : null;
  const scene = node.scene_id ? data.scenes.find((s) => s.id === node.scene_id) : null;
  const character = node.character_id ? data.characters.find((c) => c.id === node.character_id) : null;

  const copyPrompt = (kind: 'image' | 'video', shot: StudioData['shots'][number]) => {
    if (!scene) return;
    const ep = data.episodes.find((e) => e.id === scene.episode_id);
    const ctx = {
      project,
      episodeNumber: ep?.number ?? 1,
      characters: data.characters, wardrobes: data.wardrobes,
      locations: data.locations, props: data.props,
      scene, shot,
    };
    navigator.clipboard.writeText(kind === 'image' ? compileImagePrompt(ctx) : compileVideoPrompt(ctx));
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Modal
      title={node.kind === 'episode' && episode ? `EP${pad(episode.number)} — ${episode.title || 'tanpa judul'}`
        : node.kind === 'scene' ? `Scene ${scene ? pad(scene.scene_number) : '?'} — Inspector`
        : node.kind === 'character' && character ? `Karakter ${character.canonical_name}`
        : 'Catatan'}
      onClose={onClose} wide
    >
      <div className="space-y-4">
        {node.kind !== 'shot' && (
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Judul" value={title} onChange={(v) => { setTitle(v); setDirty(true); }} />
            <Field label="Status / Sub" value={body} onChange={(v) => { setBody(v); setDirty(true); }} />
          </div>
        )}

        {episode && (
          <div className="grid md:grid-cols-2 gap-2">
            {[['Hook', episode.hook], ['Cliffhanger', episode.cliffhanger], ['Konflik', episode.conflict], ['Reversal', episode.reversal]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-amber-500/90 mb-1">{k}</p>
                <p className="text-xs text-zinc-300">{v || '—'}</p>
              </div>
            ))}
          </div>
        )}

        {character && (
          <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-amber-500/90">Identity Lock</p>
            {Object.entries(character.identity).filter(([, v]) => v).map(([k, v]) => (
              <p key={k} className="text-xs text-zinc-300"><span className="text-zinc-600">{k.replace(/_/g, ' ')}:</span> {v}</p>
            ))}
            {character.forbidden_drift && (
              <p className="text-[11px] text-red-400/80 mt-1">Forbidden: {character.forbidden_drift}</p>
            )}
          </div>
        )}

        {shots.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-amber-500/90">Shot List</p>
            {shots.map((sh) => (
              <div key={sh.id} className="rounded-lg border border-white/10 p-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 font-semibold">{pad(sh.shot_number)}</span>
                  <span className="font-semibold text-zinc-200">{sh.shot_size}</span>
                  <span className="text-zinc-600">{sh.lens_mm}mm · {sh.camera_move} · {sh.duration}s</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] border ${
                    sh.qc_status === 'pass' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : sh.qc_status === 'fail' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : sh.qc_status === 'warn' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-white/5 border-white/10 text-zinc-500'
                  }`}>{sh.qc_status}</span>
                  <Button variant="ghost" className="!p-1.5" onClick={() => copyPrompt('image', sh)}>
                    <Copy size={13} /> {copied === 'image' ? '✓' : 'IMG'}
                  </Button>
                  <Button variant="ghost" className="!p-1.5" onClick={() => copyPrompt('video', sh)}>
                    <Copy size={13} /> {copied === 'video' ? '✓' : 'VID'}
                  </Button>
                </div>
                <p className="text-xs text-zinc-400 mt-1.5">{sh.action || sh.dialogue || '—'}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-white/10">
          <Button variant="danger" onClick={async () => {
            if (!confirm('Hapus node ini dari canvas?')) return;
            await deleteCanvasNode(node.id);
            onClose();
            await refresh();
          }}><Trash2 size={14} /> Hapus Node</Button>
          {dirty && (
            <Button disabled={saving} onClick={async () => {
              setSaving(true);
              try {
                await updateCanvasNode(node.id, { title, body });
                await refresh();
                setDirty(false);
              } finally { setSaving(false); }
            }}><Save size={14} /> Simpan</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
