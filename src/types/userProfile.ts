export interface UserProfile {
  _id?: string;
  userId: string;
  placeOfBirth?: string;
  permanentAddress?: string;
  temporaryAddress?: string;
  nationalId?: string;
  nationalIdIssuedDate?: string;
  nationalIdIssuedPlace?: string;
  maritalStatus?: string;
  bankAccount?: string;
  bankName?: string;
  bankBranch?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserProfileDto {
  userId: string;
  placeOfBirth?: string;
  permanentAddress?: string;
  temporaryAddress?: string;
  nationalId?: string;
  nationalIdIssuedDate?: string;
  nationalIdIssuedPlace?: string;
  maritalStatus?: string;
  bankAccount?: string;
  bankName?: string;
  bankBranch?: string;
}

export interface UpdateUserProfileDto {
  placeOfBirth?: string;
  permanentAddress?: string;
  temporaryAddress?: string;
  nationalId?: string;
  nationalIdIssuedDate?: string;
  nationalIdIssuedPlace?: string;
  maritalStatus?: string;
  bankAccount?: string;
  bankName?: string;
  bankBranch?: string;
}

export interface UserProfileResponse extends UserProfile {
  _id: string;
  createdAt: string;
  updatedAt: string;
}