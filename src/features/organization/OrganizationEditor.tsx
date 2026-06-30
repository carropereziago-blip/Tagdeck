import { Plus, Save, X } from "lucide-react";
import { useState } from "react";
import type {
  OrganizationOptions,
  OrganizationPatch,
  Project,
  SongStatus,
  TrackDetails,
} from "../../types/track";
import { useI18n } from "../../i18n";
import { SONG_STATUSES } from "./SmartCollections";

type Field = "status" | "project" | "version" | "notes" | "nextAction" | "tags";

interface OrganizationEditorProps {
  mode: "single" | "bulk";
  selectedCount: number;
  track: TrackDetails | null;
  options: OrganizationOptions;
  onClose: () => void;
  onCreateProject: (name: string) => Promise<Project>;
  onSave: (patch: OrganizationPatch) => Promise<void>;
}

export function OrganizationEditor({
  mode,
  selectedCount,
  track,
  options,
  onClose,
  onCreateProject,
  onSave,
}: OrganizationEditorProps) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<Set<Field>>(
    new Set(mode === "single" ? ["status", "project", "version", "notes", "nextAction", "tags"] : []),
  );
  const [status, setStatus] = useState<SongStatus>(track?.status ?? "review");
  const [projectId, setProjectId] = useState(track?.projectId?.toString() ?? "");
  const [version, setVersion] = useState(track?.versionLabel ?? "");
  const [notes, setNotes] = useState(track?.workflowNotes ?? "");
  const [nextAction, setNextAction] = useState(track?.nextAction ?? "");
  const [tags, setTags] = useState(track?.tagNames ?? "");
  const [newProject, setNewProject] = useState("");
  const [projects, setProjects] = useState(options.projects);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function activate(field: Field) {
    if (mode === "bulk") {
      setEnabled((current) => new Set(current).add(field));
    }
  }

  function toggle(field: Field) {
    setEnabled((current) => {
      const next = new Set(current);
      next.has(field) ? next.delete(field) : next.add(field);
      return next;
    });
  }

  async function createProject() {
    if (!newProject.trim()) return;
    try {
      const project = await onCreateProject(newProject);
      setProjects((current) =>
        current.some((item) => item.id === project.id) ? current : [...current, project],
      );
      setProjectId(String(project.id));
      setNewProject("");
      activate("project");
    } catch (projectError) {
      setError(String(projectError));
    }
  }

  async function submit() {
    const patch: OrganizationPatch = {};
    if (enabled.has("status")) patch.status = { value: status };
    if (enabled.has("project")) {
      patch.projectId = { value: projectId ? Number(projectId) : null };
    }
    if (enabled.has("version")) patch.versionLabel = { value: version.trim() || null };
    if (enabled.has("notes")) patch.workflowNotes = { value: notes.trim() || null };
    if (enabled.has("nextAction")) patch.nextAction = { value: nextAction.trim() || null };
    if (enabled.has("tags")) {
      patch.tagNames = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    if (Object.keys(patch).length === 0) {
      setError(t("organization.selectAtLeastOneField"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(patch);
      onClose();
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
      <section className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#18191c] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h3 className="font-semibold">{t("organization.creativeOrganization")}</h3>
            <p className="mt-0.5 text-xs text-white/35">
              {mode === "bulk" ? `${selectedCount} ${t("library.songs")}` : track?.title || track?.fileName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-white/45 hover:bg-white/5">
            <X size={17} />
          </button>
        </header>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5">
          <EditorField mode={mode} label={t("field.status")} field="status" enabled={enabled} onToggle={toggle}>
            <select value={status} onChange={(event) => { setStatus(event.target.value as SongStatus); activate("status"); }} className="field">
              {SONG_STATUSES.map((value) => <option key={value} value={value}>{t(`status.${value}`)}</option>)}
            </select>
          </EditorField>
          <EditorField mode={mode} label={t("field.project")} field="project" enabled={enabled} onToggle={toggle}>
            <select value={projectId} onChange={(event) => { setProjectId(event.target.value); activate("project"); }} className="field">
              <option value="">{t("organization.noProject")}</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </EditorField>
          <div className="flex gap-2 pl-[132px]">
            <input value={newProject} onChange={(event) => setNewProject(event.target.value)} placeholder={t("organization.newProject")} className="field" />
            <button type="button" onClick={() => void createProject()} className="rounded-md border border-white/10 px-3 text-white/55 hover:bg-white/5"><Plus size={15} /></button>
          </div>
          <EditorField mode={mode} label={t("field.version")} field="version" enabled={enabled} onToggle={toggle}>
            <input value={version} onChange={(event) => { setVersion(event.target.value); activate("version"); }} placeholder="v1, remix, instrumental..." className="field" />
          </EditorField>
          <EditorField mode={mode} label={t("field.tags")} field="tags" enabled={enabled} onToggle={toggle}>
            <input value={tags} onChange={(event) => { setTags(event.target.value); activate("tags"); }} placeholder="suno, cinematic, voz femenina" className="field" />
          </EditorField>
          <EditorField mode={mode} label={t("field.nextAction")} field="nextAction" enabled={enabled} onToggle={toggle}>
            <input value={nextAction} onChange={(event) => { setNextAction(event.target.value); activate("nextAction"); }} placeholder="Regenerar puente, revisar letra..." className="field" />
          </EditorField>
          <EditorField mode={mode} label={t("field.notes")} field="notes" enabled={enabled} onToggle={toggle}>
            <textarea value={notes} onChange={(event) => { setNotes(event.target.value); activate("notes"); }} rows={5} className="field resize-y" />
          </EditorField>
          {error && <p className="rounded-md border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs text-red-200">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-white/10 px-4 py-2 text-sm text-white/55">{t("common.cancel")}</button>
          <button type="button" disabled={saving} onClick={() => void submit()} className="flex items-center gap-2 rounded-md bg-[#d9ff43] px-4 py-2 text-sm font-semibold text-[#101113] disabled:opacity-50">
            <Save size={15} /> {saving ? t("common.saving") : t("organization.saveOrganization")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function EditorField({ mode, label, field, enabled, onToggle, children }: {
  mode: "single" | "bulk";
  label: string;
  field: Field;
  enabled: Set<Field>;
  onToggle: (field: Field) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3">
      <label className="flex items-center gap-2 pt-2 text-xs text-white/45">
        {mode === "bulk" && <input type="checkbox" checked={enabled.has(field)} onChange={() => onToggle(field)} className="accent-[#d9ff43]" />}
        {label}
      </label>
      {children}
    </div>
  );
}
