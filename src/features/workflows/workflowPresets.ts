import type { ExplorerCriterion, SongStatus, TrackSummary } from "../../types/track";
import type { FieldVisibilityField } from "../settings/settings";

export const WORKFLOW_PRESET_STORAGE_KEY = "tagdeck.workflowPreset";

export type WorkflowPresetId =
  | "idea_capture"
  | "deep_review"
  | "daw_finishing"
  | "release_prep"
  | "radio_selection"
  | "custom_model_seeds"
  | "rejects_i_like"
  | "archive_cleanup"
  | "metadata_cleanup";

export type WorkflowAction =
  | { kind: "tag"; value: string }
  | { kind: "status"; value: SongStatus }
  | { kind: "nextAction"; value: string }
  | { kind: "removeTag"; value: string };

export interface WorkflowQuickAction {
  id: string;
  labelKey: string;
  action: WorkflowAction;
  primary?: boolean;
}

export interface WorkflowMetric {
  id: string;
  labelKey: string;
  smartCollectionId?: string;
  kind?: "queue" | "currentFilter";
}

export interface WorkflowQueue {
  criterion: ExplorerCriterion;
  smartCollection?: string | null;
}

export interface WorkflowPreset {
  id: WorkflowPresetId;
  labelKey: string;
  descriptionKey: string;
  defaultQueue: WorkflowQueue;
  defaultFilters: string[];
  primaryFields: FieldVisibilityField[];
  secondaryFields: FieldVisibilityField[];
  hiddenOrCollapsedFields: string[];
  helperKey?: string;
  checklistKeys?: string[];
  quickActions: WorkflowQuickAction[];
  primaryButtonKey: string;
  secondaryButtonKey: string;
  secondaryAction: WorkflowAction;
  suggestedStatus?: SongStatus;
  suggestedExport?: "daw_rescue" | "release" | "radio" | "model_seed";
  progressMetrics: WorkflowMetric[];
  mainScreen: "explorer";
  playlistPurpose:
    | "idea_capture"
    | "deep_review"
    | "daw_rescue"
    | "release_candidates"
    | "radio"
    | "custom_model_seed"
    | "rejects_i_like"
    | "archive_cleanup"
    | "metadata_cleanup"
    | "general";
}

export const QUICK_ACTIONS = {
  potential: action("potential", "Potential"),
  strongIdea: action("strong_idea", "Strong Idea"),
  maybeLater: action("maybe_later", "Maybe Later"),
  rejectsILike: action("rejects_i_like", "Rejects I Like"),
  customModelSeed: action("custom_model_seed", "Custom Model Seed"),
  releaseCandidate: action("release_candidate", "Release Candidate"),
  finalVersion: action("final_version", "Final Version"),
  needsStems: action("needs_stems", "Needs Stems"),
  needsVocalReplacement: action("needs_vocal_replacement", "Needs Vocal Replacement"),
  weakIntro: action("weak_intro", "Weak Intro"),
  needsArrangement: action("needs_arrangement", "Needs Arrangement"),
  needsMix: action("needs_mix", "Needs Mix"),
  needsMaster: action("needs_master", "Needs Master"),
  needsShorterEdit: action("needs_shorter_edit", "Needs Shorter Edit"),
  goodIdeaBadExecution: action("good_idea_bad_execution", "Good Idea, Bad Execution"),
  usefulFragment: action("useful_fragment", "Useful Fragment"),
  coreSeed: action("core_seed", "Core Seed"),
  referenceOnly: action("reference_only", "Reference Only"),
  vocalReference: action("vocal_reference", "Vocal Reference"),
  grooveReference: action("groove_reference", "Groove Reference"),
  lyricReference: action("lyric_reference", "Lyric Reference"),
  arrangementReference: action("arrangement_reference", "Arrangement Reference"),
  productionReference: action("production_reference", "Production Reference"),
};

