import type { ImportSourceSystem, ImportEntityType } from "@club/shared";

/**
 * Known field mappings for legacy club management systems.
 * Maps source column names → ClubOS target fields.
 */

// ClubOS target fields per entity type
export const TARGET_FIELDS: Record<ImportEntityType, { field: string; label: string; required: boolean }[]> = {
  members: [
    { field: "first_name", label: "First Name", required: true },
    { field: "last_name", label: "Last Name", required: true },
    { field: "email", label: "Email", required: true },
    { field: "phone", label: "Phone", required: false },
    { field: "member_number", label: "Member Number", required: false },
    { field: "role", label: "Role (admin/staff/member)", required: false },
    { field: "status", label: "Status (active/inactive)", required: false },
    { field: "tier_name", label: "Membership Tier Name", required: false },
    { field: "join_date", label: "Join Date", required: false },
    { field: "notes", label: "Notes", required: false },
    { field: "family_name", label: "Family Name", required: false },
  ],
  invoices: [
    { field: "member_email", label: "Member Email", required: true },
    { field: "amount", label: "Amount", required: true },
    { field: "description", label: "Description", required: true },
    { field: "due_date", label: "Due Date", required: true },
    { field: "status", label: "Status (draft/sent/paid/overdue)", required: false },
  ],
  payments: [
    { field: "member_email", label: "Member Email", required: true },
    { field: "amount", label: "Amount", required: true },
    { field: "method", label: "Payment Method", required: false },
    { field: "description", label: "Description", required: false },
    { field: "date", label: "Payment Date", required: false },
  ],
  bookings: [
    { field: "member_email", label: "Member Email", required: true },
    { field: "facility_name", label: "Facility Name", required: true },
    { field: "date", label: "Date", required: true },
    { field: "start_time", label: "Start Time", required: true },
    { field: "end_time", label: "End Time", required: false },
    { field: "party_size", label: "Party Size", required: false },
    { field: "status", label: "Status", required: false },
  ],
  events: [
    { field: "title", label: "Title", required: true },
    { field: "description", label: "Description", required: false },
    { field: "location", label: "Location", required: false },
    { field: "start_date", label: "Start Date/Time", required: true },
    { field: "end_date", label: "End Date/Time", required: false },
    { field: "capacity", label: "Capacity", required: false },
    { field: "price", label: "Price", required: false },
  ],
};

// Known column name patterns for auto-mapping
const JONAS_MEMBER_MAP: Record<string, string> = {
  "First Name": "first_name",
  "Last Name": "last_name",
  "E-mail": "email",
  "Email": "email",
  "Phone": "phone",
  "Home Phone": "phone",
  "Member #": "member_number",
  "Member No": "member_number",
  "Member Number": "member_number",
  "MemberID": "member_number",
  "Status": "status",
  "Category": "tier_name",
  "Membership Type": "tier_name",
  "Member Type": "tier_name",
  "Join Date": "join_date",
  "Date Joined": "join_date",
  "Notes": "notes",
  "Family": "family_name",
  "Family Name": "family_name",
};

const NORTHSTAR_MEMBER_MAP: Record<string, string> = {
  "FirstName": "first_name",
  "FIRST_NAME": "first_name",
  "LastName": "last_name",
  "LAST_NAME": "last_name",
  "EmailAddress": "email",
  "EMAIL": "email",
  "PhoneNumber": "phone",
  "PHONE": "phone",
  "MemberNumber": "member_number",
  "MEMBER_NO": "member_number",
  "MemberStatus": "status",
  "STATUS": "status",
  "MemberType": "tier_name",
  "MEMBER_TYPE": "tier_name",
  "JoinDate": "join_date",
  "JOIN_DATE": "join_date",
  "FamilyName": "family_name",
};

const GENERIC_MEMBER_MAP: Record<string, string> = {
  // Common variations
  "first_name": "first_name",
  "firstname": "first_name",
  "first": "first_name",
  "fname": "first_name",
  "last_name": "last_name",
  "lastname": "last_name",
  "last": "last_name",
  "lname": "last_name",
  "email": "email",
  "email_address": "email",
  "e-mail": "email",
  "phone": "phone",
  "phone_number": "phone",
  "mobile": "phone",
  "member_number": "member_number",
  "member_no": "member_number",
  "member_id": "member_number",
  "id": "member_number",
  "status": "status",
  "tier": "tier_name",
  "type": "tier_name",
  "membership_type": "tier_name",
  "join_date": "join_date",
  "joined": "join_date",
  "date_joined": "join_date",
  "notes": "notes",
  "family": "family_name",
};

const INVOICE_MAP: Record<string, string> = {
  "email": "member_email",
  "member_email": "member_email",
  "Email": "member_email",
  "amount": "amount",
  "Amount": "amount",
  "total": "amount",
  "Total": "amount",
  "description": "description",
  "Description": "description",
  "memo": "description",
  "due_date": "due_date",
  "Due Date": "due_date",
  "DueDate": "due_date",
  "status": "status",
  "Status": "status",
};

/**
 * Auto-detect field mapping from source column headers.
 */
export function suggestMapping(
  sourceColumns: string[],
  entityType: ImportEntityType,
  sourceSystem: ImportSourceSystem,
): Record<string, string> {
  const mapping: Record<string, string> = {};

  // Pick the right reference map
  let refMap: Record<string, string>;
  if (entityType === "members") {
    switch (sourceSystem) {
      case "jonas":
        refMap = { ...GENERIC_MEMBER_MAP, ...JONAS_MEMBER_MAP };
        break;
      case "northstar":
        refMap = { ...GENERIC_MEMBER_MAP, ...NORTHSTAR_MEMBER_MAP };
        break;
      default:
        refMap = GENERIC_MEMBER_MAP;
        break;
    }
  } else if (entityType === "invoices" || entityType === "payments") {
    refMap = INVOICE_MAP;
  } else {
    refMap = GENERIC_MEMBER_MAP; // fallback to fuzzy
  }

  for (const col of sourceColumns) {
    // Exact match
    if (refMap[col]) {
      mapping[col] = refMap[col];
      continue;
    }
    // Case-insensitive match
    const lower = col.toLowerCase().replace(/[^a-z0-9]/g, "_");
    for (const [pattern, target] of Object.entries(refMap)) {
      if (pattern.toLowerCase().replace(/[^a-z0-9]/g, "_") === lower) {
        mapping[col] = target;
        break;
      }
    }
  }

  return mapping;
}
