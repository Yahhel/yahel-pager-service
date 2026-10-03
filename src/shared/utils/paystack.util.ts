import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { configs } from '@shared/configs';
import {
  LogLevel,
  PaystackBank,
  PaystackResolvedAccount,
  PaystackResponse,
  PaystackTransferRecipient,
} from '@shared/interfaces';
import { axiosRequest } from './helper.util';

const source = 'PaystackUtil';

const paths = {
  banks: '/bank',
  resolveAccount: '/bank/resolve',
  transferRecipient: '/transferrecipient',
  transferRecipientByCode: (code: string) => `/transferrecipient/${code}`,
};

const paystackRequest = async <T>(
  path: string,
  payload: Record<string, any> = {},
  method: 'POST' | 'GET' | 'PUT' | 'DELETE' = 'GET',
): Promise<T> => {
  const { secret, baseUrl } = configs().paystack;
  if (!secret)
    throw new ServiceUnavailableException('Payments are not configured');

  try {
    const response: PaystackResponse<T> = await axiosRequest(
      {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      { timeout: 30000 },
      baseUrl,
    )(path, payload, method);

    if (!response?.status) throw new BadRequestException(response?.message);
    return response.data;
  } catch (exp) {
    if (exp instanceof BadRequestException) throw exp;

    const status = exp?.response?.status;
    const message = exp?.response?.data?.message || exp?.message;
    global.dataLogsService?.log(
      source,
      { source, path, method, status, message },
      LogLevel.ERROR,
    );

    // Paystack rejects bad input (e.g. unknown account) with 4xx; anything else is an outage on our side
    if (status >= 400 && status < 500 && status !== 401)
      throw new BadRequestException(
        message || 'Payment provider rejected the request',
      );
    throw new ServiceUnavailableException(
      'Payment provider is temporarily unavailable, try again',
    );
  }
};

export const listBanks = async ({
  country = 'nigeria',
  currency = 'NGN',
  type = 'nuban',
  perPage = 100,
}: {
  country?: string;
  currency?: string;
  type?: string;
  perPage?: number;
} = {}): Promise<PaystackBank[]> =>
  paystackRequest<PaystackBank[]>(paths.banks, {
    country,
    currency,
    type,
    perPage,
  });

export const resolveAccountNumber = async ({
  accountNumber,
  bankCode,
}: {
  accountNumber: string;
  bankCode: string;
}): Promise<PaystackResolvedAccount> =>
  paystackRequest<PaystackResolvedAccount>(paths.resolveAccount, {
    account_number: accountNumber,
    bank_code: bankCode,
  });

export const createTransferRecipient = async ({
  name,
  accountNumber,
  bankCode,
  currency = 'NGN',
  metadata,
}: {
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
  metadata?: Record<string, any>;
}): Promise<PaystackTransferRecipient> =>
  paystackRequest<PaystackTransferRecipient>(
    paths.transferRecipient,
    {
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency,
      metadata,
    },
    'POST',
  );

export const deleteTransferRecipient = async (
  recipientCode: string,
): Promise<boolean> => {
  await paystackRequest(
    paths.transferRecipientByCode(recipientCode),
    {},
    'DELETE',
  );
  return true;
};
