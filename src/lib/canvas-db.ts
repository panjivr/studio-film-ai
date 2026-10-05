import { supabase } from './supabase';

export type CanvasNodeKind = 'episode' | 'scene' | 'shot' | 'character' | 'note';

export interface CanvasNode {
  id: string;
  project_id: string;
  kind: CanvasNodeKind;
  title: string;
  body: string;
  meta: Record<string, unknown>;
  status: string;
  x: number;
  y: number;
  shot_id: string | null;
  character_id: string | null;
  scene_id: string | null;
  episode_id: string | null;
  created_at: string;
}

export interface CanvasEdge {
  id: string;
  project_id: string;
  source_id: string;
  target_id: string;
  created_at: string;
}

export async function loadCanvas(projectId: string): Promise<{ nodes: CanvasNode[]; edges: CanvasEdge[] }> {
  const [nodes, edges] = await Promise.all([
    supabase.from('canvas_nodes').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('canvas_edges').select('*').eq('project_id', projectId).order('created_at'),
  ]);
  return { nodes: nodes.data ?? [], edges: edges.data ?? [] };
}

export async function createCanvasNode(
  projectId: string, input: Partial<CanvasNode>,
): Promise<CanvasNode> {
  const { data, error } = await supabase
    .from('canvas_nodes')
    .insert({ project_id: projectId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCanvasNode(id: string, patch: Partial<CanvasNode>): Promise<void> {
  const { error } = await supabase.from('canvas_nodes').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteCanvasNode(id: string): Promise<void> {
  const { error } = await supabase.from('canvas_edges').delete().or(`source_id.eq.${id},target_id.eq.${id}`);
  if (error) throw error;
  const { error: err2 } = await supabase.from('canvas_nodes').delete().eq('id', id);
  if (err2) throw err2;
}

export async function createCanvasEdge(projectId: string, sourceId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('canvas_edges')
    .insert({ project_id: projectId, source_id: sourceId, target_id: targetId });
  if (error) throw error;
}

export async function deleteCanvasEdge(id: string): Promise<void> {
  const { error } = await supabase.from('canvas_edges').delete().eq('id', id);
  if (error) throw error;
}
