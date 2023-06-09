import ts = require('typescript');

export import tsm = require('./tsASTMatchers');
export import helperMethodExtractor = require('./helperMethodExtractor');

import fsUtil = require('./fsUtils');
import { EnumMemberDeclaration, FieldModel, ModuleModel } from './../index';
import Parser from './parser';

function parseSource(content: string) {
	return ts.createSourceFile('sample.ts', content, ts.ScriptTarget.ES3, true);
}

const fieldMatcher = tsm.Matching.field();


export function parseStruct(content: string, modules: { [path: string]: ModuleModel }, mpth: string): ModuleModel {
	const source = parseSource(content);
	const module = Parser.createModuleModel(mpth);
	let currentModule: string = null;

	modules[mpth] = module;

	tsm.Matching.visit(source, node => {
		if (node.kind === ts.SyntaxKind.VariableDeclaration) {
			node.forEachChild(child => {
				if (child.kind === ts.SyntaxKind.FunctionExpression) {
					const isExport = !!((node.parent.parent.modifiers || []) as any[])
						.find(m => m.kind === ts.SyntaxKind.ExportKeyword);
					const params = [];
					const isAsync = !!(child.modifiers || [] as any)
						.find((m: any) => m.kind === ts.SyntaxKind.AsyncKeyword);
					const name = (node as ts.FunctionDeclaration).name.escapedText as string;
					(child as any).parameters.forEach(param => {
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
						doc: Parser.extractTsDoc(child.getFullText()),
					});
				}
			});
		}

		if (node.kind === ts.SyntaxKind.ImportDeclaration) {
			const impDec = <ts.ImportDeclaration>node;
			const localMod = parseSource(node.getText());
			const localImport = { clauses: [], absPathNode: [], absPathString: '', isNodeModule: false };
			let localNamedImports: string[];
			let localAbsPath: string[];
			let localAbsPathString: string;
			let localNodeModule = false;
			const pth = require('path');
			tsm.Matching.visit(localMod, y => {
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

		if (node.kind === ts.SyntaxKind.FunctionDeclaration || node.kind === ts.SyntaxKind.ArrowFunction) {
			const isArrow = node.kind === ts.SyntaxKind.ArrowFunction;

			const functionDeclaration = isArrow ? node as ts.ArrowFunction : node as ts.FunctionDeclaration;
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
					doc: Parser.extractTsDoc(node.getFullText()),
				});
			}
		}


		if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
			const cmod = <ts.ModuleDeclaration>node;
			currentModule = cmod.name.text;
		}

		if (node.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
			const imp = <ts.ImportEqualsDeclaration>node;
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
				parseStruct(cnt, modules, absPath);
			}
			module.imports[namespace] = modules[absPath];
		}

		if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
			const u = <ts.TypeAliasDeclaration>node;
			if (u.name) {
				const aliasName = u.name.text;
				const type = Parser.parseType(u.type, mpth);
				module.aliases.push({ name: aliasName, type });
			}

			//return;
		}

		if (node.kind === ts.SyntaxKind.EnumDeclaration) {
			const e = <ts.EnumDeclaration>node;
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

		const isInterface = node.kind === ts.SyntaxKind.InterfaceDeclaration;
		const isClass = node.kind === ts.SyntaxKind.ClassDeclaration;
		if (!isInterface && !isClass) return;

		const classDecl = node as ts.ClassDeclaration;

		if (!classDecl) return;
		const fields: { [n: string]: FieldModel } = {};
		const clazz = Parser.createClassModel(classDecl.name.text, isInterface);
		clazz.doc = Parser.extractTsDoc(classDecl.getFullText());

		if (classDecl.decorators && classDecl.decorators.length) {
			clazz.decorators = classDecl.decorators.map((el: ts.Decorator) => Parser.parseDecorator(el.expression));
		}

		clazz.moduleName = currentModule;
		module.classes.push(clazz);

		classDecl.members.forEach(member => {
			if (member.kind === ts.SyntaxKind.MethodDeclaration) {
				const method = Parser.parseMethod(member as ts.MethodDeclaration, content, mpth);
				clazz.methods.push(method);
				//return;
			}
			const field: ts.PropertyDeclaration = fieldMatcher.doMatch(member);
			if (field) {
				const f = Parser.createFieldModel(field, mpth);
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
						clazz.extends.push(Parser.parseType(y, mpth));
					} else {
						if (heritage.token === ts.SyntaxKind.ImplementsKeyword) {
							clazz.implements.push(Parser.parseType(y, mpth));
						} else {
							throw new Error('Unknown token class heritage');
						}
					}
				});
			});
		}
		return tsm.Matching.SKIP;
	});

	return module;
}

