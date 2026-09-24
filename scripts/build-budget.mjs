const TAG_PATTERN = /<(script|link)\b[^>]*>/gi;
const ATTRIBUTE_PATTERN =
  /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/g;

const parseAttributes = (tag) => {
  const attributes = new Map();

  for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
    const [, rawName, doubleQuoted, singleQuoted, unquoted] = match;
    const name = rawName?.toLowerCase();

    if (!name || name === "script" || name === "link") {
      continue;
    }

    attributes.set(
      name,
      doubleQuoted ?? singleQuoted ?? unquoted ?? "",
    );
  }

  return attributes;
};

export const toDistAssetPath = (assetUrl) => {
  if (typeof assetUrl !== "string") {
    return null;
  }

  const trimmed = assetUrl.trim();

  if (
    trimmed.length === 0 ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("//")
  ) {
    return null;
  }

  const pathname = trimmed.split(/[?#]/, 1)[0]?.replaceAll("\\", "/") ?? "";

  if (pathname.startsWith("./assets/")) {
    return pathname.slice(2);
  }

  if (pathname.startsWith("assets/")) {
    return pathname;
  }

  const assetsMarker = "/assets/";
  const markerIndex = pathname.lastIndexOf(assetsMarker);

  if (markerIndex >= 0) {
    return `assets/${pathname.slice(markerIndex + assetsMarker.length)}`;
  }

  return null;
};

export const extractInitialAssetPaths = (html) => {
  const js = new Set();
  const css = new Set();

  for (const match of html.matchAll(TAG_PATTERN)) {
    const [tag, rawTagName] = match;
    const tagName = rawTagName.toLowerCase();
    const attributes = parseAttributes(tag);

    if (tagName === "script") {
      if ((attributes.get("type") ?? "").toLowerCase() !== "module") {
        continue;
      }

      const path = toDistAssetPath(attributes.get("src"));

      if (path?.endsWith(".js")) {
        js.add(path);
      }

      continue;
    }

    const relTokens = new Set(
      (attributes.get("rel") ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    );
    const path = toDistAssetPath(attributes.get("href"));

    if (!path) {
      continue;
    }

    if (relTokens.has("modulepreload") && path.endsWith(".js")) {
      js.add(path);
    }

    if (relTokens.has("stylesheet") && path.endsWith(".css")) {
      css.add(path);
    }
  }

  return {
    js: [...js].sort(),
    css: [...css].sort(),
  };
};
