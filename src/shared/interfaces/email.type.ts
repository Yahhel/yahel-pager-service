export enum EmailFrom {
  HELLO = 'HELLO',
  SUPPORT = 'SUPPORT',
  ENGINEERING = 'ENGINEERING',
  MARKETING = 'MARKETING',
  FINANCE = 'FINANCE',
  NOREPLY = 'NOREPLY',
}

export const emailFromTypes = [...new Set(Object.values(EmailFrom))];

export type EmailParams = {
  to: string;
  from: EmailFrom | string;
  subject: string;
  template: string;
  templateVariables: any;
  replyTo?: string;
};
