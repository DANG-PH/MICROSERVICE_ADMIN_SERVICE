export interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordAlertPayload {
  title: string;
  color: number;
  fields: DiscordField[];
  description?: string;
}

// Màu sắc embed Discord
const COLOR = {
  DO: 0xFF0000,   // critical / failed
  CAM: 0xFFA500,  // warning / retry
  XANH: 0x00AA00, // success (dùng khi cần)
} as const;

export class DiscordAlert {
  private static readonly webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  // Gửi alert thô — dùng khi cần tuỳ chỉnh hoàn toàn
  static async gui(payload: DiscordAlertPayload): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('[DiscordAlert] DISCORD_WEBHOOK_URL chưa được cấu hình, bỏ qua alert');
      return;
    }

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: payload.title,
          color: payload.color,
          description: payload.description,
          timestamp: new Date().toISOString(),
          fields: payload.fields,
        }],
      }),
    }).catch(e => console.error('[DiscordAlert] Gửi alert thất bại:', e));
  }

  // Saga thất bại hoàn toàn sau khi hết maxRetries VÀ đã có side effect dở dang
  // → bắt buộc engineer xử lý tay, không tự reset được
  static async sagaCritical(params: {
    sagaId: string;
    phase: string;
    attempt: number;
    completedSteps: string[];
    lastError: string;
  }): Promise<void> {
    await this.gui({
      title: '🚨 CRITICAL: Saga thất bại — cần xử lý thủ công',
      color: COLOR.DO,
      fields: [
        { name: 'Saga ID',         value: params.sagaId,                                                     inline: true },
        { name: 'Phase',           value: params.phase,                                                       inline: true },
        { name: 'Số lần thử',      value: String(params.attempt),                                            inline: true },
        { name: 'Các bước đã chạy',value: params.completedSteps.join(' → ') || 'Chưa có bước nào hoàn thành'              },
        { name: 'Lỗi cuối',        value: params.lastError.slice(0, 1024)                                                  },
        { name: 'Cần làm gì',      value: params.phase === 'FORWARD'
            ? 'Forward dở dang — kiểm tra và credit/rollback thủ công cho các bước đã chạy'
            : 'Compensation dở dang — review và ép hoàn thành hoặc rollback hoàn toàn'                                     },
      ],
    });
  }

  // Saga đang retry — cảnh báo sớm để theo dõi
  static async sagaWarn(params: {
    sagaId: string;
    retry: number;
    maxRetries: number;
    lastError: string;
  }): Promise<void> {
    await this.gui({
      title: '⚠️ Saga đang retry',
      color: COLOR.CAM,
      fields: [
        { name: 'Saga ID',   value: params.sagaId,                           inline: true },
        { name: 'Lần thử',  value: `${params.retry}/${params.maxRetries}`,  inline: true },
        { name: 'Lỗi',      value: params.lastError.slice(0, 1024)                       },
      ],
    });
  }

  // Saga thất bại nhưng chưa có side effect → an toàn reset account về ACTIVE
  static async taiKhoanResetVeActive(params: {
    sagaId: string;
    accountId: string;
  }): Promise<void> {
    await this.gui({
      title: '✅ Saga thất bại — tài khoản đã được reset về ACTIVE',
      color: COLOR.XANH,
      fields: [
        { name: 'Saga ID',    value: params.sagaId,    inline: true },
        { name: 'Account ID', value: params.accountId, inline: true },
        { name: 'Ghi chú',   value: 'Chưa có bước nào chạy nên tự reset an toàn, không cần xử lý thủ công' },
      ],
    });
  }
}