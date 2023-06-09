import index = require('../index');
import helperMethodExtractor = require('./helperMethodExtractor');

const ns: { [key: string]: boolean } = { 'RamlWrapper': true };

export class HelperMethod {

	public constructor(
		public originalName: string,
		public wrapperMethodName: string,
		public returnType: index.TypeModel,
		public args: Arg[],
		public meta: Meta
	) { }

	public targetWrappers(): string[] {
		let isValid = true;
		let result: string[] = [];
		this.args.forEach(x => {

			const arr = flatten(x.type, ns);
			if (arr.length === 0) {
				return;
			}
			if (!isValid || result.length !== 0) {
				result = [];
				isValid = false;
				return;
			}
			result = result.concat(arr);
		});
		return result;
	}

	public callArgs(): Arg[] {
		return this.args.map(x => {
			if (flatten(x.type, ns).length === 0) {
				return x;
			}
			return {
				name: 'this',
				type: null,
				optional: false,
				defaultValue: undefined,
			};
		});
	}
}

export interface Arg {
	name: string;
	type: index.TypeModel;
	defaultValue: any;
	optional: boolean;
}

export interface Meta {
	name?: string;
	comment?: string;
	override?: boolean;
	primary?: boolean;
	deprecated?: boolean;
}

export function flatten(t: index.TypeModel, namespaces?: { [key: string]: boolean }): string[] {
	if (t.typeKind === index.TypeKind.ARRAY) {
		if (namespaces) {
			return [];
		} else {
			return [flatten((<index.ArrayType>t).base)[0] + '[]'];
		}
	} else if (t.typeKind === index.TypeKind.BASIC) {
		const bt = (<index.BasicType>t);

		let str = bt.basicName;
		const nameSpace = bt.nameSpace && bt.nameSpace.trim();
		if (nameSpace && nameSpace.length > 0 && nameSpace !== 'RamlWrapper') {
			str = nameSpace + '.' + str;
		}
		if (bt.typeArguments && bt.typeArguments.length !== 0) {
			str += `<${bt.typeArguments.map(x => flatten(x)).join(', ')}>`;
		}
		if (namespaces) {
			if (bt.nameSpace) {
				return namespaces[bt.nameSpace] ? [str] : [];
			} else {
				return [];
			}
		}
		return [str];
	} else if (t.typeKind === index.TypeKind.UNION) {
		const ut = <index.UnionType>t;
		let result: string[] = [];
		ut.options.forEach(x => result = result.concat(flatten(x, namespaces)));
		return result;
	}
	return [];
}

export function getHelperMethods(srcPath: string): HelperMethod[] {
	return helperMethodExtractor.getHelperMethods(srcPath);
}