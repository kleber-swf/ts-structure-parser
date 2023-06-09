'use strict';

import * as fs from 'fs';
import { } from 'mocha';
import { expect } from 'chai';
import { ModuleModel } from '../../../index';
import { parseStruct } from '../../../src/tsStructureParser';


describe('E2E Tests', () => {

	it('Hero', (done) => {
		const filePath = './test/src/model/hero/hero.ts';
		const structPath = './test/src/model/hero/hero.json';

		const decls = fs.readFileSync(filePath).toString();
		const parsedStructure: ModuleModel = parseStruct(decls, {}, filePath);
		const expectedStruct: any = JSON.parse(fs.readFileSync(structPath, 'utf8'));
		expect(parsedStructure).be.deep.equal(expectedStruct);

		done();
	});

	it('Function', (done) => {
		const filePath = './test/src/model/hero/testFunction.ts';
		const expectedFunc = './test/src/model/hero/testFunction.json';

		const decls = fs.readFileSync(filePath).toString();
		const parsedStructure: ModuleModel = parseStruct(decls, {}, filePath);
		const expectedStruct: any = JSON.parse(fs.readFileSync(expectedFunc, 'utf8'));
		expect(parsedStructure).be.deep.equal(expectedStruct);
		done();
	});
});
