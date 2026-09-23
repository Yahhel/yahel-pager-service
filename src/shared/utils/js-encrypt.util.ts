import { randomUUID } from 'crypto';

export const generateRsaKeyPair = async () => {
  let publicKey = randomUUID();
  let privateKey = randomUUID();

  if (
    process.env.KEY_GENERATOR === 'true' ||
    process.env.KEY_GENERATOR === '1'
  ) {
    // Only way to import without getting window errors
    const JSEncrypt = (await import('nodejs-jsencrypt')).default;
    const encryptor = new JSEncrypt({ default_key_size: '4096' });
    publicKey = encryptor.getPublicKey();
    privateKey = encryptor.getPrivateKey();
  }

  return {
    publicKey,
    privateKey,
  };
};

export const decryptRsa = async (encodedMessage, privateKey) => {
  // Only way to import without getting window errors
  const JSEncrypt = (await import('nodejs-jsencrypt')).default;
  const decryptor = new JSEncrypt({ default_key_size: '4096' });

  // Set the private key for the decryptor
  decryptor.setPrivateKey(privateKey);
  return await decryptor.decrypt(encodedMessage); // returns false if fail
};

export const encryptRsa = async (message, publicKey) => {
  // Only way to import without getting window errors
  const JSEncrypt = (await import('nodejs-jsencrypt')).default;
  const encryptor = new JSEncrypt();

  // Set the public key for the encryptor
  encryptor.setPublicKey(publicKey);

  // Encrypt the message
  return encryptor.encrypt(message);
};
