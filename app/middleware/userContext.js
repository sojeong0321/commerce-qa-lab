const { AppError } = require('../errors');

// 로그인 대신 X-User-Id 헤더로 사용자를 구분한다.
// 헤더가 없거나, 형식이 틀리거나, 없는 사용자면 401.
function userContext(db) {
  const findUser = db.prepare('SELECT id FROM users WHERE id = ?');

  return (req, res, next) => {
    const header = req.get('X-User-Id');
    const user = header && /^[1-9]\d*$/.test(header) ? findUser.get(Number(header)) : undefined;

    if (!user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'X-User-Id 헤더에 올바른 사용자 ID가 필요합니다.'));
    }

    req.userId = user.id;
    return next();
  };
}

module.exports = { userContext };
