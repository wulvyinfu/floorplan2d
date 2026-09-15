export interface Point { x: number; y: number; }

export interface WalkthroughPoint extends Point {
  id: string;
  name?: string;
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  height: number;
  color: string;
  /** Optional quadratic bezier control point for curved walls */
  curvePoint?: Point;
  texture?: string;
  /** Interior-specific overrides (if different from exterior) */
  interiorColor?: string;
  interiorTexture?: string;
  /** Exterior-specific overrides */
  exteriorColor?: string;
  exteriorTexture?: string;
}

export type RoomCategory = 'indoor' | 'outdoor' | 'garage' | 'utility';

export interface Room {
  id: string;
  name: string;
  walls: string[];
  floorTexture: string;
  area: number;
  color?: string;
  roomType?: RoomCategory;
  /** Custom label position offset from centroid (in world units) */
  labelOffset?: Point;
}

export interface Door {
  id: string;
  wallId: string;
  position: number; // 0-1 along wall
  width: number;
  height: number;
  type: 'single' | 'double' | 'sliding' | 'french' | 'pocket' | 'bifold';
  swingDirection: 'left' | 'right';
  flipSide: boolean; // flip which side of wall the door opens to (vertical flip)
}

export interface Window {
  id: string;
  wallId: string;
  position: number; // 0-1 along wall
  width: number;
  height: number;
  sillHeight: number;
  type: 'standard' | 'fixed' | 'casement' | 'sliding' | 'bay';
}

export interface OpeningCatalogConfig {
  showDoors?: boolean;
  showWindows?: boolean;
  doorTypes?: readonly Door['type'][];
  windowTypes?: readonly Window['type'][];
}

export interface FurnitureItem {
  id: string;
  catalogId: string;
  position: Point;
  rotation: number;
  scale: { x: number; y: number; z: number };
  // Per-item overrides (optional — falls back to catalog defaults)
  color?: string;
  width?: number;   // cm
  depth?: number;   // cm
  height?: number;  // cm
  material?: string; // material name/id
  locked?: boolean;
  label?: ObjectLabel;
}

export type ObjectShape = 'rectangle' | 'circle';

export interface ObjectLabel {
  text: string;
  color?: string;
  fontSize?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface CustomPattern {
  id: string;
  name: string;
  category?: string;
  src?: string;
  shape?: ObjectShape;
  color?: string;
  width: number;
  depth: number;
  height?: number;
}

export interface ExternalObjectInput {
  externalId?: string;
  floorId?: string;
  pattern: CustomPattern;
  position: Point;
  rotation?: number;
  scale?: Partial<{ x: number; y: number; z: number }>;
  color?: string;
  width?: number;
  depth?: number;
  height?: number;
  material?: string;
  locked?: boolean;
  label?: string | ObjectLabel;
}

export interface DeviceInstanceInput {
  externalId?: string;
  floorId?: string;
  position: Point;
  rotation?: number;
  scale?: Partial<{ x: number; y: number; z: number }>;
  color?: string;
  width?: number;
  depth?: number;
  height?: number;
  material?: string;
  locked?: boolean;
  label?: string | ObjectLabel;
}

export interface DeviceBatchInput {
  definition: CustomPattern;
  instances: readonly DeviceInstanceInput[];
}

export type GenerateObjectsInput = readonly ExternalObjectInput[] | DeviceBatchInput;

export interface GeneratedObjectResult {
  externalId?: string;
  objectId: string;
  catalogId: string;
  floorId: string;
}

export interface GenerateObjectsResult {
  projectId: string;
  generated: GeneratedObjectResult[];
  updatedAt: Date;
}

export interface ObjectAddedEvent {
  object: FurnitureItem;
  floor: Floor;
  definition?: CustomPattern;
  source: 'editor' | 'batch';
}

export class GenerateObjectsError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join('；'));
    this.name = 'GenerateObjectsError';
  }
}

export interface ElementGroup {
  id: string;
  elementIds: string[];
}

export type StairType = 'straight' | 'l-shaped' | 'u-shaped' | 'spiral';

export interface Stair {
  id: string;
  position: Point;
  rotation: number;
  width: number;   // default 100cm
  depth: number;   // default 300cm
  riserCount: number; // default 14
  direction: 'up' | 'down';
  stairType: StairType; // default 'straight'
}

export interface Column {
  id: string;
  position: Point;
  rotation: number;
  shape: 'round' | 'square';
  diameter: number;  // cm (for round) or side length (for square)
  height: number;    // cm
  color: string;
}

export interface Measurement {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Annotation {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  offset: number; // perpendicular offset for dimension line (default 40)
}

export interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  rotation: number;
}

export interface GuideLine {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number; // world coordinate (x for vertical, y for horizontal)
}

export interface BackgroundImage {
  dataUrl: string;
  position: Point;
  scale: number;
  opacity: number;
  rotation: number;
  locked: boolean;
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  walls: Wall[];
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  furniture: FurnitureItem[];
  stairs: Stair[];
  columns: Column[];
  backgroundImage?: BackgroundImage;
  guides: GuideLine[];
  measurements: Measurement[];
  annotations: Annotation[];
  textAnnotations: TextAnnotation[];
  groups: ElementGroup[];
  walkthroughPoints?: WalkthroughPoint[];
}

export interface WalkthroughPointAddedEvent {
  point: WalkthroughPoint;
  floor: Floor;
  index: number;
  source: 'editor' | 'api';
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  floors: Floor[];
  activeFloorId: string;
  createdAt: Date;
  updatedAt: Date;
  customPatterns?: CustomPattern[];
}
