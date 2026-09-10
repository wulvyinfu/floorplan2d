// Onboarding tooltips — track which tips have been shown
const STORAGE_KEY = 'o3d_tips_seen';

export type TipId = 'first-wall' | 'first-furniture' | 'first-export' | 'first-door';

export const TIP_MESSAGES: Record<TipId, string> = {
  'first-wall': '做得好！连接墙体即可创建房间。完成后按 Esc 键。',
  'first-furniture': '拖动即可移动，按 R 键旋转，也可以使用控制点调整大小。',
  'first-export': '平面图已准备就绪！试试 SVG 矢量图形或 PDF 打印文件。',
  'first-door': '点击墙体即可放置门窗。',
};

function getSeenTips(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persist(seen: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

/** Returns true if the tip hasn't been shown yet */
export function showTip(tipId: TipId): boolean {
  return !getSeenTips().has(tipId);
}

/** Mark a tip as seen so it won't show again */
export function markTipSeen(tipId: TipId): void {
  const seen = getSeenTips();
  seen.add(tipId);
  persist(seen);
}

// Svelte 5 reactive state for the currently active tip
let _activeTip = $state<{ id: TipId; x: number; y: number } | null>(null);

export function getActiveTip() { return _activeTip; }

/** Trigger a tip at a screen position. No-ops if already seen. */
export function triggerTip(tipId: TipId, x: number, y: number) {
  if (!showTip(tipId)) return;
  _activeTip = { id: tipId, x, y };
}

/** Dismiss the current tip */
export function dismissTip() {
  if (_activeTip) {
    markTipSeen(_activeTip.id);
    _activeTip = null;
  }
}
