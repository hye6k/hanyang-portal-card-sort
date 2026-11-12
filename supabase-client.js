// 공개 키는 apikey로만 전송한다. 응답을 반환받는 SELECT 권한은 요청하지 않는다.
export async function sendResponse(config, record, fetcher = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetcher(`${config.supabaseUrl}/rest/v1/${config.table}`, {
      method: 'POST',
      headers: {
        apikey: config.publishableKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(record),
      signal: controller.signal,
    });
    if (response.status === 201) return { saved: true, repeated: false };
    let error = {};
    try { error = await response.json(); } catch { /* 빈 오류 본문도 실패로 처리한다. */ }
    // 첫 전송이 저장된 뒤 성공 응답만 유실된 경우, 같은 UUID와 동결된 본문으로 재시도한다.
    if (response.status === 409 && error.code === '23505') return { saved: true, repeated: true };
    throw new Error(`저장 확인 실패 (${response.status})`);
  } finally {
    clearTimeout(timer);
  }
}
