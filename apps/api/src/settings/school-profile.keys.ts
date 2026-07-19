export const schoolProfileKeyMap = {
  schoolName: 'school_name',
  schoolAddress: 'school_address',
  schoolPhone: 'school_phone',
  schoolEmail: 'school_email',
  schoolPanNumber: 'school_pan_number',
  principalName: 'principal_name',
  municipality: 'municipality',
  wardNumber: 'ward_number',
  district: 'district',
  province: 'province',
  schoolType: 'school_type',
  iemisSchoolCode: 'iemis_school_code',
  affiliationBoard: 'affiliation_board',
  affiliationNumber: 'affiliation_number',
} as const;

export const schoolProfileSettingKeys = Object.values(schoolProfileKeyMap);
