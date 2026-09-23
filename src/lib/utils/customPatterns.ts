import { get } from 'svelte/store';
import { currentProject } from '$lib/stores/project';
import type { CustomPattern } from '$lib/models/types';

export type ResolvedFurnitureDef = CustomPattern & { category: string; color: string; height: number; snapToWall: boolean; icon: string; pattern: true };

export function normalizePattern(pattern: CustomPattern): CustomPattern {
  if (!pattern.id.trim()) throw new Error('自定义图案 ID 不能为空');
  if (!pattern.name.trim()) throw new Error('自定义图案名称不能为空');
  if (!Number.isFinite(pattern.width) || pattern.width <= 0) throw new Error('自定义图案宽度必须大于 0');
  if (!Number.isFinite(pattern.depth) || pattern.depth <= 0) throw new Error('自定义图案深度必须大于 0');
  // if (pattern.src && !/^(data:image\/(?:svg\+xml|png|jpeg|webp);|https?:\/\/)/i.test(pattern.src)) {
  //   throw new Error('自定义图案仅支持图片 data URL 或 HTTP(S) 地址');
  // }
  if (pattern.snapToWall != null && typeof pattern.snapToWall !== 'boolean') throw new Error('自定义图案 snapToWall 必须是布尔值');
  return { ...pattern, id: pattern.id.trim(), name: pattern.name.trim(), category: pattern.category?.trim() || '自定义物件', shape: pattern.shape ?? 'rectangle', snapToWall: pattern.snapToWall ?? true };
}

export function mergeCustomPatterns(projectPatterns: readonly CustomPattern[] = [], externalPatterns: readonly CustomPattern[] = []): CustomPattern[] {
  const merged = new Map<string, CustomPattern>();
  projectPatterns.forEach((pattern) => merged.set(pattern.id, normalizePattern(pattern)));
  externalPatterns.forEach((pattern) => merged.set(pattern.id, normalizePattern(pattern)));
  return [...merged.values()];
}

export function getCustomPatterns(): CustomPattern[] {
  return get(currentProject)?.customPatterns ?? [];
}

export function getResolvedFurniture(id: string): ResolvedFurnitureDef | undefined {
  const pattern = getCustomPatterns().find((item) => item.id === id);
  if (!pattern) return undefined;
  return { ...pattern, category: pattern.category || '自定义图案', color: pattern.color || '#64748b', height: pattern.height ?? 0, snapToWall: pattern.snapToWall ?? true, icon: '图', pattern: true };
}

export function setCustomPatterns(patterns: CustomPattern[]): void {
  const project = get(currentProject);
  if (!project) return;
  project.customPatterns = patterns.map(normalizePattern);
  project.updatedAt = new Date();
  currentProject.set({ ...project });
}

export function registerCustomPattern(pattern: CustomPattern): void {
  const normalized = normalizePattern(pattern);
  const patterns = getCustomPatterns();
  setCustomPatterns([...patterns.filter((item) => item.id !== normalized.id), normalized]);
}

export function removeCustomPattern(id: string): void {
  setCustomPatterns(getCustomPatterns().filter((item) => item.id !== id));
}
