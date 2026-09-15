import { createHash } from 'node:crypto';
import path from 'node:path';

export function assetVersion(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

// Change local CSS/JS URLs only when their contents change, not on every build.
export function versionAssets(files) {
  const versions = new Map([...files].filter(([name]) => /^assets\/(?:css|js)\/.+\.(?:css|js)$/.test(name)).map(([name, value]) => [name, assetVersion(value)]));
  for (const [name, value] of files) {
    if (!name.endsWith('.html')) continue;
    const html = value.toString().replace(/<(?:link|script)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi, tag => tag.replace(/(\s(?:href|src)\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi, (attribute, prefix, double, single, bare) => {
      const ref = double ?? single ?? bare;
      if (!/^(?:\.\.?\/)?assets\/(?:css|js)\/[a-z0-9_./-]+\.(?:css|js)$/.test(ref)) return attribute;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), ref));
      const version = versions.get(target);
      return version ? `${prefix}"${ref}?v=${version}"` : attribute;
    }));
    files.set(name, html);
  }
}
