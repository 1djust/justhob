import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../domain/property_model.dart';

class PropertyDetailScreen extends ConsumerStatefulWidget {
  final PropertyModel property;

  const PropertyDetailScreen({
    super.key,
    required this.property,
  });

  @override
  ConsumerState<PropertyDetailScreen> createState() => _PropertyDetailScreenState();
}

class _PropertyDetailScreenState extends ConsumerState<PropertyDetailScreen> {
  int _selectedTabIndex = 0; // 0: Overview, 1: Units, 2: Finances



  @override
  Widget build(BuildContext context) {
    final property = widget.property;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Full-Bleed Image Header with Overlay Back and Menu Buttons
            _buildHeroImageHeader(context, property),

            // 2. Title & Address Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    property.name,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    property.address,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),

            // 3. Sub-Navigation Tabs (Overview, Units, Finances)
            _buildSubNavTabs(context, totalUnits: property.totalUnits),
            const SizedBox(height: 20),

            // 4. Tab Body Content
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: _buildTabContent(context, property),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  /// Hero Image Header with Circular Floating Back & Menu Buttons
  Widget _buildHeroImageHeader(BuildContext context, PropertyModel property) {
    return Stack(
      children: [
        // Image Container
        SizedBox(
          height: 270,
          width: double.infinity,
          child: property.imageUrl != null && property.imageUrl!.isNotEmpty
              ? Image.network(
                  property.imageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => _buildPlaceholderImage(),
                )
              : _buildPlaceholderImage(),
        ),

        // Gradient overlay for button contrast
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 100,
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.black54, Colors.transparent],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ),

        // Floating Action Buttons (Back & Menu)
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Back Button
                GestureDetector(
                  onTap: () => context.pop(),
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Color(0x73000000), // Semi-transparent dark overlay
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.arrow_back_ios_new_rounded,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                ),

                // Options Menu Button (•••)
                GestureDetector(
                  onTap: () {
                    _showPropertyOptionsMenu(context);
                  },
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Color(0x73000000),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.more_horiz_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPlaceholderImage() {
    return Container(
      color: const Color(0xFFCBD5E1),
      child: const Center(
        child: Icon(
          Icons.apartment_rounded,
          size: 64,
          color: Colors.white70,
        ),
      ),
    );
  }

  /// 3 Sub-Navigation Tabs (Overview, Units, Finances)
  Widget _buildSubNavTabs(BuildContext context, {required int totalUnits}) {
    final tabs = ['Overview', 'Units ($totalUnits)', 'Finances'];

    return Container(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
      ),
      child: Row(
        children: List.generate(tabs.length, (index) {
          final isSelected = _selectedTabIndex == index;
          return Expanded(
            child: GestureDetector(
              onTap: () {
                setState(() {
                  _selectedTabIndex = index;
                });
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: isSelected ? const Color(0xFF2563EB) : Colors.transparent,
                      width: 2.5,
                    ),
                  ),
                ),
                child: Text(
                  tabs[index],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF64748B),
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  /// Tab Content (Overview, Units, Finances)
  Widget _buildTabContent(BuildContext context, PropertyModel property) {
    switch (_selectedTabIndex) {
      case 1:
        return _buildUnitsTab(context, property);
      case 2:
        return _buildFinancesTab(context, property);
      case 0:
      default:
        return _buildOverviewTab(context, property);
    }
  }

  /// 1. Overview Tab
  Widget _buildOverviewTab(BuildContext context, PropertyModel property) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Metrics Summary Row (3 Cards: Occupancy, Total Units, M/M Revenue)
        Row(
          children: [
            Expanded(
              child: _buildOverviewMetricCard(
                title: 'Occupancy',
                value: '${property.occupancyPercentage}%',
                valueColor: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildOverviewMetricCard(
                title: 'Total Units',
                value: '${property.totalUnits}',
                valueColor: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildOverviewMetricCard(
                title: 'M/M Revenue',
                value: '₦1.4M',
                valueColor: const Color(0xFF059669), // Emerald Green
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),

        // Recent Activity Section Title
        _buildRecentActivity(),
      ],
    );
  }

  Widget _buildRecentActivity() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: const [
        Text(
          'Recent Activity',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F172A),
          ),
        ),
        SizedBox(height: 16),
        Padding(
          padding: EdgeInsets.symmetric(vertical: 20),
          child: Center(
            child: Text(
              'No activity recorded yet for this property.',
              style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildOverviewMetricCard({
    required String title,
    required String value,
    required Color valueColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: valueColor,
                letterSpacing: -0.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 2. Units Tab
  Widget _buildUnitsTab(BuildContext context, PropertyModel property) {
    if (property.units.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 30),
        child: Center(
          child: Text(
            'No units registered for this property yet.',
            style: TextStyle(color: Color(0xFF64748B)),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: property.units.map((unit) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Color(0xFF2563EB),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      unit.unitNumber,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Unit ${unit.unitNumber}',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        unit.type,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'Occupied',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF15803D),
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  /// 3. Finances Tab
  Widget _buildFinancesTab(BuildContext context, PropertyModel property) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text(
                'Financial Performance',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
              SizedBox(height: 12),
              Text(
                'Total Annual Expected: ₦16,800,000',
                style: TextStyle(fontSize: 14, color: Color(0xFF475569)),
              ),
              SizedBox(height: 4),
              Text(
                'Collected YTD: ₦14,200,000',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF059669)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showPropertyOptionsMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit_outlined, color: Color(0xFF2563EB)),
              title: const Text('Edit Property Details'),
              onTap: () {
                Navigator.pop(context);
              },
            ),
            ListTile(
              leading: const Icon(Icons.add_home_work_outlined, color: Color(0xFF2563EB)),
              title: const Text('Manage Units'),
              onTap: () {
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }
}
