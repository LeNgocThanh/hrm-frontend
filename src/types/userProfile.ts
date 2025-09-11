export enum EDUCATION_LEVELS  {
    HIGH_SCHOOL = "highSchool",
    VOCATIONAL_SCHOOL = "vocationalSchool",
    BACHELOR_DEGREE = "bachelorDegree",
    MASTER_DEGREE = "masterDegree",
    DOCTORAL_DEGREE = "doctoralDegree",
};

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
  educationLevel?: EDUCATION_LEVELS;
  certificate?: string;
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
  educationLevel?: EDUCATION_LEVELS;
  certificate?: string;
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
  educationLevel?: EDUCATION_LEVELS;
  certificate?: string;
}

export interface UserProfileResponse extends UserProfile {
  _id: string;
  createdAt: string;
  updatedAt: string;
}