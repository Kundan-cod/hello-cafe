import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailerService {
  /**
   * Sends an email. Prefers Resend (RESEND_API_KEY) when set — works on Render and other hosts
   * that block SMTP. Falls back to SMTP (MAIL_HOST, MAIL_USER, MAIL_PASS) for local dev.
   */
  async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    const resendKey = process.env.RESEND_API_KEY;

    if (resendKey) {
      await this.sendViaResend(resendKey, options);
      return;
    }

    const mailHost = process.env.MAIL_HOST;
    const mailUser = process.env.MAIL_USER;
    const mailPass = process.env.MAIL_PASS;

    if (mailHost && mailUser && mailPass) {
      await this.sendViaSmtp(options);
      return;
    }

    console.warn(
      '[Mailer] No email configured. Set RESEND_API_KEY (recommended on Render) or MAIL_HOST, MAIL_USER, MAIL_PASS.',
    );
    throw new Error(
      'Email is not configured. Set RESEND_API_KEY or MAIL_HOST, MAIL_USER, and MAIL_PASS.',
    );
  }

  private async sendViaResend(
    apiKey: string,
    options: { to: string; subject: string; text: string; html?: string },
  ): Promise<void> {
    const from = 'Cafe App <onboarding@resend.dev>';
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html ?? options.text.replace(/\n/g, '<br>'),
    });

    if (error) {
      console.error('[Mailer] Resend failed to', options.to, error);
      throw new Error(
        'Failed to send email: ' + (error.message || JSON.stringify(error)),
      );
    }
    console.log(
      '[Mailer] Email sent to',
      options.to,
      'subject:',
      options.subject,
      'id:',
      data?.id,
    );
  }

  private async sendViaSmtp(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    const mailHost = process.env.MAIL_HOST!;
    const mailUser = process.env.MAIL_USER!;
    const mailPass = process.env.MAIL_PASS!;

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: mailHost,
      port: parseInt(process.env.MAIL_PORT || '587', 10),
      secure: process.env.MAIL_SECURE === 'true',
      auth: { user: mailUser, pass: mailPass },
    });

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || mailUser,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text.replace(/\n/g, '<br>'),
      });
      console.log(
        '[Mailer] Email sent to',
        options.to,
        'subject:',
        options.subject,
      );
    } catch (err) {
      console.error('[Mailer] SMTP send failed to', options.to, err);
      throw new Error(
        'Failed to send email. On Render/hosted env use RESEND_API_KEY instead of SMTP (SMTP ports are often blocked).',
      );
    }
  }
}
