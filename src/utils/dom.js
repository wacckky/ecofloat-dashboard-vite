export const $ = (id) => document.getElementById(id);
export function set(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}
