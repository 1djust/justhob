import 'package:flutter/material.dart';

class PropertyFilterResult {
  final String category;
  final String occupancy;
  final String sortBy;
  final String location;

  PropertyFilterResult({
    required this.category,
    required this.occupancy,
    required this.sortBy,
    required this.location,
  });

  bool get isDefault =>
      (category == 'All' || category == 'All Types') &&
      occupancy == 'All' &&
      sortBy == 'Default' &&
      location == 'All';
}

class PropertyFilterBottomSheet extends StatefulWidget {
  final String selectedCategory;
  final String selectedOccupancy;
  final String selectedSortBy;
  final String selectedLocation;
  final List<String> availableLocations;

  const PropertyFilterBottomSheet({
    super.key,
    this.selectedCategory = 'All',
    this.selectedOccupancy = 'All',
    this.selectedSortBy = 'Default',
    this.selectedLocation = 'All',
    this.availableLocations = const ['All'],
  });

  static Future<PropertyFilterResult?> show(
    BuildContext context, {
    String selectedCategory = 'All',
    String selectedOccupancy = 'All',
    String selectedSortBy = 'Default',
    String selectedLocation = 'All',
    List<String> availableLocations = const ['All'],
  }) {
    return showModalBottomSheet<PropertyFilterResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => PropertyFilterBottomSheet(
        selectedCategory: selectedCategory,
        selectedOccupancy: selectedOccupancy,
        selectedSortBy: selectedSortBy,
        selectedLocation: selectedLocation,
        availableLocations: availableLocations,
      ),
    );
  }

  @override
  State<PropertyFilterBottomSheet> createState() => _PropertyFilterBottomSheetState();
}

class _PropertyFilterBottomSheetState extends State<PropertyFilterBottomSheet> {
  late String _selectedCategory;
  late String _selectedOccupancy;
  late String _selectedSortBy;
  late String _selectedLocation;

  bool _isCategoryExpanded = true;
  bool _isOccupancyExpanded = false;
  bool _isSortExpanded = false;
  bool _isLocationExpanded = false;

  final List<String> _categoryOptions = [
    'All',
    'Residential',
    'Commercial',
  ];

  final List<String> _occupancyOptions = [
    'All',
    'Fully Occupied',
    'Partially Occupied',
    'Vacant',
  ];

  final List<String> _sortOptions = [
    'Default',
    'Name (A-Z)',
    'Highest Units',
    'Most Occupied',
  ];

  @override
  void initState() {
    super.initState();
    _selectedCategory = widget.selectedCategory;
    _selectedOccupancy = widget.selectedOccupancy;
    _selectedSortBy = widget.selectedSortBy;
    _selectedLocation = widget.selectedLocation;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: "Filters" + Close button (X)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Filter Properties',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.4,
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: const Icon(
                    Icons.close_rounded,
                    color: Color(0xFF64748B),
                    size: 22,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // 1. CATEGORY SECTION
            _buildSectionTitle('PROPERTY TYPE / CATEGORY'),
            const SizedBox(height: 8),
            _buildDropdown(
              title: _selectedCategory,
              isExpanded: _isCategoryExpanded,
              onToggle: () => setState(() => _isCategoryExpanded = !_isCategoryExpanded),
              options: _categoryOptions,
              selectedOption: _selectedCategory,
              onSelect: (val) => setState(() => _selectedCategory = val),
            ),
            const SizedBox(height: 16),

            // 2. OCCUPANCY STATUS SECTION
            _buildSectionTitle('OCCUPANCY STATUS'),
            const SizedBox(height: 8),
            _buildDropdown(
              title: _selectedOccupancy,
              isExpanded: _isOccupancyExpanded,
              onToggle: () => setState(() => _isOccupancyExpanded = !_isOccupancyExpanded),
              options: _occupancyOptions,
              selectedOption: _selectedOccupancy,
              onSelect: (val) => setState(() => _selectedOccupancy = val),
            ),
            const SizedBox(height: 16),

            // 3. SORT BY SECTION
            _buildSectionTitle('SORT BY'),
            const SizedBox(height: 8),
            _buildDropdown(
              title: _selectedSortBy,
              isExpanded: _isSortExpanded,
              onToggle: () => setState(() => _isSortExpanded = !_isSortExpanded),
              options: _sortOptions,
              selectedOption: _selectedSortBy,
              onSelect: (val) => setState(() => _selectedSortBy = val),
            ),
            const SizedBox(height: 16),

            // 4. LOCATION SECTION (if available)
            if (widget.availableLocations.length > 1) ...[
              _buildSectionTitle('LOCATION'),
              const SizedBox(height: 8),
              _buildDropdown(
                title: _selectedLocation,
                isExpanded: _isLocationExpanded,
                onToggle: () => setState(() => _isLocationExpanded = !_isLocationExpanded),
                options: widget.availableLocations,
                selectedOption: _selectedLocation,
                onSelect: (val) => setState(() => _selectedLocation = val),
              ),
              const SizedBox(height: 16),
            ],

            const SizedBox(height: 12),

            // 5. ACTION BUTTONS
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop(
                    PropertyFilterResult(
                      category: _selectedCategory,
                      occupancy: _selectedOccupancy,
                      sortBy: _selectedSortBy,
                      location: _selectedLocation,
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'Apply Filters',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Reset Filters Text Button
            Center(
              child: GestureDetector(
                onTap: () {
                  setState(() {
                    _selectedCategory = 'All';
                    _selectedOccupancy = 'All';
                    _selectedSortBy = 'Default';
                    _selectedLocation = 'All';
                  });
                },
                child: const Text(
                  'Reset Filters',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF64748B),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: Color(0xFF64748B),
        letterSpacing: 0.8,
      ),
    );
  }

  Widget _buildDropdown({
    required String title,
    required bool isExpanded,
    required VoidCallback onToggle,
    required List<String> options,
    required String selectedOption,
    required ValueChanged<String> onSelect,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: BorderRadius.circular(14),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  Icon(
                    isExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: const Color(0xFF64748B),
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          if (isExpanded)
            Container(
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: Color(0xFFF1F5F9), width: 1),
                ),
              ),
              child: Column(
                children: options.map((option) {
                  final isSelected = option == selectedOption;
                  return InkWell(
                    onTap: () => onSelect(option),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFEFF6FF) : Colors.transparent,
                        border: const Border(
                          bottom: BorderSide(color: Color(0xFFF1F5F9), width: 0.5),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            option,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF334155),
                            ),
                          ),
                          if (isSelected)
                            const Icon(
                              Icons.check_rounded,
                              color: Color(0xFF2563EB),
                              size: 18,
                            ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }
}
