import { Page, Locator, expect } from '@playwright/test';

export class OrdersPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/orders.html');
    await expect(this.page.getByRole('heading', { name: '주문 내역', level: 1 })).toBeVisible();
  }

  order(orderId: number): Locator {
    return this.page.getByRole('article', { name: `주문 #${orderId}` });
  }

  status(orderId: number): Locator {
    return this.order(orderId).getByTestId('order-status');
  }

  total(orderId: number): Locator {
    return this.order(orderId).getByTestId('order-total');
  }

  discount(orderId: number): Locator {
    return this.order(orderId).getByTestId('order-discount');
  }

  cancelButton(orderId: number): Locator {
    return this.order(orderId).getByRole('button', { name: '주문 취소' });
  }

  async cancel(orderId: number) {
    await this.cancelButton(orderId).click();
  }

  get statusMessage(): Locator {
    return this.page.getByRole('status');
  }

  get errorMessage(): Locator {
    return this.page.getByRole('alert');
  }

  get emptyMessage(): Locator {
    return this.page.getByText('주문 내역이 없습니다.');
  }
}
