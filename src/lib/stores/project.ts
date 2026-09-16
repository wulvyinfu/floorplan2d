import { writable, derived, get } from 'svelte/store';
import { GenerateObjectsError } from '$lib/models/types';
import type { Project, Floor, Wall, Door, Window as Win, WallArt, FurnitureItem, Point, Stair, Column, BackgroundImage, GuideLine, ElementGroup, CustomPattern, ExternalObjectInput, GenerateObjectsInput, GenerateObjectsResult, WalkthroughPoint } from '$lib/models/types';


function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createDefaultFloor(level = 0): Floor {
  const id = uid();
  return { id, name: level === 0 ? '一层' : `${level + 1} 层`, level, walls: [], rooms: [], doors: [], windows: [], wallArt: [], furniture: [], stairs: [], columns: [], guides: [], measurements: [], annotations: [], textAnnotations: [], groups: [], walkthroughPoints: [] };
}

export function createDefaultProject(name = '未命名项目', customPatterns: CustomPattern[] = []): Project {
  const floor = createDefaultFloor();
  return {
    id: uid(),
    name,
    floors: [floor],
    activeFloorId: floor.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    customPatterns,
  };
}

export const currentProject = writable<Project | null>(null);

export const activeFloor = derived(currentProject, ($p) => {
  if (!$p) return null;
  return $p.floors.find((f) => f.id === $p.activeFloorId) ?? $p.floors[0] ?? null;
});

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'wall-art' | 'furniture' | 'text' | 'walkthrough';
export const selectedTool = writable<Tool>('select');
export const snapEnabled = writable<boolean>(true);
/** When true, left-click drag pans the canvas instead of selecting */
export const panMode = writable<boolean>(false);
export const showFurnitureStore = writable<boolean>(true);
export const selectedElementId = writable<string | null>(null);
/** Multi-select: set of element IDs currently selected (used alongside selectedElementId for marquee/shift-click) */
export const selectedElementIds = writable<Set<string>>(new Set());
export const viewMode = writable<'2d' | '3d'>('2d');

// Undo / Redo
interface UndoEntry {
  state: string;
  description: string;
  timestamp: number;
}
const undoStack: UndoEntry[] = [];
const redoStack: UndoEntry[] = [];

/** Reactive store exposing undo history for the UndoHistoryPanel */
export const undoHistoryStore = writable<{ entries: { description: string; timestamp: number }[]; currentIndex: number }>({ entries: [], currentIndex: -1 });

function syncHistoryStore() {
  const entries = undoStack.map(e => ({ description: e.description, timestamp: e.timestamp }));
  // currentIndex: undoStack.length means "current state" (top), entries are past states
  undoHistoryStore.set({ entries, currentIndex: undoStack.length });
}

/** Current undo action description — set before calling mutate/snapshot */
let _nextDescription = '';

// Undo grouping: batch multiple mutations into a single undo entry
let undoGroupSnapshot: string | null = null;
let undoGroupDepth = 0;

/** Begin an undo group. Nested calls are supported; only the outermost pair takes effect. */
export function beginUndoGroup() {
  if (undoGroupDepth === 0) {
    const p = get(currentProject);
    if (p) undoGroupSnapshot = JSON.stringify(p);
  }
  undoGroupDepth++;
}

/** End an undo group. Commits a single undo entry from the state captured at beginUndoGroup(). */
export function endUndoGroup(description?: string) {
  if (undoGroupDepth <= 0) return;
  undoGroupDepth--;
  if (undoGroupDepth === 0 && undoGroupSnapshot !== null) {
    undoStack.push({ state: undoGroupSnapshot, description: description || _nextDescription || 'Group action', timestamp: Date.now() });
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    undoGroupSnapshot = null;
    _nextDescription = '';
    syncHistoryStore();
  }
}

function snapshot(description?: string) {
  // If inside an undo group, skip — the group handles the snapshot
  if (undoGroupDepth > 0) return;
  const p = get(currentProject);
  if (p) undoStack.push({ state: JSON.stringify(p), description: description || _nextDescription || 'Edit', timestamp: Date.now() });
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
  _nextDescription = '';
  syncHistoryStore();
}

function reviveDates(p: Project): Project {
  if (p.createdAt && !(p.createdAt instanceof Date)) p.createdAt = new Date(p.createdAt as any);
  if (p.updatedAt && !(p.updatedAt instanceof Date)) p.updatedAt = new Date(p.updatedAt as any);
  return p;
}

export function undo() {
  const prev = undoStack.pop();
  if (!prev) return;
  const cur = get(currentProject);
  if (cur) redoStack.push({ state: JSON.stringify(cur), description: prev.description, timestamp: prev.timestamp });
  currentProject.set(reviveDates(JSON.parse(prev.state)));
  syncHistoryStore();
}

export function redo() {
  const next = redoStack.pop();
  if (!next) return;
  const cur = get(currentProject);
  if (cur) undoStack.push({ state: JSON.stringify(cur), description: next.description, timestamp: next.timestamp });
  currentProject.set(reviveDates(JSON.parse(next.state)));
  syncHistoryStore();
}

/** Jump to a specific undo history step by index (0 = oldest) */
export function jumpToUndoStep(targetIndex: number) {
  const total = undoStack.length; // total past states; current state is at index `total`
  if (targetIndex < 0 || targetIndex > total) return;
  if (targetIndex === total) return; // already at current state

  // We need to go back (total - targetIndex) steps
  // First, save current state to redo
  const cur = get(currentProject);
  if (!cur) return;

  // Push current + all states between current and target onto redo
  const stepsBack = total - targetIndex;
  // Move states from undoStack to redoStack
  redoStack.push({ state: JSON.stringify(cur), description: 'Current state', timestamp: Date.now() });
  for (let i = 0; i < stepsBack - 1; i++) {
    const entry = undoStack.pop()!;
    redoStack.push(entry);
  }
  const target = undoStack.pop()!;
  currentProject.set(reviveDates(JSON.parse(target.state)));
  syncHistoryStore();
}

function mutate(fn: (floor: Floor) => void, description?: string) {
  const p = get(currentProject);
  if (!p) return;
  snapshot(description);
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor) return;
  fn(floor);
  p.updatedAt = new Date();
  currentProject.set({ ...p });
}

/**
 * Translate every absolute world coordinate on a floor so the wall bounds are
 * centered on the world origin. Returns the applied translation, or null when
 * the target floor has no walls.
 */
export function normalizeCoordinates(floorId?: string): Point | null {
  const p = get(currentProject);
  if (!p) return null;
  const targetId = floorId ?? p.activeFloorId;
  const floor = p.floors.find((item) => item.id === targetId);
  if (!floor || floor.walls.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (point: Point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  };
  floor.walls.forEach((wall) => {
    include(wall.start);
    include(wall.end);
    if (wall.curvePoint) include(wall.curvePoint);
  });

  const offset = {
    x: -(minX + maxX) / 2,
    y: -(minY + maxY) / 2
  };
  if (Math.abs(offset.x) < 1e-9 && Math.abs(offset.y) < 1e-9) return { x: 0, y: 0 };

  snapshot('Normalized coordinates');
  const movePoint = (point: Point) => {
    point.x += offset.x;
    point.y += offset.y;
  };
  floor.walls.forEach((wall) => {
    movePoint(wall.start);
    movePoint(wall.end);
    if (wall.curvePoint) movePoint(wall.curvePoint);
  });
  floor.furniture.forEach((item) => movePoint(item.position));
  floor.stairs.forEach((item) => movePoint(item.position));
  floor.columns.forEach((item) => movePoint(item.position));
  (floor.walkthroughPoints ?? []).forEach(movePoint);
  if (floor.backgroundImage) movePoint(floor.backgroundImage.position);
  floor.measurements.forEach((item) => {
    item.x1 += offset.x; item.y1 += offset.y;
    item.x2 += offset.x; item.y2 += offset.y;
  });
  floor.annotations.forEach((item) => {
    item.x1 += offset.x; item.y1 += offset.y;
    item.x2 += offset.x; item.y2 += offset.y;
  });
  floor.textAnnotations.forEach((item) => {
    item.x += offset.x;
    item.y += offset.y;
  });
  floor.guides.forEach((guide) => {
    guide.position += guide.orientation === 'vertical' ? offset.x : offset.y;
  });
  p.updatedAt = new Date();
  currentProject.set({ ...p });
  return offset;
}

export function addWall(start: Point, end: Point): string {
  const id = uid();
  mutate((f) => {
    f.walls.push({ id, start, end, thickness: 15, height: 280, color: '#444444' });
  }, 'Added wall');
  // Onboarding tip
  import('$lib/stores/onboarding.svelte').then(m => m.triggerTip('first-wall', end.x > 400 ? 300 : end.x + 20, 120));
  return id;
}

export function removeWall(id: string) {
  mutate((f) => {
    f.walls = f.walls.filter((w) => w.id !== id);
    f.doors = f.doors.filter((d) => d.wallId !== id);
    f.windows = f.windows.filter((w) => w.wallId !== id);
    f.wallArt = (f.wallArt ?? []).filter((item) => item.wallId !== id);
  }, 'Deleted wall');
}

export function addDoor(wallId: string, position: number, doorType: Door['type'] = 'single'): string {
  const id = uid();
  const defaults: Record<Door['type'], { width: number; height: number }> = {
    single: { width: 90, height: 210 },
    double: { width: 150, height: 210 },
    sliding: { width: 180, height: 210 },
    french: { width: 150, height: 210 },
    pocket: { width: 90, height: 210 },
    bifold: { width: 180, height: 210 },
  };
  const { width, height } = defaults[doorType];
  mutate((f) => {
    f.doors.push({ id, wallId, position, width, height, type: doorType, swingDirection: 'left', flipSide: false });
  }, `Added ${doorType} door`);
  // Onboarding tip
  import('$lib/stores/onboarding.svelte').then(m => m.triggerTip('first-door', 300, 120));
  return id;
}

export function addWindow(wallId: string, position: number, windowType: import('$lib/models/types').Window['type'] = 'standard'): string {
  const id = uid();
  const defaults: Record<import('$lib/models/types').Window['type'], { width: number; height: number }> = {
    standard: { width: 120, height: 120 },
    fixed: { width: 100, height: 100 },
    casement: { width: 80, height: 130 },
    sliding: { width: 180, height: 120 },
    bay: { width: 200, height: 150 },
  };
  const { width, height } = defaults[windowType];
  mutate((f) => {
    f.windows.push({ id, wallId, position, width, height, sillHeight: 90, type: windowType });
  }, `Added ${windowType} window`);
  return id;
}

export function addWallArt(wallId: string, position: number, side: WallArt['side'] = 'normal'): string {
  const id = uid();
  mutate((f) => {
    f.wallArt = [...(f.wallArt ?? []), { id, wallId, position, width: 120, height: 80, bottomHeight: 120, side, color: '#b45309' }];
  }, 'Added wall art');
  return id;
}

export function duplicateWallArt(id: string): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find((item) => item.id === p.activeFloorId);
  const source = floor?.wallArt?.find((item) => item.id === id);
  if (!floor || !source) return null;
  const newId = uid();
  mutate((target) => {
    target.wallArt = [...(target.wallArt ?? []), { ...source, id: newId, position: Math.min(0.95, source.position + 0.1) }];
  });
  return newId;
}

