# floorplan2d

**Free Open Source 2D Floor Plan Editor**

当前项目由openplan3d进行轻量化的2d项目，能够快速绘制2d平面图并且导出数据，目前部分功能已经被隐藏。目前仅为适配本地项目使用。

<!-- <p align="center">
  <img src="plan1_2d.jpg" alt="2D Floor Plan View" width="48%">
  <img src="plan1_3d.jpg" alt="3D Floor Plan View" width="48%">
</p>
<p align="center">
  <img src="plan4_2d.jpg" alt="Detailed 2D Plan" width="48%">
  <img src="plan4_3d.jpg" alt="Detailed 3D View" width="48%">
</p> -->

---

## ✨ Features

### 🏗️ Drawing Tools
- **Walls** — Click-to-place with automatic snapping and angle constraints
- **Doors & Windows** — Multiple styles (single, double, sliding, pocket, bi-fold, french doors; casement, bay, picture windows)
- **Stairs** — Straight, L-shaped, and U-shaped with configurable dimensions
- **Rooms** — Auto-detected from walls with customizable labels and colors

### 🛋️ Furniture Library
- **140+ items** across categories: living room, bedroom, kitchen, bathroom, dining, office, outdoor, and more
- Drag-and-drop placement with rotation, resizing, and snapping
- Full **3D models** rendered in the 3D view

### 🏠 3D View
- **Real-time 3D preview** — Toggle with `Tab`
- **Walkthrough mode** — First-person navigation through your floor plan
- **Material editor** — Apply textures to walls, floors, and ceilings (wood, tile, marble, carpet, concrete, brick, and more)
- **Lighting** — Ambient and directional lighting with adjustable intensity

### 📐 Pro Tools
- **Snap to grid** with configurable grid size
- **Smart guides** and alignment helpers
- **Multi-select** with box selection and alignment tools (align left, center, right, top, middle, bottom; distribute evenly)
- **Layers** — Organize elements across multiple layers with visibility toggles
- **Annotations** — Text labels with customizable font size and color
- **Room presets** — Quickly apply standard room dimensions
- **Undo/Redo** — Full history with grouped operations
- **Version history** — Auto-saved snapshots you can restore

### 📤 Export
- **SVG** — Scalable vector graphics
- **DXF** — AutoCAD-compatible format
- **PDF** — Print-ready output with title block
- **PNG** — High-resolution raster image
- **JSON** — Full project data for backup and sharing

### 📥 Import
- **JSON** — Restore saved projects
- **Apple RoomPlan** — Import room scans from iOS devices
- **Clipboard images** — Paste reference images directly onto the canvas

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/theLodgeBots/open3dFloorplan.git
cd open3dFloorplan

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.


Install the generated package in a React project:

```bash
npm install floorplan2d
```

Then render the editor directly in JSX:

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

`FloorplanEditor` is a React `forwardRef` component. `project` accepts a complete floor plan document, `dataStore` accepts a custom persistence implementation, `autoSave` controls automatic persistence, and the ref exposes `getProject`, `loadProject`, and `focus`. The package is a 2D-only ES module and does not include Three.js or the 3D viewer.

#### 自定义模块

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

#### 自定义物件

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

#### 房间预设与模板

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

#### 根据第三方数据批量生成物件

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

#### 物件新增回调

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

#### 漫游标点与路线

编辑器的“建造 → 漫游标点”工具支持连续点击画布添加标点，并按照标点顺序自动连线。切换到选择工具后可以拖动或删除标点，中间标点删除后前后节点会自动重新连接。

React 也可以通过 ref 控制：

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

监听新增标点：

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

### Production Build

```bash
npm run build
npm run preview
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `V` | Select tool |
| `W` | Wall tool |
| `D` | Door tool |
| `T` | Text / annotation tool |
| `H` | Pan (hand) mode |
| `R` | Rotate selected furniture |
| `Delete` / `Backspace` | Delete selected element(s) |
| `Escape` | Deselect / cancel |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+S` | Save project |

---

## 🛠️ Tech Stack

- **[SvelteKit](https://svelte.dev)** — Application framework
- **[Tailwind CSS](https://tailwindcss.com)** — Styling
- **[TypeScript](https://www.typescriptlang.org)** — Type safety
- **[jsPDF](https://github.com/parallax/jsPDF)** — PDF generation
- **[dxf-writer](https://github.com/nicholaschiasson/dxf-writer)** — DXF export
- **[Firebase](https://firebase.google.com)** — Optional cloud sync

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature: `git checkout -b feature/my-feature`
3. **Make your changes** and ensure the build passes: `npm run build`
4. **Submit a pull request** with a clear description of your changes

Please keep PRs focused and include screenshots for UI changes.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <b>Built with ❤️ for architects, designers, and anyone who needs a floor plan.</b>
</p>
