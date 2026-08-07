import 'package:flutter/material.dart';

class TenantFilterResult {
  final String type;
  final String location;

  TenantFilterResult({
    required this.type,
    required this.location,
  });
}

class TenantFilterBottomSheet extends StatefulWidget {
  final String selectedType;
  final String selectedLocation;
  final List<String> availableLocations;

  const TenantFilterBottomSheet({
    super.key,
    this.selectedType = 'All Types',
    this.selectedLocation = 'All',
    this.availableLocations = const ['All', "Solomon's Heights", 'Solomon Luxury Estates', 'Alpha Commercial plaza'],
  });

  static Future<TenantFilterResult?> show(
    BuildContext context, {
    String selectedType = 'All Types',
    String selectedLocation = 'All',
    List<String> availableLocations = const ['All', "Solomon's Heights", 'Solomon Luxury Estates', 'Alpha Commercial plaza'],
  }) {
    return showModalBottomSheet<TenantFilterResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => TenantFilterBottomSheet(
        selectedType: selectedType,
        selectedLocation: selectedLocation,
        availableLocations: availableLocations,
      ),
    );
  }

  @override
  State<TenantFilterBottomSheet> createState() => _TenantFilterBottomSheetState();
}

class _TenantFilterBottomSheetState extends State<TenantFilterBottomSheet> {
  late String _selectedType;
  late String _selectedLocation;

  bool _isTypeExpanded = true;
  bool _isLocationExpanded = true;

  final List<String> _typeOptions = [
    'All Types',
    'New Tenants',
    'Renewals',
    'Past Tenants',
  ];

  @override
  void initState() {
    super.initState();
    _selectedType = widget.selectedType;
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: "Filters" + Close button (X)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Filters',
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

          // 1. TYPE SECTION
          const Text(
            'TYPE',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF64748B),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),

          // Custom Select Dropdown for TYPE
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                // Header Box
                InkWell(
                  onTap: () {
                    setState(() {
                      _isTypeExpanded = !_isTypeExpanded;
                    });
                  },
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _selectedType,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        Icon(
                          _isTypeExpanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          color: const Color(0xFF64748B),
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),

                // Expanded Dropdown List
                if (_isTypeExpanded)
                  Container(
                    decoration: const BoxDecoration(
                      border: Border(
                        top: BorderSide(color: Color(0xFFF1F5F9), width: 1),
                      ),
                    ),
                    child: Column(
                      children: _typeOptions.map((option) {
                        final isSelected = option == _selectedType;
                        return InkWell(
                          onTap: () {
                            setState(() {
                              _selectedType = option;
                            });
                          },
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
          ),
          const SizedBox(height: 20),

          // Divider line
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 20),

          // 2. LOCATION SECTION
          const Text(
            'LOCATION',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF64748B),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),

          // Custom Select Dropdown for LOCATION
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                // Header Box
                InkWell(
                  onTap: () {
                    setState(() {
                      _isLocationExpanded = !_isLocationExpanded;
                    });
                  },
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _selectedLocation,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        Icon(
                          _isLocationExpanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          color: const Color(0xFF64748B),
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),

                // Expanded Dropdown List
                if (_isLocationExpanded)
                  Container(
                    decoration: const BoxDecoration(
                      border: Border(
                        top: BorderSide(color: Color(0xFFF1F5F9), width: 1),
                      ),
                    ),
                    child: Column(
                      children: widget.availableLocations.map((loc) {
                        final isSelected = loc == _selectedLocation;
                        return InkWell(
                          onTap: () {
                            setState(() {
                              _selectedLocation = loc;
                            });
                          },
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
                                Expanded(
                                  child: Text(
                                    loc,
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                      color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF334155),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
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
          ),
          const SizedBox(height: 28),

          // 3. ACTION BUTTONS (Apply Filters & Reset Filters)
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop(
                  TenantFilterResult(
                    type: _selectedType,
                    location: _selectedLocation,
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB), // Vibrant Primary Blue
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
                  _selectedType = 'All Types';
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
    );
  }
}
