import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { EmailService } from '../src/auth/email.service';

describe('SMTP email delivery', () => {
  const settings = { NODE_ENV: 'development', EMAIL_TRANSPORT: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: 465, SMTP_USER: 'sender@gmail.com', SMTP_PASSWORD: 'test-app-password', EMAIL_FROM: 'sender@gmail.com', APP_BASE_URL: 'https://salonos.example' };
  let sendMail: jest.Mock;
  let log: jest.SpyInstance;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({ accepted: ['user@example.com'], messageId: 'mail-1' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as never);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses Gmail TLS and emails the exact code without logging it', async () => {
    const service = new EmailService(new ConfigService(settings));
    await service.sendVerification('user@example.com', '001234');
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true, requireTLS: true, auth: { user: settings.SMTP_USER, pass: settings.SMTP_PASSWORD } }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: settings.EMAIL_FROM, to: 'user@example.com', text: expect.stringContaining('001234') }));
    expect(JSON.stringify(log.mock.calls)).not.toContain('001234');
  });

  it('requires a TLS upgrade when using port 587', () => {
    new EmailService(new ConfigService({ ...settings, SMTP_PORT: 587 }));
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: true }));
  });

  it('fails clearly when credentials are missing', async () => {
    const service = new EmailService(new ConfigService({ EMAIL_TRANSPORT: 'smtp', SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', EMAIL_FROM: settings.EMAIL_FROM }));
    await expect(service.sendVerification('user@example.com', '001234')).rejects.toThrow(ServiceUnavailableException);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('does not report success when SMTP rejects or fails to accept the recipient', async () => {
    const service = new EmailService(new ConfigService(settings));
    sendMail.mockRejectedValueOnce(new Error('SMTP auth failed'));
    await expect(service.sendVerification('user@example.com', '001234')).rejects.toThrow(ServiceUnavailableException);
    sendMail.mockResolvedValueOnce({ accepted: [], rejected: ['user@example.com'] });
    await expect(service.sendVerification('user@example.com', '001234')).rejects.toThrow(ServiceUnavailableException);
  });

  it('never silently previews mail in production', async () => {
    const service = new EmailService(new ConfigService({ NODE_ENV: 'production', EMAIL_TRANSPORT: 'json', EMAIL_FROM: settings.EMAIL_FROM }));
    await expect(service.sendVerification('user@example.com', '001234')).rejects.toThrow(ServiceUnavailableException);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
});
