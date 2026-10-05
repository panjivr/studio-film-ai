import { useState } from 'react';
import { Film, Save, Trash2 } from 'lucide-react';
import type { Project, Premise, VisualStyle } from '@/lib/types';
import { createProject, updateProject, deleteProject } from '@/lib/db';
import { Button, Field, Modal, SectionHeader } from './ui';

interface Props {
  project: Project | null;
  hasProjects: boolean;
  onCreated: (p: Project) => void;
  onUpdated: (p: Project) => void;
  onDeleted: () => void;
}

const EMPTY_PREMISE: Premise = { wants: '', needs: '', obstacle: '', question: '' };
const EMPTY_VISUAL: VisualStyle = { genre_visual: '', lighting: '', color: '', texture: '', prohibited: '' };

export default function ProjectBible({ project, hasProjects, onCreated, onUpdated, onDeleted }: Props) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [genre, setGenre] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [promise, setPromise] = useState('');
  const [saving, setSaving] = useState(false);

  const [premise, setPremise] = useState<Premise>(project?.premise ?? EMPTY_PREMISE);
  const [visual, setVisual] = useState<VisualStyle>(project?.visual_style ?? EMPTY_VISUAL);
  const [editLogline, setEditLogline] = useState(project?.logline ?? '');
  const [dirty, setDirty] = useState(false);

  if (!project) {
    return (
      <div>
        <SectionHeader title="Series Bible" subtitle="Fondasi kanonik seluruh serial Anda." />
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <Film className="mx-auto text-zinc-700 mb-3" size={32} />
          <p className="text-sm text-zinc-400">
            {hasProjects ? 'Pilih proyek dari daftar di atas.' : 'Belum ada proyek. Mulai dengan membuat Series Bible pertama.'}
          </p>
          {!hasProjects && (
            <Button className="mt-4" onClick={() => setCreating(true)}>Buat Proyek Baru</Button>
          )}
        </div>
        {creating && (
          <Modal title="Proyek Baru" onClose={() => setCreating(false)}>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              if (!title.trim()) return;
              setSaving(true);
              try {
                const p = await createProject({ title, logline, genre, audience, tone, series_promise: promise });
                onCreated(p);
                setCreating(false);
              } finally { setSaving(false); }
            }}>
              <Field label="Judul Serial" value={title} onChange={setTitle}
                placeholder="Amplop Merah" />
              <Field label="Logline" value={logline} onChange={setLogline} textarea rows={2}
                placeholder="Satu kalimat yang menjual cerita." />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Genre" value={genre} onChange={setGenre}
                  placeholder="Melodrama, revenge, hidden identity" />
                <Field label="Audiens" value={audience} onChange={setAudience}
                  placeholder="Wanita 18-34, mobile-first" />
              </div>
              <Field label="Tone" value={tone} onChange={setTone}
                placeholder="premium contemporary Asian melodrama" />
              <Field label="Series Promise" value={promise} onChange={setPromise} textarea rows={2}
                placeholder="Janji emosional yang serial ini penuhi setiap episode." />
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving || !title.trim()}>
                  <Save size={15} /> Buat Series Bible
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    );
  }

  const setP = (k: keyof Premise, v: string) => { setPremise({ ...premise, [k]: v }); setDirty(true); };
  const setV = (k: keyof VisualStyle, v: string) => { setVisual({ ...visual, [k]: v }); setDirty(true); };

  return (
    <div className="space-y-6">
      <SectionHeader title="Series Bible"
        subtitle={`${project.title} · target ${project.target_episodes} episode × ${project.episode_seconds}s · 9:16`}
        action={
          <Button variant="danger" onClick={async () => {
            if (!confirm(`Hapus proyek "${project.title}" beserta semua karakter, episode, dan shot?`)) return;
            await deleteProject(project.id);
            onDeleted();
          }}>
            <Trash2 size={15} /> Hapus Proyek
          </Button>
        } />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-500/90">Premise</h4>
          <Field label="Protagonis Ingin" value={premise.wants} onChange={(v) => setP('wants', v)} textarea rows={2} />
          <Field label="Protagonis Butuh" value={premise.needs} onChange={(v) => setP('needs', v)} textarea rows={2} />
          <Field label="Hambatan Utama" value={premise.obstacle} onChange={(v) => setP('obstacle', v)} textarea rows={2} />
          <Field label="Dramatic Question" value={premise.question} onChange={(v) => setP('question', v)} textarea rows={2} />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-500/90">Visual Bible</h4>
          <Field label="Genre Visual" value={visual.genre_visual} onChange={(v) => setV('genre_visual', v)} textarea rows={2}
            placeholder="premium contemporary Asian melodrama" />
          <Field label="Lighting" value={visual.lighting} onChange={(v) => setV('lighting', v)} textarea rows={2}
            placeholder="soft motivated key, medium-high contrast, skin priority" />
          <Field label="Warna" value={visual.color} onChange={(v) => setV('color', v)} textarea rows={2}
            placeholder="cool neutral shadows, warm natural skin, restrained saturation" />
          <Field label="Tekstur" value={visual.texture} onChange={(v) => setV('texture', v)}
            placeholder="subtle grain, low sharpening" />
          <Field label="Dilarang" value={visual.prohibited} onChange={(v) => setV('prohibited', v)} textarea rows={2}
            placeholder="plastic skin, random neon, excessive teal-orange" />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-500/90">Logline & Promise</h4>
        <Field label="Logline" value={editLogline} onChange={(v) => { setEditLogline(v); setDirty(true); }} textarea rows={2} />
        <Field label="Series Promise" value={project.series_promise}
          onChange={(v) => { onUpdated({ ...project, series_promise: v }); setDirty(true); }} textarea rows={2} />
      </div>

      <div className="flex justify-end">
        <Button disabled={!dirty || saving} onClick={async () => {
          setSaving(true);
          try {
            await updateProject(project.id, { premise, visual_style: visual, logline: editLogline });
            onUpdated({ ...project, premise, visual_style: visual, logline: editLogline });
            setDirty(false);
          } finally { setSaving(false); }
        }}>
          <Save size={15} /> {dirty ? 'Simpan Perubahan' : 'Tersimpan'}
        </Button>
      </div>
    </div>
  );
}
