import { ClassDecorator, ClassDecoratorWithParam, FieldDecorator, FieldDecoratorWith2Params, FieldDecoratorWithAnyParam, FieldDecoratorWithFuncParam, FieldDecoratorWithParam } from '../decorator/decorator';
import { TestClassWithFunc, testFunction } from './testFunction';

/** This is a documentation for enum */
export enum TestEnum {
	/** test */
	foo = 1,
	/** another */
	BAR = 2,
	/** ok */
	Baz = null
}

export interface IHero {
	id: number;
	name: string;
	readonly bar: number;
	action(param: string): void;
}

/**
 * Hero Detail comment before decorators
 * with multiple lines
 */
@ClassDecorator()
@ClassDecoratorWithParam('HeroDetailClass')
export class HeroDetail {

	/** id field comment with no decorators single line */
	public id?: number;
	/**
	 * Detail field comment before decorators
	 * with multiple lines
	 */
	@FieldDecorator()
	@FieldDecoratorWithAnyParam({
		paramUno: '123',
		paramDos: false,
		paramTres:
		{
			paramUno: 15,
			paramDos: 'quatro',
			'paramsTre': false,
			paramsQuatro: testFunction,
			paramsCinco: TestClassWithFunc.func,
		},
	})
	public detail: string;
}

@ClassDecorator()
@ClassDecoratorWithParam('HeroClass')
@FieldDecoratorWithAnyParam({
	samenameintitle: 1,
	secondItem: 'samenameintitle/22',
})
@FieldDecoratorWithAnyParam({
	nullable: true,
	secondItem: null,
})
/**
* Hero class documentation after decorators
* with multiple lines
*/
export class Hero implements IHero {

	@FieldDecoratorWithParam('int, primary key')
	@FieldDecorator()
	/**
	 * Id field comment after decorators
	 * with multiple lines
	 */
	public id: number;

	/** Name field comment before decorators single line */
	@FieldDecoratorWith2Params('string', { 'required': true, 'max-length': 128, 'min-length': 5 })
	public name: string;


	@FieldDecoratorWithParam('external reference')
	@FieldDecorator()
	/** Name field comment after decorators single line */
	public detail: HeroDetail;

	@FieldDecoratorWithParam('array of objects from external reference')
	@FieldDecorator()
	public details: HeroDetail[];

	@FieldDecorator()
	@FieldDecoratorWithFuncParam(() => { console.log('function'); })
	@FieldDecoratorWithFuncParam(testFunction)
	public simpleArray: number[];

	private _foo = true;

	/** Foo documentation */
	@FieldDecoratorWithParam('array of objects from external reference')
	public get foo() { return this._foo; }

	public set foo(value: boolean) { this._foo = value; }

	private _bar = 0;

	/** Bar documentation */
	@FieldDecoratorWithParam('array of objects from external reference')
	public get bar() { return this._bar; }

	private _baz = '';
	@FieldDecoratorWithParam('array of objects from external reference')
	/** Baz documentation */
	public set baz(value: string) { this._baz = value; }

	public action(param: string) {
		console.log('action', param);
	}
}
