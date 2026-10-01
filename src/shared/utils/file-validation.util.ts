export const sanitizeFileName = (fileName: string): string => {
  // Remove path separators
  let safe = fileName.replace(/[\/\\]/g, '');

  // Remove null bytes
  safe = safe.replace(/\0/g, '');

  // Remove leading dots
  safe = safe.replace(/^\.+/, '');

  // Limit length
  safe = safe.substring(0, 255);

  // Remove dangerous characters
  safe = safe.replace(/[<>:"|?*]/g, '_');

  // Prevent reserved Windows names
  const reserved = [
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'LPT1',
    'LPT2',
    'LPT3',
  ];
  const nameWithoutExt = safe.substring(0, safe.lastIndexOf('.')) || safe;
  if (reserved.includes(nameWithoutExt.toUpperCase())) {
    safe = '_' + safe;
  }

  return safe;
};
