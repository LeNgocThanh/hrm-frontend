'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';

// Enum for document types
enum DocTypeEnum {
    IDENTIFICATION = 'identification',
    CV = 'cv',
    DEGREE = 'degree',
    HEALTH_CHECK = 'health_check',
    PHOTO = 'photo',
    OTHER = 'other',
}

interface FileUploadResponse {
    id: string;
    originalName: string;
    publicUrl: string;
}

interface UserDocumentResponse {
    id: string;
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

interface Props {
    userId: string;
    viewMode?: boolean;
}

const UserDocumentManagement: React.FC<Props> = ({ userId, viewMode = false }) => {
    const NESTJS_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    // State for documents list
    const [documents, setDocuments] = useState<UserDocumentResponse[]>([]);
    const [loadingDocuments, setLoadingDocuments] = useState<boolean>(true);

    // State for form
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [docType, setDocType] = useState<DocTypeEnum>(DocTypeEnum.IDENTIFICATION);
    const [otherDocTypeDescription, setOtherDocTypeDescription] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

    // Fetch user documents
    useEffect(() => {
        if (userId) {
            fetchUserDocuments();
        }
    }, [userId]);

    // File preview effect
    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl(null);
            return;
        }
        const objectUrl: string = URL.createObjectURL(selectedFile);
        setPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [selectedFile]);

    const fetchUserDocuments = async () => {
        try {
            setLoadingDocuments(true);
            const response = await fetch(`${NESTJS_API_BASE_URL}/user-documents/user/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
                },
            });
            if (response.ok) {
                const data: UserDocumentResponse[] = await response.json();

                // Fetch file info for each document
                const documentsWithFileInfo = await Promise.all(
                    data.map(async (doc) => {
                        try {
                            const fileResponse = await fetch(`${NESTJS_API_BASE_URL}/files/${doc.fileId}`, {
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
                                },
                            });
                            if (fileResponse.ok) {
                                const fileInfo = await fileResponse.json();
                                return { ...doc, fileInfo };
                            }
                            return doc;
                        } catch (error) {
                            console.error(`Error fetching file info for ${doc.fileId}:`, error);
                            return doc;
                        }
                    })
                );

                setDocuments(documentsWithFileInfo);
            }
        } catch (error) {
            console.error('Error fetching user documents:', error);
        } finally {
            setLoadingDocuments(false);
        }
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files ? event.target.files[0] : null;
        setSelectedFile(file);
        setStatusMessage('');
        setIsSuccess(null);
    };

    const handleCreateDocument = async (event: FormEvent): Promise<void> => {
        event.preventDefault();

        if (!selectedFile) {
            setStatusMessage('Vui lòng chọn một file để tải lên.');
            setIsSuccess(false);
            return;
        }

        if (docType === DocTypeEnum.OTHER && !otherDocTypeDescription.trim()) {
            setStatusMessage('Vui lòng nhập mô tả cho loại tài liệu khác.');
            setIsSuccess(false);
            return;
        }

        setIsProcessing(true);
        setStatusMessage('Đang tải lên file...');
        setIsSuccess(null);

        let fileId: string = '';

        try {
            // Step 1: Upload file
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('uploadedBy', userId);
            formData.append('resourceType', 'user-document');

            const fileUploadResponse: Response = await fetch(`${NESTJS_API_BASE_URL}/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
                },
                body: formData,
            });

            const fileUploadData: FileUploadResponse = await fileUploadResponse.json();

            if (!fileUploadResponse.ok) {
                throw new Error(`Lỗi tải lên file: ${fileUploadData.originalName || 'Có lỗi xảy ra.'}`);
            }

            fileId = fileUploadData.id;
            setStatusMessage(`File đã tải lên thành công. Đang tạo tài liệu...`);

            // Step 2: Create user document
            const userDocData: {
                userId: string;
                docType: DocTypeEnum;
                fileId: string;
                description?: string;
                isActive: boolean;
                otherDocTypeDescription?: string;
            } = {
                userId: userId,
                docType: docType,
                fileId: fileId,
                description: description,
                isActive: true,
            };

            if (docType === DocTypeEnum.OTHER) {
                userDocData.otherDocTypeDescription = otherDocTypeDescription;
            }

            const userDocResponse: Response = await fetch(`${NESTJS_API_BASE_URL}/user-documents`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userDocData),
            });

            const userDocDataResponse: UserDocumentResponse = await userDocResponse.json();

            if (!userDocResponse.ok) {
                throw new Error(`Lỗi tạo tài liệu: ${userDocDataResponse.id || 'Có lỗi xảy ra.'}`);
            }

            setStatusMessage(`Tạo tài liệu thành công!`);
            setIsSuccess(true);

            // Reset form
            setSelectedFile(null);
            setDocType(DocTypeEnum.IDENTIFICATION);
            setOtherDocTypeDescription('');
            setDescription('');

            // Refresh documents list
            await fetchUserDocuments();

        } catch (error: any) {
            console.error('Lỗi trong quá trình tạo tài liệu:', error);
            setStatusMessage(`Lỗi: ${error.message}`);
            setIsSuccess(false);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteDocument = async (documentId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa tài liệu này?')) return;

        try {
            const response = await fetch(`${NESTJS_API_BASE_URL}/user-documents/${documentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
                }
            });

            if (response.ok) {
                setStatusMessage('Xóa tài liệu thành công!');
                setIsSuccess(true);
                await fetchUserDocuments();
            } else {
                throw new Error('Không thể xóa tài liệu');
            }
        } catch (error: any) {
            setStatusMessage(`Lỗi: ${error.message}`);
            setIsSuccess(false);
        }
    };

    const getDocTypeLabel = (docType: DocTypeEnum, otherDescription?: string): string => {
        const labels = {
            [DocTypeEnum.IDENTIFICATION]: 'CMND/CCCD',
            [DocTypeEnum.CV]: 'CV/Hồ sơ',
            [DocTypeEnum.DEGREE]: 'Bằng cấp',
            [DocTypeEnum.HEALTH_CHECK]: 'Khám sức khỏe',
            [DocTypeEnum.PHOTO]: 'Ảnh',
            [DocTypeEnum.OTHER]: otherDescription || 'Khác',
        };
        return labels[docType];
    };

    const handDownloadFile = async (filePath: string) => {
        try {
            const response = await fetch(`${NESTJS_API_BASE_URL}/fileDetails/download?path=${encodeURIComponent(filePath)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filePath.split('/').pop() || 'download';
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                throw new Error('Không thể tải xuống file');
            }
        } catch (error: any) {
            setStatusMessage(`Lỗi: ${error.message}`);
            setIsSuccess(false);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Quản lý tài liệu người dùng</h3>

            {!viewMode && (
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-md font-medium text-gray-700 mb-4">Tải lên tài liệu mới</h4>
                    {/* Upload form - chỉ hiển thị khi không phải viewMode */}
                    <form onSubmit={handleCreateDocument} className="space-y-4">
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-medium mb-1">
                                Chọn File:
                            </label>
                            <input
                                type="file"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-white focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            {selectedFile && (
                                <p className="mt-1 text-sm text-gray-600">
                                    File đã chọn: <span className="font-medium">{selectedFile.name}</span>
                                </p>
                            )}
                        </div>

                        {/* File Preview */}
                        {previewUrl && selectedFile && (
                            <div className="mb-4 p-3 border border-gray-300 rounded-lg bg-white flex justify-center items-center overflow-hidden">
                                {selectedFile.type.startsWith('image/') && (
                                    <img src={previewUrl} alt="Preview" className="max-w-full h-auto rounded-md object-contain max-h-32" />
                                )}
                                {!selectedFile.type.startsWith('image/') && (
                                    <p className="text-gray-600">File: {selectedFile.name}</p>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Document Type */}
                            <div>
                                <label className="block text-gray-700 text-sm font-medium mb-1">
                                    Loại tài liệu:
                                </label>
                                <select
                                    value={docType}
                                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setDocType(e.target.value as DocTypeEnum)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value={DocTypeEnum.IDENTIFICATION}>CMND/CCCD</option>
                                    <option value={DocTypeEnum.CV}>CV/Hồ sơ</option>
                                    <option value={DocTypeEnum.DEGREE}>Bằng cấp</option>
                                    <option value={DocTypeEnum.HEALTH_CHECK}>Khám sức khỏe</option>
                                    <option value={DocTypeEnum.PHOTO}>Ảnh</option>
                                    <option value={DocTypeEnum.OTHER}>Khác</option>
                                </select>
                            </div>

                            {/* Other Description (only when docType is OTHER) */}
                            {docType === DocTypeEnum.OTHER && (
                                <div>
                                    <label className="block text-gray-700 text-sm font-medium mb-1">
                                        Mô tả loại tài liệu:
                                    </label>
                                    <input
                                        type="text"
                                        value={otherDocTypeDescription}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setOtherDocTypeDescription(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Nhập mô tả loại tài liệu"
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div className="mt-4">
                            <label className="block text-gray-700 text-sm font-medium mb-1">
                                Mô tả (tùy chọn):
                            </label>
                            <textarea
                                value={description}
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                                rows={2}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Nhập mô tả tài liệu"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isProcessing || !selectedFile || (docType === DocTypeEnum.OTHER && !otherDocTypeDescription.trim())}
                            className={`mt-4 w-full py-2 px-4 rounded-lg font-medium text-white transition duration-300 ${isProcessing || !selectedFile || (docType === DocTypeEnum.OTHER && !otherDocTypeDescription.trim())
                                    ? 'bg-indigo-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                                }`}
                        >
                            {isProcessing ? 'Đang xử lý...' : 'Thêm Tài liệu'}
                        </button>
                    </form>
                </div>
            )}

            {/* Status Message */}
            {statusMessage && (
                <div
                    className={`mb-4 p-3 rounded-lg text-center ${isSuccess === true ? 'bg-green-100 text-green-800' :
                            isSuccess === false ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                        }`}
                >
                    <p className="text-sm font-medium">{statusMessage}</p>
                </div>
            )}

            {/* Documents list - luôn hiển thị */}
            <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-700">Danh sách tài liệu</h4>
                {loadingDocuments ? (
                    <div className="text-center py-4">Đang tải...</div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">Chưa có tài liệu nào</div>
                ) : (
                    <div className="grid gap-4">
                        {documents.map((doc) => (
                            <div key={doc.id} className="border rounded-lg p-4 bg-white shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h5 className="font-medium text-gray-900">{getDocTypeLabel(doc.docType, doc.otherDocTypeDescription)}</h5>
                                        {doc.description && (
                                            <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                                        )}
                                        <p className="text-xs text-gray-500 mt-2">
                                            Tạo: {new Date(doc.createdAt).toLocaleDateString('vi-VN')}
                                        </p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => doc.fileInfo?.path ? handDownloadFile(doc.fileInfo?.path) : handDownloadFile("")}
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm"
                                        >
                                            Xem
                                        </button>

                                        {!viewMode && (
                                            <button
                                                onClick={() => handleDeleteDocument(doc.id)}
                                                className="text-red-600 hover:text-red-800 text-sm"
                                            >
                                                Xóa
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
export default UserDocumentManagement;



