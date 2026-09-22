<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import type { BatchGridPlacementInput } from '$lib/models/types';
  import { preGenerateObjectGrid as startObjectGridPlacement } from '$lib/stores/project';
  import type { CustomPattern, GenerateObjectsInput, GenerateObjectsResult, ObjectAddedEvent, OpeningCatalogConfig, OptionsContextSnapshot, OptionsSelection, Point, Project, SaveEvent, WalkthroughPoint, WalkthroughPointAddedEvent } from '$lib/models/types';
  import type { RoomPreset } from '$lib/utils/roomPresets';
  import type { RoomTemplate } from '$lib/utils/roomTemplates';
  import type { DataStore } from '$lib/services/datastore';
  import { localStore } from '$lib/services/datastore';
  import { configureRuntime } from '$lib/runtime';
  import { resolvedTheme, themePreference, type ThemePreference } from '$lib/stores/theme';
  import { manualSave } from '$lib/stores/saveStatus';
  import { activeFloor, copySelectedElements, parseElementClipboard, pasteCopiedElements, selectedElementId, selectedElementIds, selectedRoomId, serializeElementClipboard } from '$lib/stores/project';
  import { addWalkthroughPoint as addProjectWalkthroughPoint, currentProject, createDefaultProject, generateObjects as generateProjectObjects, insertWalkthroughPoint as insertProjectWalkthroughPoint, normalizeCoordinates as normalizeProjectCoordinates, selectedTool, setWalkthroughPoints as setProjectWalkthroughPoints, updateWalkthroughPoint as updateProjectWalkthroughPoint } from '$lib/stores/project';
  import type { Tool } from '$lib/stores/project';
  import { registerCustomPattern, removeCustomPattern, setCustomPatterns } from '$lib/utils/customPatterns';
  import TopBar from '$lib/components/toolbar/TopBar.svelte';
  import BuildPanel from '$lib/components/sidebar/BuildPanel.svelte';
  import PropertiesPanel from '$lib/components/sidebar/PropertiesPanel.svelte';
  import LayersPanel from '$lib/components/sidebar/LayersPanel.svelte';
  import FloorPlanCanvas from '$lib/components/editor/FloorPlanCanvas.svelte';
  import AlignmentToolbar from '$lib/components/editor/AlignmentToolbar.svelte';
  import UndoHistoryPanel from '$lib/components/editor/UndoHistoryPanel.svelte';
  import CommandPalette from '$lib/components/editor/CommandPalette.svelte';
  import PrintLayout from '$lib/components/editor/PrintLayout.svelte';
  import OnboardingTooltip from '$lib/components/OnboardingTooltip.svelte';
  import { createProjectDataSnapshot, parseProjectFileData } from '$lib/utils/projectFile';
  import type { ProjectFileData } from '$lib/utils/projectFile';

  export interface FloorplanEditorHandle {
    getProject(): Project | null;
    loadProject(project: Project): void;
    updateFileData(data: ProjectFileData): void;
    focus(): void;
    registerPattern(pattern: CustomPattern): void;
    removePattern(id: string): void;
    setRoomCatalogs(presets: readonly RoomPreset[], templates: readonly RoomTemplate[]): void;
    setOpeningCatalog(config: OpeningCatalogConfig): void;
    generateObjects(input: GenerateObjectsInput): GenerateObjectsResult;
    preGenerateObjectGrid(input: BatchGridPlacementInput): void;
    setTool(tool: Tool): void;
    addWalkthroughPoint(position: Point, name?: string, dwellTime?: number): WalkthroughPoint;
    setWalkthroughPoints(points: readonly WalkthroughPoint[], floorId?: string): void;
    updateWalkthroughPoint(id: string, updates: Partial<Omit<WalkthroughPoint, 'id'>>): void;
    insertWalkthroughPoint(afterPointId: string, position?: Point, name?: string, dwellTime?: number): WalkthroughPoint | null;
    normalizeCoordinates(floorId?: string): Point | null;
    copySelection(): Promise<boolean>;
    pasteSelection(offset?: Point): Promise<string[]>;
    save(): Promise<SaveEvent | null>;
  }

  type ModulePosition = 'toolbarRight' | 'materialLibrary' | 'properties';

  interface Props {
    project?: Project;
    theme?: ThemePreference;
    dataStore?: DataStore;
    autoSave?: boolean;
    height?: string;
    class?: string;
    onProjectChange?: (project: Project) => void;
    onObjectAdded?: (event: ObjectAddedEvent) => void;
    onWalkthroughPointAdded?: (event: WalkthroughPointAddedEvent) => void;
    onSave?: (event: SaveEvent) => void;
    onReady?: (handle: FloorplanEditorHandle) => void;
    onModuleTarget?: (position: ModulePosition, element: HTMLElement | null) => void;
    customMaterialTitle?: string;
    hideDefaultOptions?: boolean;
    onOptionsContextChange?: (context: OptionsContextSnapshot | null) => void;
    customPatterns?: CustomPattern[];
    roomPresets?: readonly RoomPreset[];
    roomTemplates?: readonly RoomTemplate[];
    openingCatalog?: OpeningCatalogConfig;
  }

  let {
    project = $bindable(createDefaultProject()),
    dataStore = localStore,
    autoSave = true,
    height = '100vh',
    class: className = '',
    onProjectChange,
    onObjectAdded,
    onWalkthroughPointAdded,
    onSave,
    onReady,
    onModuleTarget,
    customMaterialTitle,
    theme,
    hideDefaultOptions = false,
    onOptionsContextChange,
    customPatterns,
    roomPresets = [],
    roomTemplates = [],
    openingCatalog = {}
  }: Props = $props();

  $effect(() => {
    if (theme) themePreference.set(theme);
  });

  function resolveOptionsSelection(): OptionsSelection | null {
    const floor = $activeFloor;
    if (!floor) return null;
    const roomId = $selectedRoomId;
    if (roomId) {
      const room = floor.rooms.find((item) => item.id === roomId);
      if (room) return { kind: 'room', value: room };
    }
    const id = $selectedElementId;
    if (!id) return null;
    const sources = [
      ['wall', floor.walls], ['door', floor.doors], ['window', floor.windows],
      ['wallArt', floor.wallArt ?? []], ['furniture', floor.furniture], ['stair', floor.stairs],
      ['column', floor.columns], ['textAnnotation', floor.textAnnotations ?? []],
      ['walkthroughPoint', floor.walkthroughPoints ?? []]
    ] as const;
    for (const [kind, values] of sources) {
      const value = values.find((item) => item.id === id);
      if (value) return { kind, value } as OptionsSelection;
    }
    return null;
  }

  $effect(() => {
    if (!ready || !onOptionsContextChange) return;
    const projectValue = $currentProject;
    const floor = $activeFloor;
    onOptionsContextChange(projectValue && floor ? {
      project: projectValue, floor, selection: resolveOptionsSelection(), selectedIds: [...$selectedElementIds]
    } : null);
  });

  let root: HTMLDivElement;
  let ready = $state(false);
  let showLayers = $state(false);
  let showUndoHistory = $state(false);
  let commandPaletteOpen = $state(false);
  let printOpen = $state(false);
  let propertiesTarget = $state<HTMLDivElement>();
  let objectAddedSource: ObjectAddedEvent['source'] = 'editor';
  let knownObjectIds = new Set<string>();
  let knownWalkthroughPointIds = new Set<string>();
  let walkthroughPointSource: WalkthroughPointAddedEvent['source'] = 'editor';

  $effect(() => {
    if (!ready) return;
    if (propertiesTarget) onModuleTarget?.('properties', propertiesTarget);
    return () => {
      onModuleTarget?.('properties', null);
    };
  });

  $effect(() => {
    if (ready && get(currentProject) !== project) {
      currentProject.set(project);
    }
  });

  export function getProject(): Project | null {
    let value: Project | null = null;
    const unsubscribe = currentProject.subscribe((project) => value = project);
    unsubscribe();
    return value ? createProjectDataSnapshot(value) : null;
  }

  export function loadProject(nextProject: Project) {
    knownObjectIds = new Set(nextProject.floors.flatMap((floor) => floor.furniture.map((item) => item.id)));
    knownWalkthroughPointIds = new Set(nextProject.floors.flatMap((floor) => (floor.walkthroughPoints ?? []).map((point) => point.id)));
    currentProject.set(nextProject);
  }

  export function updateFileData(data: ProjectFileData) {
    loadProject(parseProjectFileData(data));
  }

  export function focus() {
    root?.focus();
  }

  export function registerPattern(pattern: CustomPattern) {
    registerCustomPattern(pattern);
  }

  export function removePattern(id: string) {
    removeCustomPattern(id);
  }

  export function setRoomCatalogs(presets: readonly RoomPreset[], templates: readonly RoomTemplate[]) {
    roomPresets = presets;
    roomTemplates = templates;
  }

  export function setOpeningCatalog(config: OpeningCatalogConfig) {
    openingCatalog = config;
  }

  export function preGenerateObjectGrid(input: BatchGridPlacementInput) {
    startObjectGridPlacement(input);
  }

  export function generateObjects(input: GenerateObjectsInput) {
    objectAddedSource = 'batch';
    try {
      return generateProjectObjects(input);
    } finally {
      objectAddedSource = 'editor';
    }
  }

  export function setTool(tool: Tool) {
    selectedTool.set(tool);
  }

  export function addWalkthroughPoint(position: Point, name?: string, dwellTime?: number) {
    walkthroughPointSource = 'api';
    try {
      return addProjectWalkthroughPoint(position, name, dwellTime);
    } finally {
      walkthroughPointSource = 'editor';
    }
  }

  export function updateWalkthroughPoint(id: string, updates: Partial<Omit<WalkthroughPoint, 'id'>>) {
    updateProjectWalkthroughPoint(id, updates);
  }

  export function insertWalkthroughPoint(afterPointId: string, position?: Point, name?: string, dwellTime?: number) {
    walkthroughPointSource = 'api';
    try {
      return insertProjectWalkthroughPoint(afterPointId, position, name, dwellTime);
    } finally {
      walkthroughPointSource = 'editor';
    }
  }

  export function setWalkthroughPoints(points: readonly WalkthroughPoint[], floorId?: string) {
    walkthroughPointSource = 'api';
    try {
      setProjectWalkthroughPoints(points, floorId);
    } finally {
      walkthroughPointSource = 'editor';
    }
  }

  export function normalizeCoordinates(floorId?: string) {
    return normalizeProjectCoordinates(floorId);
  }

  export async function copySelection() {
    const payload = copySelectedElements();
    if (!payload) return false;
    await navigator.clipboard.writeText(serializeElementClipboard(payload));
    return true;
  }

  export async function pasteSelection(offset?: Point) {
    const payload = parseElementClipboard(await navigator.clipboard.readText());
    return payload ? pasteCopiedElements(offset, payload) : [];
  }

  export function save() {
    return manualSave('external');
  }

  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const editing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
    if (event.key === 'p' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      printOpen = true;
    }
    if ((event.key === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !event.ctrlKey && !event.metaKey && !editing)) {
      event.preventDefault();
      commandPaletteOpen = !commandPaletteOpen;
    }
    if (event.key === 'l' && !event.ctrlKey && !event.metaKey && !event.altKey && !editing) {
      showLayers = !showLayers;
    }
  }

  onMount(() => {
    configureRuntime({ dataStore, onSave });
    currentProject.set(project);
    if (customPatterns) setCustomPatterns(customPatterns);
    const initialProject = get(currentProject);
    knownObjectIds = new Set(initialProject?.floors.flatMap((floor) => floor.furniture.map((item) => item.id)) ?? []);
    knownWalkthroughPointIds = new Set(initialProject?.floors.flatMap((floor) => (floor.walkthroughPoints ?? []).map((point) => point.id)) ?? []);
    ready = true;

    let first = true;
    const unsubscribeProject = currentProject.subscribe((nextProject) => {
      if (!nextProject) return;
      if (first) {
        first = false;
        return;
      }
      const nextIds = new Set<string>();
      const addedEvents: ObjectAddedEvent[] = [];
      const walkthroughEvents: WalkthroughPointAddedEvent[] = [];
      for (const floor of nextProject.floors) {
        for (const object of floor.furniture) {
          nextIds.add(object.id);
          if (!knownObjectIds.has(object.id)) {
            addedEvents.push({
              object,
              floor,
              definition: nextProject.customPatterns?.find((item) => item.id === object.catalogId),
              source: objectAddedSource
            });
          }
        }
        (floor.walkthroughPoints ?? []).forEach((point, index) => {
          if (!knownWalkthroughPointIds.has(point.id)) walkthroughEvents.push({ point, floor, index, source: walkthroughPointSource });
        });
      }
      knownObjectIds = nextIds;
      knownWalkthroughPointIds = new Set(nextProject.floors.flatMap((floor) => (floor.walkthroughPoints ?? []).map((point) => point.id)));
      project = nextProject;
      for (const event of addedEvents) {
        try {
          onObjectAdded?.(event);
        } catch (error) {
          console.error('物件新增回调执行失败', error);
        }
      }
      for (const event of walkthroughEvents) {
        try {
          onWalkthroughPointAdded?.(event);
        } catch (error) {
          console.error('漫游标点新增回调执行失败', error);
        }
      }
      try {
        onProjectChange?.(createProjectDataSnapshot(nextProject));
      } catch (error) {
        console.error('项目变更回调执行失败', error);
      }
    });

    onReady?.({ getProject, loadProject, updateFileData, focus, registerPattern, removePattern, setRoomCatalogs, setOpeningCatalog, generateObjects, preGenerateObjectGrid, setTool, addWalkthroughPoint, setWalkthroughPoints, updateWalkthroughPoint, insertWalkthroughPoint, normalizeCoordinates, copySelection, pasteSelection, save });
    root.addEventListener('keydown', handleKeydown);

    return () => {
      root.removeEventListener('keydown', handleKeydown);
      unsubscribeProject();
    };
  });
</script>

<div
  bind:this={root}
  class="floorplan-editor relative flex flex-col overflow-hidden bg-white {className}"
  class:dark={$resolvedTheme === 'dark'}
  style:height
  tabindex="-1"
  aria-label="户型图编辑器"
>
  {#if ready}
    <TopBar {autoSave} {onModuleTarget} />
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <BuildPanel {roomPresets} {roomTemplates} {openingCatalog} {customMaterialTitle} {onModuleTarget} />
      <div class="flex-1 min-w-0 relative">
        <FloorPlanCanvas {roomPresets} {roomTemplates} />
        <AlignmentToolbar />
      </div>
      {#if showLayers}
        <LayersPanel />
      {/if}
      {#if !hideDefaultOptions}<PropertiesPanel />{/if}
      <div bind:this={propertiesTarget} data-floorplan-module="properties" class="fixed right-0 top-12 bottom-9 z-50 w-64 overflow-y-auto empty:hidden"></div>
    </div>

    <button class="absolute bottom-4 left-14 w-8 h-8 rounded-full shadow-lg hover:bg-slate-600 transition-colors z-50 text-sm" class:bg-blue-600={showLayers} class:text-white={showLayers} class:bg-slate-700={!showLayers} class:text-gray-300={!showLayers} onclick={() => showLayers = !showLayers} title="图层面板（L）" aria-label="切换图层面板">层</button>

    <button class="absolute bottom-4 left-24 w-8 h-8 rounded-full shadow-lg hover:bg-slate-600 transition-colors z-50 text-sm" class:bg-blue-600={showUndoHistory} class:text-white={showUndoHistory} class:bg-slate-700={!showUndoHistory} class:text-gray-300={!showUndoHistory} onclick={() => showUndoHistory = !showUndoHistory} title="撤销历史" aria-label="切换撤销历史">史</button>

    <UndoHistoryPanel bind:visible={showUndoHistory} />
    <CommandPalette bind:open={commandPaletteOpen} />
    <PrintLayout bind:open={printOpen} />
    <OnboardingTooltip />
  {:else}
    <div class="flex h-full items-center justify-center">
      <p class="text-gray-400">正在加载...</p>
    </div>
  {/if}
</div>
