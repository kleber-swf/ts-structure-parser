import { ClassDecorator, ClassDecoratorWithParam, FieldDecorator, FieldDecoratorWith2Params, FieldDecoratorWithAnyParam, FieldDecoratorWithFuncParam, FieldDecoratorWithParam } from '../decorator/decorator';
import { TestClassWithFunc, testFunction } from './testFunction';

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
			paramsFour: testFunction,
			paramsFive: TestClassWithFunc.func,
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
export class Hero {

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
}
