Rewrites HTML Modules, [as proposed here](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/html-modules-explainer.md), to equivalent JS modules.
This can enable use of HTML Modules inside a build system or in a development environment: as of August 2019, no browser has a native implementation.

# Why

HTML Modules are an interesting future proposal that let you wrap up script and template HTML easily (because HTML from a HTML Module is not automatically added to your global page), rather than having to create your own `<template>` tags.
Inside a HTML Module, you can access the current scoped HTML with `import.meta.document`: see below for an example of exporting a chunk of HTML.

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
  // do something with generated source (e.g., use as output from Rollup plugin)
}
```

## Intended Use

This single method should be used as part of a Rollup plugin, or perhaps to dynamically rewrite HTML files when fetched as modules.
If you check out the repository, run `./demo/rewrite.js` to see the output for [the demo module](demo/module.html).

## Example Output

The output of the example above will be a single file (regardless of the number of top-level `<script>` tags used) and look like:

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
It does not use Rollup in a _general-purpose_ way: if you import something else, 

Notably, the generated HTML still includes the source `<script type="module">` tags.

## Explanation

We convert every found `<script type="module">` to a "virtual" import that is imported by a single, virtual entrypoint that we dynamically generate, which also includes the HTML template itself.
This entrypoint script _re-exports_ everything from each module, in order.
We then use Rollup to merge _just_ these virtual imports and the top-level script.

External scripts are imported without re-exporting: i.e., `<script type="module" src="foo.js"></script>` becomes `import './foo.js';`.

# Further Work

Modern browsers provide a unique `import.meta` to every JS module, so adding `.document` property at run-time within a single module is fine.

However, since most further build tools don't understand `import.meta.document` at all (although you can write [a plugin for Rollup](https://github.com/rollup/rollup/pull/2785) which does), rewritten HTML Modules that are later bundled together will probably override each other's document.
We should add a flag to the rewriter to use a local variable name instead (and rewrite usage) so that Rollup and other tools can play nice.

Additionally, there's no source map support ([tracked here](https://github.com/samthor/html-modules-polyfill/issues/1)).
