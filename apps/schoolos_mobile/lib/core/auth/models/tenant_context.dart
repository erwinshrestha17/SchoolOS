class TenantContext {
  const TenantContext({required this.tenantCode, required this.schoolName});

  final String tenantCode;
  final String schoolName;

  factory TenantContext.fromJson(Map<String, dynamic> json) {
    return TenantContext(
      tenantCode:
          json['tenantCode'] as String? ?? json['tenant_code'] as String? ?? '',
      schoolName:
          json['schoolName'] as String? ?? json['school_name'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {'tenantCode': tenantCode, 'schoolName': schoolName};
  }
}
