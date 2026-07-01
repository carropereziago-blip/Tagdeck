import { Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../../i18n";
import type {
  OrganizationOptions,
  OrganizationPatch,
  Project,
  SongStatus,
  TrackDetails,
} from "../../types/track";
import { SONG_STATUSES } from "../organization/SmartCollections";

type EditableField =
  | "rating"
  | "status"
  | "project"
  | "version"
  | "tags"
  | "mood"
  | "strongPart"
  | "mainProblem"
  | "intendedUse"
  | "nextAction"
  | "notes"
  | "generationModel"
  | "language";

interface InternalOrganizationEditorProps {
  mode: "single" | "bulk";
  selectedCount: number;
  track: TrackDetails | null;
  options: OrganizationOptions;
  onClose: () => void;
  onCreateProject: (name: string) => Promise<Project>;
  onSave: (patch: OrganizationPatch) => Promise<void>;
}

const EMPTY_PROJECT = "__empty";
const EDITABLE_FIELDS: EditableField[] = [
  "rating",
  "status",
  "project",
  "version",
  "tags",
  "mood",
  "strongPart",
  "mainProblem",
  "intendedUse",
  "nextAction",
  "notes",
  "generationModel",
  "language",
];
const INPUT_CLASS =
  "field min-h-10 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent)_20%,transparent)]";

function splitValues(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function joinValues(values: string[]) {
  return uniqueValues(values).join(", ") || null;
}

function fieldClass(enabled: boolean) {
  return `${INPUT_CLASS} ${
    enabled ? "border-[var(--color-accent)]" : "opacity-90 hover:opacity-100"
  }`;
}

export function InternalOrganizationEditor({
  mode,
  selectedCount,
  track,
  options,
  onClose,
  onCreateProject,
  onSave,
}: InternalOrganizationEditorProps) {
  const { t } = useI18n();
  const isBulk = mode === "bulk";
  const [saving, setSaving] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [createdProjects, setCreatedProjects] = useState<Project[]>([]);
  const [enabledFields, setEnabledFields] = useState<Set<EditableField>>(
    () => new Set(isBulk ? [] : EDITABLE_FIELDS),
  );
  const [rating, setRating] = useState(track?.rating?.toString() ?? "");
  const [status, setStatus] = useState<SongStatus>(track?.status ?? "review");
  const [projectId, setProjectId] = useState(
    track?.projectId ? String(track.projectId) : EMPTY_PROJECT,
  );
  const [version, setVersion] = useState(track?.versionLabel ?? "");
  const [language, setLanguage] = useState(track?.language ?? "");
  const [generationModel, setGenerationModel] = useState(track?.generationModel ?? "");
  const [notes, setNotes] = useState(track?.workflowNotes ?? "");
  const [nextAction, setNextAction] = useState(track?.nextAction ?? "");
  const [tags, setTags] = useState(() => splitValues(track?.tagNames));
  const [mood, setMood] = useState(() => splitValues(track?.mood));
  const [strongPart, setStrongPart] = useState(() => splitValues(track?.strongPart));
  const [mainProblem, setMainProblem] = useState(() => splitValues(track?.mainProblem));
  const [intendedUse, setIntendedUse] = useState(() => splitValues(track?.intendedUse));
  const [tagInput, setTagInput] = useState("");
  const [moodInput, setMoodInput] = useState("");
  const [strongPartInput, setStrongPartInput] = useState("");
  const [mainProblemInput, setMainProblemInput] = useState("");
  const [intendedUseInput, setIntendedUseInput] = useState("");

  const existingTagNames = useMemo(
    () => options.tags.map((tag) => tag.name).sort((a, b) => a.localeCompare(b)),
    [options.tags],
  );
  const projectOptions = useMemo(() => {
    const existing = new Set(options.projects.map((project) => project.id));
    return [
      ...options.projects,
      ...createdProjects.filter((project) => !existing.has(project.id)),
    ];
  }, [createdProjects, options.projects]);

  function isEnabled(field: EditableField) {
    return enabledFields.has(field);
  }

  function toggleField(field: EditableField) {
    if (!isBulk) return;
    setEnabledFields((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function enableField(field: EditableField) {
    if (!isBulk) return;
    setEnabledFields((current) => new Set(current).add(field));
  }

  function addChip(
    value: string,
    setValue: (value: string) => void,
    setItems: (updater: (current: string[]) => string[]) => void,
  ) {
    const nextValue = value.trim();
    if (!nextValue) return;
    setItems((current) => uniqueValues([...current, nextValue]));
    setValue("");
  }

  async function createAndAssignProject() {
    const name = projectName.trim();
    if (!name) return;
    setCreatingProject(true);
    try {
      const project = await onCreateProject(name);
      setCreatedProjects((current) => [...current, project]);
      setProjectId(String(project.id));
      enableField("project");
      setProjectName("");
    } finally {
      setCreatingProject(false);
    }
  }

  function buildPatch(): OrganizationPatch {
    const patch: OrganizationPatch = {};
    const enabled = (field: EditableField) => enabledFields.has(field);

    if (enabled("rating")) patch.rating = { value: rating ? Number(rating) : null };
    if (enabled("status")) patch.status = { value: status };
    if (enabled("project")) {
      patch.projectId = {
        value: projectId === EMPTY_PROJECT ? null : Number(projectId),
      };
    }
    if (enabled("version")) patch.versionLabel = { value: version.trim() || null };
    if (enabled("tags")) {
      patch.tagNames = uniqueValues(tags);
      patch.tagMode = "replace";
    }
    if (enabled("mood")) patch.mood = { value: joinValues(mood) };
    if (enabled("strongPart")) patch.strongPart = { value: joinValues(strongPart) };
    if (enabled("mainProblem")) patch.mainProblem = { value: joinValues(mainProblem) };
    if (enabled("intendedUse")) patch.intendedUse = { value: joinValues(intendedUse) };
    if (enabled("nextAction")) patch.nextAction = { value: nextAction.trim() || null };
    if (enabled("notes")) patch.workflowNotes = { value: notes.trim() || null };
    if (enabled("generationModel")) {
      patch.generationModel = { value: generationModel.trim() || null };
    }
    if (enabled("language")) patch.language = { value: language.trim() || null };
    return patch;
  }

  async function submit() {
    setError(null);
    const patch = buildPatch();
    if (!Object.keys(patch).length) {
      setError(t("editor.selectBulkField"));
      return;
    }
    if (
      isBulk &&
      !window.confirm(
        t("library.applyInternalOrganizationBulkConfirm").replace(
          "{count}",
          String(selectedCount),
        ),
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await onSave(patch);
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--color-overlay)] p-6">
      <section className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#d9ff43]/70">
              {t("library.internalOrganizationEditor")}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">
              {isBulk
                ? t("library.editingSelectedSongs").replace("{count}", String(selectedCount))
                : track?.title || track?.fileName || t("organization.selectedSong")}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t("library.internalOrganizationEditorHelp")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-control-subtle)] hover:text-[var(--color-text)]"
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <EditorField label={t("field.rating")}>
              <ApplyToggle
                mode={mode}
                field="rating"
                enabled={isEnabled("rating")}
                onToggle={toggleField}
                label={t("common.apply")}
              >
                <select
                  aria-label={t("field.rating")}
                  value={rating}
                  onChange={(event) => {
                    setRating(event.target.value);
                    enableField("rating");
                  }}
                  className={fieldClass(isEnabled("rating"))}
                >
                  <option value="">{t("field.ratingNone")}</option>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      {value}/10
                    </option>
                  ))}
                </select>
              </ApplyToggle>
            </EditorField>

            <EditorField label={t("field.status")}>
              <ApplyToggle
                mode={mode}
                field="status"
                enabled={isEnabled("status")}
                onToggle={toggleField}
                label={t("common.apply")}
              >
                <select
                  aria-label={t("field.status")}
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as SongStatus);
                    enableField("status");
                  }}
                  className={fieldClass(isEnabled("status"))}
                >
                  {SONG_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {t(`status.${value}`)}
                    </option>
                  ))}
                </select>
              </ApplyToggle>
            </EditorField>

            <EditorField label={t("field.project")}>
              <ApplyToggle
                mode={mode}
                field="project"
                enabled={isEnabled("project")}
                onToggle={toggleField}
                label={t("common.apply")}
              >
                <select
                  aria-label={t("field.project")}
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    enableField("project");
                  }}
                  className={fieldClass(isEnabled("project"))}
                >
                  <option value={EMPTY_PROJECT}>{t("organization.noProject")}</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex gap-2">
                  <input
                    aria-label={t("organization.newProject")}
                    value={projectName}
                    onChange={(event) => {
                      setProjectName(event.target.value);
                      enableField("project");
                    }}
                    placeholder={t("organization.newProject")}
                    className={`${fieldClass(isEnabled("project"))} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => void createAndAssignProject()}
                    disabled={creatingProject || !projectName.trim()}
                    className="rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-[var(--color-accent-foreground)] disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </ApplyToggle>
            </EditorField>

            <TextInputField
              mode={mode}
              field="version"
              label={t("field.version")}
              enabled={isEnabled("version")}
              onToggle={toggleField}
              onEnable={enableField}
              value={version}
              onChange={setVersion}
              list="library-version-options"
            />
            <datalist id="library-version-options">
              {options.versions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>

            <TextInputField
              mode={mode}
              field="generationModel"
              label={t("field.generationModel")}
              enabled={isEnabled("generationModel")}
              onToggle={toggleField}
              onEnable={enableField}
              value={generationModel}
              onChange={setGenerationModel}
              list="library-model-options"
            />
            <datalist id="library-model-options">
              {options.models.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>

            <TextInputField
              mode={mode}
              field="language"
              label={t("field.language")}
              enabled={isEnabled("language")}
              onToggle={toggleField}
              onEnable={enableField}
              value={language}
              onChange={setLanguage}
              placeholder="ES, EN..."
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ChipField
              mode={mode}
              field="tags"
              label={t("field.tags")}
              enabled={isEnabled("tags")}
              onToggle={toggleField}
              onEnable={enableField}
              values={tags}
              setValues={setTags}
              inputValue={tagInput}
              setInputValue={setTagInput}
              datalistId="library-tag-options"
              options={existingTagNames}
              placeholder={t("library.internalTagsPlaceholder")}
              onAdd={addChip}
            />
            <ChipField
              mode={mode}
              field="mood"
              label={t("field.mood")}
              enabled={isEnabled("mood")}
              onToggle={toggleField}
              onEnable={enableField}
              values={mood}
              setValues={setMood}
              inputValue={moodInput}
              setInputValue={setMoodInput}
              placeholder={t("explorer.selectMood")}
              onAdd={addChip}
            />
            <ChipField
              mode={mode}
              field="strongPart"
              label={t("field.strongPart")}
              enabled={isEnabled("strongPart")}
              onToggle={toggleField}
              onEnable={enableField}
              values={strongPart}
              setValues={setStrongPart}
              inputValue={strongPartInput}
              setInputValue={setStrongPartInput}
              placeholder={t("explorer.selectStrongParts")}
              onAdd={addChip}
            />
            <ChipField
              mode={mode}
              field="mainProblem"
              label={t("field.mainProblem")}
              enabled={isEnabled("mainProblem")}
              onToggle={toggleField}
              onEnable={enableField}
              values={mainProblem}
              setValues={setMainProblem}
              inputValue={mainProblemInput}
              setInputValue={setMainProblemInput}
              placeholder={t("explorer.selectMainProblems")}
              onAdd={addChip}
            />
            <ChipField
              mode={mode}
              field="intendedUse"
              label={t("field.intendedUse")}
              enabled={isEnabled("intendedUse")}
              onToggle={toggleField}
              onEnable={enableField}
              values={intendedUse}
              setValues={setIntendedUse}
              inputValue={intendedUseInput}
              setInputValue={setIntendedUseInput}
              placeholder={t("explorer.selectIntendedUses")}
              onAdd={addChip}
            />
          </div>

          <div className="mt-4 grid gap-4">
            <TextareaField
              mode={mode}
              field="nextAction"
              label={t("field.nextAction")}
              enabled={isEnabled("nextAction")}
              onToggle={toggleField}
              onEnable={enableField}
              value={nextAction}
              onChange={setNextAction}
              rows={3}
            />
            <TextareaField
              mode={mode}
              field="notes"
              label={t("field.notes")}
              enabled={isEnabled("notes")}
              onToggle={toggleField}
              onEnable={enableField}
              value={notes}
              onChange={setNotes}
              rows={5}
            />
          </div>

          {error && (
            <p className="mt-5 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-control-subtle)]"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-foreground)] disabled:opacity-45"
          >
            <Save size={16} />
            {saving ? t("common.saving") : t("library.saveInternalOrganization")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ApplyToggle({
  mode,
  field,
  enabled,
  onToggle,
  label,
  children,
}: {
  mode: "single" | "bulk";
  field: EditableField;
  enabled: boolean;
  onToggle: (field: EditableField) => void;
  label: string;
  children: ReactNode;
}) {
  if (mode === "single") return children;
  const id = `internal-organization-apply-${field}`;
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-2">
      <label
        htmlFor={id}
        className="mt-2 flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs text-[var(--color-text-secondary)]"
      >
        <input
          id={id}
          type="checkbox"
          checked={enabled}
          onChange={() => onToggle(field)}
          className="accent-[var(--color-accent)]"
        />
        <span>{label}</span>
      </label>
      {children}
    </div>
  );
}

function EditorField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block text-xs text-[var(--color-text-secondary)]">
      <span className="mb-1.5 block font-medium text-[var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function TextInputField({
  mode,
  field,
  label,
  enabled,
  onToggle,
  onEnable,
  value,
  onChange,
  placeholder,
  list,
}: {
  mode: "single" | "bulk";
  field: EditableField;
  label: string;
  enabled: boolean;
  onToggle: (field: EditableField) => void;
  onEnable: (field: EditableField) => void;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  list?: string;
}) {
  const { t } = useI18n();
  return (
    <EditorField label={label}>
      <ApplyToggle
        mode={mode}
        field={field}
        enabled={enabled}
        onToggle={onToggle}
        label={t("common.apply")}
      >
        <input
          aria-label={label}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onEnable(field);
          }}
          placeholder={placeholder}
          list={list}
          className={fieldClass(enabled)}
        />
      </ApplyToggle>
    </EditorField>
  );
}

function TextareaField({
  mode,
  field,
  label,
  enabled,
  onToggle,
  onEnable,
  value,
  onChange,
  rows,
}: {
  mode: "single" | "bulk";
  field: EditableField;
  label: string;
  enabled: boolean;
  onToggle: (field: EditableField) => void;
  onEnable: (field: EditableField) => void;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  const { t } = useI18n();
  return (
    <EditorField label={label}>
      <ApplyToggle
        mode={mode}
        field={field}
        enabled={enabled}
        onToggle={onToggle}
        label={t("common.apply")}
      >
        <textarea
          aria-label={label}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onEnable(field);
          }}
          rows={rows}
          className={`${fieldClass(enabled)} resize-y`}
        />
      </ApplyToggle>
    </EditorField>
  );
}

function ChipField({
  mode,
  field,
  label,
  enabled,
  onToggle,
  onEnable,
  values,
  setValues,
  inputValue,
  setInputValue,
  placeholder,
  datalistId,
  options = [],
  onAdd,
}: {
  mode: "single" | "bulk";
  field: EditableField;
  label: string;
  enabled: boolean;
  onToggle: (field: EditableField) => void;
  onEnable: (field: EditableField) => void;
  values: string[];
  setValues: (updater: (current: string[]) => string[]) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  placeholder: string;
  datalistId?: string;
  options?: string[];
  onAdd: (
    value: string,
    setValue: (value: string) => void,
    setItems: (updater: (current: string[]) => string[]) => void,
  ) => void;
}) {
  const { t } = useI18n();
  return (
    <EditorField label={label}>
      <ApplyToggle
        mode={mode}
        field={field}
        enabled={enabled}
        onToggle={onToggle}
        label={t("common.apply")}
      >
        <div
          className={`rounded-md border p-2 ${
            enabled
              ? "border-[var(--color-accent)] bg-[var(--color-control-subtle)]"
              : "border-[var(--color-border)] bg-[var(--color-control-subtle)] opacity-90 hover:opacity-100"
          }`}
        >
          <div className="flex min-h-7 flex-wrap gap-2">
            {values.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setValues((current) => current.filter((item) => item !== value));
                  onEnable(field);
                }}
                className="rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-3 py-1 text-xs text-[var(--color-accent)]"
              >
                {value} ×
              </button>
            ))}
          </div>
          <input
            aria-label={label}
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              onEnable(field);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                onAdd(inputValue, setInputValue, setValues);
                onEnable(field);
              }
            }}
            onBlur={() => onAdd(inputValue, setInputValue, setValues)}
            list={datalistId}
            placeholder={placeholder}
            className={`mt-2 w-full bg-transparent px-1 py-1 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] ${
              enabled ? "" : "opacity-90"
            }`}
          />
          {datalistId && (
            <datalist id={datalistId}>
              {options.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
        </div>
      </ApplyToggle>
    </EditorField>
  );
}
