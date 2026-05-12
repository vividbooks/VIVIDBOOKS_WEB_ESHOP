/**
 * BaseLinker API — změna stavu objednávky (`setOrderStatus`).
 * Dokumentace: https://api.baselinker.com/index.php?method=setOrderStatus
 */
export async function callBasecomSetOrderStatus(
  apiToken: string,
  orderId: number,
  statusId: number,
): Promise<void> {
  const body = new URLSearchParams({
    method: 'setOrderStatus',
    parameters: JSON.stringify({ order_id: orderId, status_id: statusId }),
  });
  const response = await fetch('https://api.baselinker.com/connector.php', {
    method: 'POST',
    headers: {
      'X-BLToken': apiToken,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = await response.json().catch(() => ({} as { status?: string; error_message?: string }));
  if (!response.ok) {
    throw new Error(`Base.com setOrderStatus HTTP ${response.status}`);
  }
  if (data?.status !== 'SUCCESS') {
    throw new Error(`Base.com setOrderStatus: ${data?.error_message || JSON.stringify(data)}`);
  }
}
