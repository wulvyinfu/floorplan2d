<script lang="ts">
  import { resolveAssetUrl } from '$lib/runtime';
  import { activeFloor, selectedElementId, selectedRoomId, updateWall, updateDoor, updateWindow, updateWallArt, updateRoom, updateFurniture, detectedRoomsStore, updateStair, updateColumn, updateBackgroundImage, setBackgroundImage, calibrationMode, calibrationPoints, updateTextAnnotation, toggleFurnitureLock, updateWalkthroughPoint, insertWalkthroughPoint } from '$lib/stores/project';
  import { floorMaterials, wallColors } from '$lib/utils/materials';
  import { getCatalogItem } from '$lib/utils/furnitureCatalog';
  import { projectSettings, formatLength, formatArea } from '$lib/stores/settings';
  import type { Floor, Wall, Door, Window as Win, Room, FurnitureItem, Stair, Column, RoomCategory, TextAnnotation } from '$lib/models/types';

  let floor = $state<Floor | null>(null);
  let selId: string | null = $state(null);
  let selRoomId: string | null = $state(null);
  let detectedRooms: Room[] = $state([]);

  activeFloor.subscribe((f) => { floor = f; });
  selectedElementId.subscribe((id) => { selId = id; });
  selectedRoomId.subscribe((id) => { selRoomId = id; });
  detectedRoomsStore.subscribe((rooms) => { detectedRooms = rooms; });

  let settings = $state($projectSettings);
  projectSettings.subscribe((s) => { settings = s; });

  function displayValue(cm: number): number {
    return settings.units === 'imperial' ? Math.round(cm / 2.54 * 10) / 10 : cm;
  }
  function inputToCm(value: number): number {
    return settings.units === 'imperial' ? value * 2.54 : value;
  }
  function unitLabel(): string {
    return settings.units === 'imperial' ? 'in' : 'cm';
  }

  function localizedMaterialName(id: string, name: string): string {
    const labels: Record<string, string> = {
      'light-oak': '浅橡木', walnut: '胡桃木', bamboo: '竹木', laminate: '复合板',
      'ceramic-white': '白色瓷砖', 'ceramic-gray': '灰色瓷砖', porcelain: '瓷器',
      'marble-white': '白色大理石', 'marble-dark': '深色大理石',
      'carpet-beige': '米色地毯', 'carpet-gray': '灰色地毯', concrete: '混凝土', slate: '板岩', vinyl: '乙烯基地板',
    };
    return labels[id] ?? name;
  }

  function localizedWallName(id: string, name: string): string {
    const labels: Record<string, string> = {
      white: '白色', cream: '奶油色', 'warm-white': '暖白色', 'light-gray': '浅灰色', 'medium-gray': '中灰色',
      charcoal: '炭黑色', 'navy-blue': '海军蓝', 'light-blue': '浅蓝色', 'sage-green': '鼠尾草绿', olive: '橄榄色',
      terracotta: '陶土色', 'blush-pink': '腮红粉', lavender: '薰衣草色', 'butter-yellow': '黄油黄', taupe: '灰褐色',
      'red-brick': '红砖', 'exposed-brick': '裸砖', stone: '石材', 'wood-panel': '木饰面', 'concrete-block': '混凝土砌块', 'subway-tile': '地铁砖',
    };
    return labels[id] ?? name;
  }

  let wallSideTab = $state<'interior' | 'exterior'>('interior');
  let selectedWall = $derived(floor?.walls?.find(w => w.id === selId) ?? null);
  let selectedDoor = $derived(floor?.doors?.find(d => d.id === selId) ?? null);
  let selectedWindow = $derived(floor?.windows?.find(w => w.id === selId) ?? null);
  let selectedWallArt = $derived(floor?.wallArt?.find(item => item.id === selId) ?? null);
  let selectedFurniture = $derived(floor?.furniture?.find(f => f.id === selId) ?? null);
  let selectedStair = $derived(floor?.stairs?.find(s => s.id === selId) ?? null);
  let selectedColumn = $derived(floor?.columns?.find(c => c.id === selId) ?? null);
  let selectedTextAnnotation = $derived(floor?.textAnnotations?.find(t => t.id === selId) ?? null);
  let selectedWalkthroughPoint = $derived(floor?.walkthroughPoints?.find(point => point.id === selId) ?? null);
  let hasBgImage = $derived(!!floor?.backgroundImage);
  let selectedRoom = $derived(floor?.rooms?.find(r => r.id === selRoomId) ?? detectedRooms.find(r => r.id === selRoomId) ?? null);
  let wallArtSrcInput = $state('');
  let wallArtSrcId: string | null = $state(null);
  let wallArtSrcError = $state('');

  $effect(() => {
    if (selectedWallArt?.id !== wallArtSrcId) {
      wallArtSrcId = selectedWallArt?.id ?? null;
      wallArtSrcInput = selectedWallArt?.src ?? '';
      wallArtSrcError = '';
    }
  });

  // Helper to get the parent wall for selected door/window
  let selectedDoorWall = $derived((selectedDoor && floor?.walls?.find(w => w.id === selectedDoor.wallId)) ?? null);
  let selectedWindowWall = $derived((selectedWindow && floor?.walls?.find(w => w.id === selectedWindow.wallId)) ?? null);

  // Helper function to calculate wall length
  function calcWallLength(wall: Wall): number {
    if (wall.curvePoint) {
      let len = 0; const N = 20;
      let px = wall.start.x, py = wall.start.y;
      for (let i = 1; i <= N; i++) {
        const t = i / N, mt = 1 - t;
        const nx = mt*mt*wall.start.x + 2*mt*t*wall.curvePoint.x + t*t*wall.end.x;
        const ny = mt*mt*wall.start.y + 2*mt*t*wall.curvePoint.y + t*t*wall.end.y;
        len += Math.hypot(nx - px, ny - py); px = nx; py = ny;
      }
      return len;
    }
    return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  }

  let wallLength = $derived(selectedWall ? Math.round(calcWallLength(selectedWall)) : 0);

  // Calculate door distances
  let doorDistFromA = $derived(selectedDoor && selectedDoorWall ? Math.round(calcWallLength(selectedDoorWall) * selectedDoor.position) : 0);
  let doorDistFromB = $derived(selectedDoor && selectedDoorWall ? Math.round(calcWallLength(selectedDoorWall) * (1 - selectedDoor.position)) : 0);

  // Calculate window distances  
  let windowDistFromA = $derived(selectedWindow && selectedWindowWall ? Math.round(calcWallLength(selectedWindowWall) * selectedWindow.position) : 0);
  let windowDistFromB = $derived(selectedWindow && selectedWindowWall ? Math.round(calcWallLength(selectedWindowWall) * (1 - selectedWindow.position)) : 0);

  function onWallThickness(e: Event) {
    if (!selectedWall) return;
    updateWall(selectedWall.id, { thickness: inputToCm(Number((e.target as HTMLInputElement).value)) });
  }
  function onWallHeight(e: Event) {
    if (!selectedWall) return;
    updateWall(selectedWall.id, { height: inputToCm(Number((e.target as HTMLInputElement).value)) });
  }
  function onWallColor(e: Event) {
    if (!selectedWall) return;
    updateWall(selectedWall.id, { color: (e.target as HTMLInputElement).value });
  }
  function onDoorWidth(e: Event) {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { width: Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1) });
  }
  function onDoorHeight(e: Event) {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { height: inputToCm(Number((e.target as HTMLInputElement).value)) });
  }
  function onDoorType(e: Event) {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { type: (e.target as HTMLSelectElement).value as Door['type'] });
  }
  function onDoorSwing(e: Event) {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { swingDirection: (e.target as HTMLSelectElement).value as 'left' | 'right' });
  }
  function flipDoorHorizontal() {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { swingDirection: selectedDoor.swingDirection === 'left' ? 'right' : 'left' });
  }
  function flipDoorVertical() {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { flipSide: !(selectedDoor.flipSide ?? false) });
  }
  function onWindowType(e: Event) {
    if (!selectedWindow) return;
    updateWindow(selectedWindow.id, { type: (e.target as HTMLSelectElement).value as Win['type'] });
  }
  function onWindowWidth(e: Event) {
    if (!selectedWindow) return;
    updateWindow(selectedWindow.id, { width: Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1) });
  }
  function onWindowHeight(e: Event) {
    if (!selectedWindow) return;
    updateWindow(selectedWindow.id, { height: inputToCm(Number((e.target as HTMLInputElement).value)) });
  }
  function onWindowSill(e: Event) {
    if (!selectedWindow) return;
    updateWindow(selectedWindow.id, { sillHeight: inputToCm(Number((e.target as HTMLInputElement).value)) });
  }

  function onWallArtNumber(field: 'width' | 'height' | 'bottomHeight', e: Event) {
    if (!selectedWallArt) return;
    const value = Math.max(field === 'bottomHeight' ? 0 : 1, inputToCm(Number((e.target as HTMLInputElement).value)) || 0);
    updateWallArt(selectedWallArt.id, { [field]: value });
  }

  function applyWallArtSrc() {
    if (!selectedWallArt) return;
    const src = wallArtSrcInput.trim();
    wallArtSrcError = '';
    wallArtSrcInput = src;
    updateWallArt(selectedWallArt.id, { src: src || undefined });
  }

  function uploadWallArtImage() {
    if (!selectedWallArt) return;
    const wallArtId = selectedWallArt.id;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/svg+xml,image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        wallArtSrcError = '仅支持 SVG、PNG、JPEG 或 WebP 图片';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        wallArtSrcError = '图片不能超过 5MB';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = typeof reader.result === 'string' ? reader.result : '';
        if (!src) return;
        wallArtSrcInput = src;
        wallArtSrcError = '';
        updateWallArt(wallArtId, { src });
      };
      reader.onerror = () => { wallArtSrcError = '图片读取失败'; };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function clearWallArtImage() {
    if (!selectedWallArt) return;
    wallArtSrcInput = '';
    wallArtSrcError = '';
    updateWallArt(selectedWallArt.id, { src: undefined });
  }

  function addPointAfterSelected() {
    if (!selectedWalkthroughPoint) return;
    const point = insertWalkthroughPoint(selectedWalkthroughPoint.id);
    if (point) selectedElementId.set(point.id);
  }

  // Furniture handlers
  function onFurnitureColor(color: string) {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { color });
  }
  function onFurnitureWidth(e: Event) {
    if (!selectedFurniture) return;
    const v = Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1);
    updateFurniture(selectedFurniture.id, { width: v });
  }
  function onFurnitureDepth(e: Event) {
    if (!selectedFurniture) return;
    const v = Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1);
    updateFurniture(selectedFurniture.id, { depth: v });
  }
  function onFurnitureHeight(e: Event) {
    if (!selectedFurniture) return;
    const v = Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1);
    updateFurniture(selectedFurniture.id, { height: v });
  }
  function onFurnitureMaterial(e: Event) {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { material: (e.target as HTMLSelectElement).value });
  }
  function onFurnitureRotation(e: Event) {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { rotation: Number((e.target as HTMLInputElement).value) });
  }
  function resetFurnitureDefaults() {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { color: undefined, width: undefined, depth: undefined, height: undefined, material: undefined });
  }

  // Door distance handlers
  function onDoorDistFromA(e: Event) {
    if (!selectedDoor || !selectedDoorWall) return;
    const newDistFromA = inputToCm(Number((e.target as HTMLInputElement).value));
    const wallLen = calcWallLength(selectedDoorWall);
    const newPosition = Math.max(0.05, Math.min(0.95, newDistFromA / wallLen));
    updateDoor(selectedDoor.id, { position: newPosition });
  }
  
  function onDoorDistFromB(e: Event) {
    if (!selectedDoor || !selectedDoorWall) return;
    const newDistFromB = inputToCm(Number((e.target as HTMLInputElement).value));
    const wallLen = calcWallLength(selectedDoorWall);
    const newPosition = Math.max(0.05, Math.min(0.95, 1 - (newDistFromB / wallLen)));
    updateDoor(selectedDoor.id, { position: newPosition });
  }

  // Window distance handlers
  function onWindowDistFromA(e: Event) {
    if (!selectedWindow || !selectedWindowWall) return;
    const newDistFromA = inputToCm(Number((e.target as HTMLInputElement).value));
    const wallLen = calcWallLength(selectedWindowWall);
    const newPosition = Math.max(0.05, Math.min(0.95, newDistFromA / wallLen));
    updateWindow(selectedWindow.id, { position: newPosition });
  }
  
  function onWindowDistFromB(e: Event) {
    if (!selectedWindow || !selectedWindowWall) return;
    const newDistFromB = inputToCm(Number((e.target as HTMLInputElement).value));
    const wallLen = calcWallLength(selectedWindowWall);
    const newPosition = Math.max(0.05, Math.min(0.95, 1 - (newDistFromB / wallLen)));
    updateWindow(selectedWindow.id, { position: newPosition });
  }
  // Preset colors for rooms and columns
  const roomColorPresets = [
    { name: '白色', color: '#ffffff' },
    { name: '奶油色', color: '#fffdd0' },
    { name: '米色', color: '#f5f5dc' },
    { name: '浅灰色', color: '#d1d5db' },
    { name: '暖灰色', color: '#b8a082' },
    { name: '鼠尾草绿', color: '#d4e2d4' },
    { name: '浅蓝色', color: '#dbeafe' },
    { name: '腮红粉', color: '#f4c2c2' },
    { name: '薰衣草色', color: '#e6e6fa' },
    { name: '黄油黄', color: '#fff8dc' },
  ];

  const columnColorPresets = [
    { name: '白色', color: '#ffffff' },
    { name: '浅灰色', color: '#d1d5db' },
    { name: '混凝土色', color: '#999999' },
    { name: '炭黑色', color: '#374151' },
    { name: '黑色', color: '#000000' },
    { name: '奶油色', color: '#fffdd0' },
    { name: '木色', color: '#8B6914' },
    { name: '青铜色', color: '#cd7f32' },
    { name: '银色', color: '#c0c0c0' },
    { name: '海军蓝', color: '#1e3a8a' },
  ];

  function updateDetectedRoom(id: string, updates: Partial<{ name: string; floorTexture: string; color: string }>) {
    detectedRoomsStore.update(rooms => rooms.map(r => r.id === id ? { ...r, ...updates } : r));
  }

  function onRoomName(e: Event) {
    if (!selectedRoom) return;
    const name = (e.target as HTMLInputElement).value;
    updateRoom(selectedRoom.id, { name });
    updateDetectedRoom(selectedRoom.id, { name });
  }
  function onRoomFloor(texture: string) {
    if (!selectedRoom) return;
    updateRoom(selectedRoom.id, { floorTexture: texture });
    updateDetectedRoom(selectedRoom.id, { floorTexture: texture });
  }
  function onRoomColor(color: string) {
    if (!selectedRoom) return;
    updateRoom(selectedRoom.id, { color });
    updateDetectedRoom(selectedRoom.id, { color });
  }

  const roomTypes = [
    { id: 'living', label: '客厅', icon: '🛋️' },
    { id: 'bedroom', label: '卧室', icon: '🛏️' },
    { id: 'kitchen', label: '厨房', icon: '🍳' },
    { id: 'bathroom', label: '卫生间', icon: '🚿' },
    { id: 'dining', label: '餐厅', icon: '🍽️' },
    { id: 'office', label: '书房', icon: '💻' },
    { id: 'hallway', label: '走廊', icon: '🚶' },
    { id: 'closet', label: '衣帽间', icon: '👔' },
    { id: 'laundry', label: '洗衣房', icon: '🧺' },
    { id: 'garage', label: '车库', icon: '🚗' },
    { id: 'custom', label: '自定义', icon: '✏️' },
  ];

  function onRoomType(e: Event) {
    if (!selectedRoom) return;
    const typeId = (e.target as HTMLSelectElement).value;
    const rt = roomTypes.find(t => t.id === typeId);
    if (rt && rt.id !== 'custom') {
      updateRoom(selectedRoom.id, { name: rt.label });
      updateDetectedRoom(selectedRoom.id, { name: rt.label });
    }
  }

  let selectedRoomType = $derived(() => {
    if (!selectedRoom) return 'custom';
    const match = roomTypes.find(t => t.label === selectedRoom!.name);
    return match ? match.id : 'custom';
  });

  const floorTexPaths: Record<string, string> = {
    'light-oak': '/textures/floor-light-oak.jpg', 'walnut': '/textures/floor-walnut.jpg',
    'bamboo': '/textures/floor-bamboo.jpg', 'laminate': '/textures/floor-laminate.jpg',
    'ceramic-white': '/textures/floor-tile-white.jpg', 'ceramic-gray': '/textures/floor-tile-gray.jpg',
    'porcelain': '/textures/floor-porcelain.jpg',
    'marble-white': '/textures/floor-marble-white.jpg', 'marble-dark': '/textures/floor-marble-dark.jpg',
    'carpet-beige': '/textures/floor-carpet-beige.jpg', 'carpet-gray': '/textures/floor-carpet-gray.jpg',
    'concrete': '/textures/floor-concrete.jpg', 'slate': '/textures/floor-slate.jpg',
    'vinyl': '/textures/floor-vinyl.jpg',
  };
  const textureGroups = [
    { label: '🪵 木材', ids: ['light-oak', 'walnut', 'bamboo', 'laminate'] },
    { label: '🔲 瓷砖', ids: ['ceramic-white', 'ceramic-gray', 'porcelain', 'vinyl'] },
    { label: '🪨 石材', ids: ['marble-white', 'marble-dark', 'concrete', 'slate'] },
    { label: '🧶 地毯', ids: ['carpet-beige', 'carpet-gray'] },
  ];

  let hasSelection = $derived(!!selectedWall || !!selectedDoor || !!selectedWindow || !!selectedWallArt || !!selectedFurniture || !!selectedRoom || !!selectedStair || !!selectedColumn || !!selectedTextAnnotation || !!selectedWalkthroughPoint || hasBgImage);
</script>

<div class="w-64 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto p-3 fixed right-0 z-40 shadow-lg" class:hidden={!hasSelection} style="top: 48px; bottom: 36px;">
  {#if selectedWall}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-gray-200 rounded flex items-center justify-center text-xs">▭</span>
      墙体属性
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">长度 ({unitLabel()})</span>
        <input type="number" value={displayValue(wallLength)} disabled class="w-full px-2 py-1 border border-gray-200 rounded text-sm bg-gray-50" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">厚度 ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedWall.thickness)} oninput={onWallThickness} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">高度 ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedWall.height)} oninput={onWallHeight} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500">曲线</span>
        <button
          class="px-2 py-0.5 text-xs rounded {selectedWall.curvePoint ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-500 border border-gray-200'}"
          onclick={() => {
            if (selectedWall) {
              if (selectedWall.curvePoint) {
                updateWall(selectedWall.id, { curvePoint: undefined });
              } else {
                // Set curve point to offset midpoint
                const mx = (selectedWall.start.x + selectedWall.end.x) / 2;
                const my = (selectedWall.start.y + selectedWall.end.y) / 2;
                const dx = selectedWall.end.x - selectedWall.start.x;
                const dy = selectedWall.end.y - selectedWall.start.y;
                const len = Math.hypot(dx, dy) || 1;
                updateWall(selectedWall.id, { curvePoint: { x: mx + (-dy / len) * 60, y: my + (dx / len) * 60 } });
              }
            }
          }}
        >
          {selectedWall.curvePoint ? '◆ 开启' : '◇ 关闭'}
        </button>
      </div>
      <!-- Wall Material Tabs: Interior / Exterior -->
      <div>
        <div class="flex border-b border-gray-200 mb-3">
          <button
            class="flex-1 py-1.5 text-xs font-medium border-b-2 transition-colors {wallSideTab === 'interior' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}"
            onclick={() => wallSideTab = 'interior'}
          >内侧</button>
          <button
            class="flex-1 py-1.5 text-xs font-medium border-b-2 transition-colors {wallSideTab === 'exterior' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}"
            onclick={() => wallSideTab = 'exterior'}
          >外侧</button>
        </div>
        {#if wallSideTab === 'interior'}
          {@const sideColor = selectedWall.interiorColor || selectedWall.color}
          {@const sideTex = selectedWall.interiorTexture === 'none' ? undefined : (selectedWall.interiorTexture || selectedWall.texture)}
          <div class="space-y-2">
            <span class="text-xs text-gray-500">颜色</span>
            <div class="grid grid-cols-6 gap-1.5">
              {#each wallColors as wc}
                <button
                  class="w-7 h-7 rounded-md border-2 hover:border-gray-300 transition-colors {sideColor === wc.color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
                  style="background-color: {wc.color}"
                  title={localizedWallName(wc.id, wc.name)}
                  onclick={() => { if (selectedWall) updateWall(selectedWall.id, { interiorColor: wc.color }); }}
                ></button>
              {/each}
            </div>
            <label class="flex items-center gap-2">
              <span class="text-xs text-gray-500">自定义：</span>
              <input type="color" value={sideColor} oninput={(e) => { if (selectedWall) updateWall(selectedWall.id, { interiorColor: (e.target as HTMLInputElement).value }); }} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
            </label>
            <span class="text-xs text-gray-500">纹理</span>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                class="p-1.5 rounded-md border-2 text-[10px] text-center h-14 {!sideTex ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}"
                onclick={() => { if (selectedWall) updateWall(selectedWall.id, { interiorTexture: 'none' }); }}
              >无</button>
              {#each wallColors.filter(wc => wc.texture) as wc}
                {@const texPath = resolveAssetUrl(({ 'red-brick': '/textures/brick.jpg', 'exposed-brick': '/textures/exposed-brick.jpg', 'stone': '/textures/stone.jpg', 'wood-panel': '/textures/wood-panel.jpg', 'concrete-block': '/textures/concrete.jpg', 'subway-tile': '/textures/subway-tile.jpg' })[wc.id] ?? '')}
                <button
                  class="rounded-md border-2 text-[10px] text-center h-14 flex flex-col items-center justify-end overflow-hidden relative {sideTex === wc.id ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}"
                  style={texPath ? `background-image: url(${texPath}); background-size: cover; background-position: center;` : `background-color: ${wc.color}20`}
                  onclick={() => { if (selectedWall) updateWall(selectedWall.id, { interiorTexture: wc.id, interiorColor: wc.color }); }}
                ><span class="bg-white/80 backdrop-blur-sm rounded px-1 py-0.5 mb-0.5 text-gray-700">{localizedWallName(wc.id, wc.name)}</span></button>
              {/each}
            </div>
          </div>
        {:else}
          {@const sideColor = selectedWall.exteriorColor || selectedWall.color}
          {@const sideTex = selectedWall.exteriorTexture === 'none' ? undefined : (selectedWall.exteriorTexture || selectedWall.texture)}
          <div class="space-y-2">
            <span class="text-xs text-gray-500">颜色</span>
            <div class="grid grid-cols-6 gap-1.5">
              {#each wallColors as wc}
                <button
                  class="w-7 h-7 rounded-md border-2 hover:border-gray-300 transition-colors {sideColor === wc.color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
                  style="background-color: {wc.color}"
                  title={localizedWallName(wc.id, wc.name)}
                  onclick={() => { if (selectedWall) updateWall(selectedWall.id, { exteriorColor: wc.color }); }}
                ></button>
              {/each}
            </div>
            <label class="flex items-center gap-2">
              <span class="text-xs text-gray-500">自定义：</span>
              <input type="color" value={sideColor} oninput={(e) => { if (selectedWall) updateWall(selectedWall.id, { exteriorColor: (e.target as HTMLInputElement).value }); }} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
            </label>
            <span class="text-xs text-gray-500">纹理</span>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                class="p-1.5 rounded-md border-2 text-[10px] text-center h-14 {!sideTex ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}"
                onclick={() => { if (selectedWall) updateWall(selectedWall.id, { exteriorTexture: 'none' }); }}
              >无</button>
              {#each wallColors.filter(wc => wc.texture) as wc}
                {@const texPath = resolveAssetUrl(({ 'red-brick': '/textures/brick.jpg', 'exposed-brick': '/textures/exposed-brick.jpg', 'stone': '/textures/stone.jpg', 'wood-panel': '/textures/wood-panel.jpg', 'concrete-block': '/textures/concrete.jpg', 'subway-tile': '/textures/subway-tile.jpg' })[wc.id] ?? '')}
                <button
                  class="rounded-md border-2 text-[10px] text-center h-14 flex flex-col items-center justify-end overflow-hidden relative {sideTex === wc.id ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}"
                  style={texPath ? `background-image: url(${texPath}); background-size: cover; background-position: center;` : `background-color: ${wc.color}20`}
                  onclick={() => { if (selectedWall) updateWall(selectedWall.id, { exteriorTexture: wc.id, exteriorColor: wc.color }); }}
                ><span class="bg-white/80 backdrop-blur-sm rounded px-1 py-0.5 mb-0.5 text-gray-700">{localizedWallName(wc.id, wc.name)}</span></button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

  {:else if selectedDoor}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-amber-100 rounded flex items-center justify-center text-xs">🚪</span>
      门属性
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">宽度 ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedDoor.width)} oninput={onDoorWidth} min="1" class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">距起点 A ({unitLabel()})</span>
        <input type="number" value={displayValue(doorDistFromA)} oninput={onDoorDistFromA} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">距终点 B ({unitLabel()})</span>
        <input type="number" value={displayValue(doorDistFromB)} oninput={onDoorDistFromB} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">高度 ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedDoor.height ?? 210)} oninput={onDoorHeight} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">类型</span>
        <select value={selectedDoor.type} onchange={onDoorType} class="w-full px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="single">单扇门</option>
          <option value="double">双扇门</option>
          <option value="sliding">推拉门</option>
          <option value="french">法式门</option>
          <option value="pocket">口袋门</option>
          <option value="bifold">折叠门</option>
        </select>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">铰链侧</span>
        <div class="flex gap-2">
          <button onclick={() => { if (selectedDoor) updateDoor(selectedDoor.id, { swingDirection: 'left' }); }} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedDoor?.swingDirection === 'left' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">左</button>
          <button onclick={() => { if (selectedDoor) updateDoor(selectedDoor.id, { swingDirection: 'right' }); }} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedDoor?.swingDirection === 'right' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">右</button>
        </div>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">开启方向</span>
        <div class="flex gap-2">
          <button onclick={() => { if (selectedDoor) updateDoor(selectedDoor.id, { flipSide: false }); }} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {!(selectedDoor?.flipSide) ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">向内</button>
          <button onclick={() => { if (selectedDoor) updateDoor(selectedDoor.id, { flipSide: true }); }} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedDoor?.flipSide ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">向外</button>
        </div>
      </label>
    </div>

  {:else if selectedWindow}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-cyan-100 rounded flex items-center justify-center text-xs">🪟</span>
      窗户属性
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">类型</span>
        <select value={selectedWindow.type ?? 'standard'} onchange={onWindowType} class="w-full px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="standard">标准窗</option>
          <option value="fixed">固定窗</option>
          <option value="casement">平开窗</option>
          <option value="sliding">推拉窗</option>
          <option value="bay">凸窗</option>
        </select>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">宽度 ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedWindow.width)} oninput={onWindowWidth} min="1" class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">距起点 A ({unitLabel()})</span>
        <input type="number" value={displayValue(windowDistFromA)} oninput={onWindowDistFromA} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">距终点 B ({unitLabel()})</span>
        <input type="number" value={displayValue(windowDistFromB)} oninput={onWindowDistFromB} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">高度 ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedWindow.height)} oninput={onWindowHeight} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">窗台高度 ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedWindow.sillHeight)} oninput={onWindowSill} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
    </div>

  {:else if selectedWallArt}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-amber-100 rounded flex items-center justify-center text-xs">▣</span>
      壁画属性
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">宽度 ({unitLabel()})</span>
        <input type="number" min="1" value={displayValue(selectedWallArt.width)} oninput={(e) => onWallArtNumber('width', e)} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">高度 ({unitLabel()})</span>
        <input type="number" min="1" value={displayValue(selectedWallArt.height)} oninput={(e) => onWallArtNumber('height', e)} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">底边离地 ({unitLabel()})</span>
        <input type="number" min="0" value={displayValue(selectedWallArt.bottomHeight)} oninput={(e) => onWallArtNumber('bottomHeight', e)} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <div>
        <span class="text-xs text-gray-500">贴合墙面</span>
        <div class="flex gap-2 mt-1">
          <button onclick={() => updateWallArt(selectedWallArt!.id, { side: 'normal' })} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedWallArt.side === 'normal' ? 'bg-amber-100 border-amber-400 text-amber-800' : 'border-gray-200 hover:bg-gray-50'}">正面</button>
          <button onclick={() => updateWallArt(selectedWallArt!.id, { side: 'anti' })} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedWallArt.side === 'anti' ? 'bg-amber-100 border-amber-400 text-amber-800' : 'border-gray-200 hover:bg-gray-50'}">背面</button>
        </div>
      </div>
      <label class="flex items-center gap-2">
        <span class="text-xs text-gray-500">画框颜色</span>
        <input type="color" value={selectedWallArt.color} oninput={(e) => updateWallArt(selectedWallArt!.id, { color: (e.target as HTMLInputElement).value })} class="w-8 h-7 rounded border border-gray-200 cursor-pointer" />
      </label>
      <div class="space-y-2">
        <span class="text-xs text-gray-500">壁画图片</span>
        {#if selectedWallArt.src}
          <img src={selectedWallArt.src} alt="壁画预览" class="w-full h-24 object-cover border border-gray-200 rounded" onerror={() => wallArtSrcError = '图片加载失败，请检查地址或跨域配置'} />
        {/if}
        <input bind:value={wallArtSrcInput} onblur={applyWallArtSrc} placeholder="https://example.com/art.jpg" class="w-full px-2 py-1.5 border border-gray-200 rounded text-xs" />
        <div class="flex gap-2">
          <button onclick={applyWallArtSrc} class="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs hover:bg-gray-50">应用地址</button>
          <button onclick={uploadWallArtImage} class="flex-1 px-2 py-1.5 bg-amber-50 border border-amber-300 text-amber-800 rounded text-xs hover:bg-amber-100">上传图片</button>
          {#if selectedWallArt.src}
            <button onclick={clearWallArtImage} class="px-2 py-1.5 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50">清除</button>
          {/if}
        </div>
        {#if wallArtSrcError}
          <p class="text-[11px] text-red-500">{wallArtSrcError}</p>
        {/if}
      </div>
    </div>

  {:else if selectedFurniture}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-purple-100 rounded flex items-center justify-center text-xs">
        {getCatalogItem(selectedFurniture.catalogId)?.icon ?? '🪑'}
      </span>
      {getCatalogItem(selectedFurniture.catalogId)?.name ?? '家具'} 属性
      <button
        onclick={() => { if (selectedFurniture) toggleFurnitureLock(selectedFurniture.id); }}
        class="ml-auto px-1.5 py-0.5 rounded text-xs border transition-colors {selectedFurniture.locked ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}"
        title={selectedFurniture.locked ? '解锁（Ctrl+L）' : '锁定（Ctrl+L）'}
      >{selectedFurniture.locked ? '🔒 已锁定' : '🔓'}</button>
    </h3>
    <div class="space-y-3">
      <!-- Color -->
      <div>
        <div class="flex items-center gap-1 mb-2">
          <span class="text-xs text-gray-500">颜色</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-400">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </div>
        <div class="grid grid-cols-5 gap-1.5 mb-2">
          {#each ['#ffffff', '#f5f5dc', '#d2b48c', '#daa520', '#8b4513', '#696969', '#191970', '#000000', '#dc143c', '#228b22'] as color}
            <button
              class="w-6 h-6 rounded border-2 hover:border-gray-300 transition-colors {(selectedFurniture.color ?? getCatalogItem(selectedFurniture.catalogId)?.color) === color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
              style="background-color: {color}"
              title="颜色：{color}"
              onclick={() => onFurnitureColor(color)}
            ></button>
          {/each}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">自定义：</span>
          <input 
            type="color" 
            value={selectedFurniture.color ?? getCatalogItem(selectedFurniture.catalogId)?.color ?? '#888888'} 
            oninput={(e) => onFurnitureColor((e.target as HTMLInputElement).value)} 
            class="w-8 h-6 rounded border border-gray-200 cursor-pointer" 
          />
        </div>
      </div>
      
      <!-- Dimensions -->
      <label class="block">
        <span class="text-xs text-gray-500">宽度 ({unitLabel()})</span>
        <input 
          type="number" 
          value={displayValue(selectedFurniture.width ?? getCatalogItem(selectedFurniture.catalogId)?.width ?? 100)} 
          oninput={onFurnitureWidth} min="1"
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">深度 ({unitLabel()})</span>
        <input 
          type="number" 
          value={displayValue(selectedFurniture.depth ?? getCatalogItem(selectedFurniture.catalogId)?.depth ?? 80)} 
          oninput={onFurnitureDepth} min="1"
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">高度 ({unitLabel()})</span>
        <input 
          type="number" 
          value={displayValue(selectedFurniture.height ?? getCatalogItem(selectedFurniture.catalogId)?.height ?? 80)} 
          oninput={onFurnitureHeight} min="1"
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>
      
      <!-- Material -->
      <label class="block">
        <span class="text-xs text-gray-500">材质</span>
        <select 
          value={selectedFurniture.material ?? 'Wood'} 
          onchange={onFurnitureMaterial} 
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm"
        >
          <option value="Wood">木材</option>
          <option value="Metal">金属</option>
          <option value="Fabric">布艺</option>
          <option value="Leather">皮革</option>
          <option value="Glass">玻璃</option>
          <option value="Plastic">塑料</option>
          <option value="Stone">石材</option>
          <option value="Ceramic">陶瓷</option>
        </select>
      </label>
      
      <!-- Rotation -->
      <label class="block">
        <span class="text-xs text-gray-500">旋转（度）</span>
        <input 
          type="number" 
          value={Math.round(selectedFurniture.rotation * 100) / 100} 
          oninput={onFurnitureRotation} 
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>

      <!-- Rotate / Flip controls -->
      <div class="flex gap-1">
        <button
          onclick={() => { if (selectedFurniture) updateFurniture(selectedFurniture.id, { rotation: selectedFurniture.rotation - 90 }); }}
          class="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-colors"
          title="向左旋转 90°"
        >↺ 90°</button>
        <button
          onclick={() => { if (selectedFurniture) updateFurniture(selectedFurniture.id, { rotation: selectedFurniture.rotation + 90 }); }}
          class="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-colors"
          title="向右旋转 90°"
        >↻ 90°</button>
      </div>
      <div class="flex gap-1">
        <button
          onclick={() => { if (selectedFurniture) { const s = selectedFurniture.scale; updateFurniture(selectedFurniture.id, { scale: { x: s.x * -1, y: s.y, z: s.z } }); } }}
          class="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-colors"
          title="水平翻转"
        >↔ 水平翻转</button>
        <button
          onclick={() => { if (selectedFurniture) { const s = selectedFurniture.scale; updateFurniture(selectedFurniture.id, { scale: { x: s.x, y: s.y * -1, z: s.z } }); } }}
          class="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-colors"
          title="垂直翻转"
        >↕ 垂直翻转</button>
      </div>
      
      <!-- Reset button -->
      <button
        onclick={resetFurnitureDefaults}
        class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        重置为默认值
      </button>
    </div>

  {:else if selectedRoom}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-green-100 rounded flex items-center justify-center text-xs">⬜</span>
      房间属性
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">房间类型</span>
        <select value={selectedRoomType()} onchange={onRoomType} class="w-full px-2 py-1 border border-gray-200 rounded text-sm">
          {#each roomTypes as rt}
            <option value={rt.id}>{rt.icon} {rt.label}</option>
          {/each}
        </select>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">房间名称</span>
        <input type="text" value={selectedRoom.name} oninput={onRoomName} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">类别</span>
        <select value={selectedRoom.roomType ?? 'indoor'} onchange={(e) => { if (selectedRoom) { const v = (e.target as HTMLSelectElement).value as RoomCategory; updateRoom(selectedRoom.id, { roomType: v }); updateDetectedRoom(selectedRoom.id, { roomType: v } as any); } }} class="w-full px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="indoor">🏠 室内</option>
          <option value="outdoor">🌳 室外</option>
          <option value="garage">🚗 车库</option>
          <option value="utility">🔧 功能间</option>
        </select>
      </label>
      <div>
        <span class="text-xs text-gray-500">面积</span>
        <p class="text-sm text-gray-700">{formatArea(selectedRoom.area, settings.units)}</p>
      </div>
      <!-- Room Color -->
      <div>
        <span class="text-xs text-gray-500 mb-1.5 block">房间颜色</span>
        <div class="grid grid-cols-5 gap-1.5 mb-2">
          {#each roomColorPresets as preset}
            <button
              class="w-7 h-7 rounded-md border-2 hover:border-gray-300 transition-colors {selectedRoom.color === preset.color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
              style="background-color: {preset.color}"
              title={preset.name}
              onclick={() => onRoomColor(preset.color)}
            ></button>
          {/each}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">自定义：</span>
          <input type="color" value={selectedRoom.color ?? '#ffffff'} oninput={(e) => onRoomColor((e.target as HTMLInputElement).value)} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
        </div>
      </div>
      <div>
        <div class="flex items-center gap-1 mb-2">
          <span class="text-xs text-gray-500">地板材质</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-400">
            <path d="M3 3h18v18H3z"/>
            <path d="M8 8h8v8H8z"/>
          </svg>
        </div>
        <div class="space-y-3">
          {#each textureGroups as group}
            <div>
              <span class="text-xs font-medium text-gray-600 mb-1.5 block">{group.label}</span>
              <div class="grid grid-cols-3 gap-1.5">
                {#each group.ids as matId}
                  {@const mat = floorMaterials.find(m => m.id === matId)}
                  {#if mat}
                    {@const texPath = floorTexPaths[mat.id] ?? ''}
                    <button
                      class="p-1 rounded-lg border-2 hover:border-gray-300 transition-all text-xs {selectedRoom.floorTexture === mat.id ? 'border-blue-500 ring-2 ring-blue-200 shadow-sm' : 'border-gray-200'}"
                      title={localizedMaterialName(mat.id, mat.name)}
                      onclick={() => onRoomFloor(mat.id)}
                    >
                      <div
                        class="w-full h-12 rounded-md mb-1 overflow-hidden"
                        style={texPath ? `background-image: url(${texPath}); background-size: cover; background-position: center;` : `background-color: ${mat.color}`}
                      ></div>
                      <div class="text-center leading-3 text-[10px] text-gray-600 truncate">{localizedMaterialName(mat.id, mat.name)}</div>
                    </button>
                  {/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

  {:else if selectedStair}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-gray-200 rounded flex items-center justify-center text-xs">🪜</span>
      楼梯属性
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">类型</span>
        <select value={selectedStair.stairType || 'straight'} onchange={(e) => updateStair(selectedStair!.id, { stairType: (e.target as HTMLSelectElement).value as any })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="straight">直梯</option>
          <option value="l-shaped">L 形</option>
          <option value="u-shaped">U 形</option>
          <option value="spiral">螺旋梯</option>
        </select>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">宽度 ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedStair.width)} oninput={(e) => updateStair(selectedStair!.id, { width: inputToCm(Number((e.target as HTMLInputElement).value)) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">深度 ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedStair.depth)} oninput={(e) => updateStair(selectedStair!.id, { depth: inputToCm(Number((e.target as HTMLInputElement).value)) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">踏步数</span>
        <input type="number" value={selectedStair.riserCount} min="3" max="30" oninput={(e) => updateStair(selectedStair!.id, { riserCount: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">方向</span>
        <div class="flex gap-2">
          <button onclick={() => updateStair(selectedStair!.id, { direction: 'up' })} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedStair.direction === 'up' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">向上 ↑</button>
          <button onclick={() => updateStair(selectedStair!.id, { direction: 'down' })} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedStair.direction === 'down' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">向下 ↓</button>
        </div>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">旋转（度）</span>
        <input type="number" value={selectedStair.rotation} oninput={(e) => updateStair(selectedStair!.id, { rotation: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
    </div>
  {:else if selectedColumn}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-gray-200 rounded flex items-center justify-center text-xs">🏛️</span>
      柱属性
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">形状</span>
        <div class="flex gap-2">
          <button onclick={() => updateColumn(selectedColumn!.id, { shape: 'round' })} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedColumn.shape === 'round' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">⭕ 圆形</button>
          <button onclick={() => updateColumn(selectedColumn!.id, { shape: 'square' })} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedColumn.shape === 'square' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">⬜ 方形</button>
        </div>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">{selectedColumn.shape === 'round' ? '直径' : '边长'} ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedColumn.diameter)} min="10" max="200" oninput={(e) => updateColumn(selectedColumn!.id, { diameter: inputToCm(Number((e.target as HTMLInputElement).value)) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">高度 ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedColumn.height)} min="50" max="1000" oninput={(e) => updateColumn(selectedColumn!.id, { height: inputToCm(Number((e.target as HTMLInputElement).value)) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <div>
        <span class="text-xs text-gray-500 mb-1.5 block">颜色</span>
        <div class="grid grid-cols-5 gap-1.5 mb-2">
          {#each columnColorPresets as preset}
            <button
              class="w-7 h-7 rounded-md border-2 hover:border-gray-300 transition-colors {selectedColumn.color === preset.color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
              style="background-color: {preset.color}"
              title={preset.name}
              onclick={() => updateColumn(selectedColumn!.id, { color: preset.color })}
            ></button>
          {/each}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">自定义：</span>
          <input type="color" value={selectedColumn.color} oninput={(e) => updateColumn(selectedColumn!.id, { color: (e.target as HTMLInputElement).value })} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
        </div>
      </div>
      {#if selectedColumn.shape === 'square'}
        <label class="block">
          <span class="text-xs text-gray-500">旋转（度）</span>
          <input type="number" value={selectedColumn.rotation} oninput={(e) => updateColumn(selectedColumn!.id, { rotation: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
        </label>
      {/if}
    </div>
  {:else if selectedWalkthroughPoint}
    <div class="space-y-3">
      <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span class="w-6 h-6 bg-violet-100 rounded flex items-center justify-center text-xs">●</span>
        漫游标点
      </h3>
      <label class="block">
        <span class="text-xs text-gray-500">名称</span>
        <input type="text" value={selectedWalkthroughPoint.name ?? ''} oninput={(e) => updateWalkthroughPoint(selectedWalkthroughPoint!.id, { name: (e.target as HTMLInputElement).value || undefined })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">停留时间（秒）</span>
        <input type="number" min="0" step="0.5" value={selectedWalkthroughPoint.dwellTime ?? 0} oninput={(e) => updateWalkthroughPoint(selectedWalkthroughPoint!.id, { dwellTime: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="text-xs text-gray-500">X</span>
          <input type="number" value={Math.round(selectedWalkthroughPoint.x)} oninput={(e) => updateWalkthroughPoint(selectedWalkthroughPoint!.id, { x: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
        </label>
        <label class="block">
          <span class="text-xs text-gray-500">Y</span>
          <input type="number" value={Math.round(selectedWalkthroughPoint.y)} oninput={(e) => updateWalkthroughPoint(selectedWalkthroughPoint!.id, { y: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
        </label>
      </div>
      <button onclick={addPointAfterSelected} class="w-full px-3 py-2 rounded bg-violet-600 text-white text-sm hover:bg-violet-700 transition-colors">
        在此标点后添加新标点
      </button>
      <p class="text-[11px] text-gray-400">若存在下一标点，新标点将插入两点中间；否则添加到当前标点右侧。可继续拖动调整路径。</p>
    </div>
  {:else if selectedTextAnnotation}
    <div class="space-y-3">
      <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span class="w-6 h-6 bg-emerald-100 rounded flex items-center justify-center text-xs">🏷️</span>
        文本标注
      </h3>
      <label class="block">
        <span class="text-xs text-gray-500">文本</span>
        <input type="text" value={selectedTextAnnotation.text} oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { text: (e.target as HTMLInputElement).value })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">字号</span>
        <input type="number" value={selectedTextAnnotation.fontSize} min="8" max="72" oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { fontSize: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">颜色</span>
        <div class="flex items-center gap-2">
          <input type="color" value={selectedTextAnnotation.color} oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { color: (e.target as HTMLInputElement).value })} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
          <span class="text-xs text-gray-400">{selectedTextAnnotation.color}</span>
        </div>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Rotation (°)</span>
        <input type="number" value={selectedTextAnnotation.rotation} oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { rotation: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">X</span>
        <input type="number" value={Math.round(selectedTextAnnotation.x)} oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { x: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Y</span>
        <input type="number" value={Math.round(selectedTextAnnotation.y)} oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { y: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
    </div>
  {/if}

  <!-- Background Image Controls (always show when bg image exists) -->
  {#if hasBgImage && floor?.backgroundImage}
    <div class="mt-4 pt-3 border-t border-gray-200">
      <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span class="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-xs">🖼️</span>
        背景图片
      </h3>
      <div class="space-y-3">
        <label class="block">
          <span class="text-xs text-gray-500">不透明度</span>
          <input type="range" min="0.05" max="1" step="0.05" value={floor.backgroundImage.opacity} oninput={(e) => updateBackgroundImage({ opacity: Number((e.target as HTMLInputElement).value) })} class="w-full" />
        </label>
        <label class="block">
          <span class="text-xs text-gray-500">缩放</span>
          <input type="range" min="0.1" max="5" step="0.05" value={floor.backgroundImage.scale} oninput={(e) => updateBackgroundImage({ scale: Number((e.target as HTMLInputElement).value) })} class="w-full" />
        </label>
        <label class="block">
          <span class="text-xs text-gray-500">旋转</span>
          <input type="number" value={floor.backgroundImage.rotation} oninput={(e) => updateBackgroundImage({ rotation: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
        </label>
        <div class="flex gap-2">
          <button
            onclick={() => updateBackgroundImage({ locked: !floor!.backgroundImage!.locked })}
            class="flex-1 px-2 py-1.5 border rounded text-sm {floor.backgroundImage.locked ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-gray-200 hover:bg-gray-50'}"
          >{floor.backgroundImage.locked ? '🔒 已锁定' : '🔓 未锁定'}</button>
          <button
            onclick={() => { calibrationPoints.set([]); calibrationMode.set(true); }}
            class="flex-1 px-2 py-1.5 border rounded text-sm border-gray-200 hover:bg-gray-50"
          >📏 设置比例</button>
        </div>
        <button
          onclick={() => setBackgroundImage(undefined)}
          class="w-full px-2 py-1.5 border border-red-300 rounded text-sm text-red-600 hover:bg-red-50"
        >移除图片</button>
      </div>
    </div>
  {/if}
</div>
