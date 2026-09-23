const { AppError } = require('../errors');
const { isCouponApplicable, calculateDiscount, calculateTotal } = require('./pricing');

function toCouponDto(row) {
  return {
    code: row.code,
    discountAmount: row.discount_amount,
    minOrderAmount: row.min_order_amount,
    status: row.status,
  };
}

function createCouponService(db) {
  const selectMyCoupons = db.prepare(`
    SELECT c.code, c.discount_amount, c.min_order_amount, uc.status
    FROM user_coupons uc
    JOIN coupons c ON c.id = uc.coupon_id
    WHERE uc.user_id = ?
    ORDER BY uc.id
  `);
  const selectMyCouponByCode = db.prepare(`
    SELECT uc.id AS user_coupon_id, uc.status, c.code, c.discount_amount, c.min_order_amount
    FROM user_coupons uc
    JOIN coupons c ON c.id = uc.coupon_id
    WHERE uc.user_id = ? AND c.code = ?
  `);

  function listMyCoupons(userId) {
    return selectMyCoupons.all(userId).map(toCouponDto);
  }

  // BR-CP3: 본인에게 발급된 AVAILABLE 쿠폰만 사용할 수 있다.
  // 남의 쿠폰이나 존재하지 않는 코드는 구분하지 않고 404로 답한다. (쿠폰 코드 추측 방지)
  function getUsableCoupon(userId, code) {
    const row = selectMyCouponByCode.get(userId, code);
    if (!row) {
      throw new AppError(404, 'COUPON_NOT_FOUND', `사용할 수 있는 쿠폰이 아닙니다. (${code})`);
    }
    if (row.status === 'USED') {
      throw new AppError(409, 'COUPON_ALREADY_USED', `이미 사용한 쿠폰입니다. (${code})`);
    }
    return {
      userCouponId: row.user_coupon_id,
      code: row.code,
      discountAmount: row.discount_amount,
      minOrderAmount: row.min_order_amount,
    };
  }

  // BR-CP2: 최소 주문금액을 넘지 못하면 적용할 수 없다.
  function getApplicableCoupon(userId, code, subtotal) {
    const coupon = getUsableCoupon(userId, code);
    if (!isCouponApplicable(subtotal, coupon)) {
      throw new AppError(
        422,
        'COUPON_MIN_AMOUNT_NOT_MET',
        `${coupon.minOrderAmount.toLocaleString('ko-KR')}원 이상 주문 시 사용할 수 있는 쿠폰입니다. (현재 ${subtotal.toLocaleString('ko-KR')}원)`
      );
    }
    return coupon;
  }

  // 쿠폰을 적용했을 때의 금액. 상태는 바꾸지 않는다. (BR-CP4)
  function calculateAmounts(userId, subtotal, code) {
    const coupon = code === undefined || code === null ? null : getApplicableCoupon(userId, code, subtotal);
    const discount = calculateDiscount(subtotal, coupon);
    return {
      subtotal,
      discount,
      total: calculateTotal(subtotal, discount),
      coupon: coupon
        ? { code: coupon.code, discountAmount: coupon.discountAmount, minOrderAmount: coupon.minOrderAmount }
        : null,
      userCouponId: coupon ? coupon.userCouponId : null,
    };
  }

  return { listMyCoupons, getUsableCoupon, getApplicableCoupon, calculateAmounts };
}

module.exports = { createCouponService };
