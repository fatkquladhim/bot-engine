export class OrderRecovery {
  /**
   * Checks for orders that have been open for too long and cancels them if necessary.
   */
  public static async reconcileStuckOrders(client: any, pair: string): Promise<void> {
    try {
      const openOrders = await client.getOpenOrders(pair);
      if (!openOrders || openOrders.length === 0) return;

      const now = Date.now();
      for (const order of openOrders) {
        const orderTime = order.submit_time || now;
        const ageMinutes = (now - orderTime) / 60000;

        if (ageMinutes > 30) { // 30 minutes threshold
          console.log(`🧹 [RECOVERY] Cancelling stuck order ${order.order_id} for ${pair} (Age: ${ageMinutes.toFixed(1)}m)`);
          await client.cancelOrder(pair, order.order_id);
        }
      }
    } catch (e: any) {
      console.error(`❌ [RECOVERY] Failed to reconcile orders for ${pair}: ${e.message}`);
    }
  }
}
