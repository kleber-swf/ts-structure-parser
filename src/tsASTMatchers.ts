import ts = require('typescript');

/***
 * This module is designed to match simple patterns on Typescript AST Tree
 * it functionality mirrors jsASTMatchers which allows you to match on jsAST
 */
//TODO RENAME TO MATCHERS
export namespace Matching {
	export type Node = ts.Node;
	export type Expression = ts.Expression;
	export type Identifier = ts.Identifier;
	export type SyntaxKind = ts.SyntaxKind;
	export type CallExpression = ts.CallExpression;

	export interface NodeMatcher {
		doMatch(node: Node): any;
	}

	export interface TypedMatcher<T extends Node> extends NodeMatcher {

		/**
		 * returns null or the value not null means that matched
		 * @param node
		 */
		doMatch(node: Node): any;
		nodeType(): ts.SyntaxKind;
	}

	export interface Transformer<T, R> {
		(a: T): R;
	}

	export interface NodeCallback<T> {
		(node: Node): T;
	}

	export interface NodesCallback<T> {
		(nodes: Node[]): T;
	}

	/**
	 * do match checks the node type and if node type is ok
	 * calls match function otherwise it returns null
	 */
	export class BasicMatcher {

		protected match(node: Node): any {
			throw new Error();
		}

		public nodeType(): ts.SyntaxKind {
			throw new Error();
		}

		public doMatch(n: Node): any {
			return n && this.nodeType() === n.kind ? this.match(n) : null;
		}
	}

	export class ClassDeclarationMatcher extends BasicMatcher implements TypedMatcher<ts.ClassDeclaration> {
		protected match(node: Node): ts.ClassDeclaration { return node as ts.ClassDeclaration; }
		public nodeType(): ts.SyntaxKind { return ts.SyntaxKind.ClassDeclaration; }
	}

	export class FieldMatcher extends BasicMatcher implements TypedMatcher<ts.ClassDeclaration> {
		public match(node: ts.PropertyDeclaration): ts.PropertyDeclaration { return node; }
		public nodeType(): ts.SyntaxKind { return ts.SyntaxKind.PropertyDeclaration; }
	}

	export class AssignmentExpressionMatcher extends BasicMatcher implements TypedMatcher<ts.BinaryExpression> {
		public match(node: ts.BinaryExpression): any {
			if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
				if (this.left.doMatch(node.left) && this.right.doMatch(node.right)) {
					return this.tr(node);
				}
			}
			return null;
		}

		public constructor(
			private left: TypedMatcher<Expression>,
			private right: TypedMatcher<Expression>,
			private tr: Transformer<ts.BinaryExpression, any>
		) { super(); }

		public nodeType(): ts.SyntaxKind {
			return ts.SyntaxKind.BinaryExpression;
		}
	}
	export class VariableDeclarationMatcher extends BasicMatcher implements TypedMatcher<ts.VariableDeclaration> {
		public match(node: ts.VariableDeclaration): any {
			if (this.left.doMatch(node.name) && this.right.doMatch(node.initializer)) {
				return this.tr(node);
			}
		}

		public constructor(
			private left: TypedMatcher<Expression>,
			private right: TypedMatcher<Expression>,
			private tr: Transformer<ts.VariableDeclaration, any>
		) {
			super();
		}

		public nodeType(): ts.SyntaxKind {
			return ts.SyntaxKind.VariableDeclaration;
		}
	}


	class ExpressionStatementMatcher extends BasicMatcher implements TypedMatcher<ts.ExpressionStatement> {
		public match(node: ts.ExpressionStatement): any {
			const exp = this.expression.doMatch(node.expression);
			if (exp) {
				const v = this.tr(node.expression);
				if (v === true) return exp;
				return v;
			}
			return null;
		}

		public constructor(private expression: TypedMatcher<Expression>, private tr: Transformer<Expression, any>) {
			super();
		}

		public nodeType(): ts.SyntaxKind {
			return ts.SyntaxKind.ExpressionStatement;
		}
	}

	class SimpleIdentMatcher extends BasicMatcher implements TypedMatcher<Identifier> {
		public constructor(private val: string) { super(); }
		public match(node: Identifier): any { return node.text === this.val ? true : null; }
		public nodeType(): SyntaxKind { return ts.SyntaxKind.Identifier; }
	}



	class TrueMatcher<T extends Node> implements TypedMatcher<T> {
		public doMatch(_node: Node): any { return true; }
		public nodeType(): ts.SyntaxKind { return null; }
	}
	class CallExpressionMatcher extends BasicMatcher implements TypedMatcher<CallExpression> {
		public constructor(private calleeMatcher: TypedMatcher<Expression>, private tr: Transformer<CallExpression, any>) { super(); }
		public match(node: CallExpression): any { return this.calleeMatcher.doMatch(node.expression) ? this.tr(node) : null; }
		public nodeType(): SyntaxKind { return ts.SyntaxKind.CallExpression; }
	}

	export const SKIP = {};

	export function visit<T>(n: Node, cb: NodeCallback<T>): T {
		const r0 = cb(n);
		if (r0) return r0 === SKIP ? null : r0;

		const result: T = ts.forEachChild<T>(n, x => {
			const r = visit(x, cb);
			if (r) return r;
		});

		return result;
	}

	export class PathNode {
		public name: string;
		public arguments: ReadonlyArray<Expression> = null;
		public _callExpression: ts.CallExpression;

		public constructor(name: string, private _base: Node) {
			this.name = name;
		}
	}

	export class CallPath {
		public base: string;

		public start() {
			return this._baseNode.pos;
		}

		public startLocation() {
			return this._baseNode.getSourceFile().getLineAndCharacterOfPosition(this.start());
		}

		public endLocation() {
			return this._baseNode.getSourceFile().getLineAndCharacterOfPosition(this.end());
		}

		public end() {
			const ce = this.path[this.path.length - 1]._callExpression;
			return ce ? ce.end : this.start();
		}

		public constructor(base: string, private _baseNode: ts.Node) {
			this.base = base;
		}

		public path: PathNode[] = [];

		public toString(): string {
			return this.path.map(x => x.name).join('.');
		}
	}

	class MemberExpressionMatcher extends BasicMatcher implements TypedMatcher<ts.PropertyAccessExpression> {
		public match(node: ts.PropertyAccessExpression): any {
			return (this.objectMatcher.doMatch(node.expression) && this.propertyMatcher.doMatch(node.name))
				? this.tr(node)
				: null;
		}

		public nodeType(): SyntaxKind {
			return ts.SyntaxKind.PropertyAccessExpression;
		}

		public constructor(private objectMatcher: TypedMatcher<Expression>,
			private propertyMatcher: TypedMatcher<Expression | Identifier>,
			private tr: Transformer<ts.PropertyAccessExpression, any>) {
			super();
		}
	}

	export function memberFromExp(objMatcher: string, tr: Transformer<Expression, any> = x => true): TypedMatcher<any> {
		const array: string[] = objMatcher.split('.');
		let result: TypedMatcher<any> = null;
		for (let a = 0; a < array.length; a++) {
			let arg = array[a];
			const ci = arg.indexOf('(*)');
			let isCall = false;
			if (ci !== -1) {
				arg = arg.substring(0, ci);
				isCall = true;
			}
			if (result == null) {
				result = arg === '*' ? anyNode() : ident(arg);
			} else {
				result = new MemberExpressionMatcher(result, arg === '*' ? anyNode() : ident(arg), tr);
			}
			if (isCall) {
				result = new CallExpressionMatcher(result, tr);
			}
		}
		return result;
	}

	export class CallBaseMatcher implements TypedMatcher<Expression> {
		public doMatch(node: Expression): CallPath {
			// const original = node;
			if (node.kind === ts.SyntaxKind.CallExpression) {
				const callExp = (<CallExpression>node);
				const res: CallPath = this.doMatch(callExp.expression);
				if (res) {
					if (res.path.length > 0 && res.path[res.path.length - 1].arguments == null) {
						res.path[res.path.length - 1].arguments = callExp.arguments;
						res.path[res.path.length - 1]._callExpression = callExp;
						return res;
					}
					//This case should not exist in type script clients now
					//but leaving it here for possible future use at the moment;

					//if (res.path.length==0&&call.arguments.length==1){
					//    //this is not resource based call!!!
					//    if (call.arguments[0].kind==ts.SyntaxKind.StringLiteral){
					//        var l:ts.LiteralExpression=<ts.LiteralExpression>call.arguments[0];
					//        var url=l.text;
					//        var uriPath=url.toString().split('/');
					//        uriPath.forEach(x=>res.path.push(
					//            new PathNode(x)
					//        ))
					//        return res;
					//    }
					//}
					return null;
				}
			} else if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
				const me = (<ts.PropertyAccessExpression>node);
				const v: CallPath = this.doMatch(me.expression);
				if (v) {
					if (me.name.kind === ts.SyntaxKind.Identifier) {
						v.path.push(new PathNode((<Identifier>me.name).text, me.name));
						return v;
					}
					return null;
				}
			} else if (node.kind === ts.SyntaxKind.Identifier) {
				const id: Identifier = <Identifier>node;
				if (this.rootMatcher.doMatch(id)) {
					return new CallPath(id.text, id);
				}
			}
			return null;
		}

		public nodeType(): ts.SyntaxKind {
			return null;
		}

		public constructor(private rootMatcher: TypedMatcher<Identifier>) {
		}
	}

	export function ident(name: string): TypedMatcher<Identifier> {
		return new SimpleIdentMatcher(name);
	}

	export function anyNode(): TypedMatcher<Node> {
		return new TrueMatcher();
	}

	export function call(calleeMatcher: TypedMatcher<Expression>, tr: Transformer<CallExpression, any> = x => true)
		: TypedMatcher<CallExpression> {
		return new CallExpressionMatcher(calleeMatcher, tr);
	}

	export function exprStmt(eM: TypedMatcher<Expression>,
		tr: Transformer<ts.MemberExpression, any> = x => true): TypedMatcher<ts.ExpressionStatement> {
		return new ExpressionStatementMatcher(eM, tr);
	}

	export function assign(left: TypedMatcher<Expression>,
		right: TypedMatcher<Expression>,
		tr: Transformer<ts.BinaryExpression, any> = x => true): TypedMatcher<ts.BinaryExpression> {
		return new AssignmentExpressionMatcher(left, right, tr);
	}

	export function varDecl(left: TypedMatcher<Expression>,
		right: TypedMatcher<Expression>,
		tr: Transformer<ts.VariableDeclaration, any> = x => true): TypedMatcher<ts.BinaryExpression> {
		return new VariableDeclarationMatcher(left, right, tr);
	}

	export function field() {
		return new FieldMatcher();
	}

	export function classDeclaration() {
		return new ClassDeclarationMatcher();
	}
}