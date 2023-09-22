export type FileName = {
  formName: string;
  exportDate: string;
  formId: string | null;
};

export type Record = {
  "Submission ID": string;
  "Respondent ID": string;
  "Submitted at": string;
  [key: string]: string;
};

export type Mapping = {
  [column: string]: FieldHeader;
};

export type FieldType =
  | "INPUT_TEXT"
  | "INPUT_EMAIL"
  | "DROPDOWN"
  | "MULTIPLE_CHOICE"
  | "TEXTAREA"
  | "CHECKBOXES"
  | "LINEAR_SCALE";

export type FieldHeader = {
  label: string | null;
  type: FieldType;
  key: string;
};
