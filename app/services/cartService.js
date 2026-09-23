const { AppError } = require('../errors');
const { calculateSubtotal } = require('./pricing');
const { assertCanBuy } = require('./productService');

function createCartService(db, productService) {
  const selectItems = db.prepare(`
    SELECT c.product_id, c.quantity, p.name, p.price, p.stock, p.status
    FROM cart_items c
    JOIN products p ON p.id = c.product_id
    WHERE c.user_id = ?
    ORDER BY c.id
  `);
  const selectItem = db.prepare('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?');
  const insertItem = db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)');
  const updateItem = db.prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?');
  const deleteItem = db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?');

  function getCart(userId) {
    const items = selectItems.all(userId).map((row) => ({
      productId: row.product_id,
      name: row.name,
      price: row.price,
      quantity: row.quantity,
      lineTotal: row.price * row.quantity,
      stock: row.stock,
      status: row.status,
      // 지금 이 수량 그대로 주문할 수 있는지. (담아 둔 사이 품절되거나 판매 중지될 수 있다)
      purchasable: row.status === 'ACTIVE' && row.quantity <= row.stock,
    }));
    return {
      items,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: calculateSubtotal(items),
      orderable: items.length > 0 && items.every((item) => item.purchasable),
    };
  }

  function findItemOrThrow(userId, productId) {
    const item = selectItem.get(userId, productId);
    if (!item) {
      throw new AppError(404, 'CART_ITEM_NOT_FOUND', `장바구니에 없는 상품입니다. (productId: ${productId})`);
    }
    return item;
  }

  // BR-C2: 이미 담긴 수량 + 추가 수량이 재고를 넘으면 안 된다.
  // 확인과 저장 사이에 상태가 바뀌지 않도록 하나의 transaction으로 처리한다.
  const addItem = db.transaction((userId, productId, quantity) => {
    const product = productService.getProduct(productId);
    const existing = selectItem.get(userId, productId);
    const newQuantity = (existing ? existing.quantity : 0) + quantity;

    assertCanBuy(product, newQuantity);

    if (existing) {
      updateItem.run(newQuantity, userId, productId);
    } else {
      insertItem.run(userId, productId, newQuantity);
    }
  });

  // BR-C3: 변경할 수량도 재고를 넘으면 안 된다.
  // 단, 수량을 "줄이는" 것은 항상 허용한다. 담아 둔 사이 품절되었더라도
  // 줄이기까지 막으면 손님이 장바구니를 정리할 방법이 삭제밖에 없어진다.
  const changeQuantity = db.transaction((userId, productId, quantity) => {
    const item = findItemOrThrow(userId, productId);
    const product = productService.getProduct(productId);

    if (quantity > item.quantity) {
      assertCanBuy(product, quantity);
    }

    updateItem.run(quantity, userId, productId);
  });

  function removeItem(userId, productId) {
    findItemOrThrow(userId, productId);
    deleteItem.run(userId, productId);
  }

  return { getCart, addItem, changeQuantity, removeItem };
}

module.exports = { createCartService };
