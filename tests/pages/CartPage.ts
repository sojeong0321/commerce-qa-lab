import { Page, Locator, expect } from '@playwright/test';

export class CartPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/cart.html');
    await expect(this.page.getByRole('heading', { name: '장바구니', level: 1 })).toBeVisible();
  }

  row(productName: string): Locator {
    return this.page.getByRole('row', { name: new RegExp(productName) });
  }

  quantityInput(productName: string): Locator {
    // 목록 안의 요소는 행 범위로 좁혀서 찾는다.
    return this.row(productName).getByLabel(`${productName} 수량`);
  }

  async changeQuantity(productName: string, quantity: number) {
    await this.quantityInput(productName).fill(String(quantity));
    await this.row(productName).getByRole('button', { name: '변경' }).click();
  }

  async remove(productName: string) {
    await this.row(productName).getByRole('button', { name: '삭제' }).click();
  }

  async applyCoupon(code: string) {
    await this.page.getByLabel('쿠폰 코드').fill(code);
    await this.page.getByRole('button', { name: '적용' }).click();
  }

  get couponInput(): Locator {
    return this.page.getByLabel('쿠폰 코드');
  }

  couponListItem(code: string): Locator {
    return this.page.getByRole('list', { name: '보유 쿠폰' }).getByRole('listitem').filter({ hasText: code });
  }

  get subtotal(): Locator {
    return this.page.getByTestId('cart-subtotal');
  }

  get discount(): Locator {
    return this.page.getByTestId('cart-discount');
  }

  get total(): Locator {
    return this.page.getByTestId('cart-total');
  }

  get blockedNotice(): Locator {
    return this.page.getByTestId('cart-blocked');
  }

  get orderButton(): Locator {
    return this.page.getByRole('button', { name: '주문하기' });
  }

  async placeOrder() {
    await this.orderButton.click();
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

  get emptyMessage(): Locator {
    return this.page.getByText('장바구니가 비어 있습니다.');
  }
}
