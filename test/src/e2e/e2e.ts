'use strict';

import { expect } from 'chai';
import * as fs from 'fs';
import { } from 'mocha';
import { parseStruct } from '../../../src/tsStructureParser';


describe('E2E Tests', () => {

	it('Hero', done => {
		const filePath = './test/src/model/hero/hero.ts';
		const expectedPath = './test/src/model/hero/hero.json';

		const decls = fs.readFileSync(filePath).toString();
		const parsedStructure = parseStruct(decls, {}, filePath);
		const expectedStruct = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
		// fs.writeFileSync(expectedPath + 'c', JSON.stringify(parsedStructure, null, '\t'), 'utf8');
		expect(parsedStructure).be.deep.equal(expectedStruct);
		done();
	});

	it('Function', done => {
		const filePath = './test/src/model/hero/testFunction.ts';
		const expectedFunc = './test/src/model/hero/testFunction.json';

		const decls = fs.readFileSync(filePath).toString();
		const parsedStructure = parseStruct(decls, {}, filePath);
		const expectedStruct = JSON.parse(fs.readFileSync(expectedFunc, 'utf8'));
		// fs.writeFileSync(expectedFunc + 'c', JSON.stringify(parsedStructure, null, '\t'), 'utf8');
		expect(parsedStructure).be.deep.equal(expectedStruct);
		done();
	});
});
