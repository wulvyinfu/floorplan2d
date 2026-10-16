import type { CustomPattern, FurnitureItem, Project } from '$lib/models/types';

/** Manual bottom height in cm; undefined inherits the definition's default. */
export function validateGroundHeight(value: unknown): void {
  if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new Error('离地面高度必须是非负有限数值');
  }
}

/** Bottom elevation in cm; custom objects without a height retain the existing 0cm default. */
export function getFurniturePlacement(item: FurnitureItem, definition: CustomPattern | undefined, wallHeight: number) {
  validateGroundHeight(item.groundHeight);
  validateGroundHeight(definition?.groundHeight);
  const ceilingMounted = item.ceilingMounted ?? definition?.ceilingMounted ?? false;
  const groundHeight = item.groundHeight ?? definition?.groundHeight ?? 0;
  return {
    ceilingMounted,
    groundHeight,
    elevation: ceilingMounted ? wallHeight - (item.height ?? definition?.height ?? 0) * item.scale.z : groundHeight
  };
}

/** Recompute derived elevations without materializing inherited placement defaults. */
export function refreshFurnitureElevations(project: Project): Project {
  const definitions = new Map((project.customPatterns ?? []).map((definition) => [definition.id, definition]));
  for (const floor of project.floors) {
    for (const item of floor.furniture) {
      item.elevation = getFurniturePlacement(item, definitions.get(item.catalogId), project.wallHeight).elevation;
    }
  }
  return project;
}
