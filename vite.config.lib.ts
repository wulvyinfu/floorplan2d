import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

function publicTypes(): Plugin {
  return {
    name: 'public-types',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'index.d.ts',
        source: `import type { CSSProperties, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

export interface Point { x: number; y: number }
export interface WalkthroughPoint extends Point { id: string; name?: string; dwellTime?: number }
export type DoorType = 'single' | 'double' | 'sliding' | 'french' | 'pocket' | 'bifold';
export type WindowType = 'standard' | 'fixed' | 'casement' | 'sliding' | 'bay';
export interface WallArt { id: string; wallId: string; position: number; width: number; height: number; bottomHeight: number; side: 'normal' | 'anti'; color: string; src?: string }
export interface OpeningCatalogConfig { showDoors?: boolean; showWindows?: boolean; doorTypes?: readonly DoorType[]; windowTypes?: readonly WindowType[] }
export type ObjectShape = 'rectangle' | 'circle';
export interface ObjectLabel { text: string; color?: string; fontSize?: number; offsetX?: number; offsetY?: number }
export interface FurnitureItem { id: string; catalogId: string; position: Point; rotation: number; scale: { x: number; y: number; z: number }; color?: string; width?: number; depth?: number; height?: number; material?: string; locked?: boolean; label?: ObjectLabel }
export interface Floor { id: string; name: string; level: number; walls: unknown[]; rooms: unknown[]; doors: unknown[]; windows: unknown[]; wallArt?: WallArt[]; furniture: FurnitureItem[]; stairs: unknown[]; columns: unknown[]; guides: unknown[]; measurements: unknown[]; annotations: unknown[]; textAnnotations: unknown[]; groups: unknown[]; walkthroughPoints?: WalkthroughPoint[] }
export interface CustomPattern { id: string; name: string; category?: string; src?: string; shape?: ObjectShape; color?: string; width: number; depth: number; height?: number }
export interface DeviceInstanceInput { externalId?: string; floorId?: string; position: Point; rotation?: number; scale?: Partial<{ x: number; y: number; z: number }>; color?: string; width?: number; depth?: number; height?: number; material?: string; locked?: boolean; label?: string | ObjectLabel }
export interface ExternalObjectInput extends DeviceInstanceInput { pattern: CustomPattern }
export interface DeviceBatchInput { definition: CustomPattern; instances: readonly DeviceInstanceInput[] }
export type GenerateObjectsInput = readonly ExternalObjectInput[] | DeviceBatchInput;
export interface BatchGridPlacementInput { pattern: CustomPattern; rows: number; columns: number; rowGap: number; columnGap: number; floorId?: string; rotation?: number; scale?: Partial<{ x: number; y: number; z: number }>; color?: string; material?: string; locked?: boolean }
export interface GeneratedObjectResult { externalId?: string; objectId: string; catalogId: string; floorId: string }
export interface GenerateObjectsResult { projectId: string; generated: GeneratedObjectResult[]; updatedAt: Date }
export interface ObjectAddedEvent { object: FurnitureItem; floor: Floor; definition?: CustomPattern; source: 'editor' | 'batch' }
export interface WalkthroughPointAddedEvent { point: WalkthroughPoint; floor: Floor; index: number; source: 'editor' | 'api' }
export type Tool = 'select' | 'wall' | 'door' | 'window' | 'wall-art' | 'furniture' | 'text' | 'walkthrough';
export class GenerateObjectsError extends Error { readonly issues: string[]; constructor(issues: string[]) }
export interface RoomPreset { id: string; name: string; icon: string; description: string; getWalls(width: number, height: number): { start: Point; end: Point }[] }
export interface FurniturePlacement { catalogId: string; x: number; y: number; rotation: number }
export interface RoomTemplate { name: string; presetId: string; furniture: FurniturePlacement[] }
export interface Project { id: string; name: string; description?: string; floors: Floor[]; activeFloorId: string; createdAt: Date; updatedAt: Date; customPatterns?: CustomPattern[] }
export interface DataStore { save(project: Project): Promise<void>; load(id: string): Promise<Project | null>; list(): Promise<{ id: string; name: string; updatedAt: string }[]>; delete(id: string): Promise<void>; duplicate(id: string): Promise<Project | null>; saveThumbnail(id: string, dataUrl: string): void; getThumbnail(id: string): string | null }
export interface FloorplanEditorHandle { getProject(): Project | null; loadProject(project: Project): void; focus(): void; registerPattern(pattern: CustomPattern): void; removePattern(id: string): void; setRoomCatalogs(presets: readonly RoomPreset[], templates: readonly RoomTemplate[]): void; setOpeningCatalog(config: OpeningCatalogConfig): void; generateObjects(input: GenerateObjectsInput): GenerateObjectsResult; preGenerateObjectGrid(input: BatchGridPlacementInput): void; setTool(tool: Tool): void; addWalkthroughPoint(position: Point, name?: string, dwellTime?: number): WalkthroughPoint; setWalkthroughPoints(points: readonly WalkthroughPoint[], floorId?: string): void; updateWalkthroughPoint(id: string, updates: Partial<Omit<WalkthroughPoint, 'id'>>): void; insertWalkthroughPoint(afterPointId: string, position?: Point, name?: string, dwellTime?: number): WalkthroughPoint | null; normalizeCoordinates(floorId?: string): Point | null }
export type FloorplanEditorModulePosition = 'toolbar' | 'leftPanel' | 'rightPanel' | 'canvasOverlay';
export interface FloorplanEditorModules { toolbar?: ReactNode; leftPanel?: ReactNode; rightPanel?: ReactNode; canvasOverlay?: ReactNode }
export type OptionsElementKind = 'wall' | 'door' | 'window' | 'wallArt' | 'furniture' | 'room' | 'stair' | 'column' | 'textAnnotation' | 'walkthroughPoint';
export type OptionsElement = Wall | Door | Window | WallArt | FurnitureItem | Room | Stair | Column | TextAnnotation | WalkthroughPoint;
export interface OptionsSelection { kind: OptionsElementKind; value: OptionsElement }
export interface OptionsRenderContext { project: Project; floor: Floor; selection: OptionsSelection | null; selectedIds: string[]; updateSelected(updates: Partial<OptionsElement>): void; removeSelected(): void; select(id: string | null): void; clearSelection(): void }
export interface FloorplanEditorProps { project?: Project; dataStore?: DataStore; autoSave?: boolean; height?: CSSProperties['height']; className?: string; style?: CSSProperties; modules?: FloorplanEditorModules; optionsRender?: (context: OptionsRenderContext) => ReactNode; customObjects?: CustomPattern[]; customPatterns?: CustomPattern[]; roomPresets?: readonly RoomPreset[]; roomTemplates?: readonly RoomTemplate[]; openingCatalog?: OpeningCatalogConfig; onProjectChange?: (project: Project) => void; onObjectAdded?: (event: ObjectAddedEvent) => void; onWalkthroughPointAdded?: (event: WalkthroughPointAddedEvent) => void; onReady?: (handle: FloorplanEditorHandle) => void }
export const FloorplanEditor: ForwardRefExoticComponent<FloorplanEditorProps & RefAttributes<FloorplanEditorHandle>>;
export function createDefaultFloor(level?: number): Floor;
export function createDefaultProject(name?: string): Project;
export const localStore: DataStore;
`
      });
    }
  };
}

export default defineConfig({
  plugins: [tailwindcss(), svelte(), publicTypes()],
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/react.ts'),
      formats: ['es'],
      fileName: () => 'floorplan2d.es.js',
      cssFileName: 'floorplan2d'
    },
    rollupOptions: {
      external: [/^svelte(?:\/.*)?$/, /^react(?:\/.*)?$/, /^react-dom(?:\/.*)?$/],
      output: {
        banner: '"use client";',
        inlineDynamicImports: true
      }
    }
  }
});
