import * as fs from 'fs';
import * as path from 'path';

export function resolve(p1: string, p2: string): string {
	return path.resolve(p1, p2);
}

export function readFileSync(p: string): string {
	return fs.readFileSync(p).toString();
}

export function dirname(p: string) {
	return path.dirname(p);
}

export function existsSync(p: string): boolean {
	return fs.existsSync(p);
}
