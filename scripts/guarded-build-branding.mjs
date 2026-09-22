import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const LEGACY = Object.freeze({
  title: "<title>Pulse Counter — Interaction Lab</title>",
  description:
    'content="Pulse Counter — a polished React micro-interaction case study focused on motion, accessibility and proportional architecture."',
  theme: '<meta name="theme-color" content="#070810" />',
  favicon: '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
});

const SHOPPING_MARK_FILE = "shopping-mark.svg";

const replaceRequired = (html, from, to, label) => {
  if (!html.includes(from)) {
    throw new Error(
      `Guarded build branding could not find expected ${label}: ${from}`,
    );
  }

  return html.replace(from, to);
};

export const applyGuardedBuildBrandingHtml = (
  original,
  {
    title,
    description,
    applicationName = "Shopping Budget Companion",
    themeColor = "#f5f3ee",
  },
) => {
  let next = original;

  next = replaceRequired(
    next,
    LEGACY.title,
    `<title>${title}</title>`,
    "title",
  );
  next = replaceRequired(
    next,
    LEGACY.description,
    `content="${description}"`,
    "description",
  );
  next = replaceRequired(
    next,
    LEGACY.theme,
    [
      `<meta name="theme-color" content="${themeColor}" />`,
      '<meta name="robots" content="noindex,nofollow,noarchive" />',
      `<meta name="application-name" content="${applicationName}" />`,
    ].join("\n    "),
    "theme metadata",
  );
  next = replaceRequired(
    next,
    LEGACY.favicon,
    `<link rel="icon" type="image/svg+xml" href="./${SHOPPING_MARK_FILE}" />`,
    "favicon",
  );

  if (
    !next.includes(`<title>${title}</title>`) ||
    !next.includes(`content="${description}"`) ||
    !next.includes('name="robots" content="noindex,nofollow,noarchive"') ||
    !next.includes(
      `name="application-name" content="${applicationName}"`,
    ) ||
    !next.includes(`href="./${SHOPPING_MARK_FILE}"`) ||
    next.includes("Pulse Counter — Interaction Lab")
  ) {
    throw new Error("Guarded build branding verification failed");
  }

  return next;
};

export const prepareGuardedBuildBranding = async ({
  target,
  title,
  description,
  applicationName,
  themeColor,
}) => {
  const resolvedTarget = resolve(target);
  const original = await readFile(resolvedTarget, "utf8");
  const next = applyGuardedBuildBrandingHtml(original, {
    title,
    description,
    ...(applicationName === undefined ? {} : { applicationName }),
    ...(themeColor === undefined ? {} : { themeColor }),
  });

  await access(resolve(dirname(resolvedTarget), SHOPPING_MARK_FILE));
  await writeFile(resolvedTarget, next, "utf8");
};
