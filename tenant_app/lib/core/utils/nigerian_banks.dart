/// Maps Nigerian bank codes (CBN codes) to their bank names.
class NigerianBanks {
  static const Map<String, String> _bankMap = {
    '044': 'Access Bank',
    '023': 'Citibank Nigeria',
    '063': 'Diamond Bank', // Now Access Bank
    '050': 'Ecobank Nigeria',
    '084': 'Enterprise Bank',
    '070': 'Fidelity Bank',
    '011': 'First Bank of Nigeria',
    '214': 'First City Monument Bank',
    '058': 'Guaranty Trust Bank',
    '030': 'Heritage Bank',
    '301': 'Jaiz Bank',
    '082': 'Keystone Bank',
    '526': 'Parallex Bank',
    '076': 'Polaris Bank',
    '101': 'Providus Bank',
    '221': 'Stanbic IBTC Bank',
    '068': 'Standard Chartered Bank',
    '232': 'Sterling Bank',
    '100': 'Suntrust Bank',
    '032': 'Union Bank of Nigeria',
    '033': 'United Bank for Africa',
    '215': 'Unity Bank',
    '035': 'Wema Bank',
    '057': 'Zenith Bank',
    '999': 'NIP Virtual Bank',
    '304': 'Stanbic Mobile',
    '327': 'OPay',
    '323': 'Moniepoint',
    '305': 'Paycom (PalmPay)',
    '090110': 'VFD Microfinance Bank',
    '090267': 'Kuda Microfinance Bank',
    '100025': 'Kuda',
    '50211': 'Kuda',
  };

  /// Returns the bank name for a given code, or the code itself if not found.
  static String getBankName(String? code) {
    if (code == null || code.isEmpty) return 'N/A';
    return _bankMap[code] ?? code;
  }
}
