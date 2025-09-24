class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Gửi cookie cùng với yêu cầu
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // User methods
  async getUsers() {
    return this.get('/users');
  }

  async createUser(data: any) {
    return this.post('/users', data);
  }

  async updateUser(id: string, data: any) {
    return this.put(`/users/${id}`, data);
  }

  async deleteUser(id: string) {
    return this.delete(`/users/${id}`);
  }
}

export const apiClient = new ApiClient();

