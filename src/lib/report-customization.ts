export type ReportCustomizationSettings = {
  grading_scale: "nacca_standard" | "traditional_30_70" | "traditional_40_60";
  show_class_position: boolean;
  show_subject_statistics: boolean;
  append_bill_slip: boolean;
  next_term_resumption_date: string | null;
  vacation_date: string | null;
  general_announcement: string;
  enable_qr_verification: boolean;
  include_serial_number: boolean;
  withhold_unpaid_reports: boolean;
  headteacher_signature_url: string | null;
  official_stamp_url: string | null;
};

export const defaultReportCustomizationSettings: ReportCustomizationSettings = {
  grading_scale: "nacca_standard",
  show_class_position: true,
  show_subject_statistics: false,
  append_bill_slip: true,
  next_term_resumption_date: null,
  vacation_date: null,
  general_announcement: "",
  enable_qr_verification: true,
  include_serial_number: true,
  withhold_unpaid_reports: false,
  headteacher_signature_url: null,
  official_stamp_url: null,
};
