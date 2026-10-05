import { supabase } from './supabase';
import type {
  StudioData, Project, Character, Wardrobe, LocationRow, PropRow,
  Episode, Scene, Shot, Premise, VisualStyle, Keyframe, KeyframeParams,
} from './types';

const DEFAULT_PREMISE: Premise = { wants: '', needs: '', obstacle: '', question: '' };
const DEFAULT_VISUAL: VisualStyle = { genre_visual: '', lighting: '', color: '', texture: '', prohibited: '' };

export async function loadStudioData(): Promise<StudioData> {
  const [projects, characters, wardrobes, locations, props, episodes, scenes, shots, keyframes] =
    await Promise.all([
      supabase.from('projects').select('*').order('created_at'),
      supabase.from('characters').select('*').order('created_at'),
      supabase.from('wardrobes').select('*').order('created_at'),
      supabase.from('locations').select('*').order('created_at'),
      supabase.from('props').select('*').order('created_at'),
      supabase.from('episodes').select('*').order('number'),
      supabase.from('scenes').select('*').order('scene_number'),
      supabase.from('shots').select('*').order('shot_number'),
      supabase.from('keyframes').select('*').order('created_at'),
    ]);

  const first = <T,>(r: { data: T[] | null }) => r.data ?? [];
  return {
    projects: first(projects),
    characters: first(characters),
    wardrobes: first(wardrobes),
    locations: first(locations),
    props: first(props),
    episodes: first(episodes),
    scenes: first(scenes),
    shots: first(shots),
    keyframes: first(keyframes),
  };
}

export async function createProject(input: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...input,
      premise: { ...DEFAULT_PREMISE, ...(input.premise ?? {}) },
      visual_style: { ...DEFAULT_VISUAL, ...(input.visual_style ?? {}) },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  const { error } = await supabase.from('projects').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function createCharacter(
  projectId: string, input: Partial<Character>,
): Promise<Character> {
  const { data, error } = await supabase
    .from('characters')
    .insert({ project_id: projectId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCharacter(id: string, patch: Partial<Character>): Promise<void> {
  const { error } = await supabase.from('characters').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function createWardrobe(projectId: string, input: Partial<Wardrobe>): Promise<void> {
  const { error } = await supabase.from('wardrobes').insert({ project_id: projectId, ...input });
  if (error) throw error;
}

export async function createLocation(projectId: string, input: Partial<LocationRow>): Promise<void> {
  const { error } = await supabase.from('locations').insert({ project_id: projectId, ...input });
  if (error) throw error;
}

export async function createProp(projectId: string, input: Partial<PropRow>): Promise<void> {
  const { error } = await supabase.from('props').insert({ project_id: projectId, ...input });
  if (error) throw error;
}

export async function createEpisode(projectId: string, input: Partial<Episode>): Promise<Episode> {
  const { data, error } = await supabase
    .from('episodes')
    .insert({ project_id: projectId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEpisode(id: string, patch: Partial<Episode>): Promise<void> {
  const { error } = await supabase.from('episodes').update(patch).eq('id', id);
  if (error) throw error;
}

export async function createScene(
  projectId: string, episodeId: string, sceneNumber: number, input: Partial<Scene>,
): Promise<Scene> {
  const { data, error } = await supabase
    .from('scenes')
    .insert({ project_id: projectId, episode_id: episodeId, scene_number: sceneNumber, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateScene(id: string, patch: Partial<Scene>): Promise<void> {
  const { error } = await supabase.from('scenes').update(patch).eq('id', id);
  if (error) throw error;
}

export async function createShot(
  projectId: string, sceneId: string, shotNumber: number, input: Partial<Shot>,
): Promise<Shot> {
  const { data, error } = await supabase
    .from('shots')
    .insert({ project_id: projectId, scene_id: sceneId, shot_number: shotNumber, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShot(id: string, patch: Partial<Shot>): Promise<void> {
  const { error } = await supabase.from('shots').update(patch).eq('id', id);
  if (error) throw error;
}

export async function updateShotQC(
  shotIds: string[], status: string, notes: string,
): Promise<void> {
  const { error } = await supabase.from('shots').update({ qc_status: status, qc_notes: notes }).in('id', shotIds);
  if (error) throw error;
}

export async function upsertKeyframe(
  projectId: string, shotId: string, seed: number, params: KeyframeParams,
): Promise<Keyframe> {
  const { data, error } = await supabase
    .from('keyframes')
    .upsert(
      { project_id: projectId, shot_id: shotId, seed, params, approved: false },
      { onConflict: 'shot_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setKeyframeApproval(id: string, approved: boolean): Promise<void> {
  const { error } = await supabase.from('keyframes').update({ approved }).eq('id', id);
  if (error) throw error;
}
