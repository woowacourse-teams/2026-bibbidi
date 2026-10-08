const SYS_ENV_PATTERN = /sys\.env\(\s*"([^"]+)"\s*\)/g;
const SERVICE_INDENT = 2;
const SECTION_INDENT = 4;
const KEY_INDENT = 6;

export function extractRequiredNames(alloyConfig: string): string[] {
  const names = new Set<string>();
  for (const match of alloyConfig.matchAll(SYS_ENV_PATTERN)) names.add(match[1]);
  return [...names];
}

export function extractDeclaredNames(composeText: string, service: string): string[] {
  const names: string[] = [];
  let inService = false;
  let inEnvironment = false;

  for (const line of composeText.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;
    const content = line.trim();

    if (indent <= SERVICE_INDENT) {
      inService = indent === SERVICE_INDENT && content === `${service}:`;
      inEnvironment = false;
      continue;
    }
    if (!inService) continue;

    if (indent === SECTION_INDENT) {
      inEnvironment = content === "environment:";
      continue;
    }
    if (inEnvironment && indent === KEY_INDENT) {
      const key = content.split(":")[0];
      if (key) names.push(key);
    }
  }

  return names;
}

export function findUndeclaredNames(required: string[], declared: string[]): string[] {
  const declaredNames = new Set(declared);
  return required.filter((name) => !declaredNames.has(name));
}
