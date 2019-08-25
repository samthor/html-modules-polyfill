
const walk = require('estree-walker').walk;

function flatten(node) {
	const parts = [];

	while (node.type === 'MemberExpression') {
		if (node.computed) {
      return null;
    }

		parts.unshift(node.property.name);
		node = node.object;
	}

	if (node.type !== 'Identifier') {
    return null;
  }

	const name = node.name;
	parts.unshift(name);

	return {name, keypath: parts.join('.')};
}

module.exports = {
  transform(raw) {

    const ast = this.parse(raw);

    walk(ast, {
      enter(node, parent) {
        if (node._skip) {
          return this.skip();
        }

        if (node.type === 'MemberExpression') {
          const flattened = flatten(node);
          console.info('got member', flattened && flattened.keypath);
        }
      }
    });

  },
};
