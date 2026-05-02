import axios from 'axios';

export class Notifier {
  private static botToken = process.env.TELEGRAM_BOT_TOKEN;
  private static chatId = process.env.TELEGRAM_CHAT_ID;

  /**
   * Mengirim pesan ke Telegram atau sekadar Log jika token belum diset
   */
  public static async sendTelegram(message: string) {
    // Selalu print di terminal yang sedang berjalan
    console.log(`\n🔔 [ALERT]: ${message}\n`);

    // Fitur Telegram dimatikan sementara atas permintaan user
    return;
    
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'Markdown'
      });
    } catch (e: any) {
      console.error(`⚠️ Gagal mengirim Telegram: ${e.message}`);
    }
  }
}
