import { test, expect } from '../support/fixtures';
import { getCouponStatus } from '../support/api';
import { COUPONS, PRODUCTS, USERS } from '../support/test-data';
import { ProductListPage } from '../pages/ProductListPage';
import { CartPage } from '../pages/CartPage';
import { OrderCompletePage } from '../pages/OrderCompletePage';

const { jeans } = PRODUCTS;
const { welcome } = COUPONS;

test.describe('E2E-002 쿠폰 적용 → 할인 확인 → 주문 → 최종 결제금액', () => {
  test('쿠폰을 적용하면 할인된 금액으로 주문된다', async ({ page, request }) => {
    const products = new ProductListPage(page);
    const cart = new CartPage(page);
    const complete = new OrderCompletePage(page);

    await test.step('데님 팬츠를 담고 장바구니로 이동한다', async () => {
      await products.goto();
      await products.addToCart(jeans.name, 1);
      await products.goToCart();
      await expect(cart.total).toHaveText('35,000원');
      await expect(cart.discount).toHaveText('0원');
    });

    await test.step('쿠폰을 적용하면 할인 금액과 결제 예정 금액이 바뀐다', async () => {
      await expect(cart.couponListItem(welcome.code)).toContainText('사용 가능');

      await cart.applyCoupon(welcome.code);

      await expect(cart.statusMessage).toHaveText(`쿠폰 ${welcome.code}을(를) 적용했습니다. 5,000원 할인`);
      await expect(cart.discount).toHaveText('-5,000원');
      await expect(cart.total).toHaveText('30,000원');
      await expect(cart.subtotal).toHaveText('35,000원'); // 상품 금액은 그대로
    });

    await test.step('주문하면 완료 화면에도 같은 금액이 나온다', async () => {
      await cart.placeOrder();

      await complete.expectLoaded();
      await expect(complete.subtotal).toHaveText('35,000원');
      await expect(complete.discount).toHaveText('-5,000원');
      await expect(complete.total).toHaveText('30,000원');
    });

    await test.step('쿠폰이 사용 완료로 바뀌고 다시 쓸 수 없다', async () => {
      expect(await getCouponStatus(request, USERS.alice, welcome.code)).toBe('USED');

      await products.goto();
      await products.addToCart(jeans.name, 1);
      await products.goToCart();
      await expect(cart.couponListItem(welcome.code)).toContainText('사용 완료');

      await cart.applyCoupon(welcome.code);

      await expect(cart.errorMessage).toContainText('이미 사용한 쿠폰입니다');
      await expect(cart.total).toHaveText('35,000원'); // 할인되지 않는다
    });
  });
});
