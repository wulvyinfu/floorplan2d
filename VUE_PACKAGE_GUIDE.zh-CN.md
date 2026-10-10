# Vue 3 组件打包实施说明

本文说明如何在保留现有 React 入口的前提下，为 `floorplan2d` 增加 Vue 3 组件入口。推荐发布结构如下：

```ts
import { FloorplanEditor } from 'floorplan2d/vue';
import 'floorplan2d/styles.css';
```

不要把 `.svelte` 文件直接导入 Vue 项目。Vue 包装层应负责挂载和销毁 Svelte 编辑器、同步属性、转发事件、暴露方法，以及将 Vue 插槽投送到 Svelte 预留的 DOM 目标。

## 1. 实施前提

- Vue 版本：Vue 3.4 或更高版本。
- Svelte 版本：保持当前 Svelte 5 运行时。
- 构建工具：继续使用 Vite library mode。
- 根入口 `floorplan2d` 继续导出 React 组件，避免破坏现有用户。
- 新增 `floorplan2d/vue` 子路径导出 Vue 组件。
- 当前 store 和 runtime 是模块级单例，只保证一个页面内挂载一个编辑器实例。

Vue 和 React 包装层必须复用相同的 `Project`、`DataStore`、事件和 `FloorplanEditorHandle` 类型。实施时应先把这些类型从 `react.ts` 抽到 `src/lib/publicTypes.ts`，避免 Vue 入口依赖 React 类型。

## 2. 推荐目录

```text
src/lib/
├── components/editor/FloorplanEditor.svelte
├── publicTypes.ts
├── react.ts
├── vue.ts
└── styles.css
```

`publicTypes.ts` 放置框架无关内容：

```ts
export interface FloorplanEditorHandle {
  getProject(): Project | null;
  loadProject(project: Project): void;
  updateFileData(data: ProjectFileData): void;
  focus(): void;
  setTool(tool: Tool): void;
  save(): Promise<SaveEvent | null>;
}

export interface FloorplanEditorCoreProps {
  project?: Project;
  initialFileData?: ProjectFileData;
  dataStore?: DataStore;
  autoSave?: boolean;
  theme?: ThemePreference;
  customPatterns?: CustomPattern[];
  roomPresets?: readonly RoomPreset[];
  roomTemplates?: readonly RoomTemplate[];
  openingCatalog?: OpeningCatalogConfig;
}
```

完整 handle 方法以当前 `src/lib/react.ts` 为准，迁移时不要删减已有方法。

## 3. Vue 包装组件

新增 `src/lib/vue.ts`，基本结构如下：

```ts
import './styles.css';
import {
  Teleport,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType
} from 'vue';
import { mount, unmount } from 'svelte';
import SvelteFloorplanEditor from './components/editor/FloorplanEditor.svelte';
import { parseProjectFileData } from './utils/projectFile';
import type {
  DataStore,
  FloorplanEditorHandle,
  ObjectAddedEvent,
  OpeningCatalogConfig,
  Project,
  ProjectFileData,
  SaveEvent,
  WalkthroughPointAddedEvent
} from './publicTypes';

export const FloorplanEditor = defineComponent({
  name: 'FloorplanEditor',
  inheritAttrs: false,
  props: {
    project: Object as PropType<Project>,
    initialFileData: [String, Object] as PropType<ProjectFileData>,
    dataStore: Object as PropType<DataStore>,
    autoSave: { type: Boolean, default: true },
    height: { type: [String, Number], default: '100vh' },
    customPatterns: Array,
    roomPresets: Array,
    roomTemplates: Array,
    openingCatalog: Object as PropType<OpeningCatalogConfig>
  },
  emits: [
    'update:project',
    'project-change',
    'object-added',
    'walkthrough-point-added',
    'save',
    'ready'
  ],
  setup(props, { attrs, emit, expose, slots }) {
    const host = ref<HTMLDivElement>();
    const handle = shallowRef<FloorplanEditorHandle>();
    const toolbarTarget = shallowRef<HTMLElement>();
    const materialTarget = shallowRef<HTMLElement>();
    const propertiesTarget = shallowRef<HTMLElement>();
    const selected = shallowRef<unknown>(null);
    let instance: FloorplanEditorHandle | undefined;
    let active = true;

    onMounted(() => {
      if (!host.value) return;
      instance = mount(SvelteFloorplanEditor, {
        target: host.value,
        props: {
          project: props.project ?? (
            props.initialFileData == null
              ? undefined
              : parseProjectFileData(props.initialFileData)
          ),
          dataStore: props.dataStore,
          autoSave: props.autoSave,
          height: '100%',
          customPatterns: props.customPatterns,
          roomPresets: props.roomPresets ?? [],
          roomTemplates: props.roomTemplates ?? [],
          openingCatalog: props.openingCatalog ?? {},
          customMaterialTitle: slots['material-library'] ? '自定义' : undefined,
          hideDefaultOptions: !!slots.properties,
          onProjectChange(project: Project) {
            if (!active) return;
            emit('update:project', project);
            emit('project-change', project);
          },
          onObjectAdded(event: ObjectAddedEvent) {
            if (active) emit('object-added', event);
          },
          onWalkthroughPointAdded(event: WalkthroughPointAddedEvent) {
            if (active) emit('walkthrough-point-added', event);
          },
          onSave(event: SaveEvent) {
            if (active) emit('save', event);
          },
          onOptionsContextChange(context: { selection?: { value: unknown } } | null) {
            selected.value = context?.selection?.value ?? null;
          },
          onModuleTarget(position: string, element: HTMLElement | null) {
            const target = element ?? undefined;
            if (position === 'toolbarRight') toolbarTarget.value = target;
            if (position === 'materialLibrary') materialTarget.value = target;
            if (position === 'properties') propertiesTarget.value = target;
          },
          onReady(nextHandle: FloorplanEditorHandle) {
            handle.value = nextHandle;
            emit('ready', nextHandle);
          }
        }
      }) as FloorplanEditorHandle;
      handle.value = instance;
    });

    watch(() => props.project, (project) => {
      if (project && handle.value?.getProject() !== project) {
        handle.value?.loadProject(project);
      }
    });

    watch(
      () => [props.roomPresets, props.roomTemplates] as const,
      ([presets, templates]) => handle.value?.setRoomCatalogs(presets ?? [], templates ?? [])
    );

    watch(
      () => props.openingCatalog,
      (catalog) => handle.value?.setOpeningCatalog(catalog ?? {})
    );

    onBeforeUnmount(() => {
      active = false;
      handle.value = undefined;
      if (instance) void unmount(instance);
    });

    expose({
      getProject: () => handle.value?.getProject() ?? null,
      loadProject: (project: Project) => handle.value?.loadProject(project),
      updateFileData: (data: ProjectFileData) => handle.value?.updateFileData(data),
      focus: () => handle.value?.focus(),
      save: () => handle.value?.save() ?? Promise.resolve(null)
    });

    return () => [
      h('div', {
        ref: host,
        ...attrs,
        style: [{ height: typeof props.height === 'number' ? `${props.height}px` : props.height }, attrs.style]
      }),
      toolbarTarget.value && slots.toolbar
        ? h(Teleport, { to: toolbarTarget.value }, slots.toolbar())
        : null,
      materialTarget.value && slots['material-library']
        ? h(Teleport, { to: materialTarget.value }, slots['material-library']())
        : null,
      propertiesTarget.value && slots.properties
        ? h(Teleport, { to: propertiesTarget.value }, slots.properties({ selected: selected.value }))
        : null
    ];
  }
});

export { createDefaultFloor, createDefaultProject, localStore } from './reactShared';
export { parseProjectFileData } from './utils/projectFile';
export type * from './publicTypes';
```

示例只列出了常用 exposed 方法。正式实现必须对齐现有 `FloorplanEditorHandle`，完整暴露 `registerPattern()`、`generateObjects()`、漫游点、复制粘贴等所有方法。

## 4. Vue 使用方式

### 4.1 基础用法

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { FloorplanEditor, createDefaultProject } from 'floorplan2d/vue';
import type { Project } from 'floorplan2d/vue';
import 'floorplan2d/styles.css';

const project = ref<Project>(createDefaultProject('演示项目'));
</script>

<template>
  <FloorplanEditor
    v-model:project="project"
    height="100vh"
    @save="event => console.log(event.project)"
  />
</template>
```

### 4.2 文件数据初始化与更新

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { FloorplanEditor } from 'floorplan2d/vue';
import type { FloorplanEditorHandle, ProjectFileData } from 'floorplan2d/vue';

const editor = ref<FloorplanEditorHandle>();
const initialFileData: ProjectFileData = await fetch('/api/floorplan').then(r => r.json());

async function replaceProject() {
  const data = await fetch('/api/floorplan/next').then(r => r.json());
  editor.value?.updateFileData(data);
}
</script>

<template>
  <FloorplanEditor ref="editor" :initial-file-data="initialFileData" />
  <button type="button" @click="replaceProject">替换项目</button>
</template>
```

### 4.3 扩展插槽

```vue
<FloorplanEditor v-model:project="project">
  <template #toolbar>
    <button type="button" @click="publish">发布</button>
  </template>

  <template #material-library>
    <MaterialLibrary />
  </template>

  <template #properties="{ selected }">
    <PropertyPanel :value="selected" />
  </template>
</FloorplanEditor>
```

建议将自定义素材库标题单独设计为 Vue prop，例如 `materialLibraryTitle`。不要从 slot 内容猜测标题。

## 5. Props 与事件映射

| Vue API | Svelte API | 说明 |
| --- | --- | --- |
| `project` | `project` | 受控项目数据 |
| `initialFileData` | 初始化前解析成 `project` | JSON 字符串或文件对象 |
| `dataStore` | `dataStore` | 自定义持久化实现 |
| `autoSave` | `autoSave` | 自动保存开关 |
| `customPatterns` | `customPatterns` | 自定义素材定义 |
| `roomPresets` | `roomPresets` | 房间预设 |
| `roomTemplates` | `roomTemplates` | 房间模板 |
| `openingCatalog` | `openingCatalog` | 门窗目录配置 |
| `update:project` | `onProjectChange` | 支持 `v-model:project` |
| `project-change` | `onProjectChange` | 显式项目变更事件 |
| `object-added` | `onObjectAdded` | 新增物件事件 |
| `walkthrough-point-added` | `onWalkthroughPointAdded` | 新增漫游点事件 |
| `save` | `onSave` | 保存成功事件 |
| `ready` | `onReady` | 编辑器句柄就绪 |

`project` 的 watch 默认按引用比较。调用方不要在 `project-change` 中无条件深拷贝后再赋值，否则可能重复触发 `loadProject()`。推荐直接使用 `v-model:project` 返回的对象，或在业务层比较版本号/`updatedAt` 后再替换。

## 6. Vite 多入口配置

当前构建只接受一个入口，并开启了 `inlineDynamicImports`。增加 Vue 后建议改为 Rollup 多入口：

```ts
build: {
  lib: {
    entry: {
      react: resolve(__dirname, 'src/lib/react.ts'),
      vue: resolve(__dirname, 'src/lib/vue.ts')
    },
    formats: ['es'],
    cssFileName: 'floorplan2d'
  },
  rollupOptions: {
    external: [
      /^svelte(?:\/.*)?$/,
      /^react(?:\/.*)?$/,
      /^react-dom(?:\/.*)?$/,
      /^vue(?:\/.*)?$/
    ],
    output: {
      entryFileNames: chunk => chunk.name === 'vue'
        ? 'floorplan2d-vue.es.js'
        : 'floorplan2d.es.js',
      chunkFileNames: 'chunks/[name]-[hash].js',
      banner: '"use client";'
    }
  }
}
```

多入口构建不能继续设置 `inlineDynamicImports: true`。公共业务代码会输出共享 chunk，必须一起发布 `dist/chunks`。

## 7. package.json 发布配置

```json
{
  "files": [
    "dist",
    "README.md",
    "REACT_USAGE.zh-CN.md",
    "VUE_PACKAGE_GUIDE.zh-CN.md",
    "LICENSE"
  ],
  "exports": {
    ".": {
      "types": "./dist/react.d.ts",
      "import": "./dist/floorplan2d.es.js"
    },
    "./vue": {
      "types": "./dist/vue.d.ts",
      "import": "./dist/floorplan2d-vue.es.js"
    },
    "./styles.css": "./dist/floorplan2d.css"
  },
  "sideEffects": [
    "*.css",
    "**/*.css"
  ],
  "peerDependencies": {
    "react": "^18.2.0 || ^19.0.0",
    "react-dom": "^18.2.0 || ^19.0.0",
    "vue": "^3.4.0",
    "svelte": "^5.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "react-dom": { "optional": true },
    "vue": { "optional": true }
  }
}
```

React 和 Vue 都标记为可选 peer，消费方只安装自己使用的框架。`svelte` 不能标记为可选，因为两个包装层运行时都会调用 Svelte。

发布前需要把 `vue` 加入 `devDependencies`，用于编译包装层和生成 Vue 类型。

## 8. 类型声明

当前 `vite.config.lib.ts` 手工拼接 `index.d.ts`，内容依赖 React 类型，不能直接复用于 Vue。新增 Vue 入口前应改成真实源码声明生成：

1. 使用 `tsc --emitDeclarationOnly` 或 `vite-plugin-dts` 生成 `publicTypes.d.ts`。
2. React 入口生成 `react.d.ts`，只引用 React 类型。
3. Vue 入口生成 `vue.d.ts`，声明 `FloorplanEditor` 为 Vue `DefineComponent`。
4. 两个入口都从 `publicTypes.d.ts` 重导出公共模型。
5. 在 `npm pack --dry-run` 中确认三份声明和共享 chunk 均进入包。

不要继续复制两份手写 `Project`、`FloorplanEditorHandle` 和事件类型，否则两个框架入口会快速漂移。

## 9. 样式和静态资源

Vue 入口与 React 入口共享 `floorplan2d.css`。接入方只需导入一次：

```ts
import 'floorplan2d/styles.css';
```

正式发布 Vue 入口前还需要处理以下边界：

- 将全局 reset 限制在编辑器根容器内，避免影响 Vue 应用的按钮、标题和列表。
- 主题 class 应挂在编辑器根节点，不应修改宿主应用的 `document.documentElement`。
- 把纹理和其他静态资源复制到 `dist/assets`。
- 为 React/Vue 公共 props 增加 `assetBaseUrl`，并传给 `configureRuntime()`。
- 禁止通过 `document.querySelector('canvas')` 查找编辑器画布，应从当前编辑器根节点查询。

## 10. 生命周期和 SSR

- 只在 Vue `onMounted()` 中调用 Svelte `mount()`。
- 在 `onBeforeUnmount()` 中调用 `unmount()`，避免路由切换后残留键盘监听和订阅。
- Nuxt 中使用 `<ClientOnly>` 包裹编辑器，或把组件注册为 `.client.vue`。
- `vue.ts` 模块顶层不能访问 `window`、`document`、`localStorage`。
- 回调执行前检查组件是否仍处于 active 状态，避免卸载后的异步保存回调继续触发 Vue emit。

Nuxt 示例：

```vue
<ClientOnly>
  <FloorplanEditor v-model:project="project" />
</ClientOnly>
```

## 11. 当前架构限制

实现 Vue 包装前必须明确以下限制：

- `currentProject`、自动保存、主题和 runtime 配置均为模块级单例。
- 多个编辑器实例会共享项目和保存配置，当前不能可靠隔离。
- `configureRuntime()` 后挂载的实例会覆盖先挂载实例的 `dataStore` 和 `onSave`。
- 如果需要多实例，必须先把 store/runtime 改成按编辑器实例创建并通过 Svelte context 下发。
- `autoSave`、`dataStore` 等没有对应 setter；变化时只能重挂载，或先给核心 handle 增加更新方法。

因此 Vue 入口第一版应在文档中声明“单页面只支持一个编辑器实例”。

## 12. 验证清单

实现完成后至少验证：

- Vue 3 + Vite 项目可以从 `floorplan2d/vue` 导入并渲染。
- 纯 Vue 项目不安装 React 时仍能完成安装和构建。
- `v-model:project` 能收到编辑器变更，外部替换项目能更新画布。
- `initialFileData` 和 `updateFileData()` 均能加载 JSON 字符串和对象。
- `save` 事件中的项目是普通对象，不包含 Svelte 代理。
- template ref 可以调用完整的 `FloorplanEditorHandle`。
- 三个具名 slot 能正确渲染、更新和卸载。
- Vue 路由反复进入/离开后没有重复快捷键、订阅或自动保存。
- HMR 后只保留一个编辑器实例。
- `npm pack --dry-run` 包含 Vue JS、Vue 类型、共享 chunk、CSS 和静态资源。
- Nuxt 服务端导入不访问浏览器 API，客户端挂载正常。

## 13. 推荐实施顺序

1. 抽取 `publicTypes.ts`，消除公共 API 对 React 类型的依赖。
2. 为核心 runtime 和订阅增加实例级 dispose 能力。
3. 实现 `vue.ts` 的 mount、unmount、watch、emit、expose。
4. 使用 Vue `Teleport` 实现工具栏、素材库和属性面板插槽。
5. 改造 Vite 多入口和自动类型声明生成。
6. 更新 `package.json` exports、peer dependencies、files 和 sideEffects。
7. 增加 Vue Vite 示例项目和集成测试。
8. 完成 CSS 隔离、静态资源和 Nuxt 客户端接入验证。

完成这些步骤后，React 和 Vue 将只是同一个 Svelte 编辑器核心的两层薄适配，业务模型、文件格式、保存事件和命令式 API 可以保持一致。
