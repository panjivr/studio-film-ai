import { useState } from 'react';
import { Plus, Trash2, User, Clapperboard } from 'lucide-react';
import type { Character, Wardrobe, LocationRow, PropRow, Project } from '@/lib/types';
import {
  createCharacter, updateCharacter, deleteRow,
  createWardrobe, createLocation, createProp,
} from '@/lib/db';
import { referencePackPrompt, locationMasterPrompt } from '@/lib/prompts';
import { Button, Field, Modal, SectionHeader, SelectField, EmptyState } from './ui';
import { CHARACTER_ROLES } from '@/lib/types';

interface Props {
  project: Project;
  characters: Character[];
  wardrobes: Wardrobe[];
  locations: LocationRow[];
  props: PropRow[];
  refresh: () => Promise<void>;
}

const TABS = ['Karakter', 'Lokasi', 'Properti'] as const;

export default function AssetBible({ project, characters, wardrobes, locations, props, refresh }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Karakter');
  const [modal, setModal] = useState<'char' | 'ward' | 'loc' | 'prop' | null>(null);
  const [refView, setRefView] = useState<{ kind: 'char' | 'loc'; name: string; text: string } | null>(null);

  return (
    <div>
      <SectionHeader title="Asset Bible"
        subtitle="Kanonik visual: karakter, lokasi, properti. Ini sumber kebenaran semua prompt."
        action={
          <Button onClick={() => setModal(tab === 'Karakter' ? 'char' : tab === 'Lokasi' ? 'loc' : 'prop')}>
            <Plus size={15} /> Tambah {tab === 'Karakter' ? 'Karakter' : tab === 'Lokasi' ? 'Lokasi' : 'Properti'}
          </Button>
        } />

      <div className="flex gap-1 mb-4 border-b border-white/10">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            {t} <span className="text-xs text-zinc-600">
              ({t === 'Karakter' ? characters.length : t === 'Lokasi' ? locations.length : props.length})
            </span>
          </button>
        ))}
      </div>

      {tab === 'Karakter' && (
        characters.length === 0 ? (
          <EmptyState icon={<User size={32} />} title="Belum ada karakter"
            hint="Setiap karakter utama butuh identity lock: wajah, rambut, tubuh, dan ciri khas yang tidak boleh berubah antar episode." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {characters.map((c) => {
              const wCount = wardrobes.filter((w) => w.character_id === c.id).length;
              return (
                <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/20 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-zinc-100">{c.canonical_name}</h4>
                        <span className="rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] px-2 py-0.5 uppercase tracking-wide">
                          {c.role}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        {[c.age && `${c.age} th`, c.gender].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <button onClick={async () => { if (confirm(`Hapus ${c.canonical_name}?`)) { await deleteRow('characters', c.id); await refresh(); } }}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{c.identity.features || c.identity.hair || 'Identity lock belum diisi.'}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] text-zinc-600">{wCount} kostum terkait</span>
                    <div className="flex gap-1">
                      <Button variant="subtle" className="!px-2.5 !py-1 text-xs"
                        onClick={() => setRefView({ kind: 'char', name: c.canonical_name, text: referencePackPrompt(c) })}>
                        Reference Pack
                      </Button>
                      <Button variant="subtle" className="!px-2.5 !py-1 text-xs"
                        onClick={() => setModal('ward')}>
                        + Kostum
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'Lokasi' && (
        locations.length === 0 ? (
          <EmptyState icon={<Clapperboard size={32} />} title="Belum ada lokasi"
            hint="Lokasi diperlakukan seperti karakter: layout, material, hero objects, dan larangan perubahannya dikunci." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {locations.map((l) => (
              <div key={l.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/20 transition-colors">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-zinc-100">{l.name}</h4>
                  <button onClick={async () => { if (confirm(`Hapus lokasi ${l.name}?`)) { await deleteRow('locations', l.id); await refresh(); } }}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{l.layout || 'Layout belum diisi.'}</p>
                {l.palette && (
                  <p className="text-[11px] text-zinc-600 mt-2">Palette: {l.palette}</p>
                )}
                <div className="flex justify-end mt-3">
                  <Button variant="subtle" className="!px-2.5 !py-1 text-xs"
                    onClick={() => setRefView({ kind: 'loc', name: l.name, text: locationMasterPrompt(l) })}>
                    Location Master
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'Properti' && (
        props.length === 0 ? (
          <EmptyState icon={<Clapperboard size={32} />} title="Belum ada properti"
            hint="Properti kunci cerita punya state: tersegelatif, terbuka, rusak. State ini berubah dan harus dilacak." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {props.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-zinc-100">{p.name}</h4>
                  <button onClick={async () => { if (confirm(`Hapus properti ${p.name}?`)) { await deleteRow('props', p.id); await refresh(); } }}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-zinc-400 mt-2">{p.description}</p>
                {p.state && (
                  <p className="text-[11px] mt-2 inline-block rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 px-2 py-0.5">
                    State: {p.state}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {modal === 'char' && <CharacterModal projectId={project.id} onClose={() => setModal(null)} refresh={refresh} />}
      {modal === 'ward' && <WardrobeModal projectId={project.id} characters={characters} onClose={() => setModal(null)} refresh={refresh} />}
      {modal === 'loc' && <LocationModal projectId={project.id} onClose={() => setModal(null)} refresh={refresh} />}
      {modal === 'prop' && <PropModal projectId={project.id} onClose={() => setModal(null)} refresh={refresh} />}

      {refView && (
        <Modal title={`Reference Prompt — ${refView.name}`} onClose={() => setRefView(null)} wide>
          <pre className="whitespace-pre-wrap text-xs text-zinc-300 bg-black/40 rounded-lg p-4 border border-white/10 leading-relaxed">{refView.text}</pre>
          <div className="flex justify-end mt-3">
            <Button onClick={() => { navigator.clipboard.writeText(refView.text); }}>Copy Prompt</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CharacterModal({ projectId, onClose, refresh }: { projectId: string; onClose: () => void; refresh: () => Promise<void> }) {
  const [f, setF] = useState({
    canonical_name: '', role: 'protagonist', age: '', gender: '',
    face_shape: '', skin_tone: '', eyes: '', hair: '', build: '', features: '',
    posture: '', expression: '', gestures: '', tell: '', forbidden_drift: '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const [saving, setSaving] = useState(false);

  return (
    <Modal title="Karakter Baru" onClose={onClose} wide>
      <form className="space-y-5" onSubmit={async (e) => {
        e.preventDefault();
        if (!f.canonical_name.trim()) return;
        setSaving(true);
        try {
          await createCharacter(projectId, {
            canonical_name: f.canonical_name,
            role: f.role,
            age: f.age ? parseInt(f.age, 10) : null,
            gender: f.gender,
            identity: { face_shape: f.face_shape, skin_tone: f.skin_tone, eyes: f.eyes, hair: f.hair, build: f.build, features: f.features },
            performance: { posture: f.posture, expression: f.expression, gestures: f.gestures, tell: f.tell },
            forbidden_drift: f.forbidden_drift,
          });
          await refresh();
          onClose();
        } finally { setSaving(false); }
      }}>
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="Nama Kanonik" value={f.canonical_name} onChange={set('canonical_name')} placeholder="Maya" />
          <SelectField label="Peran" value={f.role} onChange={set('role')}
            options={CHARACTER_ROLES.map((r) => ({ value: r, label: r }))} allowEmpty={false} />
          <Field label="Usia" value={f.age} onChange={set('age')} type="number" placeholder="24" />
          <Field label="Gender" value={f.gender} onChange={set('gender')} placeholder="woman" />
        </div>

        <fieldset className="rounded-lg border border-white/10 p-4 space-y-3">
          <legend className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/90 px-2">Identity Lock (tidak boleh berubah)</legend>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Bentuk Wajah" value={f.face_shape} onChange={set('face_shape')} placeholder="soft oval" />
            <Field label="Tone Kulit" value={f.skin_tone} onChange={set('skin_tone')} placeholder="warm light-medium" />
            <Field label="Mata" value={f.eyes} onChange={set('eyes')} placeholder="almond, dark brown" />
            <Field label="Rambut" value={f.hair} onChange={set('hair')} placeholder="natural black, below shoulder, center part" />
            <Field label="Build" value={f.build} onChange={set('build')} placeholder="slim, average height" />
            <Field label="Ciri Khas" value={f.features} onChange={set('features')} placeholder="small beauty mark below left eye" />
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-white/10 p-4 space-y-3">
          <legend className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/90 px-2">Performance Identity</legend>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Postur Dasar" value={f.posture} onChange={set('posture')} placeholder="upright but slightly guarded" />
            <Field label="Ekspresi Istirahat" value={f.expression} onChange={set('expression')} placeholder="calm, observant" />
            <Field label="Bahasa Gerak" value={f.gestures} onChange={set('gestures')} placeholder="small controlled hand gestures" />
            <Field label="Emotional Tell" value={f.tell} onChange={set('tell')} placeholder="jaw tightens when angry" />
          </div>
        </fieldset>

        <Field label="Forbidden Drift" value={f.forbidden_drift} onChange={set('forbidden_drift')} textarea rows={2}
          placeholder="no bangs, no hair color change, no eye color change, no age shift" />

        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={saving || !f.canonical_name.trim()}>Simpan Karakter</Button>
        </div>
      </form>
    </Modal>
  );
}

function WardrobeModal({ projectId, characters, onClose, refresh }: { projectId: string; characters: Character[]; onClose: () => void; refresh: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <Modal title="Kostum Baru" onClose={onClose}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
          await createWardrobe(projectId, { name, character_id: characterId || null, description, notes });
          await refresh();
          onClose();
        } finally { setSaving(false); }
      }}>
        <Field label="Nama Kostum" value={name} onChange={setName} placeholder="Maya — Office 02" />
        <SelectField label="Pemilik" value={characterId} onChange={setCharacterId}
          options={characters.map((c) => ({ value: c.id, label: c.canonical_name }))} />
        <Field label="Deskripsi" value={description} onChange={setDescription} textarea rows={3}
          placeholder="ivory silk blouse, charcoal fitted blazer, black straight trousers, black low heels" />
        <Field label="Catatan Kontinuitas" value={notes} onChange={setNotes}
          placeholder="episode 10-13, tanpa kerusakan" />
        <div className="flex justify-end"><Button type="submit" disabled={saving || !name.trim()}>Simpan</Button></div>
      </form>
    </Modal>
  );
}

function LocationModal({ projectId, onClose, refresh }: { projectId: string; onClose: () => void; refresh: () => Promise<void> }) {
  const [f, setF] = useState({ name: '', layout: '', materials: '', hero_objects: '', palette: '', lighting: '', forbidden_changes: '' });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const [saving, setSaving] = useState(false);

  return (
    <Modal title="Lokasi Baru" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!f.name.trim()) return;
        setSaving(true);
        try {
          await createLocation(projectId, f);
          await refresh();
          onClose();
        } finally { setSaving(false); }
      }}>
        <Field label="Nama Lokasi" value={f.name} onChange={set('name')} placeholder="Daniel's Executive Office" />
        <Field label="Layout" value={f.layout} onChange={set('layout')} textarea rows={3}
          placeholder="desk faces south toward entrance, windows floor-to-ceiling north wall, sofa west wall" />
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Material" value={f.materials} onChange={set('materials')} textarea rows={2}
            placeholder="dark walnut floor, warm gray stone walls, black oak desk" />
          <Field label="Hero Objects" value={f.hero_objects} onChange={set('hero_objects')} textarea rows={2}
            placeholder="bronze desk lamp, abstract red painting, black leather chair" />
          <Field label="Palette" value={f.palette} onChange={set('palette')}
            placeholder="charcoal, walnut brown, warm amber" />
          <Field label="Practical Lighting" value={f.lighting} onChange={set('lighting')}
            placeholder="desk lamp 3200K, warm indirect ceiling strip" />
        </div>
        <Field label="Perubahan Terlarang" value={f.forbidden_changes} onChange={set('forbidden_changes')} textarea rows={2}
          placeholder="no fireplace, no extra window, no white marble floor" />
        <div className="flex justify-end"><Button type="submit" disabled={saving || !f.name.trim()}>Simpan</Button></div>
      </form>
    </Modal>
  );
}

function PropModal({ projectId, onClose, refresh }: { projectId: string; onClose: () => void; refresh: () => Promise<void> }) {
  const [f, setF] = useState({ name: '', description: '', state: '', narrative_function: '' });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const [saving, setSaving] = useState(false);

  return (
    <Modal title="Properti Baru" onClose={onClose}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!f.name.trim()) return;
        setSaving(true);
        try {
          await createProp(projectId, f);
          await refresh();
          onClose();
        } finally { setSaving(false); }
      }}>
        <Field label="Nama Properti" value={f.name} onChange={set('name')} placeholder="Amplop Merah" />
        <Field label="Deskripsi" value={f.description} onChange={set('description')} textarea rows={2}
          placeholder="matte dark-red A5 envelope, black wax seal" />
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="State Saat Ini" value={f.state} onChange={set('state')} placeholder="sealed" />
          <Field label="Fungsi Naratif" value={f.narrative_function} onChange={set('narrative_function')} placeholder="contains DNA test" />
        </div>
        <div className="flex justify-end"><Button type="submit" disabled={saving || !f.name.trim()}>Simpan</Button></div>
      </form>
    </Modal>
  );
}
