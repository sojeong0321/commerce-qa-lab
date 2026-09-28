import { test, expect } from '../support/fixtures';
import { getCouponStatus, getStock } from '../support/api';
import { COUPONS, PRODUCTS, USERS } from '../support/test-data';
import { ProductListPage } from '../pages/ProductListPage';
import { CartPage } from '../pages/CartPage';
import { OrderCompletePage } from '../pages/OrderCompletePage';
import { OrdersPage } from '../pages/OrdersPage';

const { shoes } = PRODUCTS;
const { welcome } = COUPONS;
const ORDER_ID = 1;

test.describe('E2E-003 주문 → 재고 감소 → 취소 → 재고 원복', () => {
  test('주문을 취소하면 재고와 쿠폰이 원래대로 돌아온다', async ({ page, request }) => {
    const products = new ProductListPage(page);
    const cart = new CartPage(page);
    const complete = new OrderCompletePage(page);
    const orders = new OrdersPage(page);

    await test.step('주문 전 재고를 확인한다', async () => {
      await products.goto();
      await expect(products.stock(shoes.name)).toHaveText(`재고 ${shoes.stock}개`);
    });

    await test.step('쿠폰을 적용해 주문한다', async () => {
      await products.addToCart(shoes.name, 1);
      await products.goToCart();
      await cart.applyCoupon(welcome.code); // 89,000원 → 30,000원 조건 충족
      await expect(cart.total).toHaveText('84,000원');

      await cart.placeOrder();
      await complete.expectLoaded();
    });

    await test.step('재고가 1 줄어 있다', async () => {
      await complete.continueShopping();
      await expect(products.stock(shoes.name)).toHaveText(`재고 ${shoes.stock - 1}개`);
      expect(await getStock(request, shoes.id)).toBe(shoes.stock - 1);
      expect(await getCouponStatus(request, USERS.alice, welcome.code)).toBe('USED');
    });

    await test.step('주문 내역에서 취소한다', async () => {
      await products.goToOrders();
      await expect(orders.status(ORDER_ID)).toHaveText('주문 완료');

      await orders.cancel(ORDER_ID);

      await expect(orders.statusMessage).toContainText(`주문 #${ORDER_ID}을(를) 취소했습니다.`);
      await expect(orders.status(ORDER_ID)).toHaveText('취소됨');
    });

    await test.step('재고가 원래대로 복구되고 쿠폰도 다시 쓸 수 있다', async () => {
      await products.goto();
      await expect(products.stock(shoes.name)).toHaveText(`재고 ${shoes.stock}개`);
      expect(await getStock(request, shoes.id)).toBe(shoes.stock);
      expect(await getCouponStatus(request, USERS.alice, welcome.code)).toBe('AVAILABLE');
    });

    await test.step('취소된 주문에는 취소 버튼이 없다 (중복 취소 불가)', async () => {
      await orders.goto();
      await expect(orders.cancelButton(ORDER_ID)).toHaveCount(0);
    });
  });
});
