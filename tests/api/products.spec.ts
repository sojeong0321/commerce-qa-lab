import { test, expect } from '../support/fixtures';
import { expectError } from '../support/api';
import { MISSING, PRODUCTS } from '../support/test-data';

test.describe('상품 조회', () => {
  test('API-PRD-001 상품 목록은 seed 상품 5개를 돌려준다', async ({ request }) => {
    const res = await request.get('/api/products');

    expect(res.status()).toBe(200);
    const { products } = await res.json();
    expect(products).toHaveLength(5);
    expect(products.map((p: { name: string }) => p.name)).toEqual([
      PRODUCTS.mug.name,
      PRODUCTS.jeans.name,
      PRODUCTS.shoes.name,
      PRODUCTS.soldOut.name,
      PRODUCTS.inactive.name,
    ]);
  });

  test('API-PRD-001b 품절/판매중지 상품은 구매 불가로 표시된다', async ({ request }) => {
    const { products } = await (await request.get('/api/products')).json();
    const byId = (id: number) => products.find((p: { id: number }) => p.id === id);

    expect(byId(PRODUCTS.jeans.id)).toMatchObject({ soldOut: false, purchasable: true });
    expect(byId(PRODUCTS.soldOut.id)).toMatchObject({ stock: 0, soldOut: true, purchasable: false });
    expect(byId(PRODUCTS.inactive.id)).toMatchObject({ status: 'INACTIVE', soldOut: false, purchasable: false });
  });

  test('API-PRD-002 상품 상세는 seed 값과 일치한다', async ({ request }) => {
    const res = await request.get(`/api/products/${PRODUCTS.jeans.id}`);

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      id: PRODUCTS.jeans.id,
      name: PRODUCTS.jeans.name,
      price: PRODUCTS.jeans.price,
      stock: PRODUCTS.jeans.stock,
      status: 'ACTIVE',
    });
  });

  test('API-PRD-003 없는 상품은 404', async ({ request }) => {
    const res = await request.get(`/api/products/${MISSING.productId}`);

    await expectError(res, 404, 'PRODUCT_NOT_FOUND');
  });

  test('API-PRD-004 상품 id 형식이 틀리면 400', async ({ request }) => {
    await expectError(await request.get('/api/products/abc'), 400, 'VALIDATION_ERROR');
    await expectError(await request.get('/api/products/0'), 400, 'VALIDATION_ERROR');
    await expectError(await request.get('/api/products/1.5'), 400, 'VALIDATION_ERROR');
  });

  test('상품 조회는 로그인 없이도 가능하다', async ({ request }) => {
    expect((await request.get('/api/products')).status()).toBe(200);
    expect((await request.get(`/api/products/${PRODUCTS.mug.id}`)).status()).toBe(200);
  });
});
