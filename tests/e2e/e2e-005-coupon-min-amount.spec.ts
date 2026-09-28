import { test, expect } from '../support/fixtures';
import { getCouponStatus } from '../support/api';
import { COUPONS, PRODUCTS, USERS } from '../support/test-data';
import { ProductListPage } from '../pages/ProductListPage';
import { CartPage } from '../pages/CartPage';

const { mug } = PRODUCTS;
const { welcome } = COUPONS;

test.describe('E2E-005 최소 주문금액 미충족 → 쿠폰 적용 불가', () => {
  test('금액이 모자라면 쿠폰이 적용되지 않고 이유가 보인다', async ({ page, request }) => {
    const products = new ProductListPage(page);
    const cart = new CartPage(page);

    await test.step('머그컵 2개(20,000원)를 담는다', async () => {
      await products.goto();
      await products.addToCart(mug.name, 2);
      await products.goToCart();
      await expect(cart.subtotal).toHaveText('20,000원');
    });

    await test.step('쿠폰을 적용하면 얼마가 모자란지 알려 준다', async () => {
      await cart.applyCoupon(welcome.code);

      await expect(cart.errorMessage).toHaveText('30,000원 이상 주문 시 사용할 수 있는 쿠폰입니다. (현재 20,000원)');
      await expect(cart.discount).toHaveText('0원');
      await expect(cart.total).toHaveText('20,000원');
      expect(await getCouponStatus(request, USERS.alice, welcome.code)).toBe('AVAILABLE');
    });

    await test.step('경계값: 3개(정확히 30,000원)로 늘리면 적용된다', async () => {
      await cart.changeQuantity(mug.name, 3);
      await expect(cart.subtotal).toHaveText('30,000원');

      await cart.applyCoupon(welcome.code);

      await expect(cart.discount).toHaveText('-5,000원');
      await expect(cart.total).toHaveText('25,000원');
    });

    await test.step('다시 2개로 줄이면 쿠폰이 자동 해제되고 이유를 알려 준다', async () => {
      await cart.changeQuantity(mug.name, 2);

      await expect(cart.errorMessage).toContainText('쿠폰 적용을 해제했습니다.');
      await expect(cart.couponInput).toHaveValue('');
      await expect(cart.discount).toHaveText('0원');
      await expect(cart.total).toHaveText('20,000원');
    });

    await test.step('쿠폰이 빠진 금액 그대로 주문된다', async () => {
      await cart.placeOrder();

      await expect(page.getByTestId('complete-total')).toHaveText('20,000원');
      expect(await getCouponStatus(request, USERS.alice, welcome.code)).toBe('AVAILABLE');
    });
  });
});
