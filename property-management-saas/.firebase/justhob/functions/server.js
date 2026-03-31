const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrjusthob = onRequest({}, (req, res) => server.then(it => it.handle(req, res)));
  