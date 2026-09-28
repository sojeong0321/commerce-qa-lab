import { Page, Locator, expect } from '@playwright/test';

// 화면마다 "무엇을 어떻게 찾는가"를 한곳에 모아 둔다.
// 화면 구조가 바뀌어도 테스트 본문이 아니라 이 파일만 고치면 된다.
export class ProductListPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: '상품', level: 1 })).toBeVisible();
  }

  /** 상품 카드. 목록 안 요소는 항상 카드 범위로 좁혀서 찾는다. */
  card(productName: string): Locator {
    return this.page.getByRole('article', { name: productName });
  }

  stock(productName: string): Locator {
    return this.card(productName).getByTestId('product-stock');
  }

  price(productName: string): Locator {
    return this.card(productName).getByTestId('product-price');
  }

  async addToCart(productName: string, quantity?: number) {
    if (quantity !== undefined) {
      await this.card(productName).getByLabel(`${productName} 수량`).fill(String(quantity));
    }
    await this.card(productName).getByRole('button', { name: '장바구니 담기' }).click();
  }

  buyButton(productName: string): Locator {
    return this.card(productName).getByRole('button', { name: '구매 불가' });
  }

  get statusMessage(): Locator {
    return this.page.getByRole('status');
  }

  get errorMessage(): Locator {
    return this.page.getByRole('alert');
  }

  get cartCount(): Locator {
    return this.page.getByTestId('cart-count');
  }

  async goToCart() {
    await this.page.getByRole('link', { name: '장바구니', exact: true }).click();
  }

  async goToOrders() {
    await this.page.getByRole('link', { name: '주문 내역' }).click();
  }
}
