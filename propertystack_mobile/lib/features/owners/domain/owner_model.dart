class OwnerPropertyInfo {
  final String id;
  final String name;
  final String unitInfo;

  const OwnerPropertyInfo({
    required this.id,
    required this.name,
    required this.unitInfo,
  });

  factory OwnerPropertyInfo.fromJson(Map<String, dynamic> json) {
    return OwnerPropertyInfo(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      unitInfo: json['unitInfo'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'unitInfo': unitInfo,
    };
  }
}

const Map<String, String> nigerianBankMap = {
  '044': 'Access Bank',
  '058': 'Guaranty Trust Bank (GTB)',
  '033': 'United Bank for Africa (UBA)',
  '032': 'Union Bank',
  '057': 'Zenith Bank',
  '214': 'First City Monument Bank (FCMB)',
  '011': 'First Bank of Nigeria',
  '215': 'Unity Bank',
  '232': 'Sterling Bank',
  '050': 'Ecobank Nigeria',
  '030': 'Heritage Bank',
  '082': 'Keystone Bank',
  '076': 'Polaris Bank',
  '221': 'Stanbic IBTC Bank',
  '212': 'Wema Bank',
  '035': 'ALAT by WEMA',
  '068': 'Standard Chartered Bank',
  '999992': 'OPay (PayCom)',
  '50515': 'Moniepoint Microfinance Bank',
  '999991': 'PalmPay',
  '50211': 'Kuda Microfinance Bank',
  '565': 'Carbon',
  '090110': 'VFD Microfinance Bank',
  '51318': 'FairMoney Microfinance Bank',
};

class OwnerModel {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String? payoutStrategy;
  final String? bankCode;
  final String? accountNumber;
  final String? accountName;
  final String setupStatus; // 'NOT SET', 'Configured'
  final String accountStatus; // 'Account Pending', 'Active'
  final String? bankName;
  final String kycStatus; // 'Account Pending', 'Verified'
  final List<OwnerPropertyInfo> assignedProperties;
  final String? memberId;
  final String? joinedAt;

  const OwnerModel({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.payoutStrategy,
    this.bankCode,
    this.accountNumber,
    this.accountName,
    required this.setupStatus,
    required this.accountStatus,
    this.bankName,
    required this.kycStatus,
    required this.assignedProperties,
    this.memberId,
    this.joinedAt,
  });

  OwnerModel copyWith({
    String? id,
    String? name,
    String? email,
    String? phone,
    String? payoutStrategy,
    String? bankCode,
    String? accountNumber,
    String? accountName,
    String? setupStatus,
    String? accountStatus,
    String? bankName,
    String? kycStatus,
    List<OwnerPropertyInfo>? assignedProperties,
    String? memberId,
    String? joinedAt,
  }) {
    return OwnerModel(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      payoutStrategy: payoutStrategy ?? this.payoutStrategy,
      bankCode: bankCode ?? this.bankCode,
      accountNumber: accountNumber ?? this.accountNumber,
      accountName: accountName ?? this.accountName,
      setupStatus: setupStatus ?? this.setupStatus,
      accountStatus: accountStatus ?? this.accountStatus,
      bankName: bankName ?? this.bankName,
      kycStatus: kycStatus ?? this.kycStatus,
      assignedProperties: assignedProperties ?? this.assignedProperties,
      memberId: memberId ?? this.memberId,
      joinedAt: joinedAt ?? this.joinedAt,
    );
  }

  factory OwnerModel.fromApiJson(Map<String, dynamic> json) {
    final accNum = json['accountNumber'] as String?;
    final bCode = json['bankCode'] as String?;
    final pStrategy = json['payoutStrategy'] as String?;

    final isConfigured = (accNum != null && accNum.isNotEmpty) || (pStrategy != null && pStrategy.isNotEmpty);
    final derivedBankName = bCode != null ? (nigerianBankMap[bCode] ?? bCode) : null;

    return OwnerModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      payoutStrategy: pStrategy,
      bankCode: bCode,
      accountNumber: accNum,
      accountName: json['accountName'] as String?,
      setupStatus: isConfigured ? 'Configured' : 'NOT SET',
      accountStatus: isConfigured ? 'Active' : 'Account Pending',
      bankName: derivedBankName,
      kycStatus: isConfigured ? 'Verified' : 'Account Pending',
      assignedProperties: (json['assignedProperties'] as List<dynamic>?)
              ?.map((e) => OwnerPropertyInfo.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      memberId: json['memberId'] as String?,
      joinedAt: json['joinedAt'] as String?,
    );
  }

  factory OwnerModel.fromJson(Map<String, dynamic> json) {
    return OwnerModel.fromApiJson(json);
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'payoutStrategy': payoutStrategy,
      'bankCode': bankCode,
      'accountNumber': accountNumber,
      'accountName': accountName,
      'setupStatus': setupStatus,
      'accountStatus': accountStatus,
      'bankName': bankName,
      'kycStatus': kycStatus,
      'assignedProperties': assignedProperties.map((e) => e.toJson()).toList(),
      'memberId': memberId,
      'joinedAt': joinedAt,
    };
  }
}
