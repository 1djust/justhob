class UnitModel {
  final String id;
  final String unitNumber;
  final String type;

  UnitModel({
    required this.id,
    required this.unitNumber,
    required this.type,
  });

  factory UnitModel.fromJson(Map<String, dynamic> json) {
    return UnitModel(
      id: json['id'] ?? '',
      unitNumber: json['unitNumber'] ?? '',
      type: json['type'] ?? 'RESIDENTIAL',
    );
  }
}

class PropertyModel {
  final String id;
  final String name;
  final String address;
  final String? imageUrl;
  final List<UnitModel> units;
  final int activeLeasesCount;
  final String category; // 'Residential' or 'Commercial'
  final bool isActive;

  PropertyModel({
    required this.id,
    required this.name,
    required this.address,
    this.imageUrl,
    required this.units,
    required this.activeLeasesCount,
    required this.category,
    this.isActive = true,
  });

  int get totalUnits => units.length;
  int get totalTenants => activeLeasesCount;

  int get occupancyPercentage {
    if (totalUnits == 0) return 0;
    final pct = ((activeLeasesCount / totalUnits) * 100).round();
    return pct > 100 ? 100 : pct;
  }

  factory PropertyModel.fromJson(Map<String, dynamic> json) {
    final rawUnits = (json['units'] as List?) ?? [];
    final unitsList = rawUnits.map((u) => UnitModel.fromJson(u)).toList();
    final leasesList = (json['leases'] as List?) ?? [];

    // Determine category based on unit types or property name
    bool isCommercial = unitsList.any((u) => u.type.contains('COMMERCIAL') || u.type.contains('OFFICE') || u.type.contains('RETAIL')) ||
        (json['name']?.toString().toLowerCase().contains('commercial') ?? false) ||
        (json['name']?.toString().toLowerCase().contains('plaza') ?? false);

    return PropertyModel(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Unnamed Property',
      address: json['address'] ?? 'No address provided',
      imageUrl: json['imageUrl'],
      units: unitsList,
      activeLeasesCount: leasesList.length,
      category: isCommercial ? 'Commercial' : 'Residential',
      isActive: json['deletedAt'] == null,
    );
  }
}
