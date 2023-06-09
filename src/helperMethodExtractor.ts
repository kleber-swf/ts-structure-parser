import ts = require('typescript');
import tsm = require('./tsASTMatchers');
import * as fs from 'fs';
import * as path from 'path';
import { Arg, HelperMethod, Meta } from './helpers';
import index = require('../index');
import tsStructureParser = require('./tsStructureParser');

export function getHelperMethods(srcPath: string): HelperMethod[] {

	const result: HelperMethod[] = [];
	const content = fs.readFileSync(path.resolve(srcPath)).toString();

	const mod = ts.createSourceFile('sample.ts', content, ts.ScriptTarget.ES3, true);

	tsm.Matching.visit(mod, x => {

		const node = <any>x;
		if (node.kind === ts.SyntaxKind.FunctionDeclaration) {

			const meta = getMeta(node, content);
			if (!meta) {
				return;
			}
			const originalName = node.name.text;
			let wrapperMethodName = originalName;
			if (meta.name) {
				wrapperMethodName = meta.name;
			} else {
				meta.name = originalName;
			}
			wrapperMethodName = meta.name ? meta.name : originalName;
			const args = node.parameters ? node.parameters.map(a => readArg(a, srcPath)) : [];
			const override = meta.override ? meta.override : false;
			const returnType = tsStructureParser.buildType(node.type, srcPath);
			result.push(new HelperMethod(originalName, wrapperMethodName, returnType, args, meta));
		}
	});
	return result;
}

const refineComment = function (comment: any) {
	return comment.replace(/^\s*\/\*+/g, '').replace(/\*+\/\s*$/g, '').split('\n')
		.map(x => x.replace(/^\s*\/\//g, '').replace(/^\s*\* {0,1}/g, ''))
		.join('\n')
		.trim();
};

function getMeta(node: any, content: string): Meta {

	const cRange: any = ts.getLeadingCommentRanges(content, node.pos);
	if (!cRange) {
		return null;
	}

	const comment = cRange.map(x => content.substring(x.pos, x.end)).join('\n');

	let ind = comment.indexOf('__$helperMethod__');
	if (ind < 0) {
		return null;
	}
	ind += '__$helperMethod__'.length;

	const indMeta = comment.indexOf('__$meta__');
	if (indMeta < 0) {
		return { comment: refineComment(comment.substring(ind)) };
	}

	const commentStr = refineComment(comment.substring(ind, indMeta));

	const indMetaObj = comment.indexOf('{', indMeta);
	if (indMetaObj < 0) {
		return { comment: commentStr };
	}

	try {
		const meta = JSON.parse(refineComment(comment.substring(indMetaObj)));
		meta.comment = commentStr.trim().length > 0 ? commentStr : null;
		meta.override = meta.override || false;
		meta.primary = meta.primary || false;
		meta.deprecated = meta.deprecated || false;
		return meta;
	} catch (e) {
		console.log(e);
	}

	return {};
}

function readArg(node: any, srcPath: string): Arg {

	const name = node.name.text;

	const type = tsStructureParser.buildType(node.type, srcPath);

	let defaultValue;
	let optional = node.questionToken != null;
	if (node.initializer != null) {
		defaultValue = tsStructureParser.parseArg(node.initializer);
		optional = true;
	}
	return {
		name,
		type,
		defaultValue,
		optional,
	};
}
