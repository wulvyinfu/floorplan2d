import type { DataStore } from './services/datastore';

let dataStore: DataStore | undefined;
let assetBaseUrl = '';

export function configureRuntime(options: { dataStore?: DataStore; assetBaseUrl?: string }) {
  dataStore = options.dataStore;
  assetBaseUrl = (options.assetBaseUrl ?? '').replace(/\/$/, '');
}

export function getRuntimeDataStore(): DataStore | undefined {
  return dataStore;
}

export function resolveAssetUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${assetBaseUrl}${normalizedPath}`;
}
