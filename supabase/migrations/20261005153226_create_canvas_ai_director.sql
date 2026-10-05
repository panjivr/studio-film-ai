/*
# Canvas AI Director — node graph tables + production status columns

1. New Tables
- `canvas_nodes` — one node on the AI Director canvas for a project:
  - `kind` (text): 'idea' | 'beat' | 'script' | 'dialogue' | 'shot' | 'character' | 'location' | 'frame' | 'note' | 'ai'
  - `title` (text): node header.
  - `body` (text): main text content (idea text, script excerpt, compiled prompt, etc.).
  - `meta` (jsonb): arbitrary structured payload (shot settings, ai task config, qc report, etc.).
  - `status` (text): 'draft' | 'generating' | 'done' | 'error' — used for AI generation lifecycle.
  - `x`, `y` (double precision): canvas position.
  - `project_id` (uuid, FK to projects, cascade delete).
  - `shot_id`, `character_id`, `scene_id`, `episode_id` (uuid, nullable, SET NULL): optional links to canon rows.
- `canvas_edges` — a connection between two nodes:
  - `project_id` (uuid, FK to projects, cascade delete).
  - `source_id` (uuid, FK to canvas_nodes, cascade delete).
  - `target_id` (uuid, FK to canvas_nodes, cascade delete).

2. Modified Tables
- `shots`: add `qc_status` (text, default 'pending') and `qc_notes` (text) — continuity QC result for the production simulator.

3. Security
- RLS enabled on `canvas_nodes` and `canvas_edges`.
- Policies `TO anon, authenticated` with USING/WITH CHECK (true): this app is intentionally single-tenant and shared (no sign-in), matching the existing tables.

4. Notes
- No destructive changes; only additive columns on `shots` via ADD COLUMN IF NOT EXISTS.
- Indexes on project_id and edge endpoints for canvas loading.
*/

CREATE TABLE IF NOT EXISTS canvas_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  shot_id uuid REFERENCES shots(id) ON DELETE SET NULL,
  character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
  scene_id uuid REFERENCES scenes(id) ON DELETE SET NULL,
  episode_id uuid REFERENCES episodes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canvas_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE canvas_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_crud_canvas_nodes" ON canvas_nodes;
CREATE POLICY "public_crud_canvas_nodes" ON canvas_nodes
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_crud_canvas_edges" ON canvas_edges;
CREATE POLICY "public_crud_canvas_edges" ON canvas_edges
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE shots ADD COLUMN IF NOT EXISTS qc_status text NOT NULL DEFAULT 'pending';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS qc_notes text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_canvas_nodes_project ON canvas_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_project ON canvas_edges(project_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_source ON canvas_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_target ON canvas_edges(target_id);
