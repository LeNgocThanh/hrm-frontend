import { User, UserWithOrganization } from '@/types/index';
import { getUserAssignmentsByUser } from '@/lib/api/user-assignments';
import UserAssignments from '@/components/admin/UserAssignments';
import { UserAssignment } from '@/types/user-assignment';
import { getOrganizations } from '@/lib/api/organizations';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';
interface Organization {
  _id: string;
  name: string;
}


export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_URL}/users`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function getUsersUnderOrganizations(): Promise<User[]> {
  const res = await fetch(`${API_URL}/users/by-organization`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch users under organizations');
  return res.json();
}

export async function fetchOrganizations(): Promise<Organization[]> {  
  return getOrganizations(); 
}

export async function fetchUserAssignmentsByUser(userId: string): Promise<UserAssignment[]> {
  return getUserAssignmentsByUser(userId); // Giữ nguyên việc gọi hàm này từ file khác nếu nó đã tồn tại
}

export async function getUserWithOrganization(usersData: User[]): Promise<UserWithOrganization[]> {
  let allAssignments: UserAssignment[] = [];
    // Lấy tất cả assignments (tốn kém, cần cải thiện ở backend)
    for (const user of usersData) {
        const userAssignments = await fetchUserAssignmentsByUser(user._id);
        allAssignments.push(...userAssignments);
    }
    const organizationsData = await fetchOrganizations(); // Lấy tổ chức 1 lần

    let result: UserWithOrganization[] = [];
    for (const user of usersData) {
        const userAssignment = allAssignments.find((assignment) => assignment.userId === user._id && assignment.isActive && assignment.isPrimary);
        const organization = organizationsData.find((org) => org._id === userAssignment?.organizationId);
        result.push({
            ...user,
            organizationId: organization?._id || '',
            organizationName: organization?.name || '',
        });
    }
    return result;
}

export async function getUserWithOrganizationUnder(usersData: User[]): Promise<UserWithOrganization[]> {
  const organizationsData = await fetchOrganizations();
    let result: UserWithOrganization[] = [];

    for (const user of usersData) {
        // Vẫn phải fetch assignment cho từng user, nên cân nhắc refactor ở BE
        const userAssignments = await fetchUserAssignmentsByUser(user._id);
        const userAssignment = userAssignments.find((assignment) => assignment.isActive && assignment.isPrimary);
        
        if (!userAssignment) {
            console.log('No active primary assignment for user:', user._id); 
            continue;
        }

        const orgId =
        typeof userAssignment.organizationId === 'object' && userAssignment.organizationId !== null
            ? (userAssignment.organizationId as any)._id // Cần cast nếu OrganizationId có thể là Object
            : userAssignment.organizationId;

        const organization = organizationsData.find((org) => org._id === orgId);
        result.push({
            ...user,
            organizationId: organization?._id || '',
            organizationName: organization?.name || '',
        });
    }
    return result;
}

interface HasId {
  _id: string;
}

function isObjectWithId(obj: any): obj is HasId {
  return typeof obj === 'object' && obj !== null && '_id' in obj;
}
