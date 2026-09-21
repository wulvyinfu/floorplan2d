import './styles.css';
import { Fragment, createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { mount, unmount } from 'svelte';
import SvelteFloorplanEditor from './components/editor/FloorplanEditor.svelte';
import { createDefaultFloor, createDefaultProject } from './stores/project';
import { localStore } from './services/datastore';
import type { CSSProperties, ReactNode } from 'react';
import { GenerateObjectsError } from './models/types';
import { themePreference, type ThemePreference } from './stores/theme';
import type { BatchGridPlacementInput } from './models/types';
import type { CustomPattern, GenerateObjectsInput, GenerateObjectsResult, ObjectAddedEvent, OpeningCatalogConfig, OptionsContextSnapshot, OptionsElement, Point, Project, SaveEvent, WalkthroughPoint, WalkthroughPointAddedEvent } from './models/types';
import type { Tool } from './stores/project';
import type { RoomPreset } from './utils/roomPresets';
import type { RoomTemplate } from './utils/roomTemplates';
import type { DataStore } from './services/datastore';
import { parseProjectFileData, type ProjectFileData } from './utils/projectFile';

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

export interface FloorplanEditorModules {
  toolbar?: () => ReactNode;
  materialLibrary?: {
    title: string;
    content: ReactNode;
  };
  properties?: (selected: OptionsElement | null) => ReactNode;
}

export interface OptionsRenderContext extends OptionsContextSnapshot {
  updateSelected(updates: Partial<OptionsElement>): void;
  removeSelected(): void;
  select(id: string | null): void;
  clearSelection(): void;
}

export interface FloorplanEditorProps {
  theme?: ThemePreference;
  project?: Project;
  initialFileData?: ProjectFileData;
  dataStore?: DataStore;
  autoSave?: boolean;
  height?: CSSProperties['height'];
  className?: string;
  style?: CSSProperties;
  modules?: FloorplanEditorModules;
  /** Completely replaces the built-in right-side properties panel. */
  customPatterns?: CustomPattern[];
  customObjects?: CustomPattern[];
  roomPresets?: readonly RoomPreset[];
  roomTemplates?: readonly RoomTemplate[];
  openingCatalog?: OpeningCatalogConfig;
  onProjectChange?: (project: Project) => void;
  onObjectAdded?: (event: ObjectAddedEvent) => void;
  onWalkthroughPointAdded?: (event: WalkthroughPointAddedEvent) => void;
  onSave?: (event: SaveEvent) => void;
  onReady?: (handle: FloorplanEditorHandle) => void;
}

const EMPTY_ROOM_PRESETS: readonly RoomPreset[] = [];
const EMPTY_ROOM_TEMPLATES: readonly RoomTemplate[] = [];
const EMPTY_OPENING_CATALOG: OpeningCatalogConfig = {};

export const FloorplanEditor = forwardRef<FloorplanEditorHandle, FloorplanEditorProps>(function FloorplanEditor(
  {
    project,
    initialFileData,
    dataStore,
    autoSave = true,
    height = '100vh',
    className,
    style,
    modules,
    theme,
    customPatterns,
    customObjects,
    roomPresets = EMPTY_ROOM_PRESETS,
    roomTemplates = EMPTY_ROOM_TEMPLATES,
    openingCatalog = EMPTY_OPENING_CATALOG,
    onProjectChange,
    onObjectAdded,
    onWalkthroughPointAdded,
    onSave,
    onReady
  },
  forwardedRef
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<FloorplanEditorHandle | null>(null);
  const projectRef = useRef(project);
  const callbacksRef = useRef({ onProjectChange, onObjectAdded, onWalkthroughPointAdded, onSave, onReady });
  const effectiveObjects = customObjects ?? customPatterns;
  const patternsRef = useRef(effectiveObjects);
  const [moduleTargets, setModuleTargets] = useState<Partial<Record<'toolbarRight' | 'materialLibrary' | 'properties', HTMLElement>>>({});
  const [optionsSnapshot, setOptionsSnapshot] = useState<OptionsContextSnapshot | null>(null);

  projectRef.current = project;
  callbacksRef.current = { onProjectChange, onObjectAdded, onWalkthroughPointAdded, onSave, onReady };
  patternsRef.current = effectiveObjects;

  useImperativeHandle(forwardedRef, () => ({
    getProject: () => handleRef.current?.getProject() ?? null,
    loadProject: (nextProject) => handleRef.current?.loadProject(nextProject),
    updateFileData: (data) => handleRef.current?.loadProject(parseProjectFileData(data)),
    focus: () => handleRef.current?.focus(),
    registerPattern: (pattern) => handleRef.current?.registerPattern(pattern),
    removePattern: (id) => handleRef.current?.removePattern(id),
    setRoomCatalogs: (presets, templates) => handleRef.current?.setRoomCatalogs(presets, templates),
    setOpeningCatalog: (config) => handleRef.current?.setOpeningCatalog(config),
    generateObjects: (items) => {
      if (!handleRef.current) throw new GenerateObjectsError(['编辑器尚未初始化，请在 onReady 后调用']);
      return handleRef.current.generateObjects(items);
    },
    preGenerateObjectGrid: (input) => {
      if (!handleRef.current) throw new GenerateObjectsError(['编辑器尚未初始化，请在 onReady 后调用']);
      handleRef.current.preGenerateObjectGrid(input);
    },
    setTool: (tool) => handleRef.current?.setTool(tool),
    addWalkthroughPoint: (position, name, dwellTime) => {
      if (!handleRef.current) throw new Error('编辑器尚未初始化，请在 onReady 后调用');
      return handleRef.current.addWalkthroughPoint(position, name, dwellTime);
    },
    setWalkthroughPoints: (points, floorId) => handleRef.current?.setWalkthroughPoints(points, floorId),
    updateWalkthroughPoint: (id, updates) => handleRef.current?.updateWalkthroughPoint(id, updates),
    insertWalkthroughPoint: (afterPointId, position, name, dwellTime) => handleRef.current?.insertWalkthroughPoint(afterPointId, position, name, dwellTime) ?? null,
    normalizeCoordinates: (floorId) => handleRef.current?.normalizeCoordinates(floorId) ?? null,
    copySelection: () => handleRef.current?.copySelection() ?? Promise.resolve(false),
    pasteSelection: (offset) => handleRef.current?.pasteSelection(offset) ?? Promise.resolve([]),
    save: () => handleRef.current?.save() ?? Promise.resolve(null)
  }), []);

  useEffect(() => {
    if (!hostRef.current) return;
    let active = true;

    const instance = mount(SvelteFloorplanEditor, {
      target: hostRef.current,
      props: {
        project: projectRef.current ?? (initialFileData == null ? undefined : parseProjectFileData(initialFileData)),
        dataStore,
        autoSave,
        height: '100%',
        customPatterns: patternsRef.current,
        roomPresets,
        roomTemplates,
        openingCatalog,
        customMaterialTitle: modules?.materialLibrary?.title,
        theme,
        hideDefaultOptions: !!modules?.properties,
        onOptionsContextChange(context: OptionsContextSnapshot | null) {
          if (active) setOptionsSnapshot(context);
        },
        onProjectChange(nextProject: Project) {
          callbacksRef.current.onProjectChange?.(nextProject);
        },
        onObjectAdded(event: ObjectAddedEvent) {
          callbacksRef.current.onObjectAdded?.(event);
        },
        onWalkthroughPointAdded(event: WalkthroughPointAddedEvent) {
          callbacksRef.current.onWalkthroughPointAdded?.(event);
        },
        onSave(event: SaveEvent) {
          callbacksRef.current.onSave?.(event);
        },
        onReady(handle: FloorplanEditorHandle) {
          handleRef.current = handle;
          callbacksRef.current.onReady?.(handle);
        },
        onModuleTarget(position: 'toolbarRight' | 'materialLibrary' | 'properties', element: HTMLElement | null) {
          if (!active) return;
          setModuleTargets((current) => {
            if (current[position] === element) return current;
            const next = { ...current };
            if (element) next[position] = element;
            else delete next[position];
            return next;
          });
        }
      }
    }) as FloorplanEditorHandle;

    handleRef.current = instance;

    return () => {
      active = false;
      handleRef.current = null;
      void unmount(instance);
    };
  }, [autoSave, dataStore, !!modules?.properties, !!modules?.materialLibrary]);

  useEffect(() => {
    if (theme) themePreference.set(theme);
  }, [theme]);

  useEffect(() => {
    if (project && handleRef.current?.getProject() !== project) {
      handleRef.current?.loadProject(project);
    }
  }, [project]);

  useEffect(() => {
    if (!effectiveObjects || !handleRef.current) return;
    const current = handleRef.current.getProject();
    if (current) handleRef.current.loadProject({ ...current, customPatterns: effectiveObjects });
  }, [effectiveObjects]);

  useEffect(() => {
    handleRef.current?.setRoomCatalogs(roomPresets, roomTemplates);
  }, [roomPresets, roomTemplates]);

  useEffect(() => {
    handleRef.current?.setOpeningCatalog(openingCatalog);
  }, [openingCatalog]);

  const portals = [];
  const toolbarTarget = moduleTargets.toolbarRight;
  if (toolbarTarget && modules?.toolbar) portals.push(createPortal(modules.toolbar(), toolbarTarget, 'toolbar'));
  const materialTarget = moduleTargets.materialLibrary;
  if (materialTarget && modules?.materialLibrary) portals.push(createPortal(modules.materialLibrary.content, materialTarget, 'material-library'));
  const propertiesTarget = moduleTargets.properties;
  if (propertiesTarget && modules?.properties) portals.push(createPortal(modules.properties(optionsSnapshot?.selection?.value ?? null), propertiesTarget, 'properties'));

  return createElement(
    Fragment,
    null,
    createElement('div', { ref: hostRef, className, style: { ...style, height } }),
    ...portals
  );
});

export { createDefaultFloor, createDefaultProject, localStore };
export { GenerateObjectsError };
export { parseProjectFileData };
export type { ProjectFileData };
export type { DataStore } from './services/datastore';
export type { ThemePreference } from './stores/theme';
export type * from './models/types';
export type { RoomPreset } from './utils/roomPresets';
export type { FurniturePlacement, RoomTemplate } from './utils/roomTemplates';
