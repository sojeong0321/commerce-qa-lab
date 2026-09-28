import { test, expect } from '../support/fixtures';
import { getCart, getStock } from '../support/api';
import { PRODUCTS, USERS } from '../support/test-data';
import { ProductListPage } from '../pages/ProductListPage';
import { CartPage } from '../pages/CartPage';
import { OrderCompletePage } from '../pages/OrderCompletePage';
import { OrdersPage } from '../pages/OrdersPage';

const { jeans } = PRODUCTS;

test.describe('E2E-001 상품 선택 → 장바구니 → 주문 → 주문 완료', () => {
  test('손님이 상품을 담아 주문을 끝낼 수 있다', async ({ page, request }) => {
    const products = new ProductListPage(page);
    const cart = new CartPage(page);
    const complete = new OrderCompletePage(page);
    const orders = new OrdersPage(page);

    await test.step('상품 목록에서 데님 팬츠 2개를 담는다', async () => {
      await products.goto();
      await expect(products.price(jeans.name)).toHaveText('35,000원');
      await expect(products.stock(jeans.name)).toHaveText(`재고 ${jeans.stock}개`);

      await products.addToCart(jeans.name, 2);

      await expect(products.statusMessage).toHaveText(`${jeans.name} 2개를 장바구니에 담았습니다.`);
      await expect(products.cartCount).toHaveText('2');
    });

    await test.step('장바구니에서 금액을 확인하고 주문한다', async () => {
      await products.goToCart();
      await expect(cart.row(jeans.name)).toBeVisible();
      await expect(cart.subtotal).toHaveText('70,000원');
      await expect(cart.total).toHaveText('70,000원');

      await cart.placeOrder();
    });

    let orderId = 0;
    await test.step('주문 완료 화면에 주문번호와 결제금액이 보인다', async () => {
      await complete.expectLoaded();
      await expect(complete.orderNumber).toHaveText('#1');
      await expect(complete.total).toHaveText('70,000원');
      await expect(page.getByText(`${jeans.name} × 2 · 70,000원`)).toBeVisible();
      await expect(complete.cartCount).toHaveText('0');
      orderId = 1;
    });

    await test.step('주문 내역에 남고, 서버 상태도 함께 바뀌었다', async () => {
      await complete.goToOrders();
      await expect(orders.status(orderId)).toHaveText('주문 완료');
      await expect(orders.total(orderId)).toHaveText('70,000원');

      // 화면 표시뿐 아니라 실제 상태도 확인한다 (BR-O3)
      expect(await getStock(request, jeans.id)).toBe(jeans.stock - 2);
      expect((await getCart(request, USERS.alice)).items).toEqual([]);
    });

    await test.step('상품 목록의 재고 표시도 줄어 있다', async () => {
      await products.goto();
      await expect(products.stock(jeans.name)).toHaveText(`재고 ${jeans.stock - 2}개`);
    });
  });
});
