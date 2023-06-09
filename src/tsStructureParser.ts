import ts = require('typescript');

export import tsm = require('./tsASTMatchers');
export import helperMethodExtractor = require('./helperMethodExtractor');

import fsUtil = require('./fsUtils');
import {
	Annotation, ArrayType, BasicType, ClassModel, Constraint, Decorator, FieldModel, MethodModel,
	ModuleModel, ParameterModel, TypeKind, TypeModel, UnionType
} from '../index';
import { EnumMemberDeclaration } from './../index';
import { JSONTransformer } from './jsonTransformer';

function parse(content: string) {
	return ts.createSourceFile('sample.ts', content, ts.ScriptTarget.ES3, true);
}

const fld = tsm.Matching.field();

const tsDocRegex = /\/\*[^*]*\*+(?:[^\/\*][^*]*\*+)*\//gm;

function tryExtractTsDoc(fullText: string) {
	const matches = fullText.match(tsDocRegex);
	return (matches && matches.length) ? matches[0].toString() : '';
}

function createClassModel(name: string, isInteface: boolean): ClassModel {
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

function createFieldModel(field: ts.PropertyDeclaration, path: string): FieldModel {
	const name = field.name.getText();
	const isInitializer = name.charAt(0) === '$';
	return {
		name,
		doc: tryExtractTsDoc(field.getFullText()),
		type: buildType(field.type, path),
		annotations: isInitializer ? buildInitializer(field.initializer) : [],
		valueConstraint: !isInitializer ? buildConstraint(field.initializer) : null,
		optional: field.questionToken != null,
		decorators: (field.decorators && field.decorators.length)
			? field.decorators.map((el: ts.Decorator) => buildDecorator(el.expression))
			: [],
	};
}

function createModuleModel(name: string): ModuleModel {
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


export function parseStruct(content: string, modules: { [path: string]: ModuleModel }, mpth: string): ModuleModel {
	const source = parse(content);
	const module = createModuleModel(mpth);
	let currentModule: string = null;

	modules[mpth] = module;

	tsm.Matching.visit(source, x => {
		if (x.kind === ts.SyntaxKind.VariableDeclaration) {
			x.forEachChild(c => {
				if (c.kind === ts.SyntaxKind.FunctionExpression) {
					const isExport = !!((x.parent.parent.modifiers || []) as any[])
						.find(m => m.kind === ts.SyntaxKind.ExportKeyword);
					const params = [];
					const isAsync = !!(c.modifiers || [] as any)
						.find(m => m.kind === ts.SyntaxKind.AsyncKeyword);
					const name = (x as ts.FunctionDeclaration).name.escapedText as string;
					(c as any).parameters.forEach(param => {
						params.push({
							name: param.name.getText(),
							type: (param.type && param.type.getText()) || 'any',
							mandatory: !param.questionToken,
						});
					});
					module.functions.push({
						isArrow: false,
						isExport,
						isAsync,
						name,
						params,
						doc: tryExtractTsDoc(c.getFullText()),
					});
				}
			});
		}
		if (x.kind === ts.SyntaxKind.ImportDeclaration) {
			const impDec = <ts.ImportDeclaration>x;
			const localMod = parse(x.getText());
			const localImport = { clauses: [], absPathNode: [], absPathString: '', isNodeModule: false };
			let localNamedImports: string[];
			let localAbsPath: string[];
			let localAbsPathString: string;
			let localNodeModule = false;
			const pth = require('path');
			tsm.Matching.visit(localMod, y => {
				const _import = {};
				if (y.kind === ts.SyntaxKind.NamedImports) {
					const lit = impDec.importClause.getText();
					localNamedImports = lit.substring(1, lit.length - 1).split(',');
					localImport.clauses = localNamedImports.map(im => {
						return im.trim();
					});
				}
				if (y.kind === ts.SyntaxKind.StringLiteral) {
					const localPath = y.getText().substring(1, y.getText().length - 1);
					if (localPath[0] === '.') {
						const localP = fsUtil.resolve(fsUtil.dirname(mpth) + '/', localPath).split(process.cwd()).join('.');
						localAbsPath = localP.split(pth.sep);
						localAbsPathString = localP;
					} else {
						localAbsPath = localPath.split(pth.sep);
						localAbsPathString = localPath;
						localNodeModule = true;
					}
					localImport.absPathNode = localAbsPath;
					localImport.absPathString = localAbsPathString.replace(/[\\/]+/g, '/');
					localImport.isNodeModule = localNodeModule;
				}
			});
			module._imports.push(localImport);
		}
		if (x.kind === ts.SyntaxKind.FunctionDeclaration || x.kind === ts.SyntaxKind.ArrowFunction) {
			const isArrow = x.kind === ts.SyntaxKind.ArrowFunction;

			const functionDeclaration = isArrow ? x as ts.ArrowFunction : x as ts.FunctionDeclaration;
			const parentVariable = functionDeclaration.parent as ts.VariableDeclaration;
			const name = isArrow
				? parentVariable.name && parentVariable.name.getText()
				: functionDeclaration.name.text;

			let isAsync = false;
			let isExport = false;
			const params: { name: string, type: string, mandatory: boolean }[] = [];
			if (name) {
				let modifierContainer = isArrow
					? (functionDeclaration.parent as ts.VariableDeclaration).initializer
					: functionDeclaration;
				if (modifierContainer && modifierContainer.modifiers) {
					modifierContainer.modifiers.forEach(modi => {
						if (modi.kind === ts.SyntaxKind.AsyncKeyword) {
							isAsync = true;
						}
						if (modi.kind === ts.SyntaxKind.ExportKeyword && !isArrow) {
							isExport = true;
						}
					});
				}

				if (isArrow && !isExport) {
					do {
						modifierContainer = modifierContainer.parent as ts.Expression;
					} while (modifierContainer && modifierContainer.kind !== ts.SyntaxKind.VariableStatement);

					if (modifierContainer && modifierContainer.modifiers) {
						modifierContainer.modifiers.forEach(modi => {
							if (modi.kind === ts.SyntaxKind.ExportKeyword) {
								isExport = true;
							}
						});
					}
				}

				functionDeclaration.parameters.forEach(param => {
					params.push({
						name: param.name.getText(),
						type: (param.type && param.type.getText()) || 'any',
						mandatory: !param.questionToken,
					});

				});
				module.functions.push({
					isArrow,
					isExport,
					isAsync,
					name,
					params,
					doc: tryExtractTsDoc(x.getFullText()),
				});
			}
		}


		if (x.kind === ts.SyntaxKind.ModuleDeclaration) {
			const cmod = <ts.ModuleDeclaration>x;
			currentModule = cmod.name.text;
		}
		if (x.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
			const imp = <ts.ImportEqualsDeclaration>x;
			const namespace = imp.name.text;
			if (namespace === 'RamlWrapper') {
				return;
			}

			const path = <ts.ExternalModuleReference>imp.moduleReference;

			const literal = <ts.StringLiteral>path.expression;
			const importPath = literal.text;
			const absPath = fsUtil.resolve(fsUtil.dirname(mpth) + '/', importPath) + '.ts';
			if (!fsUtil.existsSync(absPath)) {
				throw new Error('Path ' + importPath + ' resolve to ' + absPath + 'do not exists');
			}
			if (!modules[absPath]) {
				const cnt = fsUtil.readFileSync(absPath);
				const mod = parseStruct(cnt, modules, absPath);
			}
			module.imports[namespace] = modules[absPath];
		}
		if (x.kind === ts.SyntaxKind.TypeAliasDeclaration) {
			const u = <ts.TypeAliasDeclaration>x;
			if (u.name) {
				const aliasName = u.name.text;
				const type = buildType(u.type, mpth);
				module.aliases.push({ name: aliasName, type });
			}

			//return;
		}

		if (x.kind === ts.SyntaxKind.EnumDeclaration) {
			const e = <ts.EnumDeclaration>x;
			const members: EnumMemberDeclaration[] = [];
			if (e.members) {
				e.members.forEach(member => {
					let value: number | string | undefined;
					if (member.initializer) {
						if (member.initializer.kind === ts.SyntaxKind.NumericLiteral) {
							value = parseInt((member.initializer as any).text);
						}
						if (
							member.initializer.kind === ts.SyntaxKind.StringLiteral ||
							member.initializer.kind === ts.SyntaxKind.JsxText
						) {
							value = String((member.initializer as any).text);
						}
					}
					members.push({
						name: String((member.name as any).text),
						value,
					});
				});
			}
			if (e.name) {
				module.enumDeclarations.push({ name: e.name.text, members });
			}
		}

		const isInterface = x.kind === ts.SyntaxKind.InterfaceDeclaration;
		const isClass = x.kind === ts.SyntaxKind.ClassDeclaration;
		if (!isInterface && !isClass) {
			return;
		}
		const classDecl: ts.ClassDeclaration = <ts.ClassDeclaration>x;
		if (classDecl) {
			const fields: { [n: string]: FieldModel } = {};
			const clazz = createClassModel(classDecl.name.text, isInterface);
			clazz.doc = tryExtractTsDoc(classDecl.getFullText());

			if (classDecl.decorators && classDecl.decorators.length) {
				clazz.decorators = classDecl.decorators.map((el: ts.Decorator) => buildDecorator(el.expression));
			}

			clazz.moduleName = currentModule;
			module.classes.push(clazz);

			classDecl.members.forEach(member => {
				if (member.kind === ts.SyntaxKind.MethodDeclaration) {
					const md = <ts.MethodDeclaration>member;
					const method = buildMethod(md, content, mpth);
					clazz.methods.push(method);
					//return;
				}
				const field: ts.PropertyDeclaration = fld.doMatch(member);
				if (field) {
					const f = createFieldModel(field, mpth);
					if (f.name === '$') {
						clazz.annotations = f.annotations;
					} else {
						if (f.name.charAt(0) !== '$' || f.name === '$ref') {
							fields[f.name] = f;
							clazz.fields.push(f);
						} else {
							const targetField = f.name.substr(1);
							const of = fields[targetField];
							if (!of) {
								if (f.name !== '$$') {
									//console.log('Overriding annotations for field:'+targetField);
									let overridings = clazz.annotationOverridings[targetField];
									if (!overridings) {
										overridings = [];
									}
									clazz.annotationOverridings[targetField] = overridings.concat(f.annotations);
								}
							} else {
								of.annotations = f.annotations;
							}
						}
					}
				}
			});
			if (classDecl.typeParameters) {
				classDecl.typeParameters.forEach(param => {
					clazz.typeParameters.push(param.name.getText());
					if (!param.constraint) {
						clazz.typeParameterConstraint.push(null);
					} else {
						clazz.typeParameterConstraint
							.push(param.constraint['typeName'] ? param.constraint['typeName']['text'] : null);
					}
				});
			}
			if (classDecl.heritageClauses) {
				classDecl.heritageClauses.forEach(heritage => {
					heritage.types.forEach(y => {
						if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
							clazz.extends.push(buildType(y, mpth));
						} else {
							if (heritage.token === ts.SyntaxKind.ImplementsKeyword) {
								clazz.implements.push(buildType(y, mpth));
							} else {
								throw new Error('Unknown token class heritage');
							}
						}
					});
				});
			}
			return tsm.Matching.SKIP;
		}
	});
	return module;
}

function buildMethod(md: ts.MethodDeclaration, content: any, path: string): MethodModel {
	// const name = (<ts.Identifier>md.name).text;
	// const text = content.substring(md.pos, md.end);
	// const params: ParameterModel[] = md.parameters.map(x => buildParameter(x, content, path));
	// md.parameters.forEach(x => {
	// 	params.push(buildParameter(x, content, path));
	// });

	return {
		returnType: buildType(md.type, path),
		name: md.name.getText(),
		start: md.pos,
		end: md.end,
		text: content.substring(md.pos, md.end),
		arguments: md.parameters.map(x => buildParameter(x, content, path)),
		doc: tryExtractTsDoc(md.getFullText()),
	};
}

function buildParameter(f: ts.ParameterDeclaration, content: any, path: string): ParameterModel {
	const text = content.substring(f.pos, f.end);
	return {
		name: f.name['text'],
		start: f.pos,
		end: f.end,
		text,
		type: buildType(<ts.TypeNode>f.type, path),
	};
}

function buildConstraint(e: ts.Expression): Constraint {
	if (!e) {
		return null;
	}
	if (e.kind === ts.SyntaxKind.CallExpression) {
		return {
			isCallConstraint: true,
			value: buildAnnotation(e),
		};
	} else {
		return {
			isCallConstraint: false,
			value: parseArg(e),
		};
	}

}

function buildInitializer(i: ts.Expression): Annotation[] {
	if (!i) {
		return [];
	}
	if (i.kind === ts.SyntaxKind.ArrayLiteralExpression) {
		const arr = <ts.ArrayLiteralExpression>i;
		const annotations = [];
		arr.elements.forEach(x => {
			annotations.push(buildAnnotation(x));
		});
		return annotations;
	} else {
		throw new Error('Only Array Literals supported now');
	}
}

function buildAnnotation(e: ts.Expression): Annotation {
	if (e.kind === ts.SyntaxKind.CallExpression) {
		const call: ts.CallExpression = <ts.CallExpression>e;
		const name = parseName(call.expression);
		const a = {
			name,
			arguments: [],
		};
		call.arguments.forEach(x => {
			a.arguments.push(parseArg(x));
		});
		return a;
	} else {
		throw new Error('Only call expressions may be annotations');
	}
}

function buildDecorator(e: ts.Expression): Decorator {
	if (e.kind === ts.SyntaxKind.CallExpression) {
		const call: ts.CallExpression = <ts.CallExpression>e;
		const name = parseName(call.expression);
		const a = {
			name,
			arguments: [],
		};
		call.arguments.forEach(x => {
			a.arguments.push(parseArg(x));
		});
		return a;
	} else if (e.kind === ts.SyntaxKind.Identifier) {
		return {
			name: String((e as any).escapedText),
			arguments: null,
		};
	} else {
		throw new Error('Only call expressions may be annotations');
	}
}

export function parseArg(n: ts.Expression): any {
	if (n.kind === ts.SyntaxKind.StringLiteral) {
		const l: ts.StringLiteral = <ts.StringLiteral>n;

		return l.text;
	}
	if (n.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
		const ls: ts.LiteralExpression = <ts.LiteralExpression>n;

		return ls.text;
	}
	if (n.kind === ts.SyntaxKind.ArrayLiteralExpression) {
		const arr = <ts.ArrayLiteralExpression>n;
		const annotations = [];
		arr.elements.forEach(x => {
			annotations.push(parseArg(x));
		});
		return annotations;
	}
	if (n.kind === ts.SyntaxKind.TrueKeyword) {
		return true;
	}
	if (n.kind === ts.SyntaxKind.PropertyAccessExpression) {
		const pa = <ts.PropertyAccessExpression>n;
		return parseArg(pa.expression) + '.' + parseArg(pa.name);
	}
	if (n.kind === ts.SyntaxKind.Identifier) {
		const ident = <ts.Identifier>n;
		return ident.text;
	}
	if (n.kind === ts.SyntaxKind.FalseKeyword) {
		return false;
	}
	if (n.kind === ts.SyntaxKind.NumericLiteral) {
		const nl: ts.LiteralExpression = <ts.LiteralExpression>n;


		return Number(nl.text);
	}
	if (n.kind === ts.SyntaxKind.BinaryExpression) {
		const bin: ts.BinaryExpression = <ts.BinaryExpression>n;
		if (bin.operatorToken.kind = ts.SyntaxKind.PlusToken) {
			return parseArg(bin.left) + parseArg(bin.right);
		}
	}

	if (n.kind === ts.SyntaxKind.ObjectLiteralExpression) {
		const obj: ts.ObjectLiteralExpression = <ts.ObjectLiteralExpression>n;

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
	if (n.kind === ts.SyntaxKind.ArrowFunction) {
		//mock for arrow function
		return (<ts.ArrowFunction>n).getText();
	}

	if (n.kind === ts.SyntaxKind.NullKeyword) {
		return null;
	}
	return n.getText();
	//throw new Error('Unknown value in annotation');
}

function parseName(n: ts.Expression): string {
	if (n.kind === ts.SyntaxKind.Identifier) {
		return n['text'];
	}
	if (n.kind === ts.SyntaxKind.PropertyAccessExpression) {
		const m: ts.PropertyAccessExpression = <ts.PropertyAccessExpression>n;
		return parseName(m.expression) + '.' + parseName(m.name);
	}
	throw new Error('Only simple identifiers are supported now');
}


function basicType(n: string, path: string): BasicType {
	const namespaceIndex = n.indexOf('.');
	const namespace = namespaceIndex !== -1 ? n.substring(0, namespaceIndex) : '';
	const basicName = namespaceIndex !== -1 ? n.substring(namespaceIndex + 1) : n;

	return { typeName: n, nameSpace: namespace, basicName, typeKind: TypeKind.BASIC, typeArguments: [], modulePath: path };
}

function arrayType(b: TypeModel): ArrayType {
	return { base: b, typeKind: TypeKind.ARRAY };
}

function unionType(b: TypeModel[]): UnionType {
	return { options: b, typeKind: TypeKind.UNION };
}

export function buildType(t: ts.TypeNode, path: string): TypeModel {
	if (!t) {
		return null;
	}
	if (t.kind === ts.SyntaxKind.StringKeyword) {
		return basicType('string', null);
	}
	if (t.kind === ts.SyntaxKind.NumberKeyword) {
		return basicType('number', null);
	}
	if (t.kind === ts.SyntaxKind.BooleanKeyword) {
		return basicType('boolean', null);
	}
	if (t.kind === ts.SyntaxKind.NullKeyword) {
		return basicType('null', null);
	}
	if (t.kind === ts.SyntaxKind.AnyKeyword) {
		return basicType('any', null);
	}
	if (t.kind === ts.SyntaxKind.VoidKeyword) {
		return basicType('void', null);
	}

	if (t.kind === ts.SyntaxKind.TypeReference) {
		const tr: ts.TypeReferenceNode = <ts.TypeReferenceNode>t;
		const res = basicType(parseQualified(tr.typeName), path);
		if (tr.typeArguments) {
			tr.typeArguments.forEach(x => {
				res.typeArguments.push(buildType(x, path));
			});
		}
		return res;
	}

	if (t.kind === ts.SyntaxKind.ArrayType) {
		const q: ts.ArrayTypeNode = <ts.ArrayTypeNode>t;
		return arrayType(buildType(q.elementType, path));
	}

	if (t.kind === ts.SyntaxKind.UnionType) {
		const ut: ts.UnionTypeNode = <ts.UnionTypeNode>t;
		return unionType(ut.types.map(x => buildType(x, path)));
	}

	if (t.kind === ts.SyntaxKind.ExpressionWithTypeArguments) {
		const tra = <ts.ExpressionWithTypeArguments>t;
		const res = basicType(parseQualified2(tra.expression), path);
		if (tra.typeArguments) {
			tra.typeArguments.forEach(x => {
				res.typeArguments.push(buildType(x, path));
			});
		}
		return res;
	} else {
		return basicType('mock', null);
	}
	//throw new Error('Case not supported: ' + t.kind);
}

function parseQualified2(n: any): string {
	if (!n.name) {
		return n.text;
	}
	return n.name.text;
}

function parseQualified(n: ts.EntityName): string {
	if (n.kind === ts.SyntaxKind.Identifier) {
		return n['text'];
	} else {
		const q = <ts.QualifiedName>n;
		return parseQualified(q.left) + '.' + parseQualified(q.right);
	}
}
