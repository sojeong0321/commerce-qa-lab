import { test, expect } from '../support/fixtures';
import { addToCart, getCart, getOrders, getStock, placeOrder } from '../support/api';
import { PRODUCTS, USERS } from '../support/test-data';
import { ProductListPage } from '../pages/ProductListPage';
import { CartPage } from '../pages/CartPage';
import { OrdersPage } from '../pages/OrdersPage';

const { shoes, soldOut, inactive } = PRODUCTS;
const REMAINING_AFTER_BOB = 1; // 다른 손님이 주문한 뒤 남는 재고

test.describe('E2E-004 재고보다 많은 수량 주문 → 주문 불가', () => {
  test('재고보다 많은 수량은 장바구니에 담기지 않는다', async ({ page, request }) => {
    const products = new ProductListPage(page);
    await products.goto();

    await products.addToCart(shoes.name, shoes.stock + 1);

    await expect(products.errorMessage).toContainText('재고가 부족합니다');
    await expect(products.cartCount).toHaveText('0');
    expect((await getCart(request, USERS.alice)).items).toEqual([]); // 서버에도 담기지 않았다
  });

  test('품절/판매 중지 상품은 담기 버튼 자체가 비활성이다', async ({ page }) => {
    const products = new ProductListPage(page);
    await products.goto();

    await expect(products.card(soldOut.name).getByText('품절')).toBeVisible();
    await expect(products.buyButton(soldOut.name)).toBeDisabled();
    await expect(products.card(inactive.name).getByText('판매 중지')).toBeVisible();
    await expect(products.buyButton(inactive.name)).toBeDisabled();
  });

  test('장바구니를 연 사이 다른 손님이 사 가면 주문이 거절된다', async ({ page, request }) => {
    const products = new ProductListPage(page);
    const cart = new CartPage(page);
    const orders = new OrdersPage(page);

    await test.step('러닝화 재고 전부를 담고 장바구니를 연다', async () => {
      await products.goto();
      await products.addToCart(shoes.name, shoes.stock);
      await products.goToCart();
      await expect(cart.orderButton).toBeEnabled(); // 이 시점에는 주문할 수 있다
    });

    await test.step('화면을 열어 둔 사이 다른 손님이 먼저 주문한다 (API로 사전 조건 생성)', async () => {
      await addToCart(request, USERS.bob, shoes.id, shoes.stock - REMAINING_AFTER_BOB);
      await placeOrder(request, USERS.bob);
      expect(await getStock(request, shoes.id)).toBe(REMAINING_AFTER_BOB);
    });

    await test.step('주문을 누르면 이유와 함께 거절된다', async () => {
      await cart.placeOrder();

      await expect(cart.errorMessage).toContainText('재고가 부족합니다');
      await expect(page).toHaveURL(/cart\.html/); // 완료 화면으로 넘어가지 않는다
      await expect(cart.cartCount).toHaveText(String(shoes.stock)); // 장바구니는 그대로
    });

    await test.step('주문이 생기지 않았고 재고도 그대로다', async () => {
      expect(await getOrders(request, USERS.alice)).toEqual([]);
      expect(await getStock(request, shoes.id)).toBe(REMAINING_AFTER_BOB);

      await orders.goto();
      await expect(orders.emptyMessage).toBeVisible();
    });

    await test.step('다시 열면 주문 버튼이 막히고 이유가 먼저 보인다', async () => {
      await cart.goto();
      await expect(cart.blockedNotice).toContainText(shoes.name);
      await expect(cart.orderButton).toBeDisabled();
    });

    await test.step('품절 경고가 있어도 안내 문구에 상품명만 들어간다', async () => {
      // 경고 문구가 상품명 칸 안에 있어서 메시지에 섞여 들어간 적이 있다.
      await cart.changeQuantity(shoes.name, 1);
      await expect(cart.statusMessage).toHaveText(`${shoes.name} 수량을 1개로 변경했습니다.`);

      await cart.remove(shoes.name);
      await expect(cart.statusMessage).toHaveText(`${shoes.name}을(를) 장바구니에서 삭제했습니다.`);
    });
  });
});
