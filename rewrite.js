
const {JSDOM} = require('jsdom');
const rollup = require('rollup');

/**
 * Rewrites the given HTML module to a single JS module.
 *
 * The rewrite doesn't require knowledge of the script's location or any other
 * context.
 */
module.exports = async (source) => {
  source = source.toString();  // support Buffer

  const parsed = new JSDOM(source);
  const modules = parsed.window.document.querySelectorAll('script[type="module"]');

  const docSource = `const template = document.createElement('template');
const moduleDocument = document.implementation.createHTMLDocument();
template.innerHTML = \`${source.replace(/(^|[^`\\]*)\`/g, '$1\\`')}\`;
moduleDocument.body.appendChild(template.content);
export default moduleDocument;`;

  if (!modules.length) {
    // short-circuit HTML module, just DOM
    return docSource;
  }

  const virtualSourceMap = {};
  const pushVirtualSource = (source) => {
    const j = Object.keys(virtualSourceMap).length;
    const key = `\0virtual:${j}`;
    virtualSourceMap[key] = source;
    return key;
  };

  // This only needs to be done once, because Rollup doesn't try to interpolate import.meta.
  // TODO(samthor): We could eval() to create `import.meta` if this is a module browser that doesn't support it.
  // TODO(samthor): Further build tools won't respect the value etc.
  const extendedDocSource = `${docSource}
import.meta.document = moduleDocument;
`;

  const docImport = pushVirtualSource(extendedDocSource);
  const imports = [];

  // Convert every `<script type="module">` into an import for our entrypoint. This either just
  // imports directly (via `src=""`) or creates a virtual file (for inline scripts).
  // nb. template.content won't _run_ `<script>` tags so we don't need to remove them.
  Array.from(modules).forEach((m) => {
    if (m.src) {
      let src = m.src;
      // `<script type="module" src="foo.js">` is allowed, but make it relative for imports
      if (!/^\.{0,2}\/$/.exec(src)) {
        src = `./${src}`;
      }
      imports.push({src});
      return;
    }

    const partialImport = pushVirtualSource(m.textContent);
    imports.push({src: partialImport, reexport: true});
  });

  const importStrings = imports.map(({src, reexport}) => {
    if (reexport) {
      return `export * from '${src}'`;
    }
    const escaped = src.replace(/\'/g, '\'');
    return `import '${escaped}';`;
  });
  const entrySource = `export { default } from '${docImport}';\n${importStrings.join('\n')}`;
  const entryImport = pushVirtualSource(entrySource);

  const virtualPlugin = {
    resolveId(importee, importer) {
      // Don't actually resolve any importees, but mark random imports as external.
      return {
        id: importee,
        external: !(importee in virtualSourceMap),
      };
    },
    load(id) {
      return virtualSourceMap[id];
    },
  };

  const bundle = await rollup.rollup({
    input: entryImport,
    plugins: [virtualPlugin],
  });

  const out = await bundle.generate({
    name: entryImport,
    format: 'es',
    sourcemap: true,
    treeshake: false,  // don't get smart with me
  });

  if (out.output.length !== 1) {
    throw new Error(`unexpected Rollup length: ${out.output.length}`);
  }
  const first = out.output[0];
  return first.code;
};

