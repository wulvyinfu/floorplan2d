import type { Floor, Project } from '$lib/models/types';
import { mergeCustomPatterns } from '$lib/utils/customPatterns';

export type ProjectFileData = string | Project | Record<string, unknown>;

function cloneValue<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)])) as T;
  }
  return value;
}

function parseDate(value: unknown, field: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`项目文件中的 ${field} 不是有效日期`);
  return date;
}

export function getFloorDimensions(floor: Partial<Floor>): { width: number; height: number } {
  if ((!floor.walls || floor.walls.length === 0) && typeof floor.width === 'number' && Number.isFinite(floor.width) && floor.width >= 0 && typeof floor.height === 'number' && Number.isFinite(floor.height) && floor.height >= 0) {
    return { width: floor.width, height: floor.height };
  }
  const points = (floor.walls ?? []).flatMap((wall) => [wall.start, wall.end, ...(wall.curvePoint ? [wall.curvePoint] : [])]);
  if (points.length === 0) return { width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

export function createProjectDataSnapshot(project: Project): Project {
  const snapshot = cloneValue(project);
  const wallHeight = Number.isFinite(snapshot.wallHeight) && snapshot.wallHeight > 0 ? snapshot.wallHeight : 280;
  snapshot.wallHeight = wallHeight;
  snapshot.floors = snapshot.floors.map((floor) => ({ ...floor, ...getFloorDimensions(floor) }));
  snapshot.floors.forEach((floor) => floor.walls.forEach((wall) => { wall.height = wallHeight; }));
  snapshot.customPatterns = mergeCustomPatterns(snapshot.customPatterns);
  return snapshot;
}

function normalizeFloor(value: unknown, index: number): Floor {
  if (!value || typeof value !== 'object') throw new Error(`项目文件中的楼层 ${index + 1} 格式无效`);
  const floor = cloneValue(value) as Partial<Floor>;
  if (typeof floor.id !== 'string' || !floor.id) throw new Error(`项目文件中的楼层 ${index + 1} 缺少 id`);
  if (!Array.isArray(floor.walls)) throw new Error(`项目文件中的楼层 ${index + 1} 缺少 walls`);
  const dimensions = getFloorDimensions(floor);
  return {
    ...floor,
    name: typeof floor.name === 'string' ? floor.name : `楼层 ${index + 1}`,
    level: typeof floor.level === 'number' ? floor.level : index,
    width: dimensions.width,
    height: dimensions.height,
    walls: floor.walls,
    rooms: Array.isArray(floor.rooms) ? floor.rooms : [],
    doors: Array.isArray(floor.doors) ? floor.doors : [],
    windows: Array.isArray(floor.windows) ? floor.windows : [],
    wallArt: Array.isArray(floor.wallArt) ? floor.wallArt : [],
    furniture: Array.isArray(floor.furniture) ? floor.furniture : [],
    stairs: Array.isArray(floor.stairs) ? floor.stairs : [],
    columns: Array.isArray(floor.columns) ? floor.columns : [],
    guides: Array.isArray(floor.guides) ? floor.guides : [],
    measurements: Array.isArray(floor.measurements) ? floor.measurements : [],
    annotations: Array.isArray(floor.annotations) ? floor.annotations : [],
    textAnnotations: Array.isArray(floor.textAnnotations) ? floor.textAnnotations : [],
    groups: Array.isArray(floor.groups) ? floor.groups : [],
    walkthroughPoints: Array.isArray(floor.walkthroughPoints) ? floor.walkthroughPoints : []
  } as Floor;
}

export function parseProjectFileData(input: ProjectFileData): Project {
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      throw new Error('项目文件不是有效的 JSON');
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('项目文件根节点必须是对象');
  const source = value as Record<string, unknown>;
  if (typeof source.id !== 'string' || !source.id) throw new Error('项目文件缺少 id');
  if (typeof source.name !== 'string' || !source.name) throw new Error('项目文件缺少 name');
  if (!Array.isArray(source.floors) || source.floors.length === 0) throw new Error('项目文件必须包含至少一个楼层');
  const floors = source.floors.map(normalizeFloor);
  const wallHeights = floors.flatMap((floor) => floor.walls.map((wall) => wall.height)).filter((height) => Number.isFinite(height) && height > 0);
  const wallHeight = typeof source.wallHeight === 'number' && Number.isFinite(source.wallHeight) && source.wallHeight > 0 ? source.wallHeight : wallHeights[0] ?? 280;
  floors.forEach((floor) => floor.walls.forEach((wall) => { wall.height = wallHeight; }));
  const activeFloorId = typeof source.activeFloorId === 'string' && floors.some((floor) => floor.id === source.activeFloorId)
    ? source.activeFloorId
    : floors[0].id;
  return {
    ...cloneValue(source),
    id: source.id,
    name: source.name,
    floors,
    activeFloorId,
    createdAt: parseDate(source.createdAt, 'createdAt'),
    updatedAt: parseDate(source.updatedAt, 'updatedAt'),
    wallHeight,
    customPatterns: mergeCustomPatterns(Array.isArray(source.customPatterns) ? cloneValue(source.customPatterns) : [])
  } as Project;
}