const DAW_NEXT_ACTIONS: WorkflowQuickAction[] = [
  nextAction("fix_intro", "Fix intro"),
  nextAction("replace_vocal", "Replace vocal"),
  nextAction("extract_stems", "Extract stems"),
  nextAction("export_to_daw", "Export to DAW"),
  nextAction("rewrite_lyrics", "Rewrite lyrics"),
  nextAction("add_bass", "Add bass"),
  nextAction("add_guitar", "Add guitar"),
  nextAction("mix_master", "Mix/master"),
  nextAction("check_arrangement", "Check arrangement"),
  nextAction("compare_versions", "Compare versions"),
];

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "idea_capture",
    labelKey: "workflowPreset.idea_capture",
    descriptionKey: "workflowPresetDescription.idea_capture",
    helperKey: "workflowPresetHelper.idea_capture",
    defaultQueue: { criterion: "unreviewed" },
    defaultFilters: ["unreviewed", "unrated", "not_archived"],
    primaryFields: ["rating", "status", "project", "genre", "mood", "tags", "strongPart", "notes"],
    secondaryFields: ["mainProblem", "intendedUse", "nextAction", "version", "generationModel"],
    hiddenOrCollapsedFields: ["lyrics", "technicalMetadata", "extendedMetadata"],
    quickActions: [
      QUICK_ACTIONS.potential,
      { id: "strong_idea_status", labelKey: "quickAction.strong_idea", action: { kind: "status", value: "idea" }, primary: true },
      QUICK_ACTIONS.strongIdea,
      QUICK_ACTIONS.maybeLater,
      { id: "archive", labelKey: "quickAction.archive", action: { kind: "status", value: "archived" } },
      QUICK_ACTIONS.rejectsILike,
      QUICK_ACTIONS.customModelSeed,
    ],
    primaryButtonKey: "explorer.saveAndNext",
    secondaryButtonKey: "quickAction.markPotential",
    secondaryAction: { kind: "tag", value: "Potential" },
    suggestedStatus: "idea",
    progressMetrics: [
      { id: "queue", labelKey: "workflowMetric.unreviewedRemaining", kind: "queue" },
      { id: "potential", labelKey: "workflowMetric.potentialTracksFound", smartCollectionId: "tag_potential" },
      { id: "ideas", labelKey: "workflowMetric.ideasCaptured", smartCollectionId: "tag_strong_idea" },
    ],
    mainScreen: "explorer",
    playlistPurpose: "idea_capture",
  },
  {
    id: "deep_review",
    labelKey: "workflowPreset.deep_review",
    descriptionKey: "workflowPresetDescription.deep_review",
    helperKey: "workflowPresetHelper.deep_review",
    defaultQueue: { criterion: "all", smartCollection: "tag_potential" },
    defaultFilters: ["potential", "idea", "rating_6_plus", "missing_next_action"],
    primaryFields: ["rating", "status", "project", "version", "genre", "mood", "tags", "strongPart", "mainProblem", "intendedUse", "nextAction", "notes"],
    secondaryFields: ["generationModel"],
    hiddenOrCollapsedFields: ["technicalMetadata"],
    quickActions: [
      { id: "promote_daw", labelKey: "quickAction.promoteDawRescue", action: { kind: "status", value: "generating" }, primary: true },
      QUICK_ACTIONS.releaseCandidate,
      { id: "radio_ready", labelKey: "quickAction.markRadioReady", action: { kind: "status", value: "selected" } },
      QUICK_ACTIONS.customModelSeed,
      QUICK_ACTIONS.rejectsILike,
      { id: "archive", labelKey: "quickAction.archive", action: { kind: "status", value: "archived" } },
    ],
    primaryButtonKey: "explorer.saveAndNext",
    secondaryButtonKey: "quickAction.promoteDawRescue",
    secondaryAction: { kind: "status", value: "generating" },
    suggestedStatus: "editing",
    progressMetrics: [
      { id: "potential", labelKey: "workflowMetric.potentialTracks", smartCollectionId: "tag_potential" },
      { id: "daw", labelKey: "workflowMetric.promotedToDaw", smartCollectionId: "daw_rescue" },
      { id: "release_candidates", labelKey: "workflowMetric.releaseCandidates", smartCollectionId: "tag_release_candidate" },
    ],
    mainScreen: "explorer",
    playlistPurpose: "deep_review",
  },
  {
    id: "daw_finishing",
    labelKey: "workflowPreset.daw_finishing",
    descriptionKey: "workflowPresetDescription.daw_finishing",
    helperKey: "workflowPresetHelper.daw_finishing",
    defaultQueue: { criterion: "daw_rescue" },
    defaultFilters: ["daw_rescue", "in_progress", "needs_stems", "needs_mix"],
    primaryFields: ["rating", "status", "project", "version", "strongPart", "mainProblem", "nextAction", "intendedUse", "notes"],
    secondaryFields: ["tags", "genre", "mood", "generationModel"],
    hiddenOrCollapsedFields: ["lyrics", "extendedMetadata"],
    quickActions: [
      QUICK_ACTIONS.needsStems,
      QUICK_ACTIONS.needsVocalReplacement,
      QUICK_ACTIONS.weakIntro,
      QUICK_ACTIONS.needsArrangement,
      QUICK_ACTIONS.needsMix,
      QUICK_ACTIONS.needsMaster,
      ...DAW_NEXT_ACTIONS,
      { id: "mark_in_progress", labelKey: "quickAction.markInProgress", action: { kind: "status", value: "editing" }, primary: true },
      QUICK_ACTIONS.releaseCandidate,
      { id: "archive", labelKey: "quickAction.archive", action: { kind: "status", value: "archived" } },
    ],
    primaryButtonKey: "explorer.saveAndNext",
    secondaryButtonKey: "quickAction.needs_stems",
    secondaryAction: { kind: "tag", value: "Needs Stems" },
    suggestedStatus: "generating",
    suggestedExport: "daw_rescue",
    progressMetrics: [
      { id: "daw", labelKey: "workflowMetric.tracksNeedingDaw", smartCollectionId: "needs_daw_work" },
      { id: "action", labelKey: "workflowMetric.tracksWithNextAction", smartCollectionId: "needs_action" },
      { id: "stems", labelKey: "workflowMetric.needsStems", smartCollectionId: "tag_needs_stems" },
      { id: "mix", labelKey: "workflowMetric.needsMixMaster", smartCollectionId: "tag_needs_mix" },
    ],
    mainScreen: "explorer",
    playlistPurpose: "daw_rescue",
  },
  {
    id: "release_prep",
    labelKey: "workflowPreset.release_prep",
    descriptionKey: "workflowPresetDescription.release_prep",
    helperKey: "workflowPresetHelper.release_prep",
    defaultQueue: { criterion: "release_ready" },
    defaultFilters: ["release_ready", "release_candidate", "missing_metadata"],
    primaryFields: ["title", "artist", "album", "albumArtist", "genre", "year", "trackNumber", "bpm", "musicalKey", "lyrics", "coverArt"],
    secondaryFields: ["rating", "status", "project", "version", "notes", "intendedUse", "nextAction"],
    hiddenOrCollapsedFields: ["technicalMetadata"],
    checklistKeys: [
      "release.titleOk",
      "release.artistOk",
      "release.albumOk",
      "release.genreOk",
      "release.yearOk",
      "release.coverOk",
      "release.lyricsOk",
      "release.trackNumberOk",
      "release.finalAudioSelected",
      "release.visualizerReady",
      "release.descriptionDrafted",
      "release.releaseFolderCreated",
      "release.backupDone",
    ],
    quickActions: [
      { id: "release_ready", labelKey: "quickAction.markReleaseReady", action: { kind: "status", value: "final" }, primary: true },
      QUICK_ACTIONS.releaseCandidate,
      QUICK_ACTIONS.finalVersion,
      { id: "mark_released", labelKey: "quickAction.markReleased", action: { kind: "status", value: "published" } },
      { id: "archive_old", labelKey: "quickAction.archiveOlderVersions", action: { kind: "tag", value: "Archive Older Versions" } },
    ],
    primaryButtonKey: "explorer.saveAndNext",
    secondaryButtonKey: "quickAction.markReleaseReady",
    secondaryAction: { kind: "status", value: "final" },
    suggestedStatus: "final",
    suggestedExport: "release",
    progressMetrics: [
      { id: "ready", labelKey: "workflowMetric.releaseReady", smartCollectionId: "release_ready" },
      { id: "candidates", labelKey: "workflowMetric.releaseCandidates", smartCollectionId: "tag_release_candidate" },
      { id: "metadata", labelKey: "workflowMetric.missingMetadata", smartCollectionId: "needs_metadata" },
    ],
    mainScreen: "explorer",
    playlistPurpose: "release_candidates",
  },
  {
    id: "radio_selection",
    labelKey: "workflowPreset.radio_selection",
    descriptionKey: "workflowPresetDescription.radio_selection",
    helperKey: "workflowPresetHelper.radio_selection",
    defaultQueue: { criterion: "radio_ready" },
    defaultFilters: ["radio_ready", "rating_minimum", "genre_mood"],
    primaryFields: ["rating", "status", "genre", "mood", "duration", "bpm", "project", "notes", "playCount"],
    secondaryFields: ["tags", "intendedUse", "nextAction", "strongPart"],
    hiddenOrCollapsedFields: ["technicalMetadata"],
    quickActions: [
      { id: "radio_ready", labelKey: "quickAction.markRadioReady", action: { kind: "status", value: "selected" }, primary: true },
      { id: "remove_radio", labelKey: "quickAction.removeFromRadio", action: { kind: "status", value: "idea" } },
      QUICK_ACTIONS.needsShorterEdit,
      { id: "archive_radio", labelKey: "quickAction.archiveFromRadio", action: { kind: "status", value: "archived" } },
    ],
    primaryButtonKey: "explorer.saveAndNext",
    secondaryButtonKey: "quickAction.markRadioReady",
    secondaryAction: { kind: "status", value: "selected" },
    suggestedStatus: "selected",
    suggestedExport: "radio",
    progressMetrics: [
      { id: "radio", labelKey: "workflowMetric.radioReadyTracks", smartCollectionId: "radio_ready" },
      { id: "queue", labelKey: "workflowMetric.currentQueue", kind: "queue" },
    ],
    mainScreen: "explorer",
    playlistPurpose: "radio",
  },
  {
    id: "custom_model_seeds",
    labelKey: "workflowPreset.custom_model_seeds",
    descriptionKey: "workflowPresetDescription.custom_model_seeds",
    helperKey: "workflowPresetHelper.custom_model_seeds",
    defaultQueue: { criterion: "all", smartCollection: "tag_custom_model_seed" },
    defaultFilters: ["custom_model_seed", "core_seed", "rating_high"],
    primaryFields: ["rating", "generationModel", "project", "genre", "mood", "tags", "strongPart", "intendedUse", "notes", "version", "status"],
    secondaryFields: ["mainProblem", "nextAction"],
    hiddenOrCollapsedFields: ["technicalMetadata"],
    quickActions: [
      QUICK_ACTIONS.coreSeed,
      QUICK_ACTIONS.customModelSeed,
      QUICK_ACTIONS.referenceOnly,
      QUICK_ACTIONS.goodIdeaBadExecution,
      QUICK_ACTIONS.usefulFragment,
      QUICK_ACTIONS.vocalReference,
      QUICK_ACTIONS.grooveReference,
      QUICK_ACTIONS.lyricReference,
      QUICK_ACTIONS.arrangementReference,
      QUICK_ACTIONS.productionReference,
    ],
    primaryButtonKey: "explorer.saveAndNext",
    secondaryButtonKey: "quickAction.markCoreSeed",
    secondaryAction: { kind: "tag", value: "Core Seed" },
    suggestedExport: "model_seed",
    progressMetrics: [
      { id: "core", labelKey: "workflowMetric.coreSeedsSelected", smartCollectionId: "tag_core_seed" },
      { id: "seeds", labelKey: "workflowMetric.modelSeedCandidates", smartCollectionId: "tag_custom_model_seed" },
    ],
    mainScreen: "explorer",
    playlistPurpose: "custom_model_seed",
  },
  {
    id: "rejects_i_like",
    labelKey: "workflowPreset.rejects_i_like",
    descriptionKey: "workflowPresetDescription.rejects_i_like",
    helperKey: "workflowPresetHelper.rejects_i_like",
    defaultQueue: { criterion: "all", smartCollection: "tag_rejects_i_like" },
    defaultFilters: ["rejects_i_like", "strong_part", "medium_rating"],
    primaryFields: ["strongPart", "mainProblem", "intendedUse", "tags", "mood", "genre", "notes", "rating", "project"],
    secondaryFields: ["status", "nextAction", "version"],
    hiddenOrCollapsedFields: ["technicalMetadata"],
    quickActions: [
      QUICK_ACTIONS.referenceOnly,
      QUICK_ACTIONS.customModelSeed,
      { id: "use_daw", labelKey: "quickAction.useForDawRescue", action: { kind: "status", value: "generating" } },
      { id: "archive_fully", labelKey: "quickAction.archiveFully", action: { kind: "status", value: "archived" } },
      { id: "extract_idea", labelKey: "quickAction.extractIdea", action: { kind: "nextAction", value: "Extract usable idea" } },
      QUICK_ACTIONS.usefulFragment,
      { id: "remove_reject", labelKey: "quickAction.removeFromRejects", action: { kind: "removeTag", value: "Rejects I Like" } },
    ],
    primaryButtonKey: "explorer.saveAndNext",
    secondaryButtonKey: "quickAction.keepAsReference",
    secondaryAction: { kind: "tag", value: "Reference Only" },
    progressMetrics: [
      { id: "rejects", labelKey: "workflowMetric.usefulRejects", smartCollectionId: "tag_rejects_i_like" },
      { id: "fragments", labelKey: "workflowMetric.usefulFragments", smartCollectionId: "tag_useful_fragment" },
    ],
    mainScreen: "explorer",
    playlistPurpose: "rejects_i_like",
  },
  {
    id: "archive_cleanup",
    labelKey: "workflowPreset.archive_cleanup",
    descriptionKey: "workflowPresetDescription.archive_cleanup",
    helperKey: "workflowPresetHelper.archive_cleanup",
    defaultQueue: { criterion: "unrated" },
    defaultFilters: ["low_rating", "many_skips", "no_project", "archived_review"],
    primaryFields: ["rating", "status", "skipCount", "lastReviewedAt", "strongPart", "mainProblem", "notes", "project", "tags"],
    secondaryFields: ["nextAction", "mood", "genre"],
    hiddenOrCollapsedFields: ["technicalMetadata"],
    quickActions: [
      { id: "archive", labelKey: "quickAction.archive", action: { kind: "status", value: "archived" }, primary: true },
      { id: "keep", labelKey: "quickAction.keep", action: { kind: "status", value: "idea" } },
      QUICK_ACTIONS.rejectsILike,
      QUICK_ACTIONS.referenceOnly,
      { id: "mark_reviewed", labelKey: "quickAction.markReviewed", action: { kind: "status", value: "review" } },
    ],
    primaryButtonKey: "explorer.saveAndNext",
    secondaryButtonKey: "quickAction.archive",
    secondaryAction: { kind: "status", value: "archived" },
    suggestedStatus: "archived",
    progressMetrics: [
      { id: "archived", labelKey: "workflowMetric.archived", smartCollectionId: "archived" },
      { id: "rejects", labelKey: "workflowMetric.keptAsRejects", smartCollectionId: "tag_rejects_i_like" },
    ],
    mainScreen: "explorer",
    playlistPurpose: "archive_cleanup",
  },
  {
    id: "metadata_cleanup",
    labelKey: "workflowPreset.metadata_cleanup",
    descriptionKey: "workflowPresetDescription.metadata_cleanup",
    helperKey: "workflowPresetHelper.metadata_cleanup",
    defaultQueue: { criterion: "all", smartCollection: "needs_metadata" },
    defaultFilters: ["missing_artist", "missing_album", "missing_genre", "missing_lyrics"],
    primaryFields: ["title", "artist", "album", "albumArtist", "genre", "year", "trackNumber", "discNumber", "bpm", "musicalKey", "comment", "lyrics", "coverArt"],
    secondaryFields: ["project", "status", "rating", "notes", "version", "nextAction"],
    hiddenOrCollapsedFields: ["extendedMetadata"],
    quickActions: [
      { id: "clean_title", labelKey: "quickAction.cleanTitle", action: { kind: "tag", value: "Clean Title" } },
      { id: "validate_metadata", labelKey: "quickAction.validateMetadata", action: { kind: "nextAction", value: "Validate metadata" }, primary: true },
      { id: "backup_before_write", labelKey: "quickAction.backupBeforeWrite", action: { kind: "tag", value: "Backup Before Write" } },
    ],
    primaryButtonKey: "explorer.saveAndNext",
    secondaryButtonKey: "quickAction.validateMetadata",
    secondaryAction: { kind: "nextAction", value: "Validate metadata" },
    progressMetrics: [
      { id: "metadata", labelKey: "workflowMetric.missingMetadata", smartCollectionId: "needs_metadata" },
      { id: "queue", labelKey: "workflowMetric.currentQueue", kind: "queue" },
    ],
    mainScreen: "explorer",
    playlistPurpose: "metadata_cleanup",
  },
];

export const WORKFLOW_PRESET_IDS = WORKFLOW_PRESETS.map((preset) => preset.id);

export function workflowPresetById(id: string | null | undefined): WorkflowPreset {
  return WORKFLOW_PRESETS.find((preset) => preset.id === id) ?? WORKFLOW_PRESETS[0];
}

export function trackMatchesWorkflowPreset(track: TrackSummary, presetId: WorkflowPresetId) {
  const tags = splitTagNames(track.tagNames);
  const hasTag = (tagName: string) =>
    tags.some((tag) => tag.toLocaleLowerCase() === tagName.toLocaleLowerCase());
  const rating = track.rating ?? 0;
  const hasText = (...values: Array<string | null | undefined>) =>
    values.some((value) => (value ?? "").trim().length > 0);

  switch (presetId) {
    case "idea_capture":
      return track.status === "review" || track.rating === null;
    case "deep_review":
      return hasTag("Potential") || track.status === "idea" || rating >= 6;
    case "daw_finishing":
      return (
        track.status === "generating" ||
        track.status === "editing" ||
        hasTag("Needs Stems") ||
        hasTag("Needs Mix") ||
        hasTag("Needs Master") ||
        hasTag("Needs Arrangement")
      );
    case "release_prep":
      return track.status === "final" || track.status === "published" || hasTag("Release Candidate");
    case "radio_selection":
      return track.status === "selected" || lowerIncludes(track.intendedUse, "radio");
    case "custom_model_seeds":
      return hasTag("Custom Model Seed") || hasTag("Core Seed");
    case "rejects_i_like":
      return hasTag("Rejects I Like") || hasTag("Useful Fragment");
    case "archive_cleanup":
      return track.status === "archived" || rating <= 3 || !hasText(track.projectName, track.tagNames);
    case "metadata_cleanup":
      return !hasText(track.title, track.artist, track.album, track.genre);
    default:
      return true;
  }
}

function action(id: string, value: string, primary = false): WorkflowQuickAction {
  return {
    id,
    labelKey: `quickAction.${id}`,
    action: { kind: "tag", value },
    primary,
  };
}

function nextAction(id: string, value: string, primary = false): WorkflowQuickAction {
  return {
    id,
    labelKey: `quickAction.${id}`,
    action: { kind: "nextAction", value },
    primary,
  };
}

function splitTagNames(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function lowerIncludes(value: string | null | undefined, needle: string) {
  return (value ?? "").toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}
