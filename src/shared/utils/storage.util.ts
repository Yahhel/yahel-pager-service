import { configs } from '../configs';
import { StorageProvider, StorageUtil } from '../interfaces';
import { AzureBlobUtil } from './azure-blob.util';

// To add a provider: write a util implementing StorageUtil and register it here
const storageUtils: Record<StorageProvider, () => StorageUtil> = {
  [StorageProvider.AZURE]: () => new AzureBlobUtil(),
};

export const getStorageProvider = (): StorageProvider =>
  configs().storage.provider;

// Pass the provider saved on the file so old files keep working after a switch
export const getStorageUtil = (
  provider: StorageProvider = getStorageProvider(),
): StorageUtil => {
  const createStorageUtil = storageUtils[provider];
  if (!createStorageUtil)
    throw new Error(`Unsupported storage provider: ${provider}`);
  return createStorageUtil();
};
