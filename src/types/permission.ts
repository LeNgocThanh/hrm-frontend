export enum Module {
  User = 'User',
  Asset = 'Asset',
  All = 'All',
  Meeting = 'Meeting',
  Notice = 'Notice',
}

export interface Permission {
  _id: string;
  name: string;
  module: Module;
  action: Action;
  code: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
} 

export enum Action {
    CREATE  = 'create',
    READ    = 'read',
    UPDATE  = 'update',
    DELETE  = 'delete',
    APPROVE = 'approve',
    REJECT  = 'reject',
    EXPORT  = 'export',
    VIEWOWNER = 'viewOwner',
    UPDATEOWNER = 'updateOwner',
    ASSIGN  = 'assign',
    MANAGE  = 'manage',
    VIEWALL = 'viewAll',
  }