export const brandingDocumentsKeyMap = {
  primaryColor: 'branding_primary_color',
  receiptHeaderText: 'receipt_header_text',
  receiptFooterText: 'receipt_footer_text',
  idCardFooterText: 'id_card_footer_text',
  payslipFooterText: 'payslip_footer_text',
  certificateFooterText: 'certificate_footer_text',
  reportCardFooterText: 'report_card_footer_text',
  defaultPaperSize: 'default_paper_size',
} as const;

export const brandingDocumentsSettingKeys = [
  'school_logo',
  ...Object.values(brandingDocumentsKeyMap),
];
