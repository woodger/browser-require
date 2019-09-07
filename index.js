(() => {
	class Cache {
		constructor(prefix) {
			this.prefix = prefix;
		}

		save(key, value, ttl = 1e5) {
			const lifetime = new Date();
			const seconds = lifetime.getSeconds();

			lifetime.setSeconds(seconds + ttl);

			const data = JSON.stringify({
				lifetime,
				value
			});

			const id = `${this.prefix}_${key}`;

			localStorage.setItem(id, data);
		}

		find(key) {
			const id = `${this.prefix}_${key}`;
			const data = localStorage.getItem(id);

			if (data === null) {
				return null;
			}

			const {
				lifetime,
				value
			} = JSON.parse(data);

			if (this.constructor.isFresh(lifetime)) {
				return value;
			}

			localStorage.removeItem(key);

			return null;
		}

		static isFresh(lifetime) {
			return Date.parse(lifetime) - Date.parse() > 0;
		}
	}

	const ajaxCache = new Cache('ajax');

	const ajax = ({path = '', type, ttl}) => {
		return new Promise((resolve, reject) => {
			const cached = ttl > -1;

			if (cached) {
				const str = ajaxCache.find(path);

				if (str !== null) {
					return resolve(str);
				}
			}

			const xhr = new XMLHttpRequest();

			xhr.onload = function() {
				const {
					status,
					response
				} = this;

				if (status !== 200) {
					return reject(this.statusText);
				}

				if (cached) {
					ajaxCache.save(path, response, ttl);
				}

				resolve(response);
			};

			xhr.onerror = reject;
			xhr.responseType = type;
			xhr.open('GET', path);
			xhr.send();
		});
	};

	const require = async (path) => {
		if (require.cache.has(path)) {
			return require.cache.set(path);
		}

		const type = path.substr(-5) === '.json' ?
			'json' : 'text';

		if (path.substr(-3) !== '.js') {
			throw new Error('The module must have the extension .js[on]');
		}

		const content = await ajax({
			path,
			type,
			ttl: require.ttl
		});

		const exports = await new Promise((resolve) => {
			const module = {
				set exports(obj) {
					resolve(obj)
				}
			};

			new Function('module', content)(module);
		});

		require.cache.set(path, exports);

		return exports;
	};

	require.ttl = 60;

	require.cache = new Map([
		['cache', { Cache }]
	]);

	window.require = require;
})();
