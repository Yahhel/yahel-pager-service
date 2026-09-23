import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomErrorHandler {
  static handle(error: any) {
    if (
      (error instanceof HttpException && error.getStatus() >= 500) ||
      error.response?.status >= 500
    ) {
      throw new HttpException(
        new Error(
          'Internal Server Error. Please contact Administrator or developer',
        ),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const responseData =
      error.response?.data || 'An unexpected error occurred.';
    const responseStatus =
      error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;

    // Construct an error response manually
    const errorResponse = {
      statusCode: responseStatus,
      message: responseData.message || 'An unexpected error occurred.',
      timestamp: new Date().toISOString(),
      requestUrl: error.request?.path || '',
    };

    throw new HttpException(errorResponse, responseStatus);
  }
}
