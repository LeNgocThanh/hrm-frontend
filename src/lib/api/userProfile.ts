import { UserProfile, CreateUserProfileDto, UpdateUserProfileDto } from '@/types/userProfile';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const accessToken = localStorage.getItem('accessToken');

class UserProfileApi {
  async getUserProfile(userId: string): Promise<UserProfile> {
    const res = await fetch(`${API_URL}/user-profile/${userId}`, { headers: {
      'Authorization': `Bearer ${accessToken}`, }
      ,cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 404) {
        throw { status: 404, message: 'User profile not found' };
      }
      const error = await res.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to fetch user profile');
    }
    return res.json();
  }

  async createUserProfile(data: CreateUserProfileDto): Promise<UserProfile> {
    const res = await fetch(`${API_URL}/user-profile`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`
        ,'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create user profile');
    }
    return res.json();
  }

  async updateUserProfile(userId: string, data: UpdateUserProfileDto): Promise<UserProfile> {
    const res = await fetch(`${API_URL}/user-profile/${userId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`
        ,'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to update user profile');
    }
    return res.json();
  }

  async deleteUserProfile(userId: string): Promise<{ deleted: boolean }> {
    const res = await fetch(`${API_URL}/user-profile/${userId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to delete user profile');
    }
    return res.json();
  }
}

export const userProfileApi = new UserProfileApi();

// Export individual functions for backward compatibility
export const getUserProfile = (userId: string) => userProfileApi.getUserProfile(userId);
export const createUserProfile = (data: CreateUserProfileDto) => userProfileApi.createUserProfile(data);
export const updateUserProfile = (userId: string, data: UpdateUserProfileDto) => userProfileApi.updateUserProfile(userId, data);
export const deleteUserProfile = (userId: string) => userProfileApi.deleteUserProfile(userId);

