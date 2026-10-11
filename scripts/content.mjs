// Template helpers. Text values are always escaped; templates only accept known {{placeholders}}.
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function fillTemplate(template, values) {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`템플릿 값이 없습니다: ${key}`);
    return values[key];
  });
}