export function addFurniture(catalogId: string, position: Point): string {
  const id = uid();
  mutate((f) => {
    f.furniture.push({ id, catalogId, position, rotation: 0, scale: { x: 1, y: 1, z: 1 } });
  }, `Added ${catalogId}`);
  // Onboarding tip
  import('$lib/stores/onboarding.svelte').then(m => m.triggerTip('first-furniture', position.x + 20, position.y + 20));
  return id;
}

export function generateObjects(input: GenerateObjectsInput): GenerateObjectsResult {
  const project = get(currentProject);
  if (!project) throw new GenerateObjectsError(['当前没有已加载的项目']);
  const items: readonly ExternalObjectInput[] = Array.isArray(input)
    ? input as readonly ExternalObjectInput[]
    : input.instances.map((instance) => ({ ...instance, pattern: input.definition }));
  if (items.length === 0) throw new GenerateObjectsError(['批量物件数据不能为空']);

  const issues: string[] = [];
  const externalIds = new Set<string>();
  const incomingPatterns = new Map<string, CustomPattern>();
  const availablePatterns = new Map((project.customPatterns ?? []).map((pattern) => [pattern.id, pattern]));
  // alert(JSON.stringify(items));
  items.forEach((item, index) => {
    const path = `第 ${index + 1} 个物件`;
    const pattern = item.pattern;
    if (!pattern?.id?.trim()) issues.push(`${path}的图案 ID 不能为空`);
    if (!pattern?.name?.trim()) issues.push(`${path}的名称不能为空`);
    if (!Number.isFinite(pattern?.width) || pattern.width <= 0) issues.push(`${path}的图案宽度必须大于 0`);
    if (!Number.isFinite(pattern?.depth) || pattern.depth <= 0) issues.push(`${path}的图案深度必须大于 0`);
    if (pattern?.src && !/^(data:image\/(?:svg\+xml|png|jpeg|webp);|https?:\/\/)/i.test(pattern.src)) issues.push(`${path}的图案地址格式无效`);
    if (pattern?.shape && pattern.shape !== 'rectangle' && pattern.shape !== 'circle') issues.push(`${path}的形状仅支持 rectangle 或 circle`);
    if (!Number.isFinite(item.position?.x) || !Number.isFinite(item.position?.y)) issues.push(`${path}的坐标无效`);
    if (item.rotation !== undefined && !Number.isFinite(item.rotation)) issues.push(`${path}的旋转角度无效`);
    const label = typeof item.label === 'string' ? { text: item.label } : item.label;
    if (label && !label.text.trim()) issues.push(`${path}的标签文本不能为空`);
    if (label?.fontSize !== undefined && (!Number.isFinite(label.fontSize) || label.fontSize <= 0)) issues.push(`${path}的标签字号必须大于 0`);
    for (const axis of ['x', 'y', 'z'] as const) {
      const value = item.scale?.[axis];
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) issues.push(`${path}的 ${axis} 轴缩放必须大于 0`);
    }
    if (item.externalId) {
      if (externalIds.has(item.externalId)) issues.push(`${path}的 externalId 重复：${item.externalId}`);
      externalIds.add(item.externalId);
    }
    const floorId = item.floorId ?? project.activeFloorId;
    if (!project.floors.some((floor) => floor.id === floorId)) issues.push(`${path}指定的楼层不存在：${floorId}`);
    if (pattern?.id) {
      const normalized = { ...pattern, id: pattern.id.trim(), name: pattern.name.trim(), category: pattern.category?.trim() || '自定义物件', shape: pattern.shape ?? 'rectangle' };
      const duplicate = incomingPatterns.get(normalized.id);
      if (duplicate && JSON.stringify(duplicate) !== JSON.stringify(normalized)) issues.push(`${path}的图案 ID 存在不同定义：${normalized.id}`);
      incomingPatterns.set(normalized.id, normalized);
      availablePatterns.set(normalized.id, normalized);
    }
  });

  if (issues.length) throw new GenerateObjectsError(issues);

  const generated = items.map((item) => ({
    externalId: item.externalId,
    objectId: uid(),
    catalogId: item.pattern.id.trim(),
    floorId: item.floorId ?? project.activeFloorId
  }));
  const additions = new Map<string, FurnitureItem[]>();
  items.forEach((item, index) => {
    const result = generated[index];
    const list = additions.get(result.floorId) ?? [];
    list.push({
      id: result.objectId,
      catalogId: result.catalogId,
      position: { ...item.position },
      rotation: item.rotation ?? 0,
      scale: { x: item.scale?.x ?? 1, y: item.scale?.y ?? 1, z: item.scale?.z ?? 1 },
      color: item.color,
      width: item.width,
      depth: item.depth,
      height: item.height,
      material: item.material,
      locked: item.locked,
      label: typeof item.label === 'string' ? { text: item.label } : item.label
    });
    additions.set(result.floorId, list);
  });

  snapshot(`批量生成 ${items.length} 个物件`);
  const updatedAt = new Date();
  currentProject.set({
    ...project,
    customPatterns: [...availablePatterns.values()],
    floors: project.floors.map((floor) => ({ ...floor, furniture: [...floor.furniture, ...(additions.get(floor.id) ?? [])] })),
    updatedAt
  });
  return { projectId: project.id, generated, updatedAt };
}

