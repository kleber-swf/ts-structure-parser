import ts = require('typescript');

export import tsm = require('./tsASTMatchers');
export import helperMethodExtractor = require('./helperMethodExtractor');

import fsUtil = require('./fsUtils');
import { FieldModel, ModuleModel } from './../index';
import Parser from './parser';

function parseSource(content: string) {
	return ts.createSourceFile('sample.ts', content, ts.ScriptTarget.ES3, true);
}

const fieldMatcher = tsm.Matching.field();

function parseVariableDeclaration(node: ts.Node, module: ModuleModel) {
	node.forEachChild(child => {
		if (child.kind === ts.SyntaxKind.FunctionExpression) {
			const isExport = !!((node.parent.parent.modifiers || []) as ts.ModifiersArray)
				.find(m => m.kind === ts.SyntaxKind.ExportKeyword);

			const isAsync = !!((child.modifiers || []) as ts.ModifiersArray)
				.find(m => m.kind === ts.SyntaxKind.AsyncKeyword);

			const name = (node as ts.FunctionDeclaration).name.escapedText as string;

			const params = (child as ts.FunctionDeclaration).parameters
				.map(param => ({
					name: param.name.getText(),
					type: (param.type && param.type.getText()) || 'any',
					mandatory: !param.questionToken,
				}));

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

function parseImportDeclaration(node: ts.Node, module: ModuleModel, modulePath: string) {
	const impDec = node as ts.ImportDeclaration;
	const localMod = parseSource(node.getText());
	const localImport = { clauses: [], absPathNode: [], absPathString: '', isNodeModule: false };

	let localNamedImports: string[];
	let localAbsPath: string[];
	let localAbsPathString: string;
	let localNodeModule = false;
	const path = require('path');

	tsm.Matching.visit(localMod, m => {
		if (m.kind === ts.SyntaxKind.NamedImports) {
			const lit = impDec.importClause.getText();
			localNamedImports = lit.substring(1, lit.length - 1).split(',');
			localImport.clauses = localNamedImports.map(im => im.trim());
			return;
		}

		if (m.kind === ts.SyntaxKind.StringLiteral) {
			const localPath = m.getText().substring(1, m.getText().length - 1);
			if (localPath[0] === '.') {
				const localP = fsUtil.resolve(fsUtil.dirname(modulePath) + '/', localPath).split(process.cwd()).join('.');
				localAbsPath = localP.split(path.sep);
				localAbsPathString = localP;
			} else {
				localAbsPath = localPath.split(path.sep);
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

function parseFunctionDeclaration(node: ts.Node, module: ModuleModel) {
	const isArrow = node.kind === ts.SyntaxKind.ArrowFunction;

	const fnDeclaration = isArrow ? node as ts.ArrowFunction : node as ts.FunctionDeclaration;
	const parentVariable = fnDeclaration.parent as ts.VariableDeclaration;

	const name = isArrow
		? parentVariable.name && parentVariable.name.getText()
		: fnDeclaration.name.text;

	if (!name) return;

	let isAsync = false;
	let isExport = false;

	let modifierContainer = isArrow
		? (fnDeclaration.parent as ts.VariableDeclaration).initializer
		: fnDeclaration;

	if (modifierContainer && modifierContainer.modifiers) {
		modifierContainer.modifiers.forEach(m => {
			if (m.kind === ts.SyntaxKind.AsyncKeyword) isAsync = true;
			if (m.kind === ts.SyntaxKind.ExportKeyword && !isArrow) isExport = true;
		});
	}

	if (isArrow && !isExport) {
		do {
			modifierContainer = modifierContainer.parent as ts.Expression;
		} while (modifierContainer && modifierContainer.kind !== ts.SyntaxKind.VariableStatement);

		if (modifierContainer && modifierContainer.modifiers) {
			isExport = modifierContainer.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
		}
	}

	const params = fnDeclaration.parameters.map(param => ({
		name: param.name.getText(),
		type: (param.type && param.type.getText()) || 'any',
		mandatory: !param.questionToken,
	}));

	module.functions.push({
		isArrow,
		isExport,
		isAsync,
		name,
		params,
		doc: Parser.extractTsDoc(node.getFullText()),
	});
}

function parseImportEqualsDeclaraction(node: ts.Node, module: ModuleModel, modules: { [id: string]: ModuleModel }, modulePath: string) {
	const imp = node as ts.ImportEqualsDeclaration;
	const namespace = imp.name.text;
	if (namespace === 'RamlWrapper') return;

	const path = imp.moduleReference as ts.ExternalModuleReference;
	const literal = path.expression as ts.StringLiteral;
	const importPath = literal.text;
	const absPath = fsUtil.resolve(fsUtil.dirname(modulePath) + '/', importPath) + '.ts';

	if (!fsUtil.existsSync(absPath)) {
		throw new Error('Path ' + importPath + ' resolve to ' + absPath + 'do not exists');
	}

	if (!modules[absPath]) {
		const cnt = fsUtil.readFileSync(absPath);
		parseStruct(cnt, modules, absPath);
	}

	module.imports[namespace] = modules[absPath];
}

function parseTypeAliasDeclaration(node: ts.Node, module: ModuleModel, modulePath: string) {
	const alias = node as ts.TypeAliasDeclaration;
	if (!alias.name) return;
	module.aliases.push({
		name: alias.name.text,
		type: Parser.parseType(alias.type, modulePath)
	});
}

function parseEnumDeclaration(node: ts.Node, module: ModuleModel) {
	const e = node as ts.EnumDeclaration;
	if (!e.name) return;

	module.enumDeclarations.push({
		name: e.name.getText(),
		doc: Parser.extractTsDoc(e.getFullText()),
		members: e.members
			? e.members.map(member => ({
				name: member.name.getText(),
				doc: Parser.extractTsDoc(member.getFullText()),
				value: member.initializer ? JSON.parse(member.initializer.getText()) : undefined,
			}))
			: undefined,
	});
}

function parseClassDeclaration(node: ts.Node, module: ModuleModel, content: string, modulePath: string,
	moduleName: string, isInterface: boolean) {
	const classDecl = node as ts.ClassDeclaration;

	if (!classDecl) return;
	const fields: { [n: string]: FieldModel } = {};
	const clazz = Parser.createClassModel(classDecl.name.text, isInterface);
	clazz.doc = Parser.extractTsDoc(classDecl.getFullText());

	if (classDecl.decorators && classDecl.decorators.length) {
		clazz.decorators = classDecl.decorators.map((el: ts.Decorator) => Parser.parseDecorator(el.expression));
	}

	clazz.moduleName = moduleName;
	module.classes.push(clazz);

	classDecl.members.forEach(member => {
		if (member.kind === ts.SyntaxKind.MethodDeclaration) {
			const method = Parser.parseMethod(member as ts.MethodDeclaration, content, modulePath);
			clazz.methods.push(method);
			return;
		}

		const field = fieldMatcher.doMatch(member);
		if (!field) return;

		const model = Parser.createFieldModel(field, modulePath);

		if (model.name === '$') {
			clazz.annotations = model.annotations;
			return;
		}

		if (model.name.charAt(0) !== '$' || model.name === '$ref') {
			fields[model.name] = model;
			clazz.fields.push(model);
			return;
		}

		const targetField = model.name.substring(1);
		const of = fields[targetField];

		if (of) {
			of.annotations = model.annotations;
			return;
		}

		if (model.name !== '$$') {
			//console.log('Overriding annotations for field:'+targetField);
			const overridings = clazz.annotationOverridings[targetField] || [];
			clazz.annotationOverridings[targetField] = overridings.concat(model.annotations);
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
					clazz.extends.push(Parser.parseType(y, modulePath));
				} else {
					if (heritage.token === ts.SyntaxKind.ImplementsKeyword) {
						clazz.implements.push(Parser.parseType(y, modulePath));
					} else {
						throw new Error('Unknown token class heritage');
					}
				}
			});
		});
	}
}


export function parseStruct(content: string, modules: { [path: string]: ModuleModel }, modulePath: string): ModuleModel {
	const source = parseSource(content);
	const module = Parser.createModuleModel(modulePath);
	let moduleName: string = null;

	modules[modulePath] = module;

	tsm.Matching.visit(source, node => {
		if (node.kind === ts.SyntaxKind.VariableDeclaration) {
			parseVariableDeclaration(node, module);
			return;
		}

		if (node.kind === ts.SyntaxKind.ImportDeclaration) {
			parseImportDeclaration(node, module, modulePath);
			return;
		}

		if (node.kind === ts.SyntaxKind.FunctionDeclaration || node.kind === ts.SyntaxKind.ArrowFunction) {
			parseFunctionDeclaration(node, module);
			return;
		}


		if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
			// currentModule = (node as ts.ModuleDeclaration).name.text;
			moduleName = node.getText();
			return;
		}

		if (node.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
			parseImportEqualsDeclaraction(node, module, modules, modulePath);
			return;
		}

		if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
			parseTypeAliasDeclaration(node, module, modulePath);
			return;
		}

		if (node.kind === ts.SyntaxKind.EnumDeclaration) {
			parseEnumDeclaration(node, module);
			return;
		}

		const isInterface = node.kind === ts.SyntaxKind.InterfaceDeclaration;
		const isClass = node.kind === ts.SyntaxKind.ClassDeclaration;

		if (isInterface || isClass) {
			parseClassDeclaration(node, module, content, modulePath, moduleName, isInterface);
			return tsm.Matching.SKIP;
		}
	});

	return module;
}

