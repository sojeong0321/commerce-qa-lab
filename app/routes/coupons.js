const express = require('express');
const { AppError } = require('../errors');

function validateCouponCode(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(400, 'VALIDATION_ERROR', 'couponCode는 비어 있지 않은 문자열이어야 합니다.');
  }
  return value.trim();
}

// 이 router들은 userContext 뒤에 등록되므로 req.userId가 항상 있다.
function createCouponsRouter(couponService) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({ coupons: couponService.listMyCoupons(req.userId) });
  });

  return router;
}

// 쿠폰을 적용하면 얼마가 되는지 미리 계산한다. 어떤 상태도 바꾸지 않는다. (BR-CP4)
function createCheckoutRouter(cartService, couponService) {
  const router = express.Router();

  router.post('/preview', (req, res) => {
    const couponCode = validateCouponCode((req.body ?? {}).couponCode);
    const cart = cartService.getCart(req.userId);
    const amounts = couponService.calculateAmounts(req.userId, cart.subtotal, couponCode ?? undefined);

    res.json({
      items: cart.items,
      totalQuantity: cart.totalQuantity,
      // 지금 주문할 수 있는 상태인지 미리 알려 준다. 금액만 보여 주고 주문에서 거절하면 손님이 당황한다.
      orderable: cart.orderable,
      unavailableItems: cart.items
        .filter((item) => !item.purchasable)
        .map((item) => ({
          productId: item.productId,
          name: item.name,
          reason: item.status !== 'ACTIVE' ? 'PRODUCT_NOT_PURCHASABLE' : 'OUT_OF_STOCK',
          stock: item.stock,
        })),
      subtotal: amounts.subtotal,
      discount: amounts.discount,
      total: amounts.total,
      coupon: amounts.coupon,
    });
  });

  return router;
}

module.exports = { createCouponsRouter, createCheckoutRouter, validateCouponCode };
