/*
# Keyframes — approved frame per shot for the film production pipeline

1. New Tables
- `keyframes` — one generated frame per shot:
  - `project_id` (uuid, FK to projects, cascade delete)
  - `shot_id` (uuid, FK to shots, cascade delete, UNIQUE — one keyframe per shot)
  - `seed` (integer, default 1) — deterministic variation seed; regenerating bumps this
  - `params` (jsonb) — visual edit overrides: expression, light_side, intensity
  - `approved` (boolean, default false) — user approved this keyframe as canon

2. Security
- RLS enabled.
- Policy `TO anon, authenticated` with USING/WITH CHECK (true): single-tenant shared app, matching all existing tables.

3. Notes
- Additive only; no existing tables modified.
- Index on project_id for list loading.
*/

CREATE TABLE IF NOT EXISTS keyframes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_id uuid NOT NULL UNIQUE REFERENCES shots(id) ON DELETE CASCADE,
  seed integer NOT NULL DEFAULT 1,
  params jsonb NOT NULL DEFAULT '{"expression":"neutral","light_side":"left","intensity":0.6}'::jsonb,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE keyframes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_crud_keyframes" ON keyframes;
CREATE POLICY "public_crud_keyframes" ON keyframes
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_keyframes_project ON keyframes(project_id);
