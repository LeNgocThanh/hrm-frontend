'use client';

import React, { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'; // NestJS base URL

export default function UsersImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleDownloadTemplate = () => {
    // Nếu file mẫu nằm trong /public/templates/...
    window.open('/templates/users-import-template.xlsx', '_blank');
  };

  const handleImport = async () => {
    if (!file) {
      setError('Vui lòng chọn file Excel trước khi import.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      formData.append('file', file); // phải trùng tên field @FileInterceptor('file')

      const res = await fetch(`${API_URL}/users/import`, {
        method: 'POST',
        body: formData,
        // KHÔNG set Content-Type, để browser tự set boundary cho multipart/form-data
        credentials: 'include', // nếu bạn dùng cookie auth
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Import failed with status ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi import.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm border border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-800 mb-4">
          Import người dùng từ Excel
        </h1>

        <p className="text-sm text-gray-600 mb-6">
          Tải file Excel mẫu, điền dữ liệu theo đúng cột quy định, sau đó chọn file và bấm Import.
        </p>

        {/* Nút tải file mẫu */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
          >
            Tải file Excel mẫu
          </button>
        </div>

        {/* Chọn file */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chọn file Excel (.xlsx)
          </label>
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-green-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-green-700 cursor-pointer"
          />
          {file && (
            <p className="mt-2 text-xs text-gray-500">
              File đã chọn: <span className="font-medium">{file.name}</span>
            </p>
          )}
        </div>

        {/* Nút Import */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleImport}
            disabled={isUploading || !file}
            className="inline-flex items-center rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {isUploading ? 'Đang import...' : 'Import'}
          </button>

          {isUploading && (
            <span className="text-xs text-gray-500">
              Đang xử lý, vui lòng đợi…
            </span>
          )}
        </div>

        {/* Hiển thị lỗi */}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Hiển thị kết quả import từ NestJS */}
        {result && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <p className="font-semibold mb-2">Kết quả import:</p>
            <ul className="space-y-1">
              {'totalRecords' in result && (
                <li>
                  Tổng số bản ghi: <span className="font-semibold">{result.totalRecords}</span>
                </li>
              )}
              {'successRecords' in result && (
                <li>
                  Số bản ghi thành công (user + assignment):{' '}
                  <span className="font-semibold">{result.successRecords}</span>
                </li>
              )}
              {'createdUsers' in result && (
                <li>
                  Số user tạo mới: <span className="font-semibold">{result.createdUsers}</span>
                </li>
              )}
              {'createdAssignments' in result && (
                <li>
                  Số user_assignments tạo mới:{' '}
                  <span className="font-semibold">{result.createdAssignments}</span>
                </li>
              )}
              {'failedRecords' in result && (
                <li>
                  Số bản ghi lỗi: <span className="font-semibold">{result.failedRecords}</span>
                </li>
              )}
            </ul>

            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <div className="mt-3">
                <p className="font-semibold mb-1">Chi tiết lỗi:</p>
                <div className="max-h-40 overflow-y-auto rounded border border-red-100 bg-white px-3 py-2 text-xs text-red-700">
                  {result.errors.map((err: any, idx: number) => (
                    <div key={idx} className="mb-1">
                      • Dòng {err.index + 2}{' '}
                      {/* +2 nếu dòng 0 là header → dòng dữ liệu bắt đầu từ row 2 trong Excel */}
                      {err.orgCode && (
                        <>
                          (orgCode: <span className="font-mono">{err.orgCode}</span>)
                        </>
                      )}
                      : {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
