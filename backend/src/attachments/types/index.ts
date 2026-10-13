/**
 * Local Multer file type shim.
 * Avoids Express.Multer namespace resolution issues across build modes.
 */
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer: Buffer;
}