/** Snapshot the current state before a drag begins (call once at drag start) */
export function beginDrag(description = 'Moved element') {
  snapshot(description);
}

/** Move furniture without creating an undo snapshot on every call (used during drag).
 *  Call `beginDrag()` when the drag starts to snapshot the pre-drag state. */
export function moveFurniture(id: string, position: Point) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor) return;
  const item = floor.furniture.find((fi) => fi.id === id);
  if (item) {
    item.position = position;
    p.updatedAt = new Date();
    currentProject.set({ ...p });
  }
}

/** Snapshot the current state before a drag begins (call once at drag start).
 *  Alias for beginDrag() for backward compatibility. */
export function commitFurnitureMove() {
  snapshot('Moved furniture');
}

export function rotateFurniture(id: string, angle: number) {
  mutate((f) => {
    const item = f.furniture.find((fi) => fi.id === id);
    if (item) item.rotation = (item.rotation + angle) % 360;
  }, 'Rotated furniture');
}

export function setFurnitureRotation(id: string, angle: number) {
  mutate((f) => {
    const item = f.furniture.find((fi) => fi.id === id);
    if (item) item.rotation = ((angle % 360) + 360) % 360;
  });
}

export function scaleFurniture(id: string, scale: { x: number; y: number }) {
  mutate((f) => {
    const fi = f.furniture.find((item) => item.id === id);
    if (fi) {
      fi.scale = { x: Math.max(0.2, scale.x), y: Math.max(0.2, scale.y), z: fi.scale.z };
    }
  });
}

export function removeFurniture(id: string) {
  mutate((f) => {
    f.furniture = f.furniture.filter((fi) => fi.id !== id);
  }, 'Deleted furniture');
}

// Stairs
export function addStair(position: Point): string {
  const id = uid();
  mutate((f) => {
    if (!f.stairs) f.stairs = [];
    f.stairs.push({ id, position, rotation: 0, width: 100, depth: 300, riserCount: 14, direction: 'up', stairType: 'straight' });
  }, 'Added stair');
  return id;
}

export function updateStair(id: string, updates: Partial<Stair>) {
  mutate((f) => {
    if (!f.stairs) return;
    const s = f.stairs.find((s) => s.id === id);
    if (s) Object.assign(s, updates);
  });
}

export function removeStair(id: string) {
  mutate((f) => {
    if (!f.stairs) return;
    f.stairs = f.stairs.filter((s) => s.id !== id);
  });
}

export function moveStair(id: string, position: Point) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor || !floor.stairs) return;
  const s = floor.stairs.find((s) => s.id === id);
  if (s) {
    s.position = position;
    p.updatedAt = new Date();
    currentProject.set({ ...p });
  }
}

// Background Image
export function setBackgroundImage(bg: BackgroundImage | undefined) {
  mutate((f) => {
    f.backgroundImage = bg;
  });
}

export function updateBackgroundImage(updates: Partial<BackgroundImage>) {
  mutate((f) => {
    if (f.backgroundImage) Object.assign(f.backgroundImage, updates);
  });
}

// Column functions
export function addColumn(position: Point, shape: 'round' | 'square' = 'round'): string {
  const id = uid();
  mutate((f) => {
    if (!f.columns) f.columns = [];
    f.columns.push({ id, position, rotation: 0, shape, diameter: 30, height: 280, color: '#cccccc' });
  }, `Added ${shape} column`);
  return id;
}

export function updateColumn(id: string, updates: Partial<Column>) {
  mutate((f) => {
    if (!f.columns) return;
    const c = f.columns.find((c) => c.id === id);
    if (c) Object.assign(c, updates);
  });
}

export function removeColumn(id: string) {
  mutate((f) => {
    if (!f.columns) return;
    f.columns = f.columns.filter((c) => c.id !== id);
  });
}

export function moveColumn(id: string, position: Point) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor || !floor.columns) return;
  const c = floor.columns.find((c) => c.id === id);
  if (c) {
    c.position = position;
    p.updatedAt = new Date();
    currentProject.set({ ...p });
  }
}

/** Tool for placing columns */
export const placingColumn = writable<boolean>(false);
export const placingColumnShape = writable<'round' | 'square'>('round');

/** Tool for placing stairs */
export const placingStair = writable<boolean>(false);

/** Scale calibration mode */
export const calibrationMode = writable<boolean>(false);
export const calibrationPoints = writable<Point[]>([]);

export function removeElement(id: string) {
  mutate((f) => {
    // Check if the element being removed is a wall — if so, also remove associated doors/windows
    const isWall = f.walls.some((w) => w.id === id);
    f.walls = f.walls.filter((w) => w.id !== id);
    if (isWall) {
      // Cascade delete: remove doors and windows attached to this wall
      f.doors = f.doors.filter((d) => d.wallId !== id);
      f.windows = f.windows.filter((w) => w.wallId !== id);
      f.wallArt = (f.wallArt ?? []).filter((item) => item.wallId !== id);
    }
    f.doors = f.doors.filter((d) => d.id !== id);
    f.windows = f.windows.filter((w) => w.id !== id);
    f.wallArt = (f.wallArt ?? []).filter((item) => item.id !== id);
    f.furniture = f.furniture.filter((fi) => fi.id !== id);
    if (f.stairs) f.stairs = f.stairs.filter((s) => s.id !== id);
    if (f.columns) f.columns = f.columns.filter((c) => c.id !== id);
    if (f.textAnnotations) f.textAnnotations = f.textAnnotations.filter((t) => t.id !== id);
    if (f.walkthroughPoints) f.walkthroughPoints = f.walkthroughPoints.filter((point) => point.id !== id);
  }, 'Deleted element');
}

export function addWalkthroughPoint(position: Point, name?: string, dwellTime = 0): WalkthroughPoint {
  const point: WalkthroughPoint = { id: uid(), ...position, name, dwellTime: Math.max(0, dwellTime) };
  mutate((floor) => {
    floor.walkthroughPoints = [...(floor.walkthroughPoints ?? []), point];
  }, 'Added walkthrough point');
  return point;
}

export function updateWalkthroughPoint(id: string, updates: Partial<Omit<WalkthroughPoint, 'id'>>): void {
  mutate((floor) => {
    const point = floor.walkthroughPoints?.find((item) => item.id === id);
    if (!point) return;
    Object.assign(point, updates);
    point.dwellTime = Math.max(0, Number(point.dwellTime) || 0);
  }, 'Updated walkthrough point');
}

/** Insert a point immediately after an existing route point. */
export function insertWalkthroughPoint(afterPointId: string, position?: Point, name?: string, dwellTime = 0): WalkthroughPoint | null {
  const project = get(currentProject);
  if (!project) return null;
  const floor = project.floors.find((item) => item.id === project.activeFloorId);
  const points = floor?.walkthroughPoints ?? [];
  const index = points.findIndex((item) => item.id === afterPointId);
  if (!floor || index < 0) return null;
  const current = points[index];
  const next = points[index + 1];
  const target = position ?? (next
    ? { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 }
    : { x: current.x + 100, y: current.y });
  const point: WalkthroughPoint = { id: uid(), ...target, name, dwellTime: Math.max(0, dwellTime) };
  snapshot('Inserted walkthrough point');
  floor.walkthroughPoints = [...points.slice(0, index + 1), point, ...points.slice(index + 1)];
  project.updatedAt = new Date();
  currentProject.set({ ...project });
  return point;
}

export function moveWalkthroughPoint(id: string, position: Point): void {
  const project = get(currentProject);
  if (!project) return;
  const floor = project.floors.find((item) => item.id === project.activeFloorId);
  const point = floor?.walkthroughPoints?.find((item) => item.id === id);
  if (!point) return;
  point.x = position.x;
  point.y = position.y;
  project.updatedAt = new Date();
  currentProject.set({ ...project });
}

export function setWalkthroughPoints(points: readonly WalkthroughPoint[], floorId?: string): void {
  const project = get(currentProject);
  if (!project) return;
  snapshot('Updated walkthrough path');
  const targetId = floorId ?? project.activeFloorId;
  project.floors = project.floors.map((floor) => floor.id === targetId
    ? { ...floor, walkthroughPoints: points.map((point) => ({ ...point, dwellTime: Math.max(0, Number(point.dwellTime) || 0) })) }
    : floor);
  project.updatedAt = new Date();
  currentProject.set({ ...project });
}

