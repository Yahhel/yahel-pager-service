export type FileMetadata = {
  fileName: string;
  fileSize: string;
  fileSizeBytes: number;
  mimeType: string;
  fileType: string;
  extension: string;
  checksum: string;
};

export const FileMetadataRaw = {
  fileName: { type: String },
  fileSize: { type: String },
  fileSizeBytes: { type: Number },
  mimeType: { type: String },
  fileType: { type: String },
  extension: { type: String },
  checksum: { type: String, index: true },
};

export enum FileCategory {
  Document = 'document',
  Spreadsheet = 'spreadsheet',
  Presentation = 'presentation',
  PDF = 'pdf',
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Archive = 'archive',
  Text = 'text',
  Other = 'other',
}

export const FileCategories = [...new Set(Object.values(FileCategory))];

export interface FilePublicUrlPayload {
  fileId: string;
  iat: number;
  exp: number;
  /** One-time token. If true, the token is claimed on first use and rejected afterwards. */
  ott: boolean;
}

export type FileAccessLink = {
  _id: any;
  private: boolean;
  category: FileCategory;
  metadata: FileMetadata;
  expiresInSeconds: number;
  singleUse: boolean;
  public_url: string;
};
