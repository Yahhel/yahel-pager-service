import { configs } from '../configs';
import { LogLevel, EmailParams } from '../interfaces';
import { MailtrapClient } from 'mailtrap';
import { isTestEnv } from './helper.util';

export const getMailTemplate = () => configs().mailtrap.templates;

export const sendMail = ({
  to,
  from,
  subject,
  template,
  templateVariables,
}: EmailParams) => {
  setImmediate(async () => {
    try {
      const { mailtrap: mailConfig } = configs();
      const client = new MailtrapClient({
        token: mailConfig.apiKey,
        ...(mailConfig.inboxId && {
          sandbox: true,
          testInboxId: mailConfig.inboxId,
        }),
      });

      const SENDER_EMAIL = isTestEnv()
        ? (mailConfig.defaultEmailFrom[
            from.toString().toLowerCase()
          ] as string) || from
        : mailConfig.defaultEmailFrom[from.toString().toLowerCase()];

      const RECIPIENT_EMAIL = to;

      const data = {
        from: {
          name: '',
          email: SENDER_EMAIL,
        },
        to: [{ email: RECIPIENT_EMAIL }],
        template_uuid: template,
        template_variables: templateVariables,
      };

      const res = await client.send(data);

      global.dataLogsService.log(
        'MailtrapSendMail',
        {
          source: 'MailtrapSendMail',
          to,
          from,
          subject,
          template,
          templateVariables,
          ...(typeof res === 'object' ? res : { data: res }),
        },
        LogLevel.INFO,
      );

      return true;
    } catch (e) {
      global.dataLogsService.log(
        'MailtrapSendMail',
        {
          source: 'MailtrapSendMail',
          to,
          from,
          subject,
          template,
          templateVariables,
          stack: e.status,
          message: e.message,
        },
        LogLevel.ERROR,
      );
      return false;
    }
  });
};
