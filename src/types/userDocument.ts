export enum DocTypeEnum {
    IDENTIFICATION = 'identification',
    CV = 'cv',
    DEGREE = 'degree',
    HEALTH_CHECK = 'health_check',
    PHOTO = 'photo',
    OTHER = 'other',
    ASSET_DOCUMENT = 'asset_document', // Thêm giá trị cho tài liệu tài sản
}

export interface FileUploadResponse {
    _id: string;
    originalName: string;
    publicUrl: string;
}

export interface UserDocumentResponse {
    _id: string;
    id?: string; // Thêm id nếu cần
    userId: string;
    docType: DocTypeEnum;
    otherDocTypeDescription?: string;
    fileId: string;
    description?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    // Thêm thông tin file
    fileInfo?: {
        originalName: string;
        filename: string;
        mimetype: string;
        size: number;
        path: string;
        publicUrl?: string;
        uploadedBy: string;
        uploadedAt: string;
        status: string;
    };
}