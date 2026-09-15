# floorplan2d

**免费开源的 2D 户型图编辑器 / Free Open Source 2D Floor Plan Editor**

本项目是由 openplan3d 轻量化而来的 2D 编辑器，可快速绘制平面图并导出数据。部分原有功能已隐藏，目前主要用于适配本地项目。

This project is a lightweight 2D editor derived from openplan3d. It supports fast floor-plan drawing and data export. Some original features are hidden, and the package is currently tailored primarily for local project integration.

<!-- <p align="center">
  <img src="plan1_2d.jpg" alt="2D Floor Plan View" width="48%">
  <img src="plan1_3d.jpg" alt="3D Floor Plan View" width="48%">
</p>
<p align="center">
  <img src="plan4_2d.jpg" alt="Detailed 2D Plan" width="48%">
  <img src="plan4_3d.jpg" alt="Detailed 3D View" width="48%">
</p> -->

---

## ✨ 功能 / Features

### 🏗️ 绘图工具 / Drawing Tools
- **墙体 / Walls** — 点击放置，支持自动吸附和角度约束 / Click-to-place with automatic snapping and angle constraints
- **门窗 / Doors & Windows** — 支持多种门窗样式 / Multiple door and window styles
- **楼梯 / Stairs** — 支持直梯、L 形和 U 形楼梯，可配置尺寸 / Straight, L-shaped, and U-shaped stairs with configurable dimensions
- **房间 / Rooms** — 根据墙体自动识别，可自定义标签和颜色 / Auto-detected from walls with customizable labels and colors
- **壁画 / Wall art** — 挂载到墙体并可切换贴合墙面、调整尺寸与离地高度 / Mount artwork on walls, switch wall sides, and adjust dimensions and elevation

### 🛋️ 家具库 / Furniture Library
- **140+ 个物件 / 140+ items**，覆盖客厅、卧室、厨房、浴室、餐厅、办公室和户外等分类 / Across living room, bedroom, kitchen, bathroom, dining, office, outdoor, and more
- 支持拖放、旋转、缩放和吸附 / Drag-and-drop placement with rotation, resizing, and snapping
- 可在 3D 视图中渲染完整的 **3D 模型** / Full **3D models** rendered in the 3D view

### 🏠 3D 视图 / 3D View
- **实时 3D 预览 / Real-time 3D preview** — 使用 `Tab` 切换 / Toggle with `Tab`
- **漫游模式 / Walkthrough mode** — 以第一人称浏览户型图 / First-person navigation through your floor plan
- **材质编辑器 / Material editor** — 为墙体、地面和天花板应用木材、瓷砖、大理石、地毯、混凝土、砖等纹理 / Apply textures to walls, floors, and ceilings
- **灯光 / Lighting** — 可调节强度的环境光与方向光 / Ambient and directional lighting with adjustable intensity

### 📐 专业工具 / Pro Tools
- **网格吸附 / Snap to grid** — 可配置网格尺寸 / Configurable grid size
- **智能参考线 / Smart guides** — 提供对齐辅助 / Alignment helpers
- **多选 / Multi-select** — 支持框选、对齐和均匀分布 / Box selection, alignment, and even distribution
- **图层 / Layers** — 跨多个图层组织元素并切换可见性 / Organize elements across layers with visibility toggles
- **标注 / Annotations** — 可自定义字号和颜色的文本标签 / Text labels with customizable font size and color
- **房间预设 / Room presets** — 快速应用标准房间尺寸 / Quickly apply standard room dimensions
- **撤销与重做 / Undo & Redo** — 支持分组操作的完整历史 / Full history with grouped operations
- **版本历史 / Version history** — 可恢复自动保存的快照 / Restorable auto-saved snapshots

### 📤 导出 / Export
- **SVG** — 可缩放矢量图 / Scalable vector graphics
- **DXF** — AutoCAD 兼容格式 / AutoCAD-compatible format
- **PDF** — 带标题栏的可打印输出 / Print-ready output with title block
- **PNG** — 高分辨率位图 / High-resolution raster image
- **JSON** — 用于备份和共享的完整项目数据 / Full project data for backup and sharing

### 📥 导入 / Import
- **JSON** — 恢复已保存的项目 / Restore saved projects
- **Apple RoomPlan** — 导入 iOS 设备扫描的房间 / Import room scans from iOS devices
- **剪贴板图片 / Clipboard images** — 将参考图片直接粘贴到画布 / Paste reference images directly onto the canvas

---

## 🚀 快速开始 / Getting Started

```bash
# Clone the repository
git clone https://github.com/theLodgeBots/open3dFloorplan.git
cd open3dFloorplan

# Install dependencies
npm install

# Start the development server
npm run dev
```

在浏览器中打开 [http://localhost:5173](http://localhost:5173)。/ Open [http://localhost:5173](http://localhost:5173) in your browser.


在 React 项目中安装构建后的包：/ Install the generated package in a React project:

```bash
npm install floorplan2d
```

然后在 JSX 中直接渲染编辑器：/ Then render the editor directly in JSX:

```tsx
import { useState } from 'react';
import { FloorplanEditor, createDefaultProject } from 'floorplan2d';
import 'floorplan2d/styles.css';

export default function App() {
  const [project, setProject] = useState(() => createDefaultProject());

  return (
    <FloorplanEditor
      project={project}
      height="800px"
      onProjectChange={setProject}
    />
  );
}
```

`FloorplanEditor` 是 React `forwardRef` 组件。`project` 接收完整的户型图文档，`dataStore` 接收自定义持久化实现，`autoSave` 控制自动持久化，ref 提供 `getProject`、`loadProject` 和 `focus`。该包是仅支持 2D 的 ES 模块，不包含 Three.js 或 3D 查看器。

`FloorplanEditor` is a React `forwardRef` component. `project` accepts a complete floor plan document, `dataStore` accepts a custom persistence implementation, `autoSave` controls automatic persistence, and the ref exposes `getProject`, `loadProject`, and `focus`. The package is a 2D-only ES module and does not include Three.js or the 3D viewer.

#### 自定义模块 / Custom Modules

```tsx
<FloorplanEditor
  modules={{
    toolbar: <div style={{ padding: 8 }}>自定义工具栏</div>,
    leftPanel: <aside style={{ width: 220, padding: 12 }}>自定义素材库</aside>,
    rightPanel: <aside style={{ width: 260, padding: 12 }}>自定义属性</aside>,
    canvasOverlay: (
      <button style={{ pointerEvents: 'auto', position: 'absolute', top: 12, right: 12 }}>
        自定义画布操作
      </button>
    )
  }}
/>
```

#### 自定义物件 / Custom Objects

```tsx
const customObjects = [{
  id: 'custom-company-logo',
  name: '企业标识',
  category: '自定义物件',
  src: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2240%22%20fill%3D%22%232563eb%22%2F%3E%3C%2Fsvg%3E',
  width: 100,
  depth: 100,
  height: 0,
  color: '#2563eb'
}];

<FloorplanEditor customObjects={customObjects} />
```

物件目录默认为空，仅显示通过 `customObjects` 添加的自定义物件。自定义物件会随项目 JSON 保存，也可以通过 `ref.current.registerPattern(pattern)` 和 `ref.current.removePattern(id)` 动态添加或移除。`src` 支持 SVG、PNG、JPEG、WebP 的 data URL，以及 HTTP(S) 图片地址。

The object catalog is empty by default and only displays custom objects supplied through `customObjects`. Custom objects are saved in the project JSON and can also be added or removed dynamically with `ref.current.registerPattern(pattern)` and `ref.current.removePattern(id)`. `src` supports SVG, PNG, JPEG, and WebP data URLs, as well as HTTP(S) image URLs.

#### 房间预设与模板 / Room Presets and Templates

```tsx
import type { RoomPreset, RoomTemplate } from 'floorplan2d';

const roomPresets: RoomPreset[] = [{
  id: 'rectangle',
  name: '矩形房间',
  icon: '▭',
  description: '标准矩形房间',
  getWalls: (width, height) => [
    { start: { x: 0, y: 0 }, end: { x: width, y: 0 } },
    { start: { x: width, y: 0 }, end: { x: width, y: height } },
    { start: { x: width, y: height }, end: { x: 0, y: height } },
    { start: { x: 0, y: height }, end: { x: 0, y: 0 } }
  ]
}];

const roomTemplates: RoomTemplate[] = [{
  name: '标准客厅',
  presetId: 'rectangle',
  furniture: [
    { catalogId: 'custom-sofa', x: 0, y: -80, rotation: 0 }
  ]
}];

<FloorplanEditor
  roomPresets={roomPresets}
  roomTemplates={roomTemplates}
  customObjects={customObjects}
/>
```

房间预设和模板默认均为空。模板中的 `catalogId` 应引用 `customObjects` 中存在的物件 ID。

Room presets and templates are empty by default. Each `catalogId` in a template must reference an object ID available in `customObjects`.

#### 门窗目录配置 / Opening Catalog Configuration

`openingCatalog` 用于控制“建造”面板中门窗分类及具体类型的可见性。默认值为 `{}`：门、窗分类均显示，并展示所有内置类型。

`openingCatalog` controls the visibility of door and window categories and their individual types in the Build panel. Its default value is `{}`: both categories and all built-in types are visible.

```tsx
import type { OpeningCatalogConfig } from 'floorplan2d';

const openingCatalog: OpeningCatalogConfig = {};

<FloorplanEditor openingCatalog={openingCatalog} />
```

使用 `showDoors: false` 或 `showWindows: false` 可隐藏整个门或窗分类：

Set `showDoors: false` or `showWindows: false` to hide the entire door or window category:

```tsx
<FloorplanEditor
  openingCatalog={{
    showDoors: false,
    showWindows: true
  }}
/>
```

使用 `doorTypes` 和 `windowTypes` 可指定允许显示的类型；未列出的类型会隐藏。传入空数组会隐藏该分类下的所有类型。

Use `doorTypes` and `windowTypes` to specify the types that remain visible; omitted types are hidden. Passing an empty array hides every type in that category.

```tsx
<FloorplanEditor
  openingCatalog={{
    doorTypes: ['single', 'sliding'],
    windowTypes: ['standard', 'fixed', 'casement']
  }}
/>
```

可用的门类型 / Available door types: `single`, `double`, `sliding`, `french`, `pocket`, `bifold`.

可用的窗类型 / Available window types: `standard`, `fixed`, `casement`, `sliding`, `bay`.

也可以通过 ref 的 `setOpeningCatalog(config)` 在运行时更新配置。/ The configuration can also be updated at runtime through `setOpeningCatalog(config)` on the ref.

#### 根据第三方数据批量生成物件 / Generate Objects from Third-Party Data

```tsx
import { useRef } from 'react';
import { FloorplanEditor, GenerateObjectsError, type FloorplanEditorHandle } from 'floorplan2d';

const editorRef = useRef<FloorplanEditorHandle>(null);

function addTenCabinets() {
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
        position: { x: 100 + index * 90, y: 200 },
        label: {
          text: `机柜 ${String(index + 1).padStart(2, '0')}`,
          color: '#0f172a',
          fontSize: 12,
          offsetY: 12
        }
      }))
    });
    console.log(result?.generated);
  } catch (error) {
    if (error instanceof GenerateObjectsError) console.error(error.issues);
  }
}

<FloorplanEditor ref={editorRef} />
```

`definition` 只定义一次，`instances` 可以生成任意数量的同类设备。`src` 可省略；`shape` 支持 `rectangle` 和 `circle`，分别使用矩形和圆形表示。每个实例可以通过 `label` 设置不同的文本、颜色、字号和偏移。旧的数组格式仍然兼容。

`generateObjects` 会先校验整批数据，再一次性注册图形并创建实例。成功时只产生一次项目更新和一次撤销记录；任意数据无效时抛出 `GenerateObjectsError`，整批数据不会部分写入。返回结果包含每个 `externalId` 对应的编辑器 `objectId`。

Define `definition` once and use `instances` to create any number of devices of the same kind. `src` is optional; `shape` accepts `rectangle` or `circle`. Each instance can define different text, color, font size, and offset through `label`. The legacy array format remains supported.

`generateObjects` validates the entire batch before registering the shape and creating instances. A successful batch produces one project update and one undo entry. If any input is invalid, it throws `GenerateObjectsError` without partially writing the batch. The result maps each `externalId` to its editor `objectId`.

#### 物件新增回调 / Object Added Callback

```tsx
import type { ObjectAddedEvent } from 'floorplan2d';

function handleObjectAdded(event: ObjectAddedEvent) {
  console.log('新增物件', event.object);
  console.log('所在楼层', event.floor);
  console.log('设备定义', event.definition);
  console.log('新增来源', event.source);
}

<FloorplanEditor onObjectAdded={handleObjectAdded} />
```

`onObjectAdded` 在用户点击或拖放物件、房间模板创建物件以及 `generateObjects` 批量创建物件时触发。`source` 为 `editor` 或 `batch`；批量创建 10 个机柜时会触发 10 次，分别返回每个实例。初始项目和 `loadProject()` 中已经存在的物件不会触发。

`onObjectAdded` fires when users click or drag an object into the plan, when a room template creates objects, and when `generateObjects` creates a batch. `source` is `editor` or `batch`; creating ten cabinets fires ten events, one for each instance. Objects already present in the initial project or in `loadProject()` do not trigger the callback.

#### 漫游标点与路线 / Walkthrough Points and Routes

编辑器的“建造 → 漫游标点”工具支持连续点击画布添加标点，并按照标点顺序自动连线。切换到选择工具后可以拖动或删除标点，中间标点删除后前后节点会自动重新连接。

The Build → Walkthrough Points tool adds points with consecutive canvas clicks and connects them in array order. Switch to the selection tool to move or delete points; deleting a middle point automatically reconnects its adjacent points.

React 也可以通过 ref 控制：/ React can also control the route through a ref:

```tsx
const editorRef = useRef<FloorplanEditorHandle>(null);

editorRef.current?.setTool('walkthrough');

const point = editorRef.current?.addWalkthroughPoint(
  { x: 100, y: 200 },
  '入口'
);

editorRef.current?.setWalkthroughPoints([
  { id: 'point-1', x: 100, y: 200, name: '入口' },
  { id: 'point-2', x: 300, y: 200, name: '展厅' },
  { id: 'point-3', x: 500, y: 350, name: '出口' }
]);
```

监听新增标点：/ Listen for newly added points:

```tsx
<FloorplanEditor
  ref={editorRef}
  onWalkthroughPointAdded={(event) => {
    console.log(event.point);
    console.log(event.floor);
    console.log(event.index);
    console.log(event.source);
  }}
/>
```

路线保存在各楼层的 `walkthroughPoints` 数组中，连线由数组顺序自动生成。`source` 为 `editor` 或 `api`；初始项目与 `loadProject()` 中已有标点不会触发新增回调。

Routes are stored in each floor's `walkthroughPoints` array, and connections follow the array order. `source` is `editor` or `api`; points already present in the initial project or in `loadProject()` do not trigger the added callback.

#### 壁画 / Wall Art

在“建造 → 壁画”中选择工具，然后单击墙体即可挂载壁画。壁画可以沿所属墙体拖动，在属性面板中修改宽度、高度、底边离地高度、画框颜色，并通过“正面/背面”切换贴合墙壁的一面。图片可以从本地上传，或使用 HTTP(S) 图片地址。

Choose Build → Wall Art and click a wall to mount artwork. Wall art can be dragged along its wall. Use the properties panel to edit width, height, bottom elevation, frame color, and switch between the wall's normal and opposite sides. Images can be uploaded locally or supplied through an HTTP(S) URL.

壁画保存在楼层的 `wallArt` 数组中：/ Wall art is stored in each floor's `wallArt` array:

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

默认尺寸为 `120 × 80cm`，底边离地 `120cm`。`normal` 和 `anti` 分别表示墙体起点到终点方向的左侧和右侧。`src` 支持 HTTP(S) 地址，以及 SVG、PNG、JPEG、WebP data URL；本地上传会转换为 data URL 并随项目 JSON 保存（单张最大 5MB）。远程图片服务器需要允许跨域访问。删除或拆分墙体时，关联壁画会自动删除或迁移到对应墙段。

The default size is `120 × 80cm`, with a `120cm` bottom elevation. `normal` and `anti` represent the left and right sides relative to the wall's start-to-end direction. `src` accepts HTTP(S) URLs and SVG, PNG, JPEG, or WebP data URLs. Local uploads are converted to data URLs and persisted in project JSON (maximum 5MB per image). Remote image servers must allow cross-origin access. Deleting or splitting a wall automatically removes or reattaches related artwork.

### 生产构建 / Production Build

```bash
npm run build
npm run preview
```

---

## ⌨️ 快捷键 / Keyboard Shortcuts

| 快捷键 / Shortcut | 操作 / Action |
|---|---|
| `V` | 选择工具 / Select tool |
| `W` | 墙体工具 / Wall tool |
| `D` | 门工具 / Door tool |
| `T` | 文本/标注工具 / Text or annotation tool |
| `H` | 平移（手形）模式 / Pan (hand) mode |
| `R` | 旋转选中的家具 / Rotate selected furniture |
| `Delete` / `Backspace` | 删除选中元素 / Delete selected elements |
| `Escape` | 取消选择或操作 / Deselect or cancel |
| `Ctrl+Z` | 撤销 / Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | 重做 / Redo |
| `Ctrl+S` | 保存项目 / Save project |

---

## 🛠️ 技术栈 / Tech Stack

- **[SvelteKit](https://svelte.dev)** — 应用框架 / Application framework
- **[Tailwind CSS](https://tailwindcss.com)** — 样式 / Styling
- **[TypeScript](https://www.typescriptlang.org)** — 类型安全 / Type safety
- **[jsPDF](https://github.com/parallax/jsPDF)** — PDF 生成 / PDF generation
- **[dxf-writer](https://github.com/nicholaschiasson/dxf-writer)** — DXF 导出 / DXF export
- **[Firebase](https://firebase.google.com)** — 可选云同步 / Optional cloud sync

---

## 🤝 贡献 / Contributing

欢迎贡献！请按以下步骤开始：/ Contributions are welcome! Here's how to get started:

1. **派生仓库 / Fork** the repository
2. **创建功能分支 / Create a branch**: `git checkout -b feature/my-feature`
3. **完成修改并确保构建通过 / Make changes and ensure the build passes**: `npm run build`
4. **提交包含清晰说明的拉取请求 / Submit a pull request** with a clear description

请保持 PR 内容聚焦，并为 UI 修改附上截图。/ Keep PRs focused and include screenshots for UI changes.

---

## 📄 许可证 / License

本项目使用 [MIT 许可证](LICENSE)。/ This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <b>为建筑师、设计师和所有需要户型图的人而构建。/ Built with ❤️ for architects, designers, and anyone who needs a floor plan.</b>
</p>
