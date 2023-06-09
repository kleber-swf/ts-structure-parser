import ts = require('typescript');

namespace Visitor {
	export const SKIP = {};

	export interface NodeCallback<T> {
		(node: ts.Node): T;
	}

	export function visit<T>(n: ts.Node, cb: NodeCallback<T>): T {
		const r0 = cb(n);
		if (r0) return r0 === SKIP ? null : r0;

		const result: T = ts.forEachChild<T>(n, x => {
			const r = visit(x, cb);
			if (r) return r;
		});

		return result;
	}
}

export default Visitor;