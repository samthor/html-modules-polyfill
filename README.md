Rewrites HTML Modules, [as proposed here](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/html-modules-explainer.md), to equivalent JS modules.
This can enable use of HTML Modules inside a build system or in a development environment: as of August 2019, no browser has a native implementation.

# Usage

This is published on NPM as [html-modules-polyfill](https://www.npmjs.com/package/html-modules-polyfill).
The package exports a single method, `rewrite`.

```js
const rewrite = require('html-modules-polyfill');

async function build() {
  const htmlModuleSource = `
<div id="blogPost">
    <p>Content...</p>
</div>
<script type="module">
    let blogPost = import.meta.document.querySelector("#blogPost");
    export {blogPost}
</script>
  `;
  const rewritten = await rewrite(htmlSource);
  // do something
}
```

## Intended Use

This single method should be used as part of a Rollup plugin, or perhaps to rewrite HTML files when fetched as modules.
Run `./demo/rewrite.js` to see the output for [the demo module](demo/module.html).

## Example Output

The output of the example above will be a single file (regardless of the number of top-level scripts used) and look like:

```js
const template = document.createElement('template');
const moduleDocument = document.implementation.createHTMLDocument();
template.innerHTML = `
<div id="blogPost">
    <p>Content...</p>
</div>
<script type="module">
    let blogPost = import.meta.document.querySelector("#blogPost");
    export {blogPost}
</script>
  `;
moduleDocument.body.appendChild(template.content);
import.meta.document = moduleDocument;

let blogPost = import.meta.document.querySelector("#blogPost");

export default moduleDocument;
export { blogPost };
```

# Implementation

The rewriter uses JSDOM and Rollup to find and concatenate every `<script type="module">` found in the passed source, as well as providing the top-level `import.meta.document` based on the HTML itself.
It does not use Rollup in a _general-purpose_ way: further imports are left alone.

Notably, the generated HTML still includes the source `<script type="module">`: it's not run inside a `<template>`.

## Explanation

We convert every found `<script type="module">` to a "virtual" import that is imported by a single, virtual entrypoint that we dynamically generate, which also includes the HTML template itself.
This entrypoint script _re-exports_ everything from each module, in order.
We then use Rollup to merge _just_ these virtual imports and the top-level script.

External scripts are imported without re-exporting: i.e., `<script type="module src="foo.js"></script>` becomes `import './foo.js';`.

# Further Work

Modern browsers provide a unique `import.meta` to every JS module, so modifying _a single file_ by adding a `.document` property at run-time is fine.

However, since most further build tools don't understand `import.meta.document` at all, rewritten HTML Modules that are later concatenated together will override each other's document.
We should add a flag to the rewriter to use a local variable name instead (and rewrite usage) so that Rollup and other tools can play nice.

Additionally, there's no source map support.
The simplest approach would be to place the source of each virtual file on the same line as where it was found inside the source HTML, and then rewrite Rollup's generated mappings (in the bundle) to point back to the real HTML, rather than the virtual file.
