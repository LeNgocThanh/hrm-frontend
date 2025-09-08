export enum AssetType {
  TOOL = 'TOOL',
  EQUIPMENT = 'EQUIPMENT',
  FURNITURE = 'FURNITURE',
  ELECTRONIC = 'ELECTRONIC',
  OTHER = 'OTHER',
}

export enum AssetStatus {
  IN_STOCK = 'IN_STOCK',
  ASSIGNED = 'ASSIGNED',
  IN_REPAIR = 'IN_REPAIR',
  LOST = 'LOST',
  DISPOSED = 'DISPOSED',
}

export interface Money {
  amount: number;
  currency: string; // ví dụ 'VND'
}

export type AssetMetadata = Record<string, string>;

export interface Asset {
  _id?: string;
  code: string;
  name: string;
  type: AssetType;
  status: AssetStatus;

  currentHolderId?: string;   // userId người đang giữ
  metadata?: AssetMetadata; 
  // Một số trường hay gặp – chỉnh theo schema NestJS của bạn
  location?: string;
  purchaseDate?: string; 
  purchasePrice?: Money;// ISO
  supplier?: string;
  originalCost?: Money;
  // Mở rộng khác:
  serialNumber?: string;
  description?: string;

  createdAt?: string;
  updatedAt?: string;
}

export enum AssetDocType {
  PURCHASE = 'PURCHASE',  
  ACCEPTANCE = 'ACCEPTANCE', // tiếp nhận
  HANDOVER = 'HANDOVER', // bàn giao
  TRANSFER = 'TRANSFER',
  REPAIR = 'REPAIR',
  LIQUIDATION = 'LIQUIDATION',
  OTHER = 'OTHER',
}

export enum AssetEventType { 
  PURCHASE = 'PURCHASE', // mua mới
  ASSIGN = 'ASSIGN', // bàn giao cho NV
  TRANSFER = 'TRANSFER', // luân chuyển người dùng/đơn vị
  REPAIR = 'REPAIR', // sửa chữa/bảo hành
  RETURN = 'RETURN', // trả về kho
  LOSS = 'LOSS', // mất
  DISPOSE = 'DISPOSE', // thanh lý/hủy
}

export type ResourceType = 'ASSET' | 'ASSET_DOCUMENT' | 'ASSET_EVENT';

export type FileStatus = 'pending' | 'active' | 'archived' | 'deleted';

export interface UploadFile {
  _id?: string;
  id?: string; // Thêm id nếu cần
  originalName: string;
  mimeType: string;
  size: number;

  // Trường lưu trữ – khớp với module upload-files của bạn
  bucket?: string;       // hoặc container
  key?: string;          // hoặc path
  url?: string;          // nếu server trả sẵn URL
  checksum?: string;     // hash
  status?: FileStatus;

  // Liên kết tài nguyên
  resourceType?: ResourceType;
  relatedId?: string;

  uploadedBy?: string;
  uploadedAt?: string;
  updatedAt?: string;
}

export interface AssetDocument {
  _id?: string;
  assetId: string;
  type: AssetDocType;
  code?: string;
  date: string; // ISO
  description?: string;
  ownerUserId?: string; // người sở hữu (nếu có)

  fileIds?: string[];
  files?: UploadFile[];

  createdAt?: string;
  updatedAt?: string;

}

export interface AssetEvent {
  _id?: string;
  assetId: string;
  type: AssetEventType;
  date: string; // ISO
//  eventDate: string;  
  note?: string;
  cost?: Money;
  toUserId?: string; // người nhận (nếu có)
  fromUserId?: string; // người bàn giao (nếu có)

  createdAt?: string;
  updatedAt?: string;
}