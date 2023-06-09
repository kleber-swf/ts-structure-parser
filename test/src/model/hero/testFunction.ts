export function testFunction(): string | void {
	console.log('test function');
}

export function testFunctionWithNumberSingleType(params1: Promise<number>[]): number {
	console.log('test function');
	return 22;
}

export async function testAsyncFunction(params1: string, params2?: number) {
	console.log('async test function');
	return 23;
}

export async function testAsyncFunctionWithReturnValue(params1: string, params2?: number): Promise<number> {
	console.log('async test function');
	return 23;
}

export async function testAsyncFunctionWithReturnMixValue(params1: string, params2?: number): Promise<number | string> {
	console.log('async test function');
	return 23;
}

function notExportNotAsyncFunction() { console.log(1); }

export const arrowFunctionLikeVariable = (): string => { return '123'; };

const arrowNotExportFunction = () => { console.log(1); };

export const arrowAsyncFunctionLikeVariable = async (params1: string): Promise<number> => { return 12; };

const arrowNotExportFunctionWithMixReturnValue = (): Promise<void | null | string> => { return null; };

export const analogIdsTransformer = async (bol: boolean) => {
	if (bol) {
		return [1, 2, 3, 4, 5, 6, 7, 8].map(item => console.log(item));
	}
	return [];
};

export const funcWithFuncDescription = function () {
	return true;
};

export const funcWithFuncDescriptionAndOneParam = function (param: number) {
	return true;
};

const asyncFuncWithFuncDescription = async function () {
	return true;
};

export const asyncFuncWithFuncDescriptionAndOneParam = async function (param?: any) {
	return true;
};

export const notInJSON = true;

export const notInJSON2 = 'true';

export class TestClassWithFunc {
	public static func = () => {
		console.log(1);
	};

	public async func1() {
		console.log(1);
	}
}
