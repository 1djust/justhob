class LandlordStats {
  final int totalProperties;
  final int totalTenants;
  final double rentCollected;
  final int pendingMaintenance;
  final int underReviewPayments;
  final int overduePaymentsCount;
  final int expiringLeasesCount;

  LandlordStats({
    required this.totalProperties,
    required this.totalTenants,
    required this.rentCollected,
    required this.pendingMaintenance,
    required this.underReviewPayments,
    required this.overduePaymentsCount,
    required this.expiringLeasesCount,
  });

  factory LandlordStats.fromJson(Map<String, dynamic> json) {
    return LandlordStats(
      totalProperties: json['totalProperties'] ?? 0,
      totalTenants: json['totalTenants'] ?? 0,
      rentCollected: (json['rentCollected'] as num?)?.toDouble() ?? 0.0,
      pendingMaintenance: json['pendingMaintenance'] ?? 0,
      underReviewPayments: json['underReviewPayments'] ?? 0,
      overduePaymentsCount: json['overduePaymentsCount'] ?? 0,
      expiringLeasesCount: json['expiringLeasesCount'] ?? 0,
    );
  }
}
