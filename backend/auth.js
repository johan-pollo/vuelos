const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { Usuario } = require('./models');

// El secreto aleatorio mantiene el servidor utilizable en desarrollo; configura JWT_SECRET para conservar sesiones al reiniciar.
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');

function crearToken(usuario) {
  return jwt.sign({ sub: usuario._id.toString() }, jwtSecret, { expiresIn: '8h' });
}

async function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Debes iniciar sesión para continuar.' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const usuario = await Usuario.findById(payload.sub).select('email rol cliente');
    if (!usuario) return res.status(401).json({ error: 'La sesión ya no es válida.' });

    req.usuario = {
      id: usuario._id,
      email: usuario.email,
      rol: usuario.rol,
      clienteId: usuario.cliente,
    };
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

module.exports = { autenticar, autorizar, crearToken };