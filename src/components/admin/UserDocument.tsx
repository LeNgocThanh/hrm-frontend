'use client'; // This directive is necessary for client-side components in Next.js App Router

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';

// Enum for document types, mirroring your DocTypeEnum
enum DocTypeEnum {
    IDENTIFICATION = 'identification',
    CV = 'cv',
    DEGREE = 'degree',
    HEALTH_CHECK = 'health_check',
    PHOTO = 'photo',
    OTHER = 'other',
}

// Define interfaces for API responses (simplified for this example)
interface FileUploadResponse {
    id: string;
    originalName: string;
    publicUrl: string;
    // Add other properties from your FileResponseDto if needed
}

interface UserDocumentResponse {
    id: string;
    userId: string;
    docType: DocTypeEnum;
    fileId: string;
    description?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    // Add other properties from your UserDocumentResponseDto if needed
}

// Interface for User as provided by the user
export interface User {
    _id: string;
    fullName: string;
    birthDay: string; // ISO date string
    gender: string;
    details: string;
    email: string;
    phone?: string;
    password: string;
    avatarUrl?: string;
    status: 'active' | 'inactive' | 'terminated';
    createdAt: string;
    updatedAt: string;
}

// React component for the combined file upload and user document creation form
export default function UserDocumentCreationForm() {
    const NESTJS_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'; // Make sure your NestJS API is running on this port

    // State for user data fetching and selection
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>(''); // State for selected user's ID
    const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
    const [usersError, setUsersError] = useState<string | null>(null);

    // State for selected file and its preview
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // States for user document details
    const [docType, setDocType] = useState<DocTypeEnum>(DocTypeEnum.IDENTIFICATION);
    const [otherDocTypeDescription, setOtherDocTypeDescription] = useState<string>('');
    const [description, setDescription] = useState<string>('');

    // State for overall process status and messages
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null); // true for success, false for error, null for neutral

    // useEffect hook to fetch users when the component mounts
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoadingUsers(true);
                const response = await fetch(`${NESTJS_API_BASE_URL}/users`); // Assuming /users endpoint for fetching users
                if (!response.ok) {
                    throw new Error(`Failed to fetch users: ${response.statusText}`);
                }
                const data: User[] = await response.json();
                setUsers(data);
                if (data.length > 0) {
                    setSelectedUserId(data[0]._id); // Select the first user by default
                }
                setUsersError(null);
            } catch (err: any) {
                setUsersError(`Failed to fetch users: ${err.message}`);
                console.error('Error fetching users:', err);
            } finally {
                setLoadingUsers(false);
            }
        };
        fetchUsers();
    }, []); // Run once on component mount

    // useEffect hook to create and clean up the preview URL for the selected file
    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl(null);
            return;
        }
        const objectUrl: string = URL.createObjectURL(selectedFile);
        setPreviewUrl(objectUrl);
        // Cleanup function: revoke the object URL when the component unmounts
        // or when selectedFile changes to prevent memory leaks
        return () => URL.revokeObjectURL(objectUrl);
    }, [selectedFile]);

    // Handler for file input change
    const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files ? event.target.files[0] : null;
        setSelectedFile(file);
        setStatusMessage(''); // Clear previous messages
        setIsSuccess(null); // Reset status
    };

    // Combined handler for creating the user document flow
    const handleCreateDocumentFlow = async (event: FormEvent): Promise<void> => {
        event.preventDefault(); // Prevent default form submission behavior

        // 1. Validate inputs before starting
        if (!selectedFile) {
            setStatusMessage('Vui lòng chọn một file để tải lên.'); // Please select a file to upload.
            setIsSuccess(false);
            return;
        }

        if (!selectedUserId) {
            setStatusMessage('Vui lòng chọn một người dùng.'); // Please select a user.
            setIsSuccess(false);
            return;
        }

        if (docType === DocTypeEnum.OTHER && !otherDocTypeDescription.trim()) {
            setStatusMessage('Mô tả loại tài liệu khác không được để trống khi chọn "other".'); // Other document type description cannot be empty when "other" is selected.
            setIsSuccess(false);
            return;
        }

        setIsProcessing(true); // Start overall processing status
        setStatusMessage('Đang tải lên file và tạo tài liệu...'); // Uploading file and creating document...
        setIsSuccess(null); // Reset status to neutral

        let fileId: string | null = null;

        try {
            // --- Bước 1: Tải lên File ---
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('uploadedBy', 'test'); // You might want to change this to selectedUserId later
            formData.append('resourceType', 'test');

            const fileUploadResponse: Response = await fetch(`${NESTJS_API_BASE_URL}/files/upload`, {
                method: 'POST',
                body: formData,
            });

            const fileUploadData: FileUploadResponse = await fileUploadResponse.json();

            if (!fileUploadResponse.ok) {
                throw new Error(`Lỗi tải lên file: ${fileUploadData.originalName || fileUploadData.id || 'Có lỗi xảy ra.'}`); // File upload error: Something went wrong.
            }
            fileId = fileUploadData.id;
            setStatusMessage(`File đã tải lên thành công. File ID: ${fileId}. Đang tạo tài liệu người dùng...`); // File uploaded successfully. File ID: ... Creating user document...

            // --- Bước 2: Tạo Tài liệu Người dùng ---
            const userDocData: {
                userId: string;
                docType: DocTypeEnum;
                fileId: string;
                description?: string;
                isActive: boolean;
                otherDocTypeDescription?: string;
            } = {
                userId: selectedUserId, // Use selectedUserId here
                docType: docType,
                fileId: fileId,
                description: description,
                isActive: true, // Default to true
            };

            if (docType === DocTypeEnum.OTHER) {
                userDocData.otherDocTypeDescription = otherDocTypeDescription;
            }

            const userDocResponse: Response = await fetch(`${NESTJS_API_BASE_URL}/user-documents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userDocData),
            });

            const userDocDataResponse: UserDocumentResponse = await userDocResponse.json();

            if (!userDocResponse.ok) {
                throw new Error(`Lỗi tạo tài liệu người dùng: ${userDocDataResponse.id || 'Có lỗi xảy ra.'}`); // Error creating user document: Something went wrong.
            }

            setStatusMessage(`Tạo tài liệu người dùng thành công! ID: ${userDocDataResponse.id}`); // User document created successfully! ID:
            setIsSuccess(true);
            // Optionally reset form fields after successful creation
            setSelectedFile(null);
            setDocType(DocTypeEnum.IDENTIFICATION);
            setOtherDocTypeDescription('');
            setDescription('');

        } catch (error: any) { // Use 'any' for error type if not specific
            console.error('Lỗi trong quá trình tạo tài liệu:', error); // Error during document creation process:
            setStatusMessage(`Lỗi: ${error.message}`); // Error:
            setIsSuccess(false);
        } finally {
            setIsProcessing(false); // End overall processing status
        }
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg mx-auto my-8">
            <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
                Tạo Tài liệu Người dùng
            </h1>

            {/* File Input Section */}
            <div className="mb-6">
                <label htmlFor="file-input" className="block text-gray-700 text-sm font-semibold mb-2">
                    Chọn File:
                </label>
                <input
                    type="file"
                    id="file-input"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {selectedFile && (
                    <p className="mt-2 text-sm text-gray-600">
                        File đã chọn: <span className="font-medium">{selectedFile.name}</span>
                    </p>
                )}
            </div>

            {/* File preview section */}
            {previewUrl && selectedFile && (
                <div className="mb-6 p-3 border border-gray-300 rounded-lg bg-white flex justify-center items-center overflow-hidden">
                    {selectedFile.type.startsWith('image/') && (
                        <img src={previewUrl} alt="Xem trước hình ảnh" className="max-w-full h-auto rounded-md object-contain max-h-48" />
                    )}
                    {selectedFile.type.startsWith('video/') && (
                        <video controls src={previewUrl} className="max-w-full h-auto rounded-md object-contain max-h-48">
                            Trình duyệt của bạn không hỗ trợ thẻ video.
                        </video>
                    )}
                    {!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/') && (
                        <p className="text-gray-600">Không có bản xem trước cho loại file này.</p>
                    )}
                </div>
            )}

            {/* User Document Details Section */}
            <div className="p-6 border border-gray-200 rounded-lg bg-gray-50 mb-6">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Thông tin Tài liệu</h2>
                <div className="mb-4">
                    <label htmlFor="user-select" className="block text-gray-700 text-sm font-semibold mb-2">
                        Chọn Người dùng:
                    </label>
                    {loadingUsers ? (
                        <p className="text-gray-600">Đang tải danh sách người dùng...</p>
                    ) : usersError ? (
                        <p className="text-red-500">{usersError}</p>
                    ) : (
                        <select
                            id="user-select"
                            value={selectedUserId}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedUserId(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500"
                            disabled={isProcessing || users.length === 0}
                        >
                            {users.length === 0 ? (
                                <option value="">Không có người dùng nào</option>
                            ) : (
                                users.map((user) => (
                                    <option key={user._id} value={user._id}>
                                        {user.fullName} ({user._id})
                                    </option>
                                ))
                            )}
                        </select>
                    )}
                    {!loadingUsers && users.length === 0 && !usersError && (
                        <p className="mt-2 text-sm text-red-500">Không tìm thấy người dùng nào. Vui lòng thêm người dùng vào hệ thống của bạn.</p>
                    )}
                </div>

                <div className="mb-4">
                    <label htmlFor="doc-type" className="block text-gray-700 text-sm font-semibold mb-2">
                        Loại Tài liệu:
                    </label>
                    <select
                        id="doc-type"
                        value={docType}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setDocType(e.target.value as DocTypeEnum)}
                        className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {Object.values(DocTypeEnum).map((type) => (
                            <option key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                            </option>
                        ))}
                    </select>
                </div>

                {docType === DocTypeEnum.OTHER && (
                    <div className="mb-4">
                        <label htmlFor="other-doc-description" className="block text-gray-700 text-sm font-semibold mb-2">
                            Mô tả loại tài liệu khác:
                        </label>
                        <input
                            type="text"
                            id="other-doc-description"
                            value={otherDocTypeDescription}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setOtherDocTypeDescription(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Ví dụ: Giấy phép lái xe"
                        />
                    </div>
                )}

                <div className="mb-4">
                    <label htmlFor="description" className="block text-gray-700 text-sm font-semibold mb-2">
                        Mô tả (Tùy chọn):
                    </label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Mô tả chi tiết về tài liệu..."
                    ></textarea>
                </div>
            </div>

            {/* Single Create Button */}
            <button
                onClick={handleCreateDocumentFlow}
                disabled={isProcessing || !selectedFile || !selectedUserId || (docType === DocTypeEnum.OTHER && !otherDocTypeDescription.trim())}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition duration-300 ease-in-out ${isProcessing || !selectedFile || !selectedUserId || (docType === DocTypeEnum.OTHER && !otherDocTypeDescription.trim())
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50'
                    }`}
            >
                {isProcessing ? 'Đang xử lý...' : 'Tạo Tài liệu'}
            </button>

            {/* Status Message */}
            {statusMessage && (
                <div
                    className={`mt-6 p-4 rounded-lg text-center ${isSuccess === true ? 'bg-green-100 text-green-800' :
                        isSuccess === false ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                        }`}
                >
                    <p className="font-medium">{statusMessage}</p>
                </div>
            )}
        </div>
    );
}