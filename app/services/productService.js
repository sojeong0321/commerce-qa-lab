const { AppError } = require('../errors');

// 품절 여부는 저장하지 않고 stock에서 계산한다. (같은 사실을 두 곳에 저장하지 않기 위해)
function toProductDto(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    stock: row.stock,
    status: row.status,
    soldOut: row.stock === 0,
    purchasable: row.status === 'ACTIVE' && row.stock > 0,
  };
}

// BR-P2, BR-P3, BR-C2: 이 수량을 살 수 있는지 확인한다.
function assertCanBuy(product, quantity) {
  if (product.status !== 'ACTIVE') {
    throw new AppError(422, 'PRODUCT_NOT_PURCHASABLE', `판매 중지된 상품입니다. (${product.name})`);
  }
  if (product.stock === 0) {
    throw new AppError(409, 'OUT_OF_STOCK', `품절된 상품입니다. (${product.name})`);
  }
  if (quantity > product.stock) {
    throw new AppError(
      409,
      'OUT_OF_STOCK',
      `재고가 부족합니다. (${product.name} 남은 재고: ${product.stock}개, 요청 수량: ${quantity}개)`
    );
  }
}

function createProductService(db) {
  const selectAll = db.prepare('SELECT * FROM products ORDER BY id');
  const selectOne = db.prepare('SELECT * FROM products WHERE id = ?');

  function listProducts() {
    return selectAll.all().map(toProductDto);
  }

  function getProduct(id) {
    const row = selectOne.get(id);
    if (!row) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', `상품을 찾을 수 없습니다. (id: ${id})`);
    }
    return toProductDto(row);
  }

  return { listProducts, getProduct };
}

module.exports = { createProductService, toProductDto, assertCanBuy };
