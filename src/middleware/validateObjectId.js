const mongoose = require('mongoose');

// Responde 400 (y no 500) cuando el :id de la ruta no es un ObjectId válido de MongoDB.
const validateObjectId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'El ID no es válido' });
  }

  return next();
};

module.exports = { validateObjectId };
