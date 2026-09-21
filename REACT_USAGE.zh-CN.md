# Floorplan XG React 接入文档

`floorplan2d` 是一个可在 React 18/19 项目中直接使用的二维户型编辑器组件。组件以 ES Module 发布，提供户型绘制、门、外部物件、批量设备、房间预设、房间模板和漫游路线能力。

## 1. 环境要求

- React 18.2 或 React 19
- React DOM 18.2 或 React DOM 19
- Svelte 5
- 支持 ES Module 的构建工具，例如 Vite、Webpack 5 或 Next.js

组件对 React 暴露标准的 `<FloorplanEditor />`，接入方不需要编写 Svelte 代码。

## 2. 生成和安装组件包

在组件源码项目中执行：

```bash
npm install
npm run package
npm pack
```

构建结果：

```text
dist/floorplan2d.es.js
dist/floorplan2d.css
dist/index.d.ts
floorplan2d-0.9.0.tgz
```

在 React 项目中安装本地包：

```bash
npm install /absolute/path/floorplan2d-0.9.0.tgz
```

发布到 npm 后安装：

```bash
npm install floorplan2d
```

如果包管理器没有自动安装 peer dependency，请执行：

```bash
npm install react react-dom svelte
```

## 3. 最小使用示例

```tsx
import { FloorplanEditor } from 'floorplan2d';
import 'floorplan2d/styles.css';

export default function App() {
  return (
    <FloorplanEditor
      height="100vh"
      autoSave={false}
    />
  );
}
```

必须引入组件样式：

```tsx
import 'floorplan2d/styles.css';
```

`height` 可以传入任意合法 CSS 高度值，例如 `800px`、`100vh` 或 `calc(100vh - 64px)`。

## 4. 受控项目数据

推荐由 React 保存当前项目数据：

```tsx
import { useState } from 'react';
import {
  FloorplanEditor,
  createDefaultProject,
  type Project
} from 'floorplan2d';
import 'floorplan2d/styles.css';

export default function App() {
  const [project, setProject] = useState<Project>(() =>
    createDefaultProject('数据中心平面图')
  );

  return (
    <FloorplanEditor
      project={project}
      onProjectChange={setProject}
      autoSave={false}
      height="100vh"
    />
  );
}
```

编辑器发生墙体、门、物件、房间或漫游路线变化时，会通过 `onProjectChange` 返回完整项目。

### 初始化项目文件数据

第三方可以通过 `initialFileData` 直接传入项目 JSON 字符串或已解析对象。该属性仅用于首次初始化；如果同时传入 `project`，以 `project` 为准。

```tsx
const initialFileData = await fetch('/api/floorplans/demo').then((response) => response.text());

<FloorplanEditor
  ref={editorRef}
  initialFileData={initialFileData}
  autoSave={false}
/>
```

运行期间更新文件数据：

```tsx
const nextFileData = await fetch('/api/floorplans/next').then((response) => response.json());
editorRef.current?.updateFileData(nextFileData);
```

也可以单独解析文件数据，用于校验或转换为受控 `Project`：

```tsx
import { parseProjectFileData } from 'floorplan2d';

const project = parseProjectFileData(fileData);
```

解析器会恢复 `createdAt`、`updatedAt` 为 `Date`，补齐旧文件缺少的楼层数组字段，并在 `activeFloorId` 无效时切换到第一个楼层。JSON 格式错误或缺少 `id`、`name`、`floors`、`walls` 等必要字段时会抛出 `Error`。

## 5. 自定义物件目录

物件目录默认为空，只显示外部传入的物件。`src` 可省略，无图片时使用 `shape` 绘制矩形或圆形。

```tsx
import type { CustomPattern } from 'floorplan2d';

const customObjects: CustomPattern[] = [
  {
    id: 'cabinet-42u',
    name: '42U 机柜',
    category: '机房设备',
    shape: 'rectangle',
    width: 60,
    depth: 120,
    height: 200,
    color: '#475569'
  },
  {
    id: 'temperature-sensor',
    name: '温度传感器',
    category: '传感器',
    shape: 'circle',
    width: 40,
    depth: 40,
    color: '#16a34a'
  },
  {
    id: 'ups-device',
    name: 'UPS',
    category: '供电设备',
    src: '/floorplan-assets/ups.svg',
    shape: 'rectangle',
    width: 80,
    depth: 100,
    height: 180
  }
];

<FloorplanEditor customObjects={customObjects} />
```

`shape` 支持：

```ts
type ObjectShape = 'rectangle' | 'circle';
```

传入图片时优先显示图片；图片缺失或加载失败时使用 `shape`。远程图片需要允许浏览器跨域访问。

## 6. 批量生成相同设备

通过 ref 调用 `generateObjects()`，一份设备定义可以生成任意数量的实例。

```tsx
import { useRef } from 'react';
import {
  FloorplanEditor,
  GenerateObjectsError,
  type FloorplanEditorHandle
} from 'floorplan2d';

export default function App() {
  const editorRef = useRef<FloorplanEditorHandle>(null);

  function addCabinets() {
    try {
      const result = editorRef.current?.generateObjects({
        definition: {
          id: 'cabinet-42u',
          name: '42U 机柜',
          category: '机房设备',
          shape: 'rectangle',
          width: 60,
          depth: 120,
          height: 200,
          color: '#475569'
        },
        instances: Array.from({ length: 10 }, (_, index) => ({
          externalId: `cabinet-${index + 1}`,
          position: {
            x: 100 + index * 90,
            y: 200
          },
          rotation: 0,
          label: {
            text: `机柜 ${String(index + 1).padStart(2, '0')}`,
            color: '#0f172a',
            fontSize: 12,
            offsetX: 0,
            offsetY: 12
          }
        }))
      });

      console.log(result?.generated);
    } catch (error) {
      if (error instanceof GenerateObjectsError) {
        console.error(error.issues);
      }
    }
  }

  return (
    <>
      <button type="button" onClick={addCabinets}>
        添加 10 个机柜
      </button>
      <FloorplanEditor
        ref={editorRef}
        autoSave={false}
        height="800px"
      />
    </>
  );
}
```

每个实例支持以下属性：

```ts
interface DeviceInstanceInput {
  externalId?: string;
  floorId?: string;
  position: { x: number; y: number };
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
```

`externalId` 用于关联第三方业务数据。调用结果中的 `generated` 会返回第三方 ID 与编辑器内部 ID 的映射：

```ts
interface GeneratedObjectResult {
  externalId?: string;
  objectId: string;
  catalogId: string;
  floorId: string;
}
```

批量操作会先校验全部数据。任意实例无效时抛出 `GenerateObjectsError`，整批数据不会部分写入。

## 7. 物件新增回调

```tsx
import type { ObjectAddedEvent } from 'floorplan2d';

function handleObjectAdded(event: ObjectAddedEvent) {
  console.log(event.object);
  console.log(event.object.label?.text);
  console.log(event.floor.id);
  console.log(event.definition);
  console.log(event.source);
}

<FloorplanEditor onObjectAdded={handleObjectAdded} />
```

事件结构：

```ts
interface ObjectAddedEvent {
  object: FurnitureItem;
  floor: Floor;
  definition?: CustomPattern;
  source: 'editor' | 'batch';
}
```

- 用户点击或拖放创建物件时，`source` 为 `editor`。
- `generateObjects()` 创建物件时，`source` 为 `batch`。
- 批量创建 10 个设备时逐个触发 10 次。
- 初始项目和 `loadProject()` 中已有物件不会触发。

## 8. 房间预设和模板

房间预设与模板默认为空，均由外部传入。

```tsx
import type {
  RoomPreset,
  RoomTemplate
} from 'floorplan2d';

const roomPresets: RoomPreset[] = [
  {
    id: 'rectangle-room',
    name: '矩形房间',
    icon: '▭',
    description: '标准矩形空间',
    getWalls(width, height) {
      return [
        { start: { x: 0, y: 0 }, end: { x: width, y: 0 } },
        { start: { x: width, y: 0 }, end: { x: width, y: height } },
        { start: { x: width, y: height }, end: { x: 0, y: height } },
        { start: { x: 0, y: height }, end: { x: 0, y: 0 } }
      ];
    }
  }
];

const roomTemplates: RoomTemplate[] = [
  {
    name: '标准机房',
    presetId: 'rectangle-room',
    furniture: [
      {
        catalogId: 'cabinet-42u',
        x: 100,
        y: 100,
        rotation: 0
      }
    ]
  }
];

<FloorplanEditor
  customObjects={customObjects}
  roomPresets={roomPresets}
  roomTemplates={roomTemplates}
/>
```

模板中的 `presetId` 必须对应房间预设 ID，`catalogId` 必须对应外部物件 ID。

## 9. 漫游标点和路线

## 自定义右侧属性操作栏

### 选中元素复制粘贴

```tsx
const copied = await editorRef.current?.copySelection();
const newIds = await editorRef.current?.pasteSelection({ x: 50, y: 50 });
```

编辑器同时支持 `Ctrl/Cmd+C` 和 `Ctrl/Cmd+V`。复制内容以 `FLOORPLAN2D_CLIPBOARD_V1` 开头的 JSON 代码写入系统粘贴板，支持跨编辑器实例粘贴。默认每次粘贴偏移 `{ x: 30, y: 30 }` 厘米；外部调用可指定偏移量。支持墙体、门窗、壁画、家具、楼梯、柱、文本标注和漫游标点，多选粘贴作为一次撤销操作。墙体和墙上挂件一起复制时会自动重建关联。

### 保存项目与保存回调

```tsx
const editorRef = useRef<FloorplanEditorHandle>(null);

<FloorplanEditor
  ref={editorRef}
  onSave={({ project, source, savedAt }) => {
    console.log(project.id, source, savedAt);
  }}
/>

const event = await editorRef.current?.save();
```

`onSave` 仅在 `dataStore.save()` 成功后触发。回调中的 `project` 是脱离编辑器响应式状态的深度普通对象快照，嵌套对象和数组均不包含 Svelte 代理，日期字段保持为 `Date`。`source` 为 `'manual' | 'auto' | 'shortcut' | 'external'`，分别表示顶部保存按钮、自动保存、`Ctrl/Cmd+S` 和 `ref.save()`。`save()` 返回本次保存事件；当前没有项目时返回 `null`，保存失败时抛出存储层错误。

### 深色模式

```tsx
<FloorplanEditor theme="dark" />
```

`theme` 支持 `light`、`dark`、`system`（跟随系统）。不传时沿用已保存的主题偏好。顶部太阳/月亮按钮可快捷切换，也可以在设置中选择跟随系统。侧栏、表单和画布背景/网格随主题变化；物件颜色和导出工程图保持不变。主题偏好是全局共享的，并同步页面根节点的 `dark` 类。

`modules.properties` 会完全覆盖内置右侧属性栏，适用于墙、门、窗、壁画、家具、房间、楼梯、柱、文本标注和漫游标点。回调参数是当前选中的属性对象，未选中时为 `null`。

```tsx
<FloorplanEditor
  modules={{
    properties: (selected) => (
      <div className="w-72 p-4">
        <h3>当前属性</h3>
        <pre>{JSON.stringify(selected, null, 2)}</pre>
      </div>
    )
  }}
/>
```

自定义属性组件需要通过编辑器已有的数据更新 API 或业务状态管理完成属性修改。

### 物件矩阵预生成与鼠标放置

```tsx
const devicePattern = { 
  id: "cabinet-42u",// 对应物件 ID
  name: "机柜",
  category: "自定义物件",
  color: "#2563eb",
  width: 100,
  depth: 100,
  height: 200
}
editorRef.current?.preGenerateObjectGrid({
  pattern: devicePattern,
  rows: 3,
  columns: 4,
  rowGap: 50,
  columnGap: 80
});
```

调用后矩阵跟随鼠标预览，单击画布后以点击位置为中心一次性生成。间距单位为厘米。

用户可在“建造 → 漫游标点”中连续点击画布。标点按照数组顺序自动连接，切换到选择工具后可以选择、拖动和删除标点。选中标点后可设置名称和停留时间，并通过“在此标点后添加新标点”直接扩展路线；若有下一点则插入两点中间，否则添加到当前点右侧。

React 可以主动切换工具：

```tsx
editorRef.current?.setTool('walkthrough');
```

通过 API 增加单个标点：

```tsx
const point = editorRef.current?.addWalkthroughPoint(
  { x: 100, y: 200 },
  '入口',
  2.5 // 停留秒数
);
```

更新标点或在指定标点后插入新标点：

```tsx
editorRef.current?.updateWalkthroughPoint(pointId, { dwellTime: 5 });
const inserted = editorRef.current?.insertWalkthroughPoint(
  pointId,
  { x: 200, y: 200 }, // 可省略；自动选择中点或右侧位置
  '新增检查点',
  1
);
```

批量设置当前楼层路线：

```tsx
editorRef.current?.setWalkthroughPoints([
  { id: 'route-1', x: 100, y: 200, name: '入口', dwellTime: 2 },
  { id: 'route-2', x: 300, y: 200, name: '机房', dwellTime: 5 },
  { id: 'route-3', x: 500, y: 350, name: '出口' }
]);
```

设置指定楼层：

```tsx
editorRef.current?.setWalkthroughPoints(points, floorId);
```

监听新增标点：

```tsx
import type { WalkthroughPointAddedEvent } from 'floorplan2d';

function handlePointAdded(event: WalkthroughPointAddedEvent) {
  console.log(event.point);
  console.log(event.floor.id);
  console.log(event.index);
  console.log(event.source);
}

<FloorplanEditor
  ref={editorRef}
  onWalkthroughPointAdded={handlePointAdded}
/>
```

`dwellTime` 单位为秒，默认 `0`。画布会在停留时间大于 `0` 时显示秒数。`source` 为：

- `editor`：用户在画布上标点。
- `api`：通过 `addWalkthroughPoint()` 或 `setWalkthroughPoints()` 添加。

路线保存在对应楼层的 `walkthroughPoints` 中：

```ts
const project = editorRef.current?.getProject();
const activeFloor = project?.floors.find(
  (floor) => floor.id === project.activeFloorId
);
const route = activeFloor?.walkthroughPoints ?? [];
```

连线不单独保存，而是根据数组顺序生成。删除中间标点后，前后标点自动重新连接。

### 壁画数据

壁画通过编辑器中的“建造 → 壁画”挂载到墙体，并保存在楼层的 `wallArt` 数组中：

```ts
interface WallArt {
  id: string;
  wallId: string;
  position: number;
  width: number;
  height: number;
  bottomHeight: number;
  side: 'normal' | 'anti';
  color: string;
  src?: string;
}
```

`position` 是沿墙体的 `0-1` 参数。`side` 可在属性面板中切换，用于指定壁画贴合墙体的正面或背面。`src` 可使用 HTTP(S) 图片地址，或 SVG、PNG、JPEG、WebP data URL。本地上传的图片会转换为 data URL（单张最大 5MB），并随项目 JSON 持久化；远程图片服务器需要允许跨域访问。壁画支持沿墙拖动、复制、删除以及清除图片。

## 10. 自定义 React 模块

`modules` 提供右上工具栏、自定义素材库和自定义属性面板三个扩展点：

```tsx
<FloorplanEditor
  modules={{
    toolbar: () => <button type="button" onClick={() => alert('业务操作')}>业务操作</button>,
    materialLibrary: {
      title: '我的素材',
      content: <div className="p-2">自定义素材布局</div>
    },
    properties: (selected) => (
      <div className="p-3">
        <h3>自定义属性</h3>
        <pre>{JSON.stringify(selected, null, 2)}</pre>
      </div>
    )
  }}
/>
```

- `toolbar` 是回调函数，返回的 React 组件显示在顶部右侧工具栏。
- `materialLibrary` 必须提供 `title` 和 `content`，会作为左侧素材库 Tab，与“建造”“房间”“物件”并列切换。
- `properties` 是回调函数，参数是当前选中的属性对象；未选中时为 `null`。返回的 React 组件会替换默认属性面板。

## 11. Ref API

```ts
interface FloorplanEditorHandle {
  getProject(): Project | null;
  loadProject(project: Project): void;
  updateFileData(data: ProjectFileData): void;
  focus(): void;
  registerPattern(pattern: CustomPattern): void;
  removePattern(id: string): void;
  setRoomCatalogs(
    presets: readonly RoomPreset[],
    templates: readonly RoomTemplate[]
  ): void;
  generateObjects(input: GenerateObjectsInput): GenerateObjectsResult;
  setTool(tool: Tool): void;
  addWalkthroughPoint(position: Point, name?: string, dwellTime?: number): WalkthroughPoint;
  setWalkthroughPoints(
    points: readonly WalkthroughPoint[],
    floorId?: string
  ): void;
  updateWalkthroughPoint(
    id: string,
    updates: Partial<Omit<WalkthroughPoint, 'id'>>
  ): void;
  insertWalkthroughPoint(
    afterPointId: string,
    position?: Point,
    name?: string,
    dwellTime?: number
  ): WalkthroughPoint | null;
  normalizeCoordinates(floorId?: string): Point | null;
}
```

坐标归一化会将指定楼层（省略 `floorId` 时为当前楼层）的墙体包围盒中心移动到世界原点 `(0, 0)`，并同步平移家具、楼梯、柱、标注、测量、辅助线、漫游点及背景图等绝对坐标。门窗和壁画使用墙体相对位置，无需单独换算。返回值是实际应用的平移量；没有墙体时返回 `null`。

```tsx
const offset = editorRef.current?.normalizeCoordinates();
// 指定楼层：editorRef.current?.normalizeCoordinates(floorId)
```

获取当前项目：

```tsx
const project = editorRef.current?.getProject();
```

载入项目：

```tsx
editorRef.current?.loadProject(nextProject);
```

动态注册物件：

```tsx
editorRef.current?.registerPattern({
  id: 'camera',
  name: '摄像头',
  category: '安防设备',
  shape: 'circle',
  width: 30,
  depth: 30
});
```

## 12. 自定义数据存储

需要自动保存到后端时，实现 `DataStore`：

```tsx
import type { DataStore, Project } from 'floorplan2d';

const apiStore: DataStore = {
  async save(project) {
    await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(project)
    });
  },

  async load(id) {
    const response = await fetch(`/api/projects/${id}`);
    if (!response.ok) return null;
    const project = await response.json();
    return {
      ...project,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt)
    } as Project;
  },

  async list() {
    const response = await fetch('/api/projects');
    return response.json();
  },

  async delete(id) {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  },

  async duplicate() {
    return null;
  },

  saveThumbnail() {},

  getThumbnail() {
    return null;
  }
};

<FloorplanEditor
  dataStore={apiStore}
  autoSave
/>
```

如果由外部 React 状态或业务接口负责保存，建议设置：

```tsx
<FloorplanEditor autoSave={false} />
```

## 13. Next.js 使用

编辑器依赖浏览器 Canvas，应在客户端组件中使用：

```tsx
'use client';

import { FloorplanEditor } from 'floorplan2d';
import 'floorplan2d/styles.css';

export default function EditorPage() {
  return (
    <FloorplanEditor
      autoSave={false}
      height="100vh"
    />
  );
}
```

全局 CSS 也可以在 Next.js 根布局中引入。

## 14. 完整接入示例

```tsx
import { useRef, useState } from 'react';
import {
  FloorplanEditor,
  createDefaultProject,
  type FloorplanEditorHandle,
  type ObjectAddedEvent,
  type Project,
  type WalkthroughPointAddedEvent
} from 'floorplan2d';
import 'floorplan2d/styles.css';

const customObjects = [
  {
    id: 'cabinet-42u',
    name: '42U 机柜',
    category: '机房设备',
    shape: 'rectangle' as const,
    width: 60,
    depth: 120,
    height: 200
  }
];

const roomPresets = [
  {
    id: 'rectangle-room',
    name: '矩形房间',
    icon: '▭',
    description: '标准矩形空间',
    getWalls(width: number, height: number) {
      return [
        { start: { x: 0, y: 0 }, end: { x: width, y: 0 } },
        { start: { x: width, y: 0 }, end: { x: width, y: height } },
        { start: { x: width, y: height }, end: { x: 0, y: height } },
        { start: { x: 0, y: height }, end: { x: 0, y: 0 } }
      ];
    }
  }
];

const roomTemplates = [
  {
    name: '标准机房',
    presetId: 'rectangle-room',
    furniture: [
      { catalogId: 'cabinet-42u', x: 100, y: 100, rotation: 0 }
    ]
  }
];

export default function App() {
  const editorRef = useRef<FloorplanEditorHandle>(null);
  const [project, setProject] = useState<Project>(() =>
    createDefaultProject('机房平面图')
  );

  function handleObjectAdded(event: ObjectAddedEvent) {
    console.log('新增设备', event.object.id, event.source);
  }

  function handlePointAdded(event: WalkthroughPointAddedEvent) {
    console.log('新增漫游点', event.point.id, event.index);
  }

  return (
    <FloorplanEditor
      ref={editorRef}
      project={project}
      customObjects={customObjects}
      roomPresets={roomPresets}
      roomTemplates={roomTemplates}
      openingCatalog={{ showDoors: true, showWindows: true }}
      autoSave={false}
      height="100vh"
      onProjectChange={setProject}
      onObjectAdded={handleObjectAdded}
      onWalkthroughPointAdded={handlePointAdded}
    />
  );
}
```

## 15. 注意事项

- 当前组件为纯二维编辑器，不包含 Three.js 和 3D 模块。
- 坐标和尺寸统一使用厘米。
- 旋转角度使用度数。
- `customObjects`、房间预设和房间模板默认均为空。
- 建造模块默认展示全部 6 种门和 5 种窗，可通过 `openingCatalog` 隐藏整个分类或限制具体类型。
- 壁画保存在 `Floor.wallArt` 中，旧项目缺少该字段时按空数组处理。
- 使用 ref 方法前应确保组件已经挂载，可通过 `onReady` 获取就绪通知。
- 不建议同时使用 `customObjects` 受控属性和 `registerPattern()` 修改同一物件 ID。
- `loadProject()` 不会触发物件或漫游标点的新增回调。
- 项目 JSON 中的日期从服务端读取后应恢复为 `Date` 对象。
- 当前版本适合单编辑器实例页面；同页多实例仍可能共享内部状态。

## 16. Props 速查

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `project` | `Project` | 自动创建 | 当前项目数据 |
| `initialFileData` | `string \| Project \| Record<string, unknown>` | 无 | 首次初始化使用的项目文件 JSON 或对象 |
| `height` | `CSSProperties['height']` | `100vh` | 编辑器高度 |
| `autoSave` | `boolean` | `true` | 是否使用 DataStore 自动保存 |
| `dataStore` | `DataStore` | 本地存储 | 自定义持久化适配器 |
| `customObjects` | `CustomPattern[]` | `[]` | 外部物件目录 |
| `roomPresets` | `RoomPreset[]` | `[]` | 外部房间预设 |
| `roomTemplates` | `RoomTemplate[]` | `[]` | 外部房间模板 |
| `openingCatalog` | `OpeningCatalogConfig` | `{}` | 控制门窗分类及具体预设是否展示 |
| `modules` | `FloorplanEditorModules` | 无 | React 扩展模块 |
| `onProjectChange` | `(project) => void` | 无 | 项目变化回调 |
| `onObjectAdded` | `(event) => void` | 无 | 物件新增回调 |
| `onWalkthroughPointAdded` | `(event) => void` | 无 | 漫游点新增回调 |
| `onReady` | `(handle) => void` | 无 | 编辑器就绪回调 |

## 17. 撤销与重做快捷键

编辑器挂载后支持以下快捷键：

在选择工具（`V`）下，按住 `B` 并拖动画布可强制框选，即使从物件或房间内部开始拖动也不会触发其选中或移动；按住 `B + Shift` 拖动可追加到当前选择。松开 `B` 恢复普通选择，输入框获得焦点时不会触发框选快捷键。

| 功能 | Windows / Linux | macOS |
| --- | --- | --- |
| 撤销 | `Ctrl+Z` | `Command+Z` |
| 重做 | `Ctrl+Y` 或 `Ctrl+Shift+Z` | `Command+Shift+Z` |

快捷键适用于墙体、门、物件、房间和漫游标点等进入历史栈的编辑操作。在输入框、文本域、下拉框或可编辑文本区域中使用这些组合键时，将保留浏览器原生的文字撤销与重做行为，不会修改户型数据。
