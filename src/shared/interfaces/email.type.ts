export enum EmailFrom {
  HELLO = 'HELLO',
  SUPPORT = 'SUPPORT',
}

export type EmailParams = {
  to: string;
  from: EmailFrom;
  subject: string;
  template: string;
  templateVariables?: Record<string, any>;
};
