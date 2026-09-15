import './styles.css';
import { Fragment, createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { mount, unmount } from 'svelte';
import SvelteFloorplanEditor from './components/editor/FloorplanEditor.svelte';
import { createDefaultFloor, createDefaultProject } from './stores/project';
import { localStore } from './services/datastore';
import type { CSSProperties, ReactNode } from 'react';
import { GenerateObjectsError } from './models/types';
import type { CustomPattern, GenerateObjectsInput, GenerateObjectsResult, ObjectAddedEvent, OpeningCatalogConfig, Point, Project, WalkthroughPoint, WalkthroughPointAddedEvent } from './models/types';
import type { Tool } from './stores/project';
import type { RoomPreset } from './utils/roomPresets';
import type { RoomTemplate } from './utils/roomTemplates';
import type { DataStore } from './services/datastore';

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
  addWalkthroughPoint(position: Point, name?: string): WalkthroughPoint;
  setWalkthroughPoints(points: readonly WalkthroughPoint[], floorId?: string): void;
}

export type FloorplanEditorModulePosition = 'toolbar' | 'leftPanel' | 'rightPanel' | 'canvasOverlay';

export interface FloorplanEditorModules {
  toolbar?: ReactNode;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  canvasOverlay?: ReactNode;
}

export interface FloorplanEditorProps {
  project?: Project;
  dataStore?: DataStore;
  autoSave?: boolean;
  height?: CSSProperties['height'];
  className?: string;
  style?: CSSProperties;
  modules?: FloorplanEditorModules;
  customPatterns?: CustomPattern[];
  customObjects?: CustomPattern[];
  roomPresets?: readonly RoomPreset[];
  roomTemplates?: readonly RoomTemplate[];
  openingCatalog?: OpeningCatalogConfig;
  onProjectChange?: (project: Project) => void;
  onObjectAdded?: (event: ObjectAddedEvent) => void;
  onWalkthroughPointAdded?: (event: WalkthroughPointAddedEvent) => void;
  onReady?: (handle: FloorplanEditorHandle) => void;
}

const EMPTY_ROOM_PRESETS: readonly RoomPreset[] = [];
const EMPTY_ROOM_TEMPLATES: readonly RoomTemplate[] = [];
const EMPTY_OPENING_CATALOG: OpeningCatalogConfig = {};

export const FloorplanEditor = forwardRef<FloorplanEditorHandle, FloorplanEditorProps>(function FloorplanEditor(
  {
    project,
    dataStore,
    autoSave = true,
    height = '100vh',
    className,
    style,
    modules,
    customPatterns,
    customObjects,
    roomPresets = EMPTY_ROOM_PRESETS,
    roomTemplates = EMPTY_ROOM_TEMPLATES,
    openingCatalog = EMPTY_OPENING_CATALOG,
    onProjectChange,
    onObjectAdded,
    onWalkthroughPointAdded,
    onReady
  },
  forwardedRef
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<FloorplanEditorHandle | null>(null);
  const projectRef = useRef(project);
  const callbacksRef = useRef({ onProjectChange, onObjectAdded, onWalkthroughPointAdded, onReady });
  const effectiveObjects = customObjects ?? customPatterns;
  const patternsRef = useRef(effectiveObjects);
  const [moduleTargets, setModuleTargets] = useState<Partial<Record<FloorplanEditorModulePosition, HTMLElement>>>({});

  projectRef.current = project;
  callbacksRef.current = { onProjectChange, onObjectAdded, onWalkthroughPointAdded, onReady };
  patternsRef.current = effectiveObjects;

  useImperativeHandle(forwardedRef, () => ({
    getProject: () => handleRef.current?.getProject() ?? null,
    loadProject: (nextProject) => handleRef.current?.loadProject(nextProject),
    focus: () => handleRef.current?.focus(),
    registerPattern: (pattern) => handleRef.current?.registerPattern(pattern),
    removePattern: (id) => handleRef.current?.removePattern(id),
    setRoomCatalogs: (presets, templates) => handleRef.current?.setRoomCatalogs(presets, templates),
    setOpeningCatalog: (config) => handleRef.current?.setOpeningCatalog(config),
    generateObjects: (items) => {
      if (!handleRef.current) throw new GenerateObjectsError(['编辑器尚未初始化，请在 onReady 后调用']);
      return handleRef.current.generateObjects(items);
    },
    setTool: (tool) => handleRef.current?.setTool(tool),
    addWalkthroughPoint: (position, name) => {
      if (!handleRef.current) throw new Error('编辑器尚未初始化，请在 onReady 后调用');
      return handleRef.current.addWalkthroughPoint(position, name);
    },
    setWalkthroughPoints: (points, floorId) => handleRef.current?.setWalkthroughPoints(points, floorId)
  }), []);

  useEffect(() => {
    if (!hostRef.current) return;
    let active = true;

    const instance = mount(SvelteFloorplanEditor, {
      target: hostRef.current,
      props: {
        project: projectRef.current,
        dataStore,
        autoSave,
        height: '100%',
        customPatterns: patternsRef.current,
        roomPresets,
        roomTemplates,
        openingCatalog,
        onProjectChange(nextProject: Project) {
          callbacksRef.current.onProjectChange?.(nextProject);
        },
        onObjectAdded(event: ObjectAddedEvent) {
          callbacksRef.current.onObjectAdded?.(event);
        },
        onWalkthroughPointAdded(event: WalkthroughPointAddedEvent) {
          callbacksRef.current.onWalkthroughPointAdded?.(event);
        },
        onReady(handle: FloorplanEditorHandle) {
          handleRef.current = handle;
          callbacksRef.current.onReady?.(handle);
        },
        onModuleTarget(position: FloorplanEditorModulePosition, element: HTMLElement | null) {
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
  }, [autoSave, dataStore]);

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

  const positions: FloorplanEditorModulePosition[] = ['toolbar', 'leftPanel', 'rightPanel', 'canvasOverlay'];
  const portals = positions.flatMap((position) => {
    const target = moduleTargets[position];
    const content = modules?.[position];
    return target && content != null ? [createPortal(content, target, position)] : [];
  });

  return createElement(
    Fragment,
    null,
    createElement('div', { ref: hostRef, className, style: { ...style, height } }),
    ...portals
  );
});

export { createDefaultFloor, createDefaultProject, localStore };
export { GenerateObjectsError };
export type { DataStore } from './services/datastore';
export type * from './models/types';
export type { RoomPreset } from './utils/roomPresets';
export type { FurniturePlacement, RoomTemplate } from './utils/roomTemplates';
