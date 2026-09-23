const express = require('express');
const { parseIdParam, validateIdField, validateQuantity } = require('../validation');

// 이 router는 app.js에서 userContext 뒤에 등록되므로 req.userId가 항상 있다.
function createCartRouter(cartService) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(cartService.getCart(req.userId));
  });

  router.post('/items', (req, res) => {
    const body = req.body ?? {};
    const productId = validateIdField(body.productId, 'productId');
    const quantity = validateQuantity(body.quantity);

    cartService.addItem(req.userId, productId, quantity);

    res.status(201).json(cartService.getCart(req.userId));
  });

  router.patch('/items/:productId', (req, res) => {
    const productId = parseIdParam(req.params.productId, 'productId');
    const quantity = validateQuantity((req.body ?? {}).quantity);

    cartService.changeQuantity(req.userId, productId, quantity);

    res.json(cartService.getCart(req.userId));
  });

  router.delete('/items/:productId', (req, res) => {
    const productId = parseIdParam(req.params.productId, 'productId');

    cartService.removeItem(req.userId, productId);

    res.status(204).end();
  });

  return router;
}

module.exports = { createCartRouter };
