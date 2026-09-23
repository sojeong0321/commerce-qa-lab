const path = require('node:path');
const express = require('express');
const { createHealthRouter } = require('./routes/health');
const { createUsersRouter } = require('./routes/users');
const { createProductsRouter } = require('./routes/products');
const { createCartRouter } = require('./routes/cart');
const { createCouponsRouter, createCheckoutRouter } = require('./routes/coupons');
const { createTestSupportRouter } = require('./routes/testSupport');
const { createProductService } = require('./services/productService');
const { createCartService } = require('./services/cartService');
const { createCouponService } = require('./services/couponService');
const { userContext } = require('./middleware/userContext');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// 서버 실행(server.js)과 테스트가 같은 app을 쓰도록 app 생성만 담당한다.
function createApp({ db, env }) {
  const app = express();

  const productService = createProductService(db);
  const cartService = createCartService(db, productService);
  const couponService = createCouponService(db);

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // 사용자 구분이 필요 없는 API
  app.use('/api', createHealthRouter(db));
  app.use('/api', createUsersRouter(db));
  app.use('/api', createProductsRouter(productService));

  // 운영 환경에서 DB 초기화 API가 노출되지 않도록 test 환경에서만 등록한다.
  if (env === 'test') {
    app.use('/api', createTestSupportRouter(db));
  }

  // 사용자별 API: X-User-Id 헤더 필요
  app.use('/api/cart', userContext(db), createCartRouter(cartService));
  app.use('/api/coupons', userContext(db), createCouponsRouter(couponService));
  app.use('/api/checkout', userContext(db), createCheckoutRouter(cartService, couponService));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
