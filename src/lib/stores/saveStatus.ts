import { writable, get } from 'svelte/store';
import { currentProject } from './project';
import { localStore } from '$lib/services/datastore';
import { saveSnapshot } from '$lib/stores/versionHistory';
import { getRuntimeDataStore, getRuntimeSaveCallback } from '$lib/runtime';
import type { Project, SaveEvent, SaveSource } from '$lib/models/types';

export type SaveState = 'saved' | 'unsaved' | 'saving';

export const saveState = writable<SaveState>('saved');
export const lastSavedAt = writable<Date | null>(null);

function dataStore() {
  return getRuntimeDataStore() ?? localStore;
}

function toPlainValue<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map((item) => toPlainValue(item)) as T;
  if (value && typeof value === 'object') {
    const plain: Record<string, unknown> = {};
    for (const key of Object.keys(value)) plain[key] = toPlainValue((value as Record<string, unknown>)[key]);
    return plain as T;
  }
  return value;
}

function notifySaved(project: Project, source: SaveSource, savedAt: Date): SaveEvent {
  const event = {
    project: toPlainValue(project),
    source,
    savedAt: new Date(savedAt.getTime())
  };
  try {
    getRuntimeSaveCallback()?.(event);
  } catch (error) {
    console.error('[Save callback] Failed:', error);
  }
  return event;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
let skipNext = false;

/** Call once to start watching project changes */
export function initAutoSave() {
  if (initialized) return;
  initialized = true;

  let first = true;
  currentProject.subscribe((_p) => {
    // Skip the initial subscription fire and loadProject calls
    if (first) { first = false; return; }
    if (skipNext) { skipNext = false; return; }
    if (!_p) return;
    markDirty();
  });
}

/** Mark project as dirty (unsaved). */
export function markDirty() {
  saveState.set('unsaved');
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    autoSave();
  }, 5000);
}

function captureThumbnail(projectId: string) {
  try {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const size = 300;
    const tmp = document.createElement('canvas');
    tmp.width = size;
    tmp.height = Math.round(size * (canvas.height / canvas.width));
    const ctx = tmp.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
    const dataUrl = tmp.toDataURL('image/jpeg', 0.6);
    dataStore().saveThumbnail(projectId, dataUrl);
  } catch {}
}

async function autoSave() {
  const p = get(currentProject);
  if (!p) return;
  saveState.set('saving');
  try {
    await dataStore().save(p);
    captureThumbnail(p.id);
    const savedAt = new Date();
    saveState.set('saved');
    lastSavedAt.set(savedAt);
    notifySaved(p, 'auto', savedAt);
  } catch (e) {
    console.error('[AutoSave] Failed:', e);
    saveState.set('unsaved');
  }
}

/** Manual save */
export async function manualSave(source: Exclude<SaveSource, 'auto'> = 'manual'): Promise<SaveEvent | null> {
  if (debounceTimer) clearTimeout(debounceTimer);
  const p = get(currentProject);
  if (!p) return null;
  saveState.set('saving');
  try {
    await dataStore().save(p);
    captureThumbnail(p.id);
    saveSnapshot(p, 'Manual save');
    const savedAt = new Date();
    saveState.set('saved');
    lastSavedAt.set(savedAt);
    return notifySaved(p, source, savedAt);
  } catch (e) {
    console.error('[Save] Failed:', e);
    saveState.set('unsaved');
    throw e;
  }
}

/** Mark as saved without triggering dirty (e.g. after loadProject) */
export function markClean() {
  if (debounceTimer) clearTimeout(debounceTimer);
  saveState.set('saved');
  skipNext = true;
}