/** Move a wall endpoint without creating an undo snapshot (for dragging) */
export function moveWallEndpoint(id: string, endpoint: 'start' | 'end', position: Point) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor) return;
  const w = floor.walls.find((w) => w.id === id);
  if (w) {
    w[endpoint] = position;
    p.updatedAt = new Date();
    currentProject.set({ ...p });
  }
}

export function updateWall(id: string, updates: Partial<Wall>) {
  mutate((f) => {
    const w = f.walls.find((w) => w.id === id);
    if (w) Object.assign(w, updates);
  });
}

export function updateDoor(id: string, updates: Partial<Door>) {
  mutate((f) => {
    const d = f.doors.find((d) => d.id === id);
    if (d) Object.assign(d, updates);
  });
}

export function updateWindow(id: string, updates: Partial<Win>) {
  mutate((f) => {
    const w = f.windows.find((w) => w.id === id);
    if (w) Object.assign(w, updates);
  });
}

export function updateWallArt(id: string, updates: Partial<WallArt>) {
  mutate((f) => {
    const item = f.wallArt?.find((wallArt) => wallArt.id === id);
    if (item) Object.assign(item, updates);
  });
}

export function updateFurniture(id: string, updates: Partial<FurnitureItem>) {
  mutate((f) => {
    const fi = f.furniture.find((fi) => fi.id === id);
    if (fi) Object.assign(fi, updates);
  });
}

export function updateRoom(id: string, updates: Partial<{ name: string; floorTexture: string; color: string; roomType: import('$lib/models/types').RoomCategory; labelOffset: import('$lib/models/types').Point | undefined }>) {
  mutate((f) => {
    let r = f.rooms.find((r) => r.id === id);
    if (r) {
      Object.assign(r, updates);
    } else {
      // Room not in floor.rooms yet (dynamically detected) — add it so changes persist on save
      const detected = get(detectedRoomsStore).find((r) => r.id === id);
      if (detected) {
        const newRoom = { ...detected, ...updates };
        f.rooms.push(newRoom);
      }
    }
  });
}

export function addFloor(name?: string, copyCurrentLayout = false) {
  const p = get(currentProject);
  if (!p) return;
  snapshot('Added floor');
  const level = p.floors.length;
  const floor: Floor = { id: uid(), name: name ?? `${level + 1} 层`, level, walls: [], rooms: [], doors: [], windows: [], wallArt: [], furniture: [], stairs: [], columns: [], guides: [], measurements: [], annotations: [], textAnnotations: [], groups: [], walkthroughPoints: [] };
  if (copyCurrentLayout) {
    const cur = p.floors.find(f => f.id === p.activeFloorId);
    if (cur) {
      floor.walls = cur.walls.map(w => ({ ...w, id: uid() }));
    }
  }
  p.floors.push(floor);
  p.activeFloorId = floor.id;
  p.updatedAt = new Date();
  currentProject.set({ ...p });
}

export function removeFloor(id: string) {
  const p = get(currentProject);
  if (!p || p.floors.length <= 1) return;
  snapshot('Removed floor');
  p.floors = p.floors.filter(f => f.id !== id);
  if (p.activeFloorId === id) {
    p.activeFloorId = p.floors[0].id;
  }
  p.updatedAt = new Date();
  currentProject.set({ ...p });
}

export function setActiveFloor(floorId: string) {
  const p = get(currentProject);
  if (!p) return;
  if (p.floors.some((f) => f.id === floorId)) {
    p.activeFloorId = floorId;
    currentProject.set({ ...p });
  }
}

export function updateProjectName(name: string) {
  const p = get(currentProject);
  if (!p) return;
  p.name = name;
  p.updatedAt = new Date();
  currentProject.set({ ...p });
}

export function loadProject(project: Project) {
  undoStack.length = 0;
  redoStack.length = 0;
  currentProject.set(project);
  syncHistoryStore();
}

/** Import a floor's data into the current project's active floor (replaces walls/doors/windows/furniture) */
export function importFloorIntoCurrentProject(floor: import('$lib/models/types').Floor) {
  const p = get(currentProject);
  if (!p) return;
  snapshot('Imported floor');
  const activeFloorIdx = p.floors.findIndex((f) => f.id === p.activeFloorId);
  if (activeFloorIdx === -1) return;
  // snapshot was already called above via snapshot('Imported floor')
  const existing = p.floors[activeFloorIdx];
  // Merge imported data into the active floor
  existing.walls = [...existing.walls, ...floor.walls];
  existing.doors = [...existing.doors, ...floor.doors];
  existing.windows = [...existing.windows, ...floor.windows];
  existing.wallArt = [...(existing.wallArt ?? []), ...(floor.wallArt ?? [])];
  existing.furniture = [...existing.furniture, ...floor.furniture];
  if (floor.stairs) existing.stairs = [...(existing.stairs || []), ...floor.stairs];
  if (floor.columns) existing.columns = [...(existing.columns || []), ...floor.columns];
  currentProject.set({ ...p });
}

