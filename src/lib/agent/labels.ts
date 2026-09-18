export const FIELD_LABEL: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  fullName: "Full Name",
  email: "Email",
  address: "Address",
  jobTitle: "Job Title",
  department: "Department",
  workLocation: "Work Location",
  hireDate: "Hire Date",
  phoneNumber: "Phone Number",
  dateOfBirth: "Date of Birth",
  legacyId: "Legacy ID",
};

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

export function humanizeFields(text: string): string {
  return Object.entries(FIELD_LABEL).reduce(
    (value, [key, label]) => value.replaceAll(key, label),
    text,
  );
}
