import { request } from './client';

export interface MyStudentsGroupStudent {
  id: string;
  studentSystemId: string;
  fullNameEn: string;
  rollNumber: number | null;
  hasMedicalAlert: boolean;
}

export interface MyStudentsClassGroup {
  classId: string;
  sectionId: string | null;
  className: string;
  subject: string;
  students: MyStudentsGroupStudent[];
}

export const teacherStudentsApi = {
  getMyStudents: () => request<MyStudentsClassGroup[]>('/teacher-workspace/my-students'),
};
