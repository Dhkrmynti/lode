const numberFormat = new Intl.NumberFormat('en-US');

export const formatNumber = (value) => numberFormat.format(value);

// Emission rates: one decimal for large values, more as they shrink after halvings.
export const formatRate = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: value >= 10 ? 1 : 4 }).format(value);

// LODE amounts: two decimals, or four for amounts under 1 so small payouts don't show as 0.00.
export const formatLode = (value) => {
  const digits = Math.abs(value) > 0 && Math.abs(value) < 1 ? 4 : 2;
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

// Seconds left as m:ss.
export const countdown = (ms) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function formatHashrate(hashesPerSecond) {
  const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s'];
  let value = hashesPerSecond;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return { value: value.toFixed(value >= 100 || unit === 0 ? 0 : 2), unit: units[unit] };
}

export function timeAgo(timestamp) {
  if (!timestamp) return 'never';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

let toastTimer;
export function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast('Copied to clipboard');
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Animates a number from its previous value to the new one.
export function countUp(element, target, format = (value) => formatNumber(Math.round(value)), durationMs = 1400) {
  const from = Number(element.dataset.value ?? 0);
  element.dataset.value = target;
  if (from === target || prefersReducedMotion()) {
    element.innerHTML = format(target);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - start) / durationMs);
    const eased = 1 - (1 - progress) ** 4;
    element.innerHTML = format(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
