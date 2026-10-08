const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { Usuario } = require('./models');

// El secreto aleatorio mantiene el servidor utilizable en desarrollo; configura JWT_SECRET para conservar sesiones al reiniciar.
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');

function crearToken(usuario) {
  return jwt.sign({ sub: usuario._id.toString() }, jwtSecret, { expiresIn: '8h' });
}

async function obtenerUsuarioDesdeToken(token) {
  const payload = jwt.verify(token, jwtSecret);
  const usuario = await Usuario.findById(payload.sub).select('email username rol cliente');
  if (!usuario) return null;
  return {
    id: usuario._id,
    email: usuario.email,
    username: usuario.username,
    rol: usuario.rol,
    clienteId: usuario.cliente,
  };
}

async function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Debes iniciar sesión para continuar.' });
  }

  try {
    req.usuario = await obtenerUsuarioDesdeToken(token);
    if (!req.usuario) return res.status(401).json({ error: 'La sesión ya no es válida.' });
    next();
  } catch {
    res.status(401).json({ error: 'La sesión expiró o no es válida.' });
  }
}

async function autenticarOpcional(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) return next();

  const [tipo, token] = authorization.split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'La sesión no es válida.' });
  }

  try {
    req.usuario = await obtenerUsuarioDesdeToken(token);
    if (!req.usuario) return res.status(401).json({ error: 'La sesión ya no es válida.' });
    next();
  } catch {
    res.status(401).json({ error: 'La sesión expiró o no es válida.' });
  }
}

function autorizar(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta operación.' });
    }
    next();
  };
}

module.exports = { autenticar, autenticarOpcional, autorizar, crearToken };