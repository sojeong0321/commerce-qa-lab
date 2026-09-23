// 화면에서 공통으로 쓰는 API 호출과 포맷 함수.

const USER_KEY = 'commerce-qa-lab.userId';
const DEFAULT_USER_ID = '1';

export function getUserId() {
  try {
    return localStorage.getItem(USER_KEY) || DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

export function setUserId(id) {
  try {
    localStorage.setItem(USER_KEY, String(id));
  } catch {
    // 저장이 막힌 브라우저에서는 기본 사용자로 동작한다.
  }
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// 서버가 에러를 보내면 ApiError를 던진다. 화면은 error.message를 그대로 보여 준다.
export async function api(method, path, body) {
  const headers = { 'X-User-Id': getUserId() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // 서버에 닿지 못한 경우. 브라우저 원문 메시지 대신 사람이 읽을 수 있는 안내를 보여 준다.
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, data.error?.code, data.error?.message ?? '요청을 처리하지 못했습니다.');
  }
  return data;
}

export function formatWon(amount) {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
