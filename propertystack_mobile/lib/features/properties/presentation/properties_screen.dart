import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/widgets/add_units_bottom_sheet.dart';
import '../../../../core/widgets/add_property_bottom_sheet.dart';
import '../../../../core/widgets/property_filter_bottom_sheet.dart';
import '../../../../core/widgets/landlord_bottom_nav_bar.dart';
import '../../../../core/widgets/header_action_icons.dart';
import '../domain/property_model.dart';
import 'properties_notifier.dart';

class PropertiesScreen extends ConsumerStatefulWidget {
  const PropertiesScreen({super.key});

  @override
  ConsumerState<PropertiesScreen> createState() => _PropertiesScreenState();
}

class _PropertiesScreenState extends ConsumerState<PropertiesScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedCategory = 'All'; // 'All', 'Residential', 'Commercial'
  String _selectedOccupancy = 'All'; // 'All', 'Fully Occupied', 'Partially Occupied', 'Vacant'
  String _selectedSortBy = 'Default';
  String _selectedLocation = 'All';
  String _searchQuery = '';

  final List<String> _categoryOptions = ['All', 'Residential', 'Commercial', 'Location'];

  bool get _hasActiveFilters =>
      _selectedCategory != 'All' ||
      _selectedOccupancy != 'All' ||
      _selectedSortBy != 'Default' ||
      _selectedLocation != 'All';



  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final propertiesAsync = ref.watch(propertiesProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(propertiesProvider);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Header Bar
                _buildHeader(context),
                const SizedBox(height: 20),

                // 2. Search & Filter Bar
                _buildSearchAndFilterBar(context, propertiesAsync.valueOrNull ?? []),
                const SizedBox(height: 16),

                // 3. Horizontal Category Chips Row
                _buildCategoryChipsRow(context, propertiesAsync.valueOrNull ?? []),
                const SizedBox(height: 20),

                // Active Filters Clear Bar (if active)
                if (_hasActiveFilters) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Filtered by: ${_selectedCategory != "All" ? _selectedCategory : ""}${_selectedOccupancy != "All" ? " • $_selectedOccupancy" : ""}${_selectedLocation != "All" ? " • $_selectedLocation" : ""}${_selectedSortBy != "Default" ? " • $_selectedSortBy" : ""}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF2563EB)),
                      ),
                      GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedCategory = 'All';
                            _selectedOccupancy = 'All';
                            _selectedSortBy = 'Default';
                            _selectedLocation = 'All';
                          });
                        },
                        child: const Text(
                          'Clear All',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFEF4444)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                ],

                // 4. Properties List
                propertiesAsync.when(
                  data: (propertiesList) {
                    final filteredList = _filterProperties(propertiesList);

                    if (filteredList.isEmpty) {
                      return _buildEmptyState();
                    }

                    return ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: filteredList.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 20),
                      itemBuilder: (context, index) {
                        return _buildPropertyCard(context, filteredList[index]);
                      },
                    );
                  },
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: CircularProgressIndicator(color: Color(0xFF2563EB))),
                  ),
                  error: (err, stack) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: Text(
                        'Failed to load properties. Swipe down to refresh.',
                        style: const TextStyle(color: Color(0xFFEF4444), fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 80), // Bottom padding for FAB
              ],
            ),
          ),
        ),
      ),

      // Floating Action Button (+ Add Property / Units)
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          showModalBottomSheet(
            context: context,
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
            builder: (ctx) => SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ListTile(
                    leading: const Icon(Icons.domain_add, color: Color(0xFF2563EB)),
                    title: const Text('Add New Property', style: TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: const Text('Create a new building/estate with units'),
                    onTap: () {
                      Navigator.pop(ctx);
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => const AddPropertyBottomSheet(),
                      );
                    },
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.add_business, color: Color(0xFF10B981)),
                    title: const Text('Add Units to Property', style: TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: const Text('Add additional apartments to an existing building'),
                    onTap: () {
                      Navigator.pop(ctx);
                      AddUnitsBottomSheet.show(context);
                    },
                  ),
                ],
              ),
            ),
          );
        },
        backgroundColor: const Color(0xFF2563EB),
        elevation: 4,
        shape: const CircleBorder(),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
      ),

      // Bottom Navigation Bar
      bottomNavigationBar: const LandlordBottomNavBar(currentIndex: 1),
    );
  }

  List<PropertyModel> _filterProperties(List<PropertyModel> list) {
    var filtered = list.where((p) {
      final matchesSearch = _searchQuery.isEmpty ||
          p.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          p.address.toLowerCase().contains(_searchQuery.toLowerCase());

      final matchesCategory = _selectedCategory == 'All' ||
          _selectedCategory == 'Location' ||
          _selectedCategory == 'All Types' ||
          p.category.toLowerCase() == _selectedCategory.toLowerCase();

      final matchesLocation = _selectedLocation == 'All' ||
          p.address.toLowerCase().contains(_selectedLocation.toLowerCase());

      bool matchesOccupancy = true;
      if (_selectedOccupancy == 'Fully Occupied') {
        matchesOccupancy = p.occupancyPercentage >= 100;
      } else if (_selectedOccupancy == 'Partially Occupied') {
        matchesOccupancy = p.occupancyPercentage > 0 && p.occupancyPercentage < 100;
      } else if (_selectedOccupancy == 'Vacant') {
        matchesOccupancy = p.occupancyPercentage == 0;
      }

      return matchesSearch && matchesCategory && matchesLocation && matchesOccupancy;
    }).toList();

    if (_selectedSortBy == 'Name (A-Z)') {
      filtered.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    } else if (_selectedSortBy == 'Highest Units') {
      filtered.sort((a, b) => b.totalUnits.compareTo(a.totalUnits));
    } else if (_selectedSortBy == 'Most Occupied') {
      filtered.sort((a, b) => b.occupancyPercentage.compareTo(a.occupancyPercentage));
    }

    return filtered;
  }

  void _openFilterBottomSheet(List<PropertyModel> properties) async {
    final availableLocations = <String>{'All'};
    for (final p in properties) {
      if (p.address.isNotEmpty) {
        final parts = p.address.split(',');
        final loc = parts.last.trim();
        if (loc.isNotEmpty) {
          availableLocations.add(loc);
        }
      }
    }

    final result = await PropertyFilterBottomSheet.show(
      context,
      selectedCategory: _selectedCategory,
      selectedOccupancy: _selectedOccupancy,
      selectedSortBy: _selectedSortBy,
      selectedLocation: _selectedLocation,
      availableLocations: availableLocations.toList(),
    );

    if (result != null && mounted) {
      setState(() {
        _selectedCategory = result.category;
        _selectedOccupancy = result.occupancy;
        _selectedSortBy = result.sortBy;
        _selectedLocation = result.location;
      });
    }
  }

  /// 1. Header Bar with Title & Action Icons
  Widget _buildHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text(
              'Properties',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
                letterSpacing: -0.5,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Manage your real estate assets',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: Color(0xFF64748B),
              ),
            ),
          ],
        ),
        const HeaderActionIcons(),
      ],
    );
  }

  /// 2. Search Field & Filter Button Row
  Widget _buildSearchAndFilterBar(BuildContext context, List<PropertyModel> properties) {
    return Row(
      children: [
        // Search TextField
        Expanded(
          child: Container(
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(5),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: TextField(
              controller: _searchController,
              onChanged: (val) {
                setState(() {
                  _searchQuery = val;
                });
              },
              style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
              decoration: const InputDecoration(
                hintText: 'Search properties...',
                hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                prefixIcon: Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),

        // Square Filter Button
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: _hasActiveFilters ? const Color(0xFF2563EB) : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: _hasActiveFilters ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
            ),
            boxShadow: [
              BoxShadow(
                color: _hasActiveFilters ? const Color(0xFF2563EB).withOpacity(0.3) : Colors.black.withAlpha(5),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: IconButton(
            onPressed: () => _openFilterBottomSheet(properties),
            icon: Icon(
              Icons.tune_rounded,
              color: _hasActiveFilters ? Colors.white : const Color(0xFF0F172A),
              size: 20,
            ),
          ),
        ),
      ],
    );
  }

  /// 3. Horizontal Category Filter Chips Row
  Widget _buildCategoryChipsRow(BuildContext context, List<PropertyModel> properties) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _categoryOptions.map((cat) {
          final isSelected = _selectedCategory == cat;
          final isLocation = cat == 'Location';

          return Padding(
            padding: const EdgeInsets.only(right: 10),
            child: InkWell(
              onTap: () {
                HapticFeedback.selectionClick();
                if (isLocation) {
                  _openFilterBottomSheet(properties);
                } else {
                  setState(() {
                    _selectedCategory = cat;
                  });
                }
              },
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF2563EB) : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withAlpha(4),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      cat,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? Colors.white : const Color(0xFF475569),
                      ),
                    ),
                    if (isLocation) ...[
                      const SizedBox(width: 4),
                      SvgPicture.asset(
                        'assets/icon/chevron-down.svg',
                        width: 14,
                        height: 14,
                        colorFilter: ColorFilter.mode(
                          isSelected ? Colors.white : const Color(0xFF64748B),
                          BlendMode.srcIn,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  /// 4. Property Card Widget matching Figma design
  Widget _buildPropertyCard(BuildContext context, PropertyModel property) {
    return InkWell(
      onTap: () {
        context.push('/landlord/properties/detail', extra: property);
      },
      borderRadius: BorderRadius.circular(20),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(8),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image Container
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            child: SizedBox(
              height: 180,
              width: double.infinity,
              child: _buildPropertyImage(property.imageUrl),
            ),
          ),

          // Property Details Container
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Name & Active Status Badge
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        property.name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                          letterSpacing: -0.4,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'Active',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF15803D),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Location Row
                Row(
                  children: [
                    const Icon(
                      Icons.location_on_outlined,
                      color: Color(0xFF94A3B8),
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        property.address,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w400,
                          color: Color(0xFF64748B),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Horizontal Divider
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                const SizedBox(height: 14),

                // Metrics Row (Tenants, Units, Occupied, Category Tag)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Tenants Count
                    Row(
                      children: [
                        SvgPicture.asset(
                          'assets/icon/building.svg',
                          width: 15,
                          height: 15,
                          colorFilter: const ColorFilter.mode(Color(0xFF64748B), BlendMode.srcIn),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${property.totalTenants} Tenants',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF334155),
                          ),
                        ),
                      ],
                    ),

                    // Units Count
                    Row(
                      children: [
                        SvgPicture.asset(
                          'assets/icon/building.svg',
                          width: 15,
                          height: 15,
                          colorFilter: const ColorFilter.mode(Color(0xFF64748B), BlendMode.srcIn),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${property.totalUnits} Units',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF334155),
                          ),
                        ),
                      ],
                    ),

                    // Occupancy Percentage
                    Row(
                      children: [
                        SvgPicture.asset(
                          'assets/icon/clock.svg',
                          width: 15,
                          height: 15,
                          colorFilter: const ColorFilter.mode(Color(0xFF64748B), BlendMode.srcIn),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${property.occupancyPercentage}% Occupied',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF334155),
                          ),
                        ),
                      ],
                    ),

                    // Category Tag Badge (Residential / Commercial)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        property.category,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

  Widget _buildPropertyImage(String? imageUrl) {
    if (imageUrl == null || imageUrl.isEmpty) return _buildImagePlaceholder();
    if (imageUrl.startsWith('data:image')) {
      try {
        final base64String = imageUrl.split(',').last;
        return Image.memory(
          base64Decode(base64String),
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildImagePlaceholder(),
        );
      } catch (_) {
        return _buildImagePlaceholder();
      }
    }
    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => _buildImagePlaceholder(),
    );
  }

  Widget _buildImagePlaceholder() {
    return Container(
      color: const Color(0xFFE2E8F0),
      child: Center(
        child: Icon(
          Icons.apartment_rounded,
          size: 48,
          color: Colors.grey.shade400,
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40),
      alignment: Alignment.center,
      child: Column(
        children: [
          Icon(Icons.search_off_rounded, size: 48, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          const Text(
            'No properties found',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
          ),
        ],
      ),
    );
  }

}
