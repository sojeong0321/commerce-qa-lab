const { AppError } = require('../errors');
const { assertCanBuy } = require('./productService');

function createOrderService(db, { productService, cartService, couponService }) {
  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, status, subtotal_amount, discount_amount, total_amount, user_coupon_id, coupon_code, created_at)
    VALUES (?, 'PLACED', ?, ?, ?, ?, ?, ?)
  `);
  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
    VALUES (?, ?, ?, ?, ?)
  `);
  const decreaseStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
  const increaseStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  const useCoupon = db.prepare("UPDATE user_coupons SET status = 'USED', used_at = ? WHERE id = ?");
  const restoreCoupon = db.prepare("UPDATE user_coupons SET status = 'AVAILABLE', used_at = NULL WHERE id = ?");
  const clearCart = db.prepare('DELETE FROM cart_items WHERE user_id = ?');
  // 쿠폰 코드는 주문 시점 값을 orders에 저장해 둔다. (상품 이름/가격과 같은 snapshot 원칙)
  const selectOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
  const selectMyOrderIds = db.prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC');
  const selectOrderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
  const cancelOrderRow = db.prepare("UPDATE orders SET status = 'CANCELED', canceled_at = ? WHERE id = ?");

  function toOrderDto(row) {
    const items = selectOrderItems.all(row.id).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      lineTotal: item.unit_price * item.quantity,
    }));
    return {
      id: row.id,
      status: row.status,
      items,
      subtotalAmount: row.subtotal_amount,
      discountAmount: row.discount_amount,
      totalAmount: row.total_amount,
      couponCode: row.coupon_code ?? null,
      createdAt: row.created_at,
      canceledAt: row.canceled_at ?? null,
    };
  }

  // BR-X4: 없는 주문과 남의 주문은 구분하지 않고 404로 답한다.
  function findMyOrderRow(userId, orderId) {
    const row = selectOrder.get(orderId);
    if (!row || row.user_id !== userId) {
      throw new AppError(404, 'ORDER_NOT_FOUND', `주문을 찾을 수 없습니다. (id: ${orderId})`);
    }
    return row;
  }

  function getOrder(userId, orderId) {
    return toOrderDto(findMyOrderRow(userId, orderId));
  }

  function listOrders(userId) {
    return selectMyOrderIds.all(userId).map((row) => toOrderDto(selectOrder.get(row.id)));
  }

  // BR-O1~O4: 장바구니 전체로 주문을 만든다.
  // 재고 확인 → 재고 감소 → 쿠폰 사용 → 주문 저장 → 장바구니 비우기를 하나의 transaction으로 처리한다.
  // 중간에 하나라도 실패하면 전부 취소되어 재고/쿠폰/장바구니가 그대로 남는다.
  const createOrder = db.transaction((userId, couponCode) => {
    const cart = cartService.getCart(userId);
    if (cart.items.length === 0) {
      throw new AppError(422, 'CART_EMPTY', '장바구니가 비어 있어 주문할 수 없습니다.');
    }

    // BR-O2: 장바구니에 담은 뒤 재고가 바뀌었을 수 있으므로 주문 시점에 다시 확인한다.
    for (const item of cart.items) {
      assertCanBuy(productService.getProduct(item.productId), item.quantity);
    }

    const amounts = couponService.calculateAmounts(userId, cart.subtotal, couponCode);

    for (const item of cart.items) {
      decreaseStock.run(item.quantity, item.productId);
    }
    if (amounts.userCouponId) {
      useCoupon.run(new Date().toISOString(), amounts.userCouponId);
    }

    const { lastInsertRowid } = insertOrder.run(
      userId,
      amounts.subtotal,
      amounts.discount,
      amounts.total,
      amounts.userCouponId,
      amounts.coupon ? amounts.coupon.code : null,
      new Date().toISOString()
    );
    for (const item of cart.items) {
      insertOrderItem.run(lastInsertRowid, item.productId, item.name, item.price, item.quantity);
    }
    clearCart.run(userId);

    return toOrderDto(selectOrder.get(lastInsertRowid));
  });

  // BR-X1~X3: PLACED 주문만 취소할 수 있고, 재고와 쿠폰을 원래대로 되돌린다.
  const cancelOrder = db.transaction((userId, orderId) => {
    const order = findMyOrderRow(userId, orderId);
    if (order.status === 'CANCELED') {
      throw new AppError(409, 'ORDER_ALREADY_CANCELED', `이미 취소된 주문입니다. (id: ${orderId})`);
    }

    // [의도적 결함 - DEMO] 취소 시 재고를 복구하지 않는다.
    // CI가 이 결함을 잡아내고 증거를 남기는지 확인하기 위한 브랜치. main에 병합하지 않는다.
    if (order.user_coupon_id) {
      restoreCoupon.run(order.user_coupon_id); // BR-CP6: 취소하면 쿠폰을 다시 쓸 수 있다.
    }
    cancelOrderRow.run(new Date().toISOString(), orderId);

    return toOrderDto(selectOrder.get(orderId));
  });

  return { createOrder, cancelOrder, getOrder, listOrders };
}

module.exports = { createOrderService };