export const selectedRoomId = writable<string | null>(null);
/** Detected rooms (synced from canvas room detection) */
export const detectedRoomsStore = writable<import('$lib/models/types').Room[]>([]);
/** catalogId currently being placed (null = not placing) */
export const placingFurnitureId = writable<string | null>(null);
/** Rotation angle for furniture being placed */
export const placingRotation = writable<number>(0);
/** Door subtype currently selected for placement */
export const placingDoorType = writable<Door['type']>('single');
/** Window subtype currently selected for placement */
export const placingWindowType = writable<import('$lib/models/types').Window['type']>('standard');

/** Duplicate a door onto the same wall */
export function duplicateDoor(id: string): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find(f => f.id === p.activeFloorId);
  if (!floor) return null;
  const d = floor.doors.find(d => d.id === id);
  if (!d) return null;
  const newPos = Math.min(1, d.position + 0.1);
  const newId = uid();
  mutate(f => {
    f.doors.push({ ...d, id: newId, position: newPos });
  });
  return newId;
}

/** Duplicate a window onto the same wall */
export function duplicateWindow(id: string): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find(f => f.id === p.activeFloorId);
  if (!floor) return null;
  const w = floor.windows.find(w => w.id === id);
  if (!w) return null;
  const newPos = Math.min(1, w.position + 0.1);
  const newId = uid();
  mutate(f => {
    f.windows.push({ ...w, id: newId, position: newPos });
  });
  return newId;
}

/** Duplicate furniture */
export function duplicateFurniture(id: string): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find(f => f.id === p.activeFloorId);
  if (!floor) return null;
  const fi = floor.furniture.find(fi => fi.id === id);
  if (!fi) return null;
  const newId = uid();
  mutate(f => {
    f.furniture.push({ ...fi, id: newId, position: { x: fi.position.x + 30, y: fi.position.y + 30 } });
  });
  return newId;
}

/** Move a wall parallel to itself (both endpoints shift by the same perpendicular offset) without undo snapshot (for dragging) */
export function moveWallParallel(id: string, dx: number, dy: number) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor) return;
  const w = floor.walls.find((w) => w.id === id);
  if (w) {
    w.start = { x: w.start.x + dx, y: w.start.y + dy };
    w.end = { x: w.end.x + dx, y: w.end.y + dy };
    if (w.curvePoint) {
      w.curvePoint = { x: w.curvePoint.x + dx, y: w.curvePoint.y + dy };
    }
    p.updatedAt = new Date();
    currentProject.set({ ...p });
  }
}

/** Split a wall into two segments at a given parameter t (0-1) */
export function splitWall(id: string, t: number): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor) return null;
  const w = floor.walls.find((w) => w.id === id);
  if (!w || w.curvePoint) return null; // don't split curved walls
  if (t <= 0.001 || t >= 0.999) return null; // prevent division by zero at extremes
  snapshot('Split wall');
  const midPt: Point = {
    x: w.start.x + (w.end.x - w.start.x) * t,
    y: w.start.y + (w.end.y - w.start.y) * t,
  };
  const newId = uid();
  // New wall from midpoint to original end
  floor.walls.push({ id: newId, start: { ...midPt }, end: { ...w.end }, thickness: w.thickness, height: w.height, color: w.color });
  // Shorten original wall to midpoint
  w.end = { ...midPt };
  // Move doors/windows on the original wall: adjust positions
  for (const d of floor.doors) {
    if (d.wallId === id) {
      if (d.position > t) {
        d.wallId = newId;
        d.position = (d.position - t) / (1 - t);
      } else {
        d.position = d.position / t;
      }
    }
  }
  for (const win of floor.windows) {
    if (win.wallId === id) {
      if (win.position > t) {
        win.wallId = newId;
        win.position = (win.position - t) / (1 - t);
      } else {
        win.position = win.position / t;
      }
    }
  }
  for (const item of floor.wallArt ?? []) {
    if (item.wallId === id) {
      if (item.position > t) {
        item.wallId = newId;
        item.position = (item.position - t) / (1 - t);
      } else {
        item.position = item.position / t;
      }
    }
  }
  p.updatedAt = new Date();
  currentProject.set({ ...p });
  return newId;
}

/** Duplicate a wall */
export function duplicateWall(id: string): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find(f => f.id === p.activeFloorId);
  if (!floor) return null;
  const w = floor.walls.find(w => w.id === id);
  if (!w) return null;
  const newId = uid();
  mutate(f => {
    f.walls.push({ ...w, id: newId, start: { x: w.start.x + 30, y: w.start.y + 30 }, end: { x: w.end.x + 30, y: w.end.y + 30 } });
  });
  return newId;
}

// --- Guide Lines ---
export function addGuide(orientation: 'horizontal' | 'vertical', position: number): string {
  const id = uid();
  mutate(f => {
    if (!f.guides) f.guides = [];
    f.guides.push({ id, orientation, position });
  });
  return id;
}

export function moveGuide(id: string, position: number) {
  mutate(f => {
    if (!f.guides) return;
    const g = f.guides.find(g => g.id === id);
    if (g) g.position = position;
  });
}

