import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendEmail(to: string, subject: string, body: string) {
    try {
      const info = await this.transporter.sendMail({
        from: `"Nexora AG" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html: body,
      });

      // await this.saveEmailLog(to, subject, body, 'sent');

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error('Error sending email:', error);
      // await this.saveEmailLog(to, subject, body, 'failed', error.message);
      throw error;
    }
  }

  async sendOrderConfirmation(orderId: string, email: string) {
    // Get order details
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        vehicle: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Build email body
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Confirmação de Ordem de Serviço</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c3e50;">Nexora AG - Sistema de Gestão</h1>
          
          <h2 style="color: #3498db;">Ordem de Serviço Confirmada</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">#${order.orderNumber} - ${this.getStatusDisplay(order.status)}</h3>
            
            <p><strong>Cliente:</strong> ${order.customer.name}</p>
            <p><strong>Email:</strong> ${order.customer.email || 'Não informado'}</p>
            <p><strong>Telefone:</strong> ${order.customer.phone}</p>
            
            ${order.vehicle ? `
            <h4>Veículo</h4>
            <p>${order.vehicle.brand} ${order.vehicle.model} (${order.vehicle.year})</p>
            <p>Placa: ${order.vehicle.plate}</p>
            ` : ''}
            
            <h4>Descrição do Serviço</h4>
            <p>${order.problemDescription || 'Não informado'}</p>
            
            <p><strong>Status:</strong> ${this.getStatusDisplay(order.status)}</p>
            ${order.totalValue ? `<p><strong>Valor Total:</strong> R$ ${order.totalValue.toFixed(2)}</p>` : ''}
          </div>
          
          <p>Obrigado por escolher a Nexora AG!</p>
          <p>Estamos à disposição para atender suas necessidades.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            Esta é uma mensagem automática. Por favor, não responda diretamente a este e-mail.<br>
            Para contato, envie uma mensagem para o WhatsApp ou ligue para nossos telefones.
          </p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(email, `Confirmação - Ordem de Serviço #${order.orderNumber}`, html);

    return { success: true };
  }

  private getStatusDisplay(status: string) {
    const statusMap: any = {
      pending: 'Pendente',
      waiting: 'Aguardando',
      in_progress: 'Em andamento',
      completed: 'Concluído',
      cancelled: 'Cancelado',
    };
    return statusMap[status] || status;
  }

  private async saveEmailLog(to: string, subject: string, body: string) {
    // Create email log entry
    await this.prisma.emailLog.create({
      data: {
        to,
        subject,
        body,
        tenantId: 'default-tenant-id', // Placeholder - in real app get from auth
      },
    });
  }
}
