-- Torna lead_id opcional em tasks (para tarefas sem lead associado)
ALTER TABLE tasks ALTER COLUMN lead_id DROP NOT NULL;
