import * as cloudinary from 'cloudinary';
import { LogLevel } from '../interfaces';
import { BadRequestException } from '@nestjs/common';
import { DocLinksDto } from '@shared/dtos';

export enum CloudinaryFolders {
  PHOTOS = 'photos',
  VIDEOS = 'videos',
  PRODUCT_PHOTOS = 'product-photos',
  DOCUMENTS = 'documents',
}

type UploadFile = Express.Multer.File | string;

const ResourceType = {
  [CloudinaryFolders.VIDEOS]: 'video' as const,
  [CloudinaryFolders.PHOTOS]: 'image' as const,
  [CloudinaryFolders.PRODUCT_PHOTOS]: 'image' as const,
  [CloudinaryFolders.DOCUMENTS]: 'auto' as const,
};

export const getDataUri = (data: UploadFile): string => {
  if (typeof data === 'string') return data;
  const b64 = Buffer.from(data.buffer).toString('base64');
  return 'data:' + data.mimetype + ';base64,' + b64;
};

export const uploadToCloud = async (data: UploadFile, folder: string) => {
  if (
    data &&
    typeof data === 'string' &&
    !data.includes('data:') &&
    !data?.includes('http')
  ) {
    throw new BadRequestException(
      'Doc must include a base64 data header if a link is not provisioned',
    );
  }
  try {
    if (!data) return '';
    if (
      typeof data === 'string' &&
      data?.includes('http') &&
      !data.includes('data:')
    )
      return data;
    const uploaded = await cloudinary.v2.uploader.upload(getDataUri(data), {
      folder,
      resource_type: ResourceType[folder],
    });
    return uploaded.secure_url;
  } catch (e) {
    global.dataLogsService.log(
      global.req.traceId,
      { source: 'uploadToCloudinary', message: e.message, stackTrace: e.stack },
      LogLevel.ERROR,
    );
    return '';
  }
};

export const addPhotos = async (base64PhotosWithImageData: UploadFile[]) => {
  const promisesImages = [];

  (base64PhotosWithImageData || []).forEach((photo, i) => {
    if (
      photo &&
      typeof photo === 'string' &&
      !photo.includes('data:') &&
      !photo.includes('http')
    ) {
      throw new BadRequestException(
        `Doc must include a data header at index ${i}`,
      );
    }

    if (photo) {
      promisesImages.push(uploadToCloud(photo, CloudinaryFolders.PHOTOS));
    }
  });

  if (promisesImages.length > 0) {
    return (await Promise.all(promisesImages)).filter((p) => !!p);
  }

  return [];
};

export const addPhotosWithLinks = async (photos: UploadFile[]) => {
  let objPhotos: any = { photoLinks: [], base64Photos: [] };

  if (photos && photos.length > 0) {
    objPhotos = photos.reduce(
      (result, p) => {
        if (
          typeof p === 'string' &&
          p.includes('http') &&
          !p.includes('data:')
        ) {
          result.photoLinks.push(p);
        } else {
          result.base64Photos.push(p);
        }
        return result;
      },
      { photoLinks: [], base64Photos: [] },
    );
    return [
      ...(await addPhotos(objPhotos.base64Photos)),
      ...objPhotos.photoLinks,
    ];
  }

  return [];
};

export const handleDocLinkUpload = async (docLinks: DocLinksDto[]) => {
  console.log('d', docLinks);
  return (
    await Promise.all(
      docLinks.map(async (doc) => {
        const imgUrl = await addPhotosWithLinks([doc.link]);
        doc.link = imgUrl?.[0];
        return doc;
      }),
    )
  ).filter((doc) => !!doc.link);
};

export const deleteFromCloudinary = async (url: string): Promise<void> => {
  try {
    const publicId = extractPublicIdFromURL(url);
    await cloudinary.v2.uploader.destroy(publicId, (error, result) => {
      if (error)
        throw new BadRequestException(
          'Failed to delete document from Cloudinary.',
        );
      global.dataLogsService.log(
        global.req.traceId,
        {
          source: 'deleteFromCloudinary',
          message: 'Document deleted successfully.',
          result,
        },
        LogLevel.INFO,
      );
      return result;
    });
  } catch (e) {
    global.dataLogsService.log(
      global.req.traceId,
      {
        source: 'deleteFromCloudinary',
        message: e.message,
        stackTrace: e.stack,
      },
      LogLevel.ERROR,
    );
  }
};

export const extractPublicIdFromURL = (url: string): string => {
  // Regular expression to find the public ID part of the URL.
  const match = url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
  if (!match) {
    throw new BadRequestException('Invalid Cloudinary URL format.');
  }
  return match[1];
};
