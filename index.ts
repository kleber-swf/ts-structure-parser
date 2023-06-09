import ts = require('typescript');
import tsStructureParser = require("./src/tsStructureParser");

export interface ModuleModel {
	classes: ClassModel[];
	functions: FunctionDeclaration[];
	imports: { [name: string]: ModuleModel };
	_imports: ImportNode[];
	aliases: AliasNode[];
	enumDeclarations: EnumDeclaration[];
	name: string;
}

export interface FunctionDeclaration {
	name: string;
	doc: string;
	isAsync: boolean;
	isArrow: boolean;
	isExport: boolean;
	// returnType?: ReturnTypeDeclaration;
	params?: {
		name: string,
		type: string,
		mandatory: boolean;
	}[];
}


export interface ReturnTypeDeclaration {
	isPromise?: boolean;
	isArray?: boolean;
	isUnion?: boolean;
	isLiteral?: boolean;
	value?: any;
	type: string | ReturnTypeDeclaration[] | undefined;

}
export interface AliasNode {
	name: string;
	type: TypeModel;
}

export interface ImportNode {
	clauses: string[];
	absPathNode: string[];
	absPathString: string;
	isNodeModule: boolean;
}

export class EnumMemberDeclaration {
	name: string;
	doc: string;
	value?: number | string;
}

export class EnumDeclaration {
	name: string;
	doc: string;
	members: EnumMemberDeclaration[];
}

export enum TypeKind {
	BASIC,
	ARRAY,
	UNION
}

export interface TypeModel {
	typeKind: TypeKind;
}

export interface BasicType extends TypeModel {
	//typeName:string
	nameSpace: string;
	basicName: string;
	typeName: string;
	typeArguments: TypeModel[];
	modulePath: string;
}

export interface ArrayType extends TypeModel {
	base: TypeModel;
}

export type Arg = string | number | boolean;

export interface UnionType extends TypeModel {
	options: TypeModel[];
}

export interface Annotation {
	name: string;
	arguments: (Arg | Arg[])[];
}

export interface Decorator {
	name: string;
	arguments: (Arg | Arg[])[];
}


export interface FieldModel {
	name: string;
	doc: string;
	type: TypeModel;
	decorators: Decorator[];
	annotations: Annotation[];
	valueConstraint: Constraint;
	optional: boolean;
}

export interface MethodModel {
	start: number;
	end: number;
	name: string;
	text: string;
	returnType: TypeModel;
	arguments: ParameterModel[];
	doc: string;
}

export interface ParameterModel {
	start: number;
	end: number;
	name: string;
	text: string;
	type: TypeModel;
}

export interface Constraint {
	isCallConstraint: boolean;
	value?: any;
}

export interface CallConstraint extends Constraint {
	value: Annotation;
}

export interface ValueConstraint extends Constraint {
	value: string | number | boolean;
}

export interface ClassModel {
	name: string;
	doc: string;

	decorators: Decorator[];
	annotations: Annotation[];
	moduleName: string;
	extends: TypeModel[];
	implements: TypeModel[];

	fields: FieldModel[];
	methods: MethodModel[];

	typeParameters: string[];
	typeParameterConstraint: string[];
	isInterface: boolean;
	annotationOverridings: { [key: string]: Annotation[] };
}

export function parseStruct(content: string, modules: { [path: string]: ModuleModel }, mpth: string): ModuleModel {
	return tsStructureParser.parseStruct(content, modules, mpth);
}