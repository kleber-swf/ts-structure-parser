import ts = require('typescript');
import path = require('path');
import fs = require('fs');

const SyntaxKind = ts.SyntaxKind;

import { ClassModel, DirectionKind, FieldModel, ModuleModel } from './../index';
import Parser from './parser';
import Visitor from './visitor';

function parseSource(content: string) {
	return ts.createSourceFile('sample.ts', content, ts.ScriptTarget.ES3, true);
}


function parseVariableDeclaration(node: ts.Node, module: ModuleModel) {
	node.forEachChild(child => {
		if (child.kind === SyntaxKind.FunctionExpression) {
			const isExport = !!((node.parent.parent.modifiers || []) as ts.ModifiersArray)
				.find(m => m.kind === SyntaxKind.ExportKeyword);

			const isAsync = !!((child.modifiers || []) as ts.ModifiersArray)
				.find(m => m.kind === SyntaxKind.AsyncKeyword);

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

	Visitor.visit(localMod, m => {
		if (m.kind === SyntaxKind.NamedImports) {
			const lit = impDec.importClause.getText();
			localNamedImports = lit.substring(1, lit.length - 1).split(',');
			localImport.clauses = localNamedImports.map(im => im.trim());
			return;
		}

		if (m.kind === SyntaxKind.StringLiteral) {
			const localPath = m.getText().substring(1, m.getText().length - 1);
			if (localPath[0] === '.') {
				const localP = path.resolve(path.dirname(modulePath) + '/', localPath).split(process.cwd()).join('.');
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
	const isArrow = node.kind === SyntaxKind.ArrowFunction;

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
			if (m.kind === SyntaxKind.AsyncKeyword) isAsync = true;
			if (m.kind === SyntaxKind.ExportKeyword && !isArrow) isExport = true;
		});
	}

	if (isArrow && !isExport) {
		do {
			modifierContainer = modifierContainer.parent as ts.Expression;
		} while (modifierContainer && modifierContainer.kind !== SyntaxKind.VariableStatement);

		if (modifierContainer && modifierContainer.modifiers) {
			isExport = modifierContainer.modifiers.some(m => m.kind === SyntaxKind.ExportKeyword);
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

	const ref = imp.moduleReference as ts.ExternalModuleReference;
	const literal = ref.expression as ts.StringLiteral;
	const importPath = literal.text;
	const absPath = path.resolve(path.dirname(modulePath) + '/', importPath) + '.ts';

	if (!fs.existsSync(absPath)) {
		throw new Error('Path ' + importPath + ' resolve to ' + absPath + 'do not exists');
	}

	if (!modules[absPath]) {
		const cnt = fs.readFileSync(absPath).toString();
		parseStruct(cnt, modules, absPath);
	}

	module.imports[namespace] = modules[absPath];
}

function parseTypeAliasDeclaration(node: ts.Node, module: ModuleModel, modulePath: string) {
	const alias = node as ts.TypeAliasDeclaration;
	if (!alias.name) return;
	module.aliases.push({
		name: alias.name.text,
		type: Parser.parseType(alias.type, modulePath),
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

function parseField(field: ts.PropertySignature | ts.PropertyDeclaration, clazz: ClassModel,
	modulePath: string, fields: { [n: string]: FieldModel }) {
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
}

function parseAccessor(accessor: ts.AccessorDeclaration, clazz: ClassModel, modulePath: string, direction: DirectionKind) {
	const model = Parser.createAccessorModel(accessor, modulePath);
	clazz.accessors.push(model);
}

function parseClassDeclaration(node: ts.Node, module: ModuleModel, content: string, modulePath: string,
	moduleName: string, isInterface: boolean) {
	const classDecl = node as ts.ClassDeclaration;
	if (!classDecl) return;

	const fields: { [n: string]: FieldModel } = {};
	const clazz = Parser.createClassModel(classDecl.name.text, isInterface);
	clazz.doc = Parser.extractTsDoc(classDecl.getFullText());

	if (classDecl.decorators && classDecl.decorators.length) {
		clazz.decorators = classDecl.decorators.map(el => Parser.parseDecorator(el.expression));
	}

	clazz.moduleName = moduleName;
	module.classes.push(clazz);

	if (isInterface) {
		classDecl.members.forEach(member => {
			if (member.kind === SyntaxKind.MethodSignature) {
				const method = Parser.parseMethod(member as ts.MethodDeclaration, content, modulePath);
				clazz.methods.push(method);
				return;
			}

			if (member.kind === SyntaxKind.PropertySignature) {
				parseField(member as ts.PropertyDeclaration, clazz, modulePath, fields);
			}
		});
	} else {
		classDecl.members.forEach(member => {
			if (member.kind === SyntaxKind.MethodDeclaration) {
				const method = Parser.parseMethod(member as ts.MethodDeclaration, content, modulePath);
				clazz.methods.push(method);
				return;
			}

			if (member.kind === SyntaxKind.GetAccessor) {
				parseAccessor(member as ts.AccessorDeclaration, clazz, modulePath, DirectionKind.GET);
				return;
			}

			if (member.kind === SyntaxKind.SetAccessor) {
				parseAccessor(member as ts.AccessorDeclaration, clazz, modulePath, DirectionKind.SET);
				return;
			}

			if (member.kind === SyntaxKind.PropertyDeclaration) {
				parseField(member as ts.PropertyDeclaration, clazz, modulePath, fields);
			}
		});
	}

	if (classDecl.typeParameters) {
		clazz.typeParameterConstraint = classDecl.typeParameters.map(param => {
			if (!param.constraint) return null;
			return param.constraint['typeName'] ? param.constraint['typeName'].text : null;
		});
	}

	if (classDecl.heritageClauses) {
		classDecl.heritageClauses.forEach(heritage => {
			heritage.types.forEach(y => {
				if (heritage.token === SyntaxKind.ExtendsKeyword) {
					clazz.extends.push(Parser.parseType(y, modulePath));
				} else if (heritage.token === SyntaxKind.ImplementsKeyword) {
					clazz.implements.push(Parser.parseType(y, modulePath));
				} else {
					throw new Error('Unknown token class heritage');
				}
			});
		});
	}
}


export function parseStruct(content: string, modules: { [id: string]: ModuleModel }, modulePath: string): ModuleModel {
	const source = parseSource(content);
	const module = Parser.createModuleModel(modulePath);
	let moduleName: string = null;

	modules[modulePath] = module;

	Visitor.visit(source, node => {
		if (node.kind === SyntaxKind.VariableDeclaration) {
			parseVariableDeclaration(node, module);
			return;
		}

		if (node.kind === SyntaxKind.ImportDeclaration) {
			parseImportDeclaration(node, module, modulePath);
			return;
		}

		if (node.kind === SyntaxKind.FunctionDeclaration || node.kind === SyntaxKind.ArrowFunction) {
			parseFunctionDeclaration(node, module);
			return;
		}

		if (node.kind === SyntaxKind.ModuleDeclaration) {
			moduleName = node.getText();
			return;
		}

		if (node.kind === SyntaxKind.ImportEqualsDeclaration) {
			parseImportEqualsDeclaraction(node, module, modules, modulePath);
			return;
		}

		if (node.kind === SyntaxKind.TypeAliasDeclaration) {
			parseTypeAliasDeclaration(node, module, modulePath);
			return;
		}

		if (node.kind === SyntaxKind.EnumDeclaration) {
			parseEnumDeclaration(node, module);
			return;
		}

		const isInterface = node.kind === SyntaxKind.InterfaceDeclaration;
		const isClass = node.kind === SyntaxKind.ClassDeclaration;

		if (isInterface || isClass) {
			parseClassDeclaration(node, module, content, modulePath, moduleName, isInterface);
			return Visitor.SKIP;
		}
	});

	return module;
}

