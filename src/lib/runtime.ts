import type { DataStore } from './services/datastore';
import type { SaveEvent } from './models/types';

let dataStore: DataStore | undefined;
let assetBaseUrl = '';
let saveCallback: ((event: SaveEvent) => void) | undefined;

export function configureRuntime(options: { dataStore?: DataStore; assetBaseUrl?: string; onSave?: (event: SaveEvent) => void }) {
  dataStore = options.dataStore;
  assetBaseUrl = (options.assetBaseUrl ?? '').replace(/\/$/, '');
  saveCallback = options.onSave;
}

export function getRuntimeDataStore(): DataStore | undefined {
  return dataStore;
}

export function getRuntimeSaveCallback(): ((event: SaveEvent) => void) | undefined {
  return saveCallback;
}

export function resolveAssetUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${assetBaseUrl}${normalizedPath}`;
}
