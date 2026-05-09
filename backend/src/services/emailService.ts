import nodemailer from "nodemailer";

type TransporterConfig = {
  service?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
};

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;
  private isEnabled: boolean;

  constructor() {
    this.fromEmail = process.env.MAIL_FROM || process.env.MAIL_USER || "noreply@votecounting.local";
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const mailService = process.env.MAIL_SERVICE || "gmail";
    const mailHost = process.env.MAIL_HOST;
    const mailPort = process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT) : undefined;
    const mailUser = process.env.MAIL_USER;
    const mailPass = process.env.MAIL_PASS;

    // If no credentials, disable email
    if (!mailUser || !mailPass) {
      console.warn(
        "⚠️  Email not configured. Set MAIL_USER and MAIL_PASS to enable email notifications."
      );
      this.isEnabled = false;
      return;
    }

    const setupTransport = async (cfg: any) => {
      try {
        this.transporter = nodemailer.createTransport(cfg);
        const ok = await this.transporter.verify().then(() => true).catch(() => false);
        if (!ok) throw new Error("Transport verify failed");
        this.isEnabled = true;
        console.log(`✅ Email service configured (${mailHost ? mailHost : mailService})`);
        return true;
      } catch (err: any) {
        console.warn("⚠️  Transport verify failed:", err?.message || err);
        this.transporter = null;
        this.isEnabled = false;
        return false;
      }
    };

    (async () => {
      try {
        let config: any;

        if (mailHost && mailPort) {
          // Custom SMTP
          config = {
            host: mailHost,
            port: mailPort,
            secure: mailPort === 465,
            auth: {
              user: mailUser,
              pass: mailPass,
            },
          };
        } else {
          // Use service (Gmail, Outlook, etc.)
          config = {
            service: mailService,
            auth: {
              user: mailUser,
              pass: mailPass,
            },
          };
        }

        const ok = await setupTransport(config);

        // If initial attempt fails and host looks like Ethereal, create a test account
        if (!ok && (mailHost === "smtp.ethereal.email" || process.env.FORCE_ETHEREAL === "true")) {
          console.log("ℹ️  Falling back to Ethereal test account...");
          const testAcct = await nodemailer.createTestAccount();
          const ethConfig = {
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
              user: testAcct.user,
              pass: testAcct.pass,
            },
          };
          const ethOk = await setupTransport(ethConfig);
          if (ethOk) {
            console.log(`📧 Ethereal account: ${testAcct.user} / ${testAcct.pass}`);
          }
        }
      } catch (e: any) {
        console.error("❌ Email setup error:", e?.message || e);
      }
    })();
  }

  async sendUserApprovalEmail(userEmail: string, fullName: string): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) {
      console.log(
        `📧 Email disabled - would send approval email to ${userEmail}`
      );
      return false;
    }

    try {
      const systemName = process.env.SYSTEM_NAME || "Vote Counting System";
      const systemDesc = process.env.SYSTEM_DESCRIPTION || "hệ thống";
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Tài khoản đã được duyệt</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
            <p>Xin chào <strong>${fullName || "bạn"}</strong>,</p>
            
            <p>Chúng tôi vui mừng thông báo rằng tài khoản của bạn đã được admin duyệt và kích hoạt thành công!</p>
            
            <p>Bạn có thể đăng nhập ngay bây giờ để bắt đầu sử dụng ${systemDesc} của chúng tôi.</p>
            
            <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
              <p><strong>Thông tin tài khoản:</strong></p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Email: <strong>${userEmail}</strong></li>
              </ul>
            </div>
            
            <p style="margin-top: 30px; color: #666;">
              Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với admin.
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
              © 2026 ${systemName}. Đây là email tự động, vui lòng không trả lời.
            </p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: this.fromEmail,
        to: userEmail,
        subject: `Tài khoản của bạn đã được duyệt - ${systemName}`,
        html: htmlContent,
        text: `Xin chào ${fullName || "bạn"},\n\nTài khoản của bạn đã được admin duyệt và kích hoạt thành công!\n\nBạn có thể đăng nhập ngay bây giờ.\n\nEmail: ${userEmail}`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Approval email sent to ${userEmail} (${info.messageId})`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send approval email to ${userEmail}:`, error);
      return false;
    }
  }

  async sendUserRejectionEmail(userEmail: string, fullName: string): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) {
      console.log(`📧 Email disabled - would send rejection email to ${userEmail}`);
      return false;
    }

    try {
      const systemName = process.env.SYSTEM_NAME || "Vote Counting System";
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Đơn đăng ký bị từ chối</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
            <p>Xin chào <strong>${fullName || "bạn"}</strong>,</p>
            
            <p>Chúng tôi rất tiếc phải thông báo rằng đơn đăng ký tài khoản của bạn đã bị từ chối.</p>
            
            <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 0; color: #991b1b;">
                Nếu bạn có bất kỳ câu hỏi hay muốn biết thêm thông tin, vui lòng liên hệ trực tiếp với admin.
              </p>
            </div>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
              © 2026 ${systemName}. Đây là email tự động, vui lòng không trả lời.
            </p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: this.fromEmail,
        to: userEmail,
        subject: `Thông báo về đơn đăng ký - ${systemName}`,
        html: htmlContent,
        text: `Xin chào ${fullName || "bạn"},\n\nChúng tôi rất tiếc phải thông báo rằng đơn đăng ký tài khoản của bạn đã bị từ chối.\n\nNếu bạn có bất kỳ câu hỏi, vui lòng liên hệ với admin.`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Rejection email sent to ${userEmail} (${info.messageId})`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send rejection email to ${userEmail}:`, error);
      return false;
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      console.log("✅ Email transporter connection verified");
      return true;
    } catch (error) {
      console.error("❌ Email transporter connection failed:", error);
      return false;
    }
  }

  isEmailEnabled(): boolean {
    return this.isEnabled;
  }
}

export const emailService = new EmailService();
