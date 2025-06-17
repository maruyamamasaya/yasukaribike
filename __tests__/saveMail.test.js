const putMock = jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
const DocumentClientMock = jest.fn(() => ({ put: putMock }));

jest.mock('aws-sdk', () => ({
  DynamoDB: { DocumentClient: DocumentClientMock }
}));

const { saveMail } = require('../fetchAllEmails');

describe('saveMail category', () => {
  beforeEach(() => {
    putMock.mockClear();
  });

  const parsed = { from: { text: '' }, to: { text: '' }, text: '', subject: '', date: new Date('2025-06-01') };

  test('INBOX.グーバイク.回答依頼', async () => {
    process.env.MAIL_TABLE = 'T';
    await saveMail('1', parsed, 'INBOX.グーバイク.回答依頼');
    const item = putMock.mock.calls[0][0].Item;
    expect(item.category).toBe('answer_request');
  });

  test('INBOX/グーバイク/回答依頼', async () => {
    process.env.MAIL_TABLE = 'T';
    await saveMail('1', parsed, 'INBOX/グーバイク/回答依頼');
    const item = putMock.mock.calls[0][0].Item;
    expect(item.category).toBe('answer_request');
  });

  test('グーバイク/見送りのお知らせ', async () => {
    process.env.MAIL_TABLE = 'T';
    await saveMail('1', parsed, 'グーバイク/見送りのお知らせ');
    const item = putMock.mock.calls[0][0].Item;
    expect(item.category).toBe('skip');
  });
});
