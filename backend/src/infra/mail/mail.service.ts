import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * MailService – initializes a Nodemailer transporter from env vars.
 * In development Ethereal credentials are used; preview URL is logged.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;
  private fromAddress!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('MAIL_HOST');
    const port = Number(this.config.get<string>('MAIL_PORT') ?? 587);
    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASSWORD');

    this.fromAddress = this.config.get<string>('MAIL_FROM') ?? 'PJ-A <noreply@pja.local>';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log(`Mail transport ready (${host}:${port})`);
  }

  async send(options: SendMailOptions): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      const preview = nodemailer.getTestMessageUrl(info);
      this.logger.log(`Mail sent to ${options.to} (id=${info.messageId})${preview ? ` preview=${preview}` : ''}`);
    } catch (err) {
      this.logger.error(`Mail send failed to ${options.to}: ${(err as Error).message}`);
      // Do not rethrow – OTP flow should continue even if email fails.
    }
  }
}
