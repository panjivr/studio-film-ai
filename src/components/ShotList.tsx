import { useMemo, useState } from 'react';
import { Plus, Trash2, Copy, Check, Image as ImageIcon, Video, ChevronLeft, Camera } from 'lucide-react';
import type { Episode, Project, Scene, Shot, Character, Wardrobe, LocationRow } from '@/lib/types';
import { createScene, createShot, updateShot, deleteRow } from '@/lib/db';
import { compileImagePrompt, compileVideoPrompt } from '@/lib/prompts';
import { SHOT_SIZES, CAMERA_ANGLES, CAMERA_MOVES } from '@/lib/types';
import { Button, Field, Modal, SectionHeader, SelectField, EmptyState } from './ui';

interface Props {
  project: Project;
  episode: Episode;
  scenes: Scene[];
  shots: Shot[];
  characters: Character[];
  wardrobes: Wardrobe[];
  locations: LocationRow[];
  refresh: () => Promise<void>;
  onBack: () => void;
}

export default function ShotList({ project, episode, scenes, shots, characters, wardrobes, locations, refresh, onBack }: Props) {
  const [sceneModal, setSceneModal] = useState(false);
  const [activeShot, setActiveShot] = useState<Shot | null>(null);

  return (
    <div>
      <SectionHeader
        title={`Shot List — EP${String(episode.number).padStart(2, '0')} ${episode.title}`}
        subtitle="Setiap shot mewarisi kanon: karakter terkunci, kostum terkunci, lokasi terkunci."
        action={
          <div className="flex gap-2">
            <Button variant="subtle" onClick={onBack}><ChevronLeft size={15} /> Episode</Button>
            <Button onClick={() => setSceneModal(true)}><Plus size={15} /> Scene Baru</Button>
          </div>
        } />

      {scenes.length === 0 ? (
        <EmptyState icon={<Camera size={32} />} title="Belum ada scene"
          hint="Pecah episode menjadi scene. Setiap scene memilih lokasi, waktu, objective, dan state masuk/keluar." />
      ) : (
        <div className="space-y-5">
          {scenes.map((sc) => {
            const scShots = shots.filter((s) => s.scene_id === sc.id);
            const loc = locations.find((l) => l.id === sc.location_id);
            const totalSec = scShots.reduce((a, s) => a + s.duration, 0);
            return (
              <div key={sc.id} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                  <div>
                    <h4 className="font-semibold text-zinc-100 text-sm">
                      SC{String(sc.scene_number).padStart(2, '0')} · {loc?.name ?? 'Lokasi belum dipilih'}
                      {sc.time_of_day && <span className="text-zinc-500 font-normal"> — {sc.time_of_day}</span>}
                    </h4>
                    {sc.objective && <p className="text-xs text-zinc-500 mt-0.5">Objective: {sc.objective}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                    <span>{scShots.length} shot · {totalSec}s</span>
                    <button onClick={async () => { if (confirm('Hapus scene ini beserta semua shot-nya?')) { await deleteRow('scenes', sc.id); await refresh(); } }}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {scShots.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-zinc-600 text-center">Belum ada shot di scene ini.</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {scShots.map((sh) => (
                      <button key={sh.id} onClick={() => setActiveShot(sh)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/[0.03] transition-colors">
                        <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-white/5 border border-white/10 text-[11px] font-bold text-zinc-300">
                          {String(sh.shot_number).padStart(2, '0')}
                        </span>
                        <span className="flex h-7 shrink-0 items-center rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-semibold px-2">
                          {sh.shot_size}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-200 truncate">{sh.action || sh.dialogue || '(belum ada aksi)'}</p>
                          <p className="text-[11px] text-zinc-600 truncate">
                            {characters.find((c) => c.id === sh.character_id)?.canonical_name ?? 'tanpa karakter'}
                            {' · '}{sh.lens_mm}mm · {sh.camera_move} · {sh.duration}s
                          </p>
                        </div>
                        <ChevronLeft size={14} className="rotate-180 text-zinc-700 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="px-4 pb-3 pt-1">
                  <AddShotButton scene={sc} nextNumber={scShots.length + 1}
                    characters={characters} wardrobes={wardrobes}
                    onCreated={async (input) => {
                      await createShot(project.id, sc.id, scShots.length + 1, input);
                      await refresh();
                    }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sceneModal && (
        <SceneModal projectId={project.id} episodeId={episode.id}
          nextSceneNumber={scenes.reduce((m, s) => Math.max(m, s.scene_number), 0) + 1}
          locations={locations}
          onClose={() => setSceneModal(false)}
          refresh={refresh} />
      )}

      {activeShot && scenes.length > 0 && (
        <ShotInspector
          shot={activeShot}
          project={project}
          characters={characters} wardrobes={wardrobes} locations={locations}
          scene={scenes.find((s) => s.id === activeShot.scene_id)!}
          episodeNumber={episode.number}
          onClose={() => setActiveShot(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
}

function AddShotButton({ scene, nextNumber, characters, wardrobes, onCreated }: {
  scene: Scene; nextNumber: number; characters: Character[]; wardrobes: Wardrobe[];
  onCreated: (input: Partial<Shot>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    shot_size: 'MCU', camera_angle: 'eye level', lens_mm: '50', camera_move: 'locked-off',
    character_id: '', wardrobe_id: '', action: '', performance: '', dialogue: '',
    lighting: '', blocking: '', duration: '4',
  });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const charWardrobes = wardrobes.filter((w) => w.character_id === f.character_id);

  return (
    <>
      <Button variant="subtle" className="!py-1.5 text-xs" onClick={() => setOpen(true)}>
        <Plus size={13} /> Tambah Shot
      </Button>
      {open && (
        <Modal title={`Shot Baru — SC${String(scene.scene_number).padStart(2, '0')}`} onClose={() => setOpen(false)} wide>
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await onCreated({
                shot_size: f.shot_size,
                camera_angle: f.camera_angle,
                lens_mm: parseInt(f.lens_mm, 10) || 50,
                camera_move: f.camera_move,
                character_id: f.character_id || null,
                wardrobe_id: f.wardrobe_id || null,
                action: f.action, performance: f.performance, dialogue: f.dialogue,
                lighting: f.lighting, blocking: f.blocking,
                duration: parseInt(f.duration, 10) || 4,
              });
              setOpen(false);
            } finally { setSaving(false); }
          }}>
            <div className="grid md:grid-cols-5 gap-3">
              <SelectField label="Shot Size" value={f.shot_size} onChange={set('shot_size')} allowEmpty={false}
                options={SHOT_SIZES.map((s) => ({ value: s, label: s }))} />
              <SelectField label="Angle" value={f.camera_angle} onChange={set('camera_angle')} allowEmpty={false}
                options={CAMERA_ANGLES.map((s) => ({ value: s, label: s }))} />
              <SelectField label="Lens" value={f.lens_mm} onChange={set('lens_mm')} allowEmpty={false}
                options={['24', '28', '35', '50', '85', '100'].map((l) => ({ value: l, label: `${l}mm` }))} />
              <SelectField label="Camera Move" value={f.camera_move} onChange={set('camera_move')} allowEmpty={false}
                options={CAMERA_MOVES.map((s) => ({ value: s, label: s }))} />
              <Field label="Durasi (detik)" value={f.duration} onChange={set('duration')} type="number" />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <SelectField label="Karakter" value={f.character_id} onChange={(v) => setF({ ...f, character_id: v, wardrobe_id: '' })}
                options={characters.map((c) => ({ value: c.id, label: c.canonical_name }))} />
              <SelectField label="Kostum (terkunci per karakter)" value={f.wardrobe_id} onChange={set('wardrobe_id')}
                options={charWardrobes.map((w) => ({ value: w.id, label: w.name }))}
                {...(!f.character_id ? {} : {})} />
            </div>
            <Field label="Aksi (satu aksi terlihat)" value={f.action} onChange={set('action')}
              placeholder="membuka amplop merah" />
            <Field label="Performance" value={f.performance} onChange={set('performance')}
              placeholder="dari marah bergeser ke takut; rahang mengeras" />
            <Field label="Dialog" value={f.dialogue} onChange={set('dialogue')}
              placeholder="MAYA: Kembalikan." />
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Lighting" value={f.lighting} onChange={set('lighting')}
                placeholder="soft window key dari kiri, practical 3200K" />
              <Field label="Blocking" value={f.blocking} onChange={set('blocking')}
                placeholder="Maya screen-left menghadap kanan; Daniel di belakang meja" />
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={saving}>Simpan Shot</Button>
            </div>
          </form>
        </Modal>
      )}
      {void nextNumber}
    </>
  );
}

function SceneModal({ projectId, episodeId, nextSceneNumber, locations, onClose, refresh }: {
  projectId: string; episodeId: string; nextSceneNumber: number;
  locations: LocationRow[]; onClose: () => void; refresh: () => Promise<void>;
}) {
  const [f, setF] = useState({ location_id: '', time_of_day: '', objective: '', conflict: '', entry_state: '', exit_state: '', notes: '' });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const [saving, setSaving] = useState(false);

  return (
    <Modal title="Scene Baru" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await createScene(projectId, episodeId, nextSceneNumber, {
            location_id: f.location_id || null,
            time_of_day: f.time_of_day, objective: f.objective, conflict: f.conflict,
            entry_state: f.entry_state, exit_state: f.exit_state, notes: f.notes,
          });
          await refresh();
          onClose();
        } finally { setSaving(false); }
      }}>
        <div className="grid md:grid-cols-2 gap-3">
          <SelectField label="Lokasi (kanonik)" value={f.location_id} onChange={set('location_id')}
            options={locations.map((l) => ({ value: l.id, label: l.name }))} />
          <Field label="Waktu" value={f.time_of_day} onChange={set('time_of_day')} placeholder="malam, 21:12" />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Objective Scene" value={f.objective} onChange={set('objective')} textarea rows={2} />
          <Field label="Conflict Scene" value={f.conflict} onChange={set('conflict')} textarea rows={2} />
          <Field label="Entry State" value={f.entry_state} onChange={set('entry_state')} textarea rows={2}
            placeholder="Maya basah karena hujan, membawa tas kerja" />
          <Field label="Exit State" value={f.exit_state} onChange={set('exit_state')} textarea rows={2}
            placeholder="Maya memegang amplop, seal patah" />
        </div>
        <Field label="Catatan" value={f.notes} onChange={set('notes')} textarea rows={2} />
        <div className="flex justify-end"><Button type="submit" disabled={saving}>Simpan Scene</Button></div>
      </form>
    </Modal>
  );
}

function ShotInspector({ shot, project, characters, wardrobes, locations, scene, episodeNumber, onClose, refresh }: {
  shot: Shot; project: Project; characters: Character[]; wardrobes: Wardrobe[];
  locations: LocationRow[]; scene: Scene; episodeNumber: number; onClose: () => void; refresh: () => Promise<void>;
}) {
  const [f, setF] = useState({ ...shot });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promptView, setPromptView] = useState<'image' | 'video' | null>(null);

  const compiled = useMemo(() => {
    const ctx = {
      project,
      episodeNumber,
      characters, wardrobes,
      locations, props: [],
      scene,
      shot: f,
    };
    return {
      image: compileImagePrompt(ctx),
      video: compileVideoPrompt(ctx),
    };
  }, [project, episodeNumber, locations, characters, wardrobes, scene, f]);

  const set = (k: keyof Shot, v: string) => { setF({ ...f, [k]: v }); setDirty(true); };
  const charWardrobes = wardrobes.filter((w) => w.character_id === f.character_id);

  return (
    <Modal title={`Shot ${String(shot.shot_number).padStart(2, '0')} — Inspector`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid md:grid-cols-5 gap-3">
          <SelectField label="Shot Size" value={f.shot_size} onChange={(v) => set('shot_size', v)} allowEmpty={false}
            options={SHOT_SIZES.map((s) => ({ value: s, label: s }))} />
          <SelectField label="Angle" value={f.camera_angle} onChange={(v) => set('camera_angle', v)} allowEmpty={false}
            options={CAMERA_ANGLES.map((s) => ({ value: s, label: s }))} />
          <SelectField label="Lens" value={String(f.lens_mm)} onChange={(v) => set('lens_mm', v)} allowEmpty={false}
            options={['24', '28', '35', '50', '85', '100'].map((l) => ({ value: l, label: `${l}mm` }))} />
          <SelectField label="Camera Move" value={f.camera_move} onChange={(v) => set('camera_move', v)} allowEmpty={false}
            options={CAMERA_MOVES.map((s) => ({ value: s, label: s }))} />
          <Field label="Durasi" value={f.duration} onChange={(v) => set('duration', v)} type="number" />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <SelectField label="Karakter" value={f.character_id ?? ''} onChange={(v) => set('character_id', v)}
            options={characters.map((c) => ({ value: c.id, label: c.canonical_name }))} />
          <SelectField label="Kostum" value={f.wardrobe_id ?? ''} onChange={(v) => set('wardrobe_id', v)}
            options={charWardrobes.map((w) => ({ value: w.id, label: w.name }))} />
        </div>
        <Field label="Aksi" value={f.action} onChange={(v) => set('action', v)} textarea rows={2} />
        <Field label="Performance" value={f.performance} onChange={(v) => set('performance', v)} textarea rows={2} />
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Dialog" value={f.dialogue} onChange={(v) => set('dialogue', v)} textarea rows={2} />
          <Field label="Audio" value={f.audio} onChange={(v) => set('audio', v)} textarea rows={2} />
          <Field label="Lighting" value={f.lighting} onChange={(v) => set('lighting', v)} textarea rows={2} />
          <Field label="Blocking" value={f.blocking} onChange={(v) => set('blocking', v)} textarea rows={2} />
        </div>
        <Field label="Catatan Kontinuitas" value={f.notes} onChange={(v) => set('notes', v)} textarea rows={2} />

        <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-white/10">
          <div className="flex flex-wrap gap-2">
            <Button variant="subtle" onClick={() => setPromptView('image')}><ImageIcon size={14} /> Prompt Gambar</Button>
            <Button variant="subtle" onClick={() => setPromptView('video')}><Video size={14} /> Prompt Video</Button>
            <Button variant="danger" onClick={async () => {
              if (!confirm('Hapus shot ini?')) return;
              await deleteRow('shots', shot.id);
              onClose();
              await refresh();
            }}><Trash2 size={14} /> Hapus</Button>
          </div>
          <Button disabled={!dirty || saving} onClick={async () => {
            setSaving(true);
            try {
              await updateShot(shot.id, {
                shot_size: f.shot_size, camera_angle: f.camera_angle, lens_mm: f.lens_mm,
                camera_move: f.camera_move, character_id: f.character_id, wardrobe_id: f.wardrobe_id,
                action: f.action, performance: f.performance, dialogue: f.dialogue, audio: f.audio,
                lighting: f.lighting, blocking: f.blocking, duration: f.duration, notes: f.notes,
              });
              await refresh();
              setDirty(false);
            } finally { setSaving(false); }
          }}><Check size={15} /> {dirty ? 'Simpan' : 'Tersimpan'}</Button>
        </div>

        {promptView && (
          <div className="rounded-lg border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/90">
                {promptView === 'image' ? 'Master Image Prompt' : 'Master Video Prompt'} — dikompilasi dari kanon
              </span>
              <Button variant="ghost" className="!px-2 !py-1 text-xs"
                onClick={() => navigator.clipboard.writeText(promptView === 'image' ? compiled.image : compiled.video)}>
                <Copy size={13} /> Copy
              </Button>
            </div>
            <pre className="whitespace-pre-wrap text-[11px] text-zinc-300 leading-relaxed max-h-72 overflow-y-auto">
              {promptView === 'image' ? compiled.image : compiled.video}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}
