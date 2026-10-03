import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import {
  createTransferRecipient,
  listBanks,
  resolveAccountNumber,
} from './paystack.util';
import { isAccountNameMatch } from './helper.util';

jest.mock('axios');
const mockedAxios = axios as unknown as jest.Mock;

describe('paystack util', () => {
  const originalSecret = process.env.PAYSTACK_SECRET;

  beforeEach(() => {
    process.env.PAYSTACK_SECRET = 'sk_test_unit';
    mockedAxios.mockReset();
    global.dataLogsService = { log: jest.fn() };
  });

  afterAll(() => (process.env.PAYSTACK_SECRET = originalSecret));

  it('sends authenticated GET requests with query params and returns data', async () => {
    mockedAxios.mockResolvedValue({
      data: { status: true, data: [{ code: '044' }] },
    });

    await expect(listBanks()).resolves.toEqual([{ code: '044' }]);
    const request = mockedAxios.mock.calls[0][0];
    expect(request.url).toBe('https://api.paystack.co/bank');
    expect(request.params).toEqual({
      country: 'nigeria',
      currency: 'NGN',
      type: 'nuban',
      perPage: 100,
    });
    expect(request.headers.Authorization).toBe('Bearer sk_test_unit');
  });

  it('creates NUBAN transfer recipients with a POST body', async () => {
    mockedAxios.mockResolvedValue({
      data: { status: true, data: { recipient_code: 'RCP_1' } },
    });
    await createTransferRecipient({
      name: 'ADA',
      accountNumber: '0123456789',
      bankCode: '044',
    });
    expect(mockedAxios.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      url: 'https://api.paystack.co/transferrecipient',
      data: {
        type: 'nuban',
        name: 'ADA',
        account_number: '0123456789',
        bank_code: '044',
        currency: 'NGN',
      },
    });
  });

  it('turns Paystack 4xx errors into a 400 with their message', async () => {
    mockedAxios.mockRejectedValue({
      response: {
        status: 422,
        data: { message: 'Could not resolve account name' },
      },
    });
    await expect(
      resolveAccountNumber({ accountNumber: '0000000000', bankCode: '044' }),
    ).rejects.toThrow(
      new BadRequestException('Could not resolve account name'),
    );
  });

  it('treats network errors, 5xx and a bad secret (401) as provider unavailable', async () => {
    for (const error of [
      { message: 'timeout' },
      { response: { status: 500 } },
      { response: { status: 401 } },
    ]) {
      mockedAxios.mockRejectedValueOnce(error);
      await expect(listBanks()).rejects.toThrow(ServiceUnavailableException);
    }
  });

  it('never logs the secret key', async () => {
    mockedAxios.mockRejectedValue({
      response: {
        status: 500,
        config: { headers: { Authorization: 'Bearer sk_test_unit' } },
      },
    });
    await expect(listBanks()).rejects.toThrow();
    expect(JSON.stringify(global.dataLogsService.log.mock.calls)).not.toContain(
      'sk_test_unit',
    );
  });

  it('refuses to call Paystack without a secret', async () => {
    delete process.env.PAYSTACK_SECRET;
    await expect(listBanks()).rejects.toThrow('Payments are not configured');
    expect(mockedAxios).not.toHaveBeenCalled();
  });
});

describe('isAccountNameMatch', () => {
  it.each([
    ['LOVELACE ADA MARY', 'Ada', 'Lovelace', true],
    ['ADA LOVELACE', 'ada', 'LOVELACE', true],
    ['Lovelace, Ada-Mary', 'Ada', 'Lovelace', true],
    ['ADAEZE LOVELACE', 'Ada', 'Lovelace', false],
    ['JOHN DOE', 'Ada', 'Lovelace', false],
    ['ADA', 'Ada', 'Lovelace', false],
    ['', 'Ada', 'Lovelace', false],
  ])('"%s" vs %s %s -> %s', (accountName, first, last, expected) => {
    expect(isAccountNameMatch(accountName, first, last)).toBe(expected);
  });
});
