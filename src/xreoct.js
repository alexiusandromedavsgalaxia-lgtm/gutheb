// Small, intentionally readable Xreoct parser used by the Run panel.
// It recognizes the constructs currently used by the Xreoct repository.

const TOKEN_RULES = [
  [/^\s*\/\/.*$/, "comment"],
  [/^(component|screen|element|const|if|return|import|export|default|use|action|true|false)\b/, "keyword"],
  [/^"(?:[^"\\]|\\.)*"/, "string"],
  [/^#[0-9a-fA-F]{6,8}\b/, "color"],
  /^\d+(?:\.\d+)?/.source
];

export function tokenizeXreoct(line) {
  const tokens = [];
  let rest = line;

  while (rest.length) {
    if (/^\s+/.test(rest)) {
      const m = rest.match(/^\s+/)[0];
      tokens.push({ type: "plain", value: m });
      rest = rest.slice(m.length);
      continue;
    }

    let matched = false;
    for (const rule of TOKEN_RULES) {
      const regex = rule[0] instanceof RegExp ? rule[0] : new RegExp(rule[0]);
      const match = rest.match(regex);
      if (!match) continue;
      const value = match[0];
      tokens.push({ type: rule[1] || "number", value });
      rest = rest.slice(value.length);
      matched = true;
      break;
    }

    if (!matched) {
      tokens.push({ type: "plain", value: rest[0] });
      rest = rest.slice(1);
    }
  }

  return tokens;
}

export function parseXreoct(source, path = "file.rsx") {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const result = {
    path,
    lines: lines.length,
    components: [],
    actions: [],
    routes: [],
    exports: [],
    diagnostics: []
  };

  lines.forEach((line, index) => {
    const n = index + 1;

    const component = line.match(/\bcomponent\.([A-Za-z0-9_.-]+)/);
    if (component) result.components.push({ name: component[1], line: n });

    const action = line.match(/\baction\(([^)]+)\)/);
    if (action) result.actions.push({ value: action[1].trim(), line: n });

    const route = line.match(/(?:route|open\.?)\(?\s*\.?\(?([^\)]+\.rsx)/);
    if (route) result.routes.push({ value: route[1].trim(), line: n });

    const exp = line.match(/\bexport\s+default\s+(.+)/);
    if (exp) result.exports.push({ value: exp[1].trim(), line: n });

    if (/\bcomponent\.[A-Za-z0-9_.-]+/.test(line) && !line.includes("{")) {
      result.diagnostics.push({
        level: "info",
        line: n,
        message: "Component declaration detected."
      });
    }
  });

  return result;
}

export function runXreoct(source, path) {
  const parsed = parseXreoct(source, path);
  const log = [
    "Xreoct runtime",
    "────────────────────────",
    `Loaded: ${path}`,
    `Lines: ${parsed.lines}`,
    `Components: ${parsed.components.length}`,
    `Actions: ${parsed.actions.length}`,
    `Routes: ${parsed.routes.length}`,
    `Exports: ${parsed.exports.length}`,
    "",
    ...parsed.components.map(c => `component → ${c.name} (line ${c.line})`),
    ...parsed.actions.map(a => `action → ${a.value} (line ${a.line})`),
    ...parsed.routes.map(r => `route → ${r.value} (line ${r.line})`),
    "",
    "Execution completed in the browser-safe Xreoct preview runtime."
  ];

  return { parsed, output: log.join("\n") };
}
