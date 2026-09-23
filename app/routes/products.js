const express = require('express');
const { parseIdParam } = require('../validation');

function createProductsRouter(productService) {
  const router = express.Router();

  router.get('/products', (req, res) => {
    res.json({ products: productService.listProducts() });
  });

  router.get('/products/:id', (req, res) => {
    const id = parseIdParam(req.params.id, 'id');
    res.json(productService.getProduct(id));
  });

  return router;
}

module.exports = { createProductsRouter };
