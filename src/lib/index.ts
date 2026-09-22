import './styles.css';

export { default as FloorplanEditor } from './components/editor/FloorplanEditor.svelte';
export { createDefaultFloor, createDefaultProject } from './stores/project';
export { createProjectDataSnapshot, parseProjectFileData } from './utils/projectFile';
export type { ProjectFileData } from './utils/projectFile';
export { localStore } from './services/datastore';
export type { DataStore } from './services/datastore';
export type { FloorplanEditorHandle } from './components/editor/FloorplanEditor.svelte';
export type * from './models/types';
export type { RoomPreset } from './utils/roomPresets';
export type { FurniturePlacement, RoomTemplate } from './utils/roomTemplates';