export function removeGuide(id: string) {
  mutate(f => {
    if (!f.guides) return;
    f.guides = f.guides.filter(g => g.id !== id);
  });
}

// --- Measurements ---
export function addMeasurement(x1: number, y1: number, x2: number, y2: number): string {
  const id = uid();
  mutate(f => {
    if (!f.measurements) f.measurements = [];
    f.measurements.push({ id, x1, y1, x2, y2 });
  });
  return id;
}

export function removeMeasurement(id: string) {
  mutate(f => {
    if (!f.measurements) return;
    f.measurements = f.measurements.filter(m => m.id !== id);
  });
}

// --- Annotations ---
export function addAnnotation(x1: number, y1: number, x2: number, y2: number, offset = 40, label?: string): string {
  const id = uid();
  mutate(f => {
    if (!f.annotations) f.annotations = [];
    f.annotations.push({ id, x1, y1, x2, y2, offset, label });
  });
  return id;
}

export function removeAnnotation(id: string) {
  mutate(f => {
    if (!f.annotations) return;
    f.annotations = f.annotations.filter(a => a.id !== id);
  });
}

export function updateAnnotation(id: string, updates: Partial<{ x1: number; y1: number; x2: number; y2: number; offset: number; label: string }>) {
  mutate(f => {
    if (!f.annotations) return;
    const a = f.annotations.find(a => a.id === id);
    if (!a) return;
    Object.assign(a, updates);
  });
}

// --- Text Annotations ---
export function addTextAnnotation(x: number, y: number, text: string, fontSize = 16, color = '#1e293b', rotation = 0): string {
  const id = uid();
  mutate(f => {
    if (!f.textAnnotations) f.textAnnotations = [];
    f.textAnnotations.push({ id, x, y, text, fontSize, color, rotation });
  });
  return id;
}

export function removeTextAnnotation(id: string) {
  mutate(f => {
    if (!f.textAnnotations) return;
    f.textAnnotations = f.textAnnotations.filter(t => t.id !== id);
  });
}

export function updateTextAnnotation(id: string, updates: Partial<{ x: number; y: number; text: string; fontSize: number; color: string; rotation: number }>) {
  mutate(f => {
    if (!f.textAnnotations) return;
    const t = f.textAnnotations.find(t => t.id === id);
    if (!t) return;
    Object.assign(t, updates);
  });
}

export function moveTextAnnotation(id: string, position: { x: number; y: number }) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find(f => f.id === p.activeFloorId);
  if (!floor?.textAnnotations) return;
  const t = floor.textAnnotations.find(t => t.id === id);
  if (!t) return;
  t.x = position.x;
  t.y = position.y;
  p.updatedAt = new Date();
  currentProject.set({ ...p });
}

// Layer visibility store (used by LayersPanel and FloorPlanCanvas)
export const layerVisibility = writable<{ walls: boolean; doors: boolean; windows: boolean; furniture: boolean; stairs: boolean; columns: boolean; guides: boolean; measurements: boolean; annotations: boolean }>({
  walls: true, doors: true, windows: true, furniture: true, stairs: true, columns: true, guides: true, measurements: true, annotations: true,
});

// --- Lock ---
export function toggleFurnitureLock(id: string) {
  mutate((f) => {
    const fi = f.furniture.find((fi) => fi.id === id);
    if (fi) fi.locked = !fi.locked;
  });
}

export function setFurnitureLocked(id: string, locked: boolean) {
  mutate((f) => {
    const fi = f.furniture.find((fi) => fi.id === id);
    if (fi) fi.locked = locked;
  });
}

// --- Element Groups ---
export function createGroup(elementIds: string[]): string | null {
  if (elementIds.length < 2) return null;
  const id = uid();
  mutate((f) => {
    if (!f.groups) f.groups = [];
    // Remove any existing group membership for these elements
    f.groups = f.groups.map(g => ({
      ...g,
      elementIds: g.elementIds.filter(eid => !elementIds.includes(eid))
    })).filter(g => g.elementIds.length >= 2);
    f.groups.push({ id, elementIds: [...elementIds] });
  });
  return id;
}

export function ungroup(groupId: string) {
  mutate((f) => {
    if (!f.groups) return;
    f.groups = f.groups.filter(g => g.id !== groupId);
  });
}

export function ungroupElements(elementIds: string[]) {
  mutate((f) => {
    if (!f.groups) return;
    f.groups = f.groups.filter(g => !g.elementIds.some(eid => elementIds.includes(eid)));
  });
}

export function findGroupForElement(floor: Floor, elementId: string): ElementGroup | undefined {
  if (!floor.groups) return undefined;
  return floor.groups.find(g => g.elementIds.includes(elementId));
}

// Zoom store for 2D canvas — shared between FloorPlanCanvas and TopBar
export const canvasZoom = writable<number>(1);
// Camera position stores for 2D canvas — used to compute viewport center
export const canvasCamX = writable<number>(0);
export const canvasCamY = writable<number>(0);

