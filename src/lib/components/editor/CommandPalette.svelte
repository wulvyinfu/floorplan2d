<script lang="ts">
  import { selectedTool, snapEnabled, placingFurnitureId, placingDoorType, undo, redo, currentProject } from '$lib/stores/project';
  import { exportAsPNG, exportAsJSON, exportAsSVG, exportPDF } from '$lib/utils/export';
  import { exportDXF } from '$lib/utils/cadExport';
  import { get } from 'svelte/store';

  interface Props {
    open: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  type ResultItem = {
    id: string;
    name: string;
    icon: string;
    category: 'furniture' | 'tool' | 'action';
    categoryLabel: string;
    action: () => void;
  };

  const tools: ResultItem[] = [
    { id: 't-select', name: '选择工具', icon: '🔧', category: 'tool', categoryLabel: '🔧 工具', action: () => selectedTool.set('select') },
    { id: 't-wall', name: '墙体工具', icon: '🔧', category: 'tool', categoryLabel: '🔧 工具', action: () => selectedTool.set('wall') },
    { id: 't-door-double', name: '双开门', icon: '🔧', category: 'tool', categoryLabel: '🔧 工具', action: () => { placingDoorType.set('double'); selectedTool.set('door'); } },
  ];

  const actions: ResultItem[] = [
    { id: 'a-export-svg', name: '导出 SVG', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => { const p = get(currentProject); if (p) exportAsSVG(p); } },
    { id: 'a-export-dxf', name: '导出 DXF', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => { const p = get(currentProject); if (p) exportDXF(p); } },
    { id: 'a-export-pdf', name: '导出 PDF', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => { const p = get(currentProject); if (p) exportPDF(p); } },
    { id: 'a-export-png', name: '导出 PNG', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => { const canvas = document.querySelector('canvas'); const p = get(currentProject); if (canvas && p) exportAsPNG(canvas, p); } },
    { id: 'a-export-json', name: '导出 JSON', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => { const p = get(currentProject); if (p) exportAsJSON(p); } },
    { id: 'a-toggle-grid', name: '切换网格', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true })); } },
    { id: 'a-toggle-snap', name: '切换吸附', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => { snapEnabled.update(v => !v); } },
    { id: 'a-zoom-fit', name: '缩放至适合', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true })); } },
    { id: 'a-undo', name: '撤销', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => undo() },
    { id: 'a-redo', name: '重做', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => redo() },
    { id: 'a-settings', name: '设置', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => { window.dispatchEvent(new CustomEvent('open-settings')); } },
    { id: 'a-new-project', name: '新建项目', icon: '⚡', category: 'action', categoryLabel: '⚡ 操作', action: () => window.location.assign('/') },
  ];

  let furnitureItems = $derived((get(currentProject)?.customPatterns ?? []).map((item): ResultItem => ({
    id: `f-${item.id}`,
    name: item.name,
    icon: '图',
    category: 'furniture',
    categoryLabel: `🪑 ${item.category || '自定义物件'}`,
    action: () => { selectedTool.set('furniture'); placingFurnitureId.set(item.id); }
  })));

  let allItems = $derived([...actions, ...tools, ...furnitureItems]);

  let results = $derived.by(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allItems.slice(0, 12);
    return allItems.filter(item => item.name.toLowerCase().includes(q) || item.categoryLabel.toLowerCase().includes(q)).slice(0, 20);
  });

  $effect(() => {
    if (open) {
      query = '';
      selectedIndex = 0;
      // Focus after mount
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  // Reset index when results change
  $effect(() => {
    results; // track
    selectedIndex = 0;
  });

  function execute(item: ResultItem) {
    open = false;
    item.action();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) execute(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      open = false;
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 bg-black/40 z-[100] flex justify-center"
    onclick={() => open = false}
    onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
    role="dialog"
    aria-label="命令面板"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="mt-[15vh] w-full max-w-lg h-fit bg-white rounded-xl shadow-2xl overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
      role="listbox"
    >
      <!-- Search input -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <span class="text-gray-400 text-lg">🔍</span>
        <input
          bind:this={inputEl}
          bind:value={query}
          onkeydown={onKeydown}
          class="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
          placeholder="搜索家具、工具或操作…"
          type="text"
          spellcheck="false"
        />
        <kbd class="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 text-gray-400">ESC</kbd>
      </div>

      <!-- Results -->
      <div class="max-h-[50vh] overflow-y-auto">
        {#if results.length === 0}
          <div class="px-4 py-6 text-center text-sm text-gray-400">未找到结果</div>
        {:else}
          {#each results as item, i}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div
              class="flex items-center gap-3 px-4 py-2 cursor-pointer text-sm transition-colors"
              class:bg-blue-50={i === selectedIndex}
              class:text-blue-700={i === selectedIndex}
              class:text-gray-700={i !== selectedIndex}
              onmouseenter={() => selectedIndex = i}
              onclick={() => execute(item)}
              onkeydown={() => {}}
              role="option"
              aria-selected={i === selectedIndex}
            >
              <span class="text-base w-6 text-center flex-shrink-0">{item.icon}</span>
              <span class="flex-1 truncate">{item.name}</span>
              <span class="text-xs text-gray-400 flex-shrink-0">{item.categoryLabel}</span>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer hint -->
      <div class="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-400">
        <span><kbd class="px-1 py-0.5 bg-gray-100 rounded border border-gray-200">↑↓</kbd> 导航</span>
        <span><kbd class="px-1 py-0.5 bg-gray-100 rounded border border-gray-200">↵</kbd> 选择</span>
        <span><kbd class="px-1 py-0.5 bg-gray-100 rounded border border-gray-200">Esc</kbd> 关闭</span>
      </div>
    </div>
  </div>
{/if}
