import 'package:flutter/material.dart';

class TimeframeBottomSheet extends StatefulWidget {
  final String selectedTimeframe;
  final ValueChanged<String>? onSelected;

  const TimeframeBottomSheet({
    super.key,
    required this.selectedTimeframe,
    this.onSelected,
  });

  static Future<String?> show(
    BuildContext context, {
    required String selectedTimeframe,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => TimeframeBottomSheet(selectedTimeframe: selectedTimeframe),
    );
  }

  @override
  State<TimeframeBottomSheet> createState() => _TimeframeBottomSheetState();
}

class _TimeframeBottomSheetState extends State<TimeframeBottomSheet> {
  late String _selected;

  final List<Map<String, String>> _timeframeOptions = [
    {'title': 'This Month', 'subtitle': 'Current active month metrics'},
    {'title': 'Last Month', 'subtitle': 'Previous month historical metrics'},
    {'title': 'Last 3 Months', 'subtitle': 'Quarterly aggregated summary'},
    {'title': 'This Year', 'subtitle': 'Year to date financial summary'},
  ];

  @override
  void initState() {
    super.initState();
    _selected = widget.selectedTimeframe;
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

          // Header: "Select Timeframe" + "Done"
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Select Timeframe',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.4,
                ),
              ),
              GestureDetector(
                onTap: () {
                  if (widget.onSelected != null) widget.onSelected!(_selected);
                  Navigator.of(context).pop(_selected);
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

          // Options List
          Column(
            children: _timeframeOptions.map((option) {
              final isSelected = option['title'] == _selected;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: InkWell(
                  onTap: () {
                    setState(() {
                      _selected = option['title']!;
                    });
                  },
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
                        width: isSelected ? 1.5 : 1.0,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Icon(
                            isSelected ? Icons.check_rounded : Icons.calendar_today_rounded,
                            color: isSelected ? Colors.white : const Color(0xFF64748B),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                option['title']!,
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                option['subtitle']!,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w400,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}
