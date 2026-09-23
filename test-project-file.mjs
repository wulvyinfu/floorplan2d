import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'vite.config.lib.ts', server: { middlewareMode: true } });
const { createProjectDataSnapshot, parseProjectFileData } = await server.ssrLoadModule('/src/lib/utils/projectFile.ts');
const { mergeCustomPatterns } = await server.ssrLoadModule('/src/lib/utils/customPatterns.ts');

test('parses project JSON and normalizes legacy floors', () => {
  const source = {
    id: 'demo',
    name: 'Demo',
    floors: [{ id: 'floor', walls: [] }],
    activeFloorId: 'missing',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-02-01T00:00:00.000Z'
  };
  const project = parseProjectFileData(JSON.stringify(source));
  assert.equal(project.activeFloorId, 'floor');
  assert.ok(project.createdAt instanceof Date);
  assert.ok(project.updatedAt instanceof Date);
  assert.deepEqual(project.floors[0].furniture, []);
  assert.deepEqual(project.floors[0].walkthroughPoints, []);
  assert.equal(project.floors[0].width, 0);
  assert.equal(project.floors[0].height, 0);
  const copy = parseProjectFileData(source);
  copy.floors[0].walls.push({ id: 'test' });
  assert.equal(source.floors[0].walls.length, 0);
});

test('preserves dimensions or derives them from legacy walls', () => {
  const base = {
    id: 'dimensions', name: 'Dimensions', activeFloorId: 'floor',
    createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z'
  };
  const explicit = parseProjectFileData({ ...base, floors: [{ id: 'floor', width: 800, height: 600, walls: [] }] });
  assert.equal(explicit.floors[0].width, 800);
  assert.equal(explicit.floors[0].height, 600);
  const derived = parseProjectFileData({
    ...base,
    floors: [{ id: 'floor', walls: [{ start: { x: -100, y: 20 }, end: { x: 500, y: 320 } }] }]
  });
  assert.equal(derived.floors[0].width, 600);
  assert.equal(derived.floors[0].height, 300);
});

test('normalizes every floor in output snapshots', () => {
  const project = parseProjectFileData({
    id: 'output', name: 'Output', activeFloorId: 'first',
    createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
    floors: [
      { id: 'first', width: 1, height: 1, walls: [{ start: { x: 0, y: 0 }, end: { x: 900, y: 700 } }] },
      { id: 'second', width: 500, height: 400, walls: [] }
    ]
  });
  project.floors[0].width = 1;
  project.floors[0].height = 1;
  const output = createProjectDataSnapshot(project);
  assert.equal(output.floors[0].width, 900);
  assert.equal(output.floors[0].height, 700);
  assert.equal(output.floors[1].width, 500);
  assert.equal(output.floors[1].height, 400);
  assert.notEqual(output, project);
  assert.equal(project.floors[0].width, 1);
});

test('normalizes wall height and custom pattern wall snapping', () => {
  const project = parseProjectFileData({
    id: 'settings', name: 'Settings', activeFloorId: 'floor',
    createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
    floors: [{ id: 'floor', walls: [{ start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, height: 320 }] }],
    customPatterns: [
      { id: 'legacy', name: 'Legacy', width: 10, depth: 10 },
      { id: 'free', name: 'Free', width: 10, depth: 10, snapToWall: false }
    ]
  });
  assert.equal(project.wallHeight, 320);
  assert.equal(project.floors[0].walls[0].height, 320);
  assert.equal(project.customPatterns[0].snapToWall, true);
  assert.equal(project.customPatterns[1].snapToWall, false);
  project.wallHeight = 360;
  const output = createProjectDataSnapshot(project);
  assert.equal(output.floors[0].walls[0].height, 360);
});

test('keeps file patterns while external patterns win id conflicts', () => {
  const merged = mergeCustomPatterns(
    [
      { id: 'file-only', name: 'File Only', width: 10, depth: 10 },
      { id: 'shared', name: 'File Shared', width: 10, depth: 10 }
    ],
    [
      { id: 'shared', name: 'External Shared', width: 20, depth: 20, snapToWall: false },
      { id: 'external-only', name: 'External Only', width: 10, depth: 10 }
    ]
  );
  assert.deepEqual(merged.map((pattern) => pattern.id), ['file-only', 'shared', 'external-only']);
  assert.equal(merged.find((pattern) => pattern.id === 'shared').name, 'External Shared');
  assert.equal(merged.find((pattern) => pattern.id === 'shared').snapToWall, false);
});

test('rejects invalid project data', () => {
  assert.throws(() => parseProjectFileData('invalid'), /JSON/);
  assert.throws(() => parseProjectFileData({ id: 'missing-floors', name: 'Demo' }), /楼层/);
  assert.throws(() => parseProjectFileData({
    id: 'invalid-date', name: 'Demo', floors: [{ id: 'floor', walls: [] }],
    createdAt: 'not-a-date', updatedAt: '2025-01-01T00:00:00.000Z'
  }), /日期/);
});

test.after(async () => {
  await server.close();
});
