export const TARGET_SCHEMA = {
  entity: "Employee",
  system: "Darwinbox (mock)",
  identity: ["email", "legacyId"],
  dateFormat: "DD/MM/YYYY",
  fields: [
    { name: "firstName", type: "string", required: true, label: "First Name", description: "Given name only." },
    { name: "lastName", type: "string", required: true, label: "Last Name", description: "Family name only." },
    {
      name: "fullName",
      type: "string",
      required: false,
      label: "Full Name",
      description:
        "Synthetic. Use only when the source has one combined name column that should be split into firstName + lastName.",
    },
    {
      name: "email",
      type: "email",
      required: true,
      unique: true,
      label: "Email",
      description: "Work email. Primary identity key.",
    },
    { name: "address", type: "string", required: false, label: "Address", description: "Home or mailing address." },
    { name: "jobTitle", type: "string", required: false, label: "Job Title", description: "Role or designation." },
    { name: "department", type: "string", required: false, label: "Department", description: "Org unit / team / dept." },
    {
      name: "workLocation",
      type: "string",
      required: false,
      label: "Work Location",
      description: "Office, city, site, or work location.",
    },
    {
      name: "hireDate",
      type: "date",
      required: false,
      format: "DD/MM/YYYY",
      label: "Hire Date",
      description: "Join / start / hire date. Target stores DD/MM/YYYY.",
    },
    {
      name: "phoneNumber",
      type: "phone",
      required: false,
      label: "Phone Number",
      description: "Mobile or work phone.",
    },
    {
      name: "dateOfBirth",
      type: "date",
      required: false,
      format: "DD/MM/YYYY",
      label: "Date of Birth",
      description: "Date of birth. Target stores DD/MM/YYYY.",
    },
    {
      name: "legacyId",
      type: "string",
      required: false,
      label: "Legacy System ID",
      description:
        "The source HRIS employee/contractor id. Do not invent a Darwinbox id. The target system assigns Target ID on insert.",
    },
    {
      name: "ignore",
      type: "none",
      required: false,
      description: "Source leftover that must not be imported (bank account, notes, employment type, status flags).",
    },
  ],
} as const;

export const TARGET_FIELD_NAMES = TARGET_SCHEMA.fields.map((field) => field.name);
