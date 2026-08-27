import 'package:flutter/material.dart';

class TenantModel {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String propertyName;
  final String unitNumber;
  final String status; // 'Active', 'Expiring', 'Overdue'
  final String? avatarUrl;

  // New fields for feature parity with web
  final bool? allowPartialPayments;
  final String? leaseStatus; // Raw backend status
  final String? leaseId;
  final String? rejectionReason;
  final String? legalDocUrl;

  TenantModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.propertyName,
    required this.unitNumber,
    required this.status,
    this.avatarUrl,
    this.allowPartialPayments,
    this.leaseStatus,
    this.leaseId,
    this.rejectionReason,
    this.legalDocUrl,
  });

  String get locationSubtitle => '$propertyName, Unit $unitNumber';

  /// Short ID for display (e.g. "AB12CD")
  String get shortId {
    final parts = id.split('-');
    return parts.isNotEmpty ? parts.first.toUpperCase() : id.substring(0, 6).toUpperCase();
  }

  /// Attachment file name derived from tenant name and short ID
  String get attachmentName {
    final namePart = name.split(' ').first.length > 4
        ? name.split(' ').first.substring(0, 4)
        : name.split(' ').first;
    final idPart = shortId.length > 4 ? shortId.substring(0, 4) : shortId;
    return '${namePart}_$idPart.pdf';
  }

  /// Whether this tenant has an active or pending lease
  bool get hasLease => leaseStatus != null && leaseStatus!.isNotEmpty;

  /// Whether this tenant's lease has a viewable attachment
  bool get hasAttachment =>
      hasLease &&
      (leaseStatus == 'ACTIVE' || leaseStatus == 'PENDING_SIGNATURE') &&
      legalDocUrl != null &&
      legalDocUrl!.isNotEmpty;

  /// Display-friendly lease status label
  String get displayLeaseStatus {
    switch (leaseStatus) {
      case 'PENDING_SIGNATURE':
        return 'Pending Signature';
      case 'PENDING_LEGAL_VERIFICATION':
        return 'Pending Verification';
      case 'PENDING_LEGAL_UPLOAD':
        return 'Pending Upload';
      case 'REJECTED':
        return 'Rejected';
      case 'PENDING_RENEWAL':
        return 'Pending Renewal';
      case 'ACTIVE':
        return status; // Use computed status (Active/Expiring/Overdue)
      default:
        return status;
    }
  }

  Color get statusTextColor {
    // Check raw lease status first for non-standard statuses
    switch (leaseStatus) {
      case 'PENDING_SIGNATURE':
        return const Color(0xFFD97706); // Amber
      case 'PENDING_LEGAL_VERIFICATION':
        return const Color(0xFF2563EB); // Blue
      case 'PENDING_LEGAL_UPLOAD':
        return const Color(0xFF0284C7); // Sky
      case 'REJECTED':
        return const Color(0xFFEF4444); // Rose
      case 'PENDING_RENEWAL':
        return const Color(0xFFD97706); // Amber
      default:
        break;
    }
    // Fall back to computed status
    switch (status.toLowerCase()) {
      case 'expiring':
        return const Color(0xFFD97706); // Amber
      case 'overdue':
        return const Color(0xFFEF4444); // Red
      case 'active':
      default:
        return const Color(0xFF15803D); // Dark Green
    }
  }

  Color get statusBackgroundColor {
    switch (leaseStatus) {
      case 'PENDING_SIGNATURE':
        return const Color(0xFFFFFBEB); // Soft Amber
      case 'PENDING_LEGAL_VERIFICATION':
        return const Color(0xFFEFF6FF); // Soft Blue
      case 'PENDING_LEGAL_UPLOAD':
        return const Color(0xFFF0F9FF); // Soft Sky
      case 'REJECTED':
        return const Color(0xFFFEF2F2); // Soft Red/Rose
      case 'PENDING_RENEWAL':
        return const Color(0xFFFFFBEB); // Soft Amber
      default:
        break;
    }
    switch (status.toLowerCase()) {
      case 'expiring':
        return const Color(0xFFFFFBEB); // Soft Amber
      case 'overdue':
        return const Color(0xFFFEF2F2); // Soft Red
      case 'active':
      default:
        return const Color(0xFFDCFCE7); // Soft Green
    }
  }

  factory TenantModel.fromJson(Map<String, dynamic> json) {
    final leases = (json['leases'] as List?) ?? [];
    Map<String, dynamic>? activeLease;

    // Find active lease first, then fall back to first lease
    for (final lease in leases) {
      if (lease is Map<String, dynamic> && lease['status'] == 'ACTIVE') {
        activeLease = lease;
        break;
      }
    }
    activeLease ??= leases.isNotEmpty ? (leases.first as Map<String, dynamic>) : null;

    final property = activeLease?['property'];
    final unit = activeLease?['unit'];
    final rawLeaseStatus = activeLease?['status']?.toString();

    // Determine computed status from lease dates
    String calculatedStatus = 'Active';
    if (activeLease != null && activeLease['endDate'] != null) {
      final endDate = DateTime.tryParse(activeLease['endDate'].toString());
      if (endDate != null) {
        final daysRemaining = endDate.difference(DateTime.now()).inDays;
        if (daysRemaining < 0) {
          calculatedStatus = 'Overdue';
        } else if (daysRemaining <= 30) {
          calculatedStatus = 'Expiring';
        }
      }
    }

    // For non-ACTIVE lease statuses, use the raw status as the display status
    String displayStatus = calculatedStatus;
    if (rawLeaseStatus != null && rawLeaseStatus != 'ACTIVE') {
      displayStatus = rawLeaseStatus.replaceAll('_', ' ');
    }

    return TenantModel(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Unnamed Tenant',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      propertyName: property?['name'] ?? 'Unassigned',
      unitNumber: unit?['unitNumber'] ?? '-',
      status: json['status'] ?? displayStatus,
      avatarUrl: json['avatarUrl'],
      allowPartialPayments: json['allowPartialPayments'] as bool?,
      leaseStatus: rawLeaseStatus,
      leaseId: activeLease?['id']?.toString(),
      rejectionReason: activeLease?['rejectionReason']?.toString(),
      legalDocUrl: activeLease?['legalDocUrl']?.toString(),
    );
  }
}
