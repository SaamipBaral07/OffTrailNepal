// In-memory token store — bridges React context and the Axios api.js module.
// JS variables are inaccessible to XSS scripts, unlike sessionStorage/localStorage.
let _token = null;
let _csrfToken = null;

const readCookie = (name) => {
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
};

const initializeCsrfToken = () => {
	if (!_csrfToken) {
		_csrfToken = readCookie("csrfToken");
	}
};

initializeCsrfToken();

export const getToken = () => _token;
export const setToken = (token) => { _token = token; };

export const getCsrfToken = () => {
	initializeCsrfToken();
	return _csrfToken;
};
export const setCsrfToken = (token) => { _csrfToken = token; };
export const clearCsrfToken = () => { _csrfToken = null; };
