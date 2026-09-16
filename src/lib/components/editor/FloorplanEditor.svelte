<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import type { CustomPattern, GenerateObjectsInput, GenerateObjectsResult, ObjectAddedEvent, OpeningCatalogConfig, Point, Project, WalkthroughPoint, WalkthroughPointAddedEvent } from '$lib/models/types';
  import type { RoomPreset } from '$lib/utils/roomPresets';
  import type { RoomTemplate } from '$lib/utils/roomTemplates';
  import type { DataStore } from '$lib/services/datastore';
  import { localStore } from '$lib/services/datastore';
  import { configureRuntime } from '$lib/runtime';
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

  export interface FloorplanEditorHandle {
    getProject(): Project | null;
    loadProject(project: Project): void;
    focus(): void;
    registerPattern(pattern: CustomPattern): void;
    removePattern(id: string): void;
    setRoomCatalogs(presets: readonly RoomPreset[], templates: readonly RoomTemplate[]): void;
    setOpeningCatalog(config: OpeningCatalogConfig): void;
    generateObjects(input: GenerateObjectsInput): GenerateObjectsResult;
    setTool(tool: Tool): void;
    addWalkthroughPoint(position: Point, name?: string, dwellTime?: number): WalkthroughPoint;
    setWalkthroughPoints(points: readonly WalkthroughPoint[], floorId?: string): void;
    updateWalkthroughPoint(id: string, updates: Partial<Omit<WalkthroughPoint, 'id'>>): void;
    insertWalkthroughPoint(afterPointId: string, position?: Point, name?: string, dwellTime?: number): WalkthroughPoint | null;
    normalizeCoordinates(floorId?: string): Point | null;
  }

  type ModulePosition = 'toolbar' | 'leftPanel' | 'rightPanel' | 'canvasOverlay';

  interface Props {
    project?: Project;
    dataStore?: DataStore;
    autoSave?: boolean;
    height?: string;
    class?: string;
    onProjectChange?: (project: Project) => void;
    onObjectAdded?: (event: ObjectAddedEvent) => void;
    onWalkthroughPointAdded?: (event: WalkthroughPointAddedEvent) => void;
    onReady?: (handle: FloorplanEditorHandle) => void;
    onModuleTarget?: (position: ModulePosition, element: HTMLElement | null) => void;
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
    onReady,
    onModuleTarget,
    customPatterns,
    roomPresets = [],
    roomTemplates = [],
    openingCatalog = {}
  }: Props = $props();

  let root: HTMLDivElement;
  let ready = $state(false);
  let showLayers = $state(false);
  let showUndoHistory = $state(false);
  let commandPaletteOpen = $state(false);
  let printOpen = $state(false);
  let toolbarTarget = $state<HTMLDivElement>();
  let leftPanelTarget = $state<HTMLDivElement>();
  let rightPanelTarget = $state<HTMLDivElement>();
  let canvasOverlayTarget = $state<HTMLDivElement>();
  let objectAddedSource: ObjectAddedEvent['source'] = 'editor';
  let knownObjectIds = new Set<string>();
  let knownWalkthroughPointIds = new Set<string>();
  let walkthroughPointSource: WalkthroughPointAddedEvent['source'] = 'editor';

  $effect(() => {
    if (!ready) return;
    if (toolbarTarget) onModuleTarget?.('toolbar', toolbarTarget);
    if (leftPanelTarget) onModuleTarget?.('leftPanel', leftPanelTarget);
    if (rightPanelTarget) onModuleTarget?.('rightPanel', rightPanelTarget);
    if (canvasOverlayTarget) onModuleTarget?.('canvasOverlay', canvasOverlayTarget);
    return () => {
      onModuleTarget?.('toolbar', null);
      onModuleTarget?.('leftPanel', null);
      onModuleTarget?.('rightPanel', null);
      onModuleTarget?.('canvasOverlay', null);
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
    return value;
  }

  export function loadProject(nextProject: Project) {
    knownObjectIds = new Set(nextProject.floors.flatMap((floor) => floor.furniture.map((item) => item.id)));
    knownWalkthroughPointIds = new Set(nextProject.floors.flatMap((floor) => (floor.walkthroughPoints ?? []).map((point) => point.id)));
    currentProject.set(nextProject);
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
    configureRuntime({ dataStore });
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
        onProjectChange?.(nextProject);
      } catch (error) {
        console.error('项目变更回调执行失败', error);
      }
    });

    onReady?.({ getProject, loadProject, focus, registerPattern, removePattern, setRoomCatalogs, setOpeningCatalog, generateObjects, setTool, addWalkthroughPoint, setWalkthroughPoints, updateWalkthroughPoint, insertWalkthroughPoint, normalizeCoordinates });
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
  style:height
  tabindex="-1"
  aria-label="户型图编辑器"
>
  {#if ready}
    <TopBar {autoSave} />
    <div bind:this={toolbarTarget} data-floorplan-module="toolbar" class="shrink-0 empty:hidden"></div>
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <BuildPanel {roomPresets} {roomTemplates} {openingCatalog} />
      <div bind:this={leftPanelTarget} data-floorplan-module="left-panel" class="h-full shrink-0 overflow-auto empty:hidden"></div>
      <div class="flex-1 min-w-0 relative">
        <FloorPlanCanvas {roomPresets} {roomTemplates} />
        <AlignmentToolbar />
        <div bind:this={canvasOverlayTarget} data-floorplan-module="canvas-overlay" class="absolute inset-0 z-30 pointer-events-none empty:hidden"></div>
      </div>
      {#if showLayers}
        <LayersPanel />
      {/if}
      <div bind:this={rightPanelTarget} data-floorplan-module="right-panel" class="h-full shrink-0 overflow-auto empty:hidden"></div>
      <PropertiesPanel />
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
