import 'dart:ui';
import 'package:flutter/material.dart';

class UnitItem {
  final String label; // e.g. "A1", "A2"
  String unitType;   // e.g. "Mini Flat", "Self-Contain"

  UnitItem({required this.label, required this.unitType});
}

class AddUnitsBottomSheet extends StatefulWidget {
  final List<UnitItem>? initialUnits;
  final ValueChanged<List<UnitItem>>? onDone;

  const AddUnitsBottomSheet({
    super.key,
    this.initialUnits,
    this.onDone,
  });

  static Future<List<UnitItem>?> show(
    BuildContext context, {
    List<UnitItem>? initialUnits,
  }) {
    return showModalBottomSheet<List<UnitItem>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddUnitsBottomSheet(initialUnits: initialUnits),
    );
  }

  @override
  State<AddUnitsBottomSheet> createState() => _AddUnitsBottomSheetState();
}

class _AddUnitsBottomSheetState extends State<AddUnitsBottomSheet> {
  late List<UnitItem> _units;

  final List<String> _availableTypes = [
    'Mini Flat',
    'Self-Contain',
    'R&P S/C',
    'Single Room',
    '2-Bed Flat',
    '3-Bed Flat',
    'Duplex',
  ];

  @override
  void initState() {
    super.initState();
    _units = widget.initialUnits != null && widget.initialUnits!.isNotEmpty
        ? List.from(widget.initialUnits!)
        : [
            UnitItem(label: 'A1', unitType: 'Mini Flat'),
            UnitItem(label: 'A2', unitType: 'Self-Contain'),
            UnitItem(label: 'A3', unitType: '2-Bed Flat'),
          ];
  }

  void _addUnit() {
    setState(() {
      final index = _units.length + 1;
      _units.add(UnitItem(label: 'A$index', unitType: 'Mini Flat'));
    });
  }

  void _removeUnit(int index) {
    if (_units.length > 1) {
      setState(() {
        _units.removeAt(index);
        // Renumber labels
        for (int i = 0; i < _units.length; i++) {
          _units[i] = UnitItem(label: 'A${i + 1}', unitType: _units[i].unitType);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        top: 12,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag Handle
          Center(
            child: Container(
              width: 48,
              height: 5,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Header: "Add Units" + "Done"
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Add Units',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.4,
                ),
              ),
              GestureDetector(
                onTap: () {
                  if (widget.onDone != null) widget.onDone!(_units);
                  Navigator.of(context).pop(_units);
                },
                child: const Text(
                  'Done',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2563EB),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // List of Unit Rows
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  for (int i = 0; i < _units.length; i++) ...[
                    _buildUnitRow(i),
                    const SizedBox(height: 14),
                  ],

                  // Add Another Unit Dashed Button
                  _buildAddAnotherButton(),
                  const SizedBox(height: 20),

                  // Footer Caption Text
                  const Text(
                    'Available types: Mini Flat, Self-Contain, R&P S/C, Single Room, 2-Bed Flat, 3-Bed Flat, Duplex',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF64748B),
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUnitRow(int index) {
    final item = _units[index];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          // Blue Circle Avatar Badge (e.g. A1, A2)
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              color: Color(0xFF2563EB),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              item.label,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Dropdown Select Box
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _availableTypes.contains(item.unitType) ? item.unitType : _availableTypes.first,
                  icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B)),
                  isExpanded: true,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0F172A),
                  ),
                  onChanged: (newType) {
                    if (newType != null) {
                      setState(() {
                        item.unitType = newType;
                      });
                    }
                  },
                  items: _availableTypes.map((type) {
                    return DropdownMenuItem<String>(
                      value: type,
                      child: Text(type),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Trash Delete Button
          GestureDetector(
            onTap: () => _removeUnit(index),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(
                Icons.delete_outline_rounded,
                color: Color(0xFFEF4444),
                size: 22,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAddAnotherButton() {
    return CustomPaint(
      painter: _DashedBorderPainter(color: const Color(0xFF2563EB), radius: 16),
      child: InkWell(
        onTap: _addUnit,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          width: double.infinity,
          height: 52,
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              Icon(Icons.add_rounded, color: Color(0xFF2563EB), size: 20),
              SizedBox(width: 8),
              Text(
                '+ Add Another Unit',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2563EB),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Custom Dashed Border Painter
class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double radius;

  _DashedBorderPainter({required this.color, required this.radius});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final RRect rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(radius),
    );

    final Path path = Path()..addRRect(rrect);
    final Path dashPath = Path();

    double dashWidth = 6.0;
    double dashSpace = 4.0;
    double distance = 0.0;

    for (final PathMetric pathMetric in path.computeMetrics()) {
      while (distance < pathMetric.length) {
        dashPath.addPath(
          pathMetric.extractPath(distance, distance + dashWidth),
          Offset.zero,
        );
        distance += dashWidth + dashSpace;
      }
    }

    canvas.drawPath(dashPath, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
