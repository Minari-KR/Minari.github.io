// Read the attributes used by our static templates; this is not a general HTML sanitizer.
function decodeAttribute(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, key) => {
    if (!key.startsWith('#')) return named[key.toLowerCase()];
    const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
  });
}

export function readHtmlTags(html) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  return [...clean.matchAll(/<([a-z][a-z0-9-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)].map(match => {
    const attributes = Object.create(null);
    for (const attr of match[2].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const name = attr[1].toLowerCase();
      if (Object.hasOwn(attributes, name)) throw new Error(`중복 HTML 속성: ${name}`);
      attributes[name] = decodeAttribute(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    return { tag: match[1].toLowerCase(), attributes };
  });
}

const referenceAttributes = {
  a: ['href'], link: ['href'], script: ['src'], img: ['src', 'data-full-src'], iframe: ['src'],
  option: ['value'], video: ['src', 'poster'], source: ['src'], track: ['src']
};

export function* resourceReferences(tags) {
  for (const { tag, attributes } of tags) {
    if (tag === 'meta' && ['og:image', 'og:url', 'twitter:image'].includes(attributes.property ?? attributes.name)) {
      yield { tag, attributes, attribute: 'content', ref: attributes.content ?? '' };
    }
    for (const attribute of referenceAttributes[tag] ?? []) {
      if (Object.hasOwn(attributes, attribute)) yield { tag, attributes, attribute, ref: attributes[attribute] };
    }
  }
}
