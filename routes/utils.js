async function checkConnection(fastifyInstance) {
  try {
    if (fastifyInstance.mongoose.connection.readyState !== 1) {
      await fastifyInstance.mongoose.connect(fastifyInstance.config.mongoose);
    }
  } catch (error) {
    fastifyInstance.log.fatal(error);
  }
}

async function validateModel(model) {
  let validationSonuc = await model.validate()
  if (validationSonuc?.errors) {
    throw new Error(validationSonuc.message);
  }
}

module.exports = {
  checkConnection,
  validateModel
};
