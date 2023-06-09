export class JSONTransformer {
	public static unique(arr: string[]): string[] {
		const obj = {};
		for (let i = 0; i < arr.length; i++) {
			const str = arr[i];
			obj[str] = true;
		}
		return Object.keys(obj);
	}

	public static toValidateView(obj: any): string {
		// delete all ' and replace it to "
		let jsonString = obj.getFullText()
			.split('\'')
			.join('"')
			.replace(/,([\n\t]*})/gm, '$1');	// remove trailing commas
		const matches = jsonString.match(/ [\w]+.[\w]+\(\)/);
		if (matches && matches.length) {
			matches.forEach(match => {
				jsonString = jsonString.replace(match, `"${match}"`);
			});
		}
		// make all keys without "" to keys with ""
		let regExp = / ?[a-zA-Z]\w+(\.\w+)?(\s)*:/g;
		let m = jsonString.match(regExp);
		if (m) {
			m = m.map((item: string) => item.trim());
			m = JSONTransformer.unique(m);
			m.forEach((match: string) => {
				if (!(match.match(/ ?(true|false)[ ,}]?/))) {
					const reg = new RegExp(match, 'g');
					const replaceWord = `"${match.substring(0, match.length - 1).trim()}":`;
					jsonString = jsonString.replace(reg, replaceWord);
				}
			});
		}

		// make all value like function in branches
		regExp = /:(\s)*?[a-zA-Z]\w+(\.\w+)?/g;
		m = jsonString.match(regExp);
		if (m) {
			m = m.map((item: string) => item.trim());
			m = JSONTransformer.unique(m);
			m.forEach((match: string) => {
				if (!(match.match(/ ?(true|false)[ ,}]?/))) {
					const reg = new RegExp(match, 'g');
					const replaceWord = `: "${match.substring(1, match.length).trim()}"`;
					jsonString = jsonString.replace(reg, replaceWord);
				}
			});
		}
		return jsonString;
	}
}