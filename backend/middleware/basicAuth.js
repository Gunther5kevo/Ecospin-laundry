// middleware/basicAuth.js
export function basicAuth(req, res, next) {
  const auth = { login: process.env.ADMIN_USER, password: process.env.ADMIN_PASS };

  // parse login & password from headers
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login && password && login === auth.login && password === auth.password) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="401"'); // prompt browser login
  res.status(401).send('Authentication required.');
}
