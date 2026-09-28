import { Page, Locator, expect } from '@playwright/test';

export class OrderCompletePage {
  constructor(private readonly page: Page) {}

  /** 주문 후 이 화면으로 이동했는지 확인한다. */
  async expectLoaded() {
    await expect(this.page).toHaveURL(/order-complete\.html\?orderId=\d+/);
    await expect(this.page.getByText('주문이 완료되었습니다.')).toBeVisible();
  }

  get orderNumber(): Locator {
    return this.page.getByTestId('order-number');
  }

  get subtotal(): Locator {
    return this.page.getByTestId('complete-subtotal');
  }

  get discount(): Locator {
    return this.page.getByTestId('complete-discount');
  }

  get total(): Locator {
    return this.page.getByTestId('complete-total');
  }

  get cartCount(): Locator {
    return this.page.getByTestId('cart-count');
  }

  async goToOrders() {
    await this.page.getByRole('link', { name: '주문 내역 보기' }).click();
  }

  async continueShopping() {
    await this.page.getByRole('link', { name: '계속 쇼핑하기' }).click();
  }
}
