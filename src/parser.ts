import ts = require('typescript');
import * as tsp from '../index';
import { JSONTransformer } from './jsonTransformer';

namespace Parser {
	const tsDocRegex = /\/\*[^*]*\*+(?:[^\/\*][^*]*\*+)*\//gm;

	export function extractTsDoc(fullText: string) {
		const matches = fullText.match(tsDocRegex);
		return (matches && matches.length) ? matches[0].toString() : '';
	}

	export function createClassModel(name: string, isInteface: boolean): tsp.ClassModel {
		return {
			name,
			doc: '',
			methods: [],
			typeParameters: [],
			typeParameterConstraint: [],
			implements: [],
			fields: [],
			isInterface: isInteface,
			decorators: [],
			annotations: [],
			extends: [],
			moduleName: null,
			annotationOverridings: {},
		};
	}

	export function createFieldModel(field: ts.PropertyDeclaration, path: string): tsp.FieldModel {
		const name = field.name.getText();
		const isInitializer = name.charAt(0) === '$';
		return {
			name,
			doc: extractTsDoc(field.getFullText()),
			type: parseType(field.type, path),
			annotations: isInitializer ? parseInitializer(field.initializer) : [],
			valueConstraint: !isInitializer ? parseConstraint(field.initializer) : null,
			optional: field.questionToken != null,
			decorators: (field.decorators && field.decorators.length)
				? field.decorators.map((el: ts.Decorator) => parseDecorator(el.expression))
				: [],
		};
	}

	export function createModuleModel(name: string): tsp.ModuleModel {
		return {
			name,
			functions: [],
			classes: [],
			aliases: [],
			enumDeclarations: [],
			imports: {},
			_imports: [],
		};
	}

	function parseConstraint(node: ts.Expression): tsp.Constraint {
		if (!node) return null;

		return (node.kind === ts.SyntaxKind.CallExpression)
			? { isCallConstraint: true, value: parseAnnotation(node) }
			: { isCallConstraint: false, value: parseArg(node) };
	}

	function parseAnnotation(node: ts.Expression): tsp.Annotation {
		if (node.kind === ts.SyntaxKind.CallExpression) {
			const call = node as ts.CallExpression;
			return {
				name: parseName(call.expression),
				arguments: call.arguments.map(parseArg),
			};
		} else {
			throw new Error('Only call expressions may be annotations');
		}
	}

	export function parseDecorator(node: ts.Expression): tsp.Decorator {
		if (node.kind === ts.SyntaxKind.CallExpression) {
			const call = node as ts.CallExpression;
			return {
				name: parseName(call.expression),
				arguments: call.arguments.map(parseArg),
			};
		} else if (node.kind === ts.SyntaxKind.Identifier) {
			return {
				name: String((node as any).escapedText),
				arguments: null,
			};
		} else {
			throw new Error('Only call expressions may be annotations');
		}
	}

	function parseInitializer(node: ts.Expression): tsp.Annotation[] {
		if (!node) return [];
		if (node.kind === ts.SyntaxKind.ArrayLiteralExpression) {
			return (node as ts.ArrayLiteralExpression).elements.map(parseAnnotation);
		} else {
			throw new Error('Only Array Literals supported now');
		}
	}

	export function parseType(node: ts.TypeNode, path: string): tsp.TypeModel {
		if (!node) return null;
		const kind = ts.SyntaxKind;

		switch (node.kind) {
			case kind.StringKeyword: return basicType('string', null);
			case kind.NumberKeyword: return basicType('number', null);
			case kind.BooleanKeyword: return basicType('boolean', null);
			case kind.NullKeyword: return basicType('null', null);
			case kind.AnyKeyword: return basicType('any', null);
			case kind.VoidKeyword: return basicType('void', null);
			case kind.TypeReference: return typeReference(node as ts.TypeReferenceNode, path);
			case kind.ArrayType: return arrayType(parseType((node as ts.ArrayTypeNode).elementType, path));
			case kind.UnionType: return unionType((node as ts.UnionTypeNode).types.map(x => parseType(x, path)));
			case kind.ExpressionWithTypeArguments: return expWithTypeArgs(node as ts.ExpressionWithTypeArguments, path);
			default: return basicType('mock', null);
		}
	}

	function typeReference(node: ts.TypeReferenceNode, path: string) {
		const res = basicType(parseQualified(node.typeName), path);
		if (node.typeArguments) res.typeArguments = node.typeArguments.map(e => parseType(e, path));
		return res;
	}

	function expWithTypeArgs(tra: ts.ExpressionWithTypeArguments, path: string) {
		const res = basicType(parseQualified2(tra.expression), path);
		if (tra.typeArguments) res.typeArguments = tra.typeArguments.map(e => parseType(e, path));
		return res;
	}

	function basicType(n: string, path: string): tsp.BasicType {
		const namespaceIndex = n.indexOf('.');
		const namespace = namespaceIndex !== -1 ? n.substring(0, namespaceIndex) : '';
		const basicName = namespaceIndex !== -1 ? n.substring(namespaceIndex + 1) : n;

		return { typeName: n, nameSpace: namespace, basicName, typeKind: tsp.TypeKind.BASIC, typeArguments: [], modulePath: path };
	}

	function arrayType(type: tsp.TypeModel): tsp.ArrayType {
		return { base: type, typeKind: tsp.TypeKind.ARRAY };
	}

	function unionType(types: tsp.TypeModel[]): tsp.UnionType {
		return { options: types, typeKind: tsp.TypeKind.UNION };
	}


	function parseQualified2(node: any): string {
		return node.name ? node.name.text : node.text;
	}

	function parseQualified(node: ts.EntityName): string {
		return node.kind === ts.SyntaxKind.Identifier
			? node.getText()
			: parseQualified(node.left) + '.' + parseQualified(node.right);
	}

	function parseName(node: ts.Expression): string {
		if (node.kind === ts.SyntaxKind.Identifier) return node.getText();
		if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
			const e = node as ts.PropertyAccessExpression;
			return parseName(e.expression) + '.' + parseName(e.name);
		}
		throw new Error('Only simple identifiers are supported now');
	}

	export function parseArg(node: ts.Expression): any {
		const kind = ts.SyntaxKind;

		switch (node.kind) {
			case kind.StringLiteral: return (node as ts.StringLiteral).text;
			case kind.NoSubstitutionTemplateLiteral: return (node as ts.LiteralExpression).text;
			case kind.ArrayLiteralExpression: return (node as ts.ArrayLiteralExpression).elements.map(parseArg);

			case kind.TrueKeyword: return true;
			case kind.FalseKeyword: return false;

			case kind.Identifier: return (node as ts.Identifier).text;
			case kind.NumericLiteral: return Number((node as ts.LiteralExpression).text);

			case kind.NullKeyword: return null;

			case kind.PropertyAccessExpression: {
				const pa = node as ts.PropertyAccessExpression;
				return parseArg(pa.expression) + '.' + parseArg(pa.name);
			}

			case kind.BinaryExpression: {
				const bin: ts.BinaryExpression = <ts.BinaryExpression>node;
				if (bin.operatorToken.kind === kind.PlusToken) {
					return parseArg(bin.left) + parseArg(bin.right);
				}
			}

			case kind.ObjectLiteralExpression: {
				const obj: ts.ObjectLiteralExpression = <ts.ObjectLiteralExpression>node;

				try {
					let jsonString = JSONTransformer.toValidateView(obj);
					try {
						return JSON.parse(jsonString);
					} catch {
						const lamdaSearchRegexp = new RegExp(/(\(\)\s{0,1}=>\s{0,1}{(.|\n)*},)|(\(\)\s{0,1}=>\s{0,1}{(.|\n)*}})/, 'gsm');
						jsonString = jsonString.replace(lamdaSearchRegexp, (replacer) => {
							const replacerCorrect = replacer.replace(/"/g, '\'')
								.replace(/,([\n\t]*})/gm, '$1');	// remove trailing commas;
							const func = `"${replacerCorrect.slice(0, replacer.length - 1)}"`;
							const lastSymb = replacerCorrect[replacer.length - 1];
							const replacedFunction = func.replace(/\s{2,}/g, '');
							return `{"type": "lamda", "content": ${replacedFunction}}${lastSymb}`;
						});
						try {
							return JSON.parse(jsonString);
						} catch (e) {
							console.error(`Cant't parse string '${jsonString}' after complex object calculating`, e);
							return null;
						}
					}
				} catch (e) {
					throw new Error(`Can't parse string '${obj.getFullText()}' to json`);
				}
			}

			default:
				return node.getText();
		}
	}


	export function parseMethod(method: ts.MethodDeclaration, content: string, path: string): tsp.MethodModel {
		return {
			returnType: parseType(method.type, path),
			name: method.name.getText(),
			start: method.pos,
			end: method.end,
			text: content.substring(method.pos, method.end),
			arguments: method.parameters.map(x => parseParameter(x, content, path)),
			doc: extractTsDoc(method.getFullText()),
		};
	}

	function parseParameter(f: ts.ParameterDeclaration, content: any, path: string): tsp.ParameterModel {
		const text = content.substring(f.pos, f.end);
		return {
			name: f.name.getText(),
			start: f.pos,
			end: f.end,
			text,
			type: parseType(f.type, path),
		};
	}
}

export default Parser;