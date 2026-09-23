const express = require('express');
const { parseIdParam } = require('../validation');
const { validateCouponCode } = require('./coupons');

// 이 router는 userContext 뒤에 등록되므로 req.userId가 항상 있다.
function createOrdersRouter(orderService) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const couponCode = validateCouponCode((req.body ?? {}).couponCode);

    const order = orderService.createOrder(req.userId, couponCode ?? undefined);

    res.status(201).json(order);
  });

  router.get('/', (req, res) => {
    res.json({ orders: orderService.listOrders(req.userId) });
  });

  router.get('/:id', (req, res) => {
    const id = parseIdParam(req.params.id, 'id');
    res.json(orderService.getOrder(req.userId, id));
  });

  router.post('/:id/cancel', (req, res) => {
    const id = parseIdParam(req.params.id, 'id');
    res.json(orderService.cancelOrder(req.userId, id));
  });

  return router;
}

module.exports = { createOrdersRouter };
