'use client';
import React, { useEffect, useState } from 'react';
import { Organization } from '@/types/organization';
import { User } from '@/types/index';
import { UserAssignment } from '@/types/user-assignment';
import { Position } from '@/types/position';
import { getOrganizations } from '@/lib/api/organizations';
import { getUserAssignmentsByUser } from '@/lib/api/user-assignments';
import { getUsers } from '@/lib/api/users';
import { getPositions } from '@/lib/api/positions';

interface TreeNode extends Organization {
  _id: string;
  children: TreeNode[];
  users: User[];
}
 interface HasId {
  _id: string;
}

const OrganizationStructureView: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); 
  const [showUsers, setShowUsers] = useState<Record<string, boolean>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []); 

// Hàm kiểm tra type guard
function isObjectWithId(obj: any): obj is HasId {
  return typeof obj === 'object' && obj !== null && '_id' in obj;
}

  // Hàm lấy toàn bộ assignment bằng cách gọi cho từng user
  const getAllUserAssignments = async (users: User[]): Promise<UserAssignment[]> => {
    const all: UserAssignment[] = [];
    for (const user of users) {
      const assignments = await getUserAssignmentsByUser(user._id);
      all.push(...assignments);
    }
    return all;
  };

  // Hàm lấy tất cả node con (đệ quy)
  const getAllDescendantNodes = (node: TreeNode): TreeNode[] => {
    let nodes = [node];
    for (const child of (node.children as TreeNode[])) {
      nodes = nodes.concat(getAllDescendantNodes(child as TreeNode));
    }
    //console.log('getAllDescendantNodes:', nodes);
    return nodes;
  };

  // Hàm lấy tất cả user và assignment thuộc node và node con
  const getAllUsersWithAssignments = (node: TreeNode) => {
    const allNodes = getAllDescendantNodes(node);
    const result: {
      user: User;
      assignment: UserAssignment;
      orgName: string;
      positionName: string;
      level: number;
    }[] = [];
    for (const n of allNodes as TreeNode[]) {
      for (const user of (n.users as User[])) {
       
        // Tìm assignment của user tại node này
        const assignment = assignments.find(
          a =>
            ((isObjectWithId(a.userId) ? a.userId._id : a.userId) === user._id) &&
            ((isObjectWithId(a.organizationId) ? a.organizationId._id : a.organizationId) === n._id)
        );
        if (assignment) {
          const posId = isObjectWithId(assignment.positionId) ? assignment.positionId._id : assignment.positionId;
          const position = positions.find(p => p._id === posId);
          result.push({
            user,
            assignment,
            orgName: n.name,
            positionName: position ? position.name : '',
            level: position ? position.level: 1,
          });
        }
      }
    }
    return result;
  };

  const fetchData = async () => {
    setLoading(true);
    const orgs = await getOrganizations();
    const users: User[] = await getUsers();
    const assignments: UserAssignment[] = await getAllUserAssignments(users);
    const positions: Position[] = await getPositions();
    setPositions(positions);
    setAssignments(assignments);   

    // Build tree
    const orgMap = new Map<string, TreeNode>();
    
    // Tạo tất cả nodes trước
    orgs.forEach(org => {
      const orgId = org.id || org._id;
      orgMap.set(String(orgId), { 
        ...org, 
        _id: String(orgId), 
        children: [], 
        users: [],
        parent: org.parent // Đảm bảo parent được giữ lại
      });
    });    
   
    // Xây dựng quan hệ cha-con
    orgs.forEach(org => {
      const orgId = org.id || org._id;
      const parentId = org.parent;      
      
      if (parentId) {
        const parentIdStr = String(parentId);
        if (orgMap.has(parentIdStr)) {
          const childNode = orgMap.get(String(orgId));
          const parentNode = orgMap.get(parentIdStr);
          if (childNode && parentNode) {         
            parentNode.children.push(childNode);
          }
        } else {
          console.log(`Parent ${parentId} not found for ${org.name}`);
        }
      }
    });


    // Gán user vào từng node
    assignments.forEach(a => {
      const orgId = isObjectWithId(a.organizationId) && a.organizationId !== null
        ? a.organizationId._id : a.organizationId;
      if (orgId && orgMap.has(String(orgId))) {
        const user = users.find(u => u._id === (isObjectWithId(a.userId) ? a.userId._id : a.userId));
        if (user && !orgMap.get(String(orgId))!.users.some(u => u._id === user._id)) {
          orgMap.get(String(orgId))!.users.push(user);
        }
      }
    });

    // Lấy root nodes (những node không có parent hoặc parent không tồn tại trong map)
    const roots = Array.from(orgMap.values()).filter(org => {
      const hasParent = org.parent && orgMap.has(String(org.parent));
   
      return !hasParent;
    });  
   
    setTreeData(roots);
    setLoading(false);
  };

  const expandAll = () => {
    const allNodeIds: string[] = [];
    const collectNodeIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        allNodeIds.push(node._id);
        if (node.children) {
          collectNodeIds(node.children);
        }
      });
    };
    collectNodeIds(treeData);
    
    const expandedState: Record<string, boolean> = {};
    const showUsersState: Record<string, boolean> = {};
    allNodeIds.forEach(id => {
      expandedState[id] = true;
      showUsersState[id] = true;
    });
    setExpanded(expandedState);
    setShowUsers(showUsersState);
  };

  const collapseAll = () => {
    setExpanded({});
    setShowUsers({});
  };

  const toggleNode = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleUsers = (id: string) => {
    setShowUsers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTree = (node: TreeNode, level = 1) => (
    <div
      key={node._id}
      style={{
        marginLeft: level * 30,
        marginBottom: 8,
        border: '1px solid #e0e0e0',
        borderRadius: 6,
        background: level === 1 ? '#f5f5f5' : level === 2 ? '#fafbfc' : '#ffffff',
        padding: 12,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        {node.children && node.children.length > 0 ? (
          <button
            onClick={() => toggleNode(node._id)}
            style={{
              marginRight: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              color: '#1976d2',
            }}
            aria-label={expanded[node._id] ? 'Thu gọn' : 'Mở rộng'}
          >
            {expanded[node._id] ? '📂' : '📁'}
          </button>
        ) : (
          <span style={{ marginRight: 8, fontSize: 16 }}>📄</span>
        )}
        
        <span style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>
          {node.name}
          {node.children && node.children.length > 0 && (
            <span style={{ color: '#666', fontWeight: 400, fontSize: 14 }}>
              {' '}({node.children.length} phòng ban con)
            </span>
          )}
        </span>
        
        {node.users && node.users.length > 0 && (
          <button
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              border: '1px solid #4caf50',
              borderRadius: 4,
              background: showUsers[node._id] ? '#4caf50' : '#fff',
              color: showUsers[node._id] ? '#fff' : '#4caf50',
              cursor: 'pointer',
              fontSize: 12,
            }}
            onClick={() => toggleUsers(node._id)}
          >
            {showUsers[node._id] ? 'Ẩn NV' : 'Hiện NV'} ({node.users.length})
          </button>
        )}
        
        {/* <button
          style={{
            marginLeft: 8,
            padding: '2px 8px',
            border: '1px solid #1976d2',
            borderRadius: 4,
            background: '#fff',
            color: '#1976d2',
            cursor: 'pointer',
            fontSize: 12,
          }}
          onClick={() => setDetailNodeId(node._id)}
        >
          Chi tiết
        </button> */}
      </div>

      {node.users && node.users.length > 0 && showUsers[node._id] && (
        <div style={{ 
          background: '#fff', 
          border: '1px solid #ddd', 
          borderRadius: 4, 
          padding: 8, 
          marginBottom: 8 
        }}>
          <div style={{ fontWeight: 500, marginBottom: 4, color: '#666' }}>
            Nhân viên ({node.users.length}):
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {node.users
  .map(user => {
    const assignment = assignments.find(
      a =>
        ((isObjectWithId(a.userId) && a.userId !== null && '_id' in a.userId ? a.userId._id : a.userId) === user._id) &&
        ((isObjectWithId(a.organizationId) && a.organizationId !== null && '_id' in a.organizationId ? a.organizationId._id : a.organizationId) === node._id)
    );
    let positionName = '';
    let level = 1;
    if (assignment) {
      const posId = isObjectWithId(assignment.positionId) && assignment.positionId !== null && '_id' in assignment.positionId ? assignment.positionId._id : assignment.positionId;
      const position = positions.find(p => p._id === posId);
      positionName = position ? position.name : '';
      level = position ? position.level : 1;
    }
    return { user, positionName, level };
  })
  .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
  .map(({ user, positionName }, idx) => (
    <li key={user._id} style={{ marginBottom: 2 }}>
      <span style={{ fontWeight: 500 }}>{user.fullName}</span>
      {positionName && <span style={{ color: '#1976d2', marginLeft: 6 }}>- {positionName}</span>}
      {user.email && <span style={{ color: '#888', marginLeft: 6 }}>({user.email})</span>}
    </li>
  ))}
          </ul>
        </div>
      )}

      {node.children && node.children.length > 0 && expanded[node._id] && (
        <div style={{ borderLeft: '2px solid #ddd', paddingLeft: 16, marginTop: 8 }}>
          {node.children.map(child => renderTree(child, level + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Cơ cấu tổ chức & Người dùng</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={expandAll}
            style={{
              padding: '8px 16px',
              border: '1px solid #4caf50',
              borderRadius: 4,
              background: '#4caf50',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Mở tất cả
          </button>
          <button
            onClick={collapseAll}
            style={{
              padding: '8px 16px',
              border: '1px solid #f44336',
              borderRadius: 4,
              background: '#f44336',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Đóng tất cả
          </button>
        </div>
      </div>
      
      {loading ? (
        <p>Đang tải...</p>
      ) : treeData.length === 0 ? (
        <p>Không có cơ cấu tổ chức</p>
      ) : (
        treeData.map(node => renderTree(node))
      )}      
    </div>
  );
};

export default OrganizationStructureView;

function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes as TreeNode[]) {
    if ((node as TreeNode)._id === id) return node as TreeNode;
    if (node.children) {
      const found = findNodeById(node.children as TreeNode[], id);
      if (found) return found;
    }
  }
  return null;
}