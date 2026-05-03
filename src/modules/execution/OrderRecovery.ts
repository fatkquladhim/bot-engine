export class OrderRecovery {
  /**
   * Checks for orders that have been open for too long and cancels them if necessary.
   */
  public static async reconcileStuckOrders(client: any, pair: string): Promise<void> {
    try {
      const result = await client.openOrders(pair);
      const openOrders = result?.orders ? Object.values(result.orders) : [];
      if (openOrders.length === 0) return;

      const now = Date.now();
      for (const order of openOrders as any[]) {
        const orderTime = (order.submit_time || 0) * 1000; // Indodax returns unix seconds
        const ageMinutes = orderTime > 0 ? (now - orderTime) / 60000 : 0;

        if (ageMinutes > 30) {
          console.log(`🧹 [RECOVERY] Cancelling stuck order ${order.order_id} for ${pair} (Age: ${ageMinutes.toFixed(1)}m)`);
          await client.cancelOrder(pair, order.order_id, order.type);
        }
      }
    } catch (e: any) {
      console.error(`❌ [RECOVERY] Failed to reconcile orders for ${pair}: ${e.message}`);
    }
  }
}
