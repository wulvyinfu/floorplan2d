import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'vite.config.lib.ts', server: { middlewareMode: true } });
const { parseProjectFileData } = await server.ssrLoadModule('/src/lib/utils/projectFile.ts');

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
  const copy = parseProjectFileData(source);
  copy.floors[0].walls.push({ id: 'test' });
  assert.equal(source.floors[0].walls.length, 0);
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
