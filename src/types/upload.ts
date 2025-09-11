export interface UploadFileRef {
  id: string;               // file id from BE
  originalName?: string;
  filename?: string;
  mimetype?: string;
  size?: number;
  path?: string;            // storage path used by BE
  publicUrl?: string;       // if BE returns public URL directly
}

export interface UploadFileInfo extends UploadFileRef {
  // normalize potential BE fields
  _id?: string;
  mimeType?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  status?: string;
}

export type UploadResponse = {
  id: string;
  originalName?: string;
  publicUrl?: string;
  path?: string;
} | {
  files?: UploadFileRef[];
  data?: UploadFileRef[];
  result?: UploadFileRef[];
  uploaded?: UploadFileRef[];
  [k: string]: any;
}