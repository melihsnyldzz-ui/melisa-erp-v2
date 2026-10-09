// Photo loaders create browser object URLs from authenticated, verified JPEGs.
// Permit those URLs only as images; scripts, connections and objects stay pinned.
export const SHARED_WEB_CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://127.0.0.1:4174 http://192.168.1.46:4174; connect-src 'self' http://127.0.0.1:4174 http://127.0.0.1:4176 http://192.168.1.46:4174; frame-src http://127.0.0.1:62600 http://localhost:62600 http://192.168.1.46:62600; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
