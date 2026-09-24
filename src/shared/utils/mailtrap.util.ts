import { MailtrapClient } from 'mailtrap';
import { configs } from '../configs';
import { EmailParams, LogLevel } from '../interfaces';
import { runNextTick } from './helper.util';

let client: MailtrapClient;

const getClient = () => {
  const { apiKey, inboxId } = configs().mailtrap;
  client ??= new MailtrapClient({
    token: apiKey,
    ...(inboxId && { sandbox: true, testInboxId: inboxId }),
  });
  return client;
};

export const getMailTemplate = () => configs().mailtrap.templates;

export const sendMail = (params: EmailParams) =>
  runNextTick(async () => {
    const { to, from, subject, template, templateVariables } = params;
    const { mailtrap } = configs();
    const logData = { source: 'MailtrapSendMail', to, subject, template };

    if (!mailtrap.apiKey || !template) {
      global.dataLogsService?.log(
        'MailtrapSendMail',
        { ...logData, message: 'Mailtrap API key or template not configured' },
        LogLevel.ERROR,
      );
      return;
    }

    try {
      await getClient().send({
        from: mailtrap.defaultEmailFrom[from.toLowerCase()],
        to: [{ email: to }],
        template_uuid: template,
        template_variables: templateVariables,
      });
      global.dataLogsService?.log('MailtrapSendMail', logData, LogLevel.INFO);
    } catch (e) {
      global.dataLogsService?.log(
        'MailtrapSendMail',
        { ...logData, message: e.message },
        LogLevel.ERROR,
      );
    }
  });
