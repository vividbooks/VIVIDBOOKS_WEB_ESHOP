/**
 * BaseLinker API — úprava polí existující objednávky (`setOrderFields`).
 * Dokumentace: https://api.baselinker.com/index.php?method=setOrderFields
 */
export async function callBasecomSetOrderFields(
  apiToken: string,
  orderId: number,
  fields: Record<string, string | number | boolean>,
): Promise<void> {
  const body = new URLSearchParams({
    method: 'setOrderFields',
    parameters: JSON.stringify({ order_id: orderId, ...fields }),
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
    throw new Error(`Base.com setOrderFields HTTP ${response.status}`);
  }
  if (data?.status !== 'SUCCESS') {
    throw new Error(`Base.com setOrderFields: ${data?.error_message || JSON.stringify(data)}`);
  }
}
