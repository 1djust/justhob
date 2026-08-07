import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../features/tenants/data/tenants_repository.dart';
import '../../features/tenants/presentation/tenants_notifier.dart';
import '../../features/properties/data/properties_repository.dart';
import '../../features/auth/presentation/auth_notifier.dart';

class CreateLeaseBottomSheet extends ConsumerStatefulWidget {
  final String tenantId;
  final String tenantName;

  const CreateLeaseBottomSheet({
    super.key,
    required this.tenantId,
    required this.tenantName,
  });

  @override
  ConsumerState<CreateLeaseBottomSheet> createState() => _CreateLeaseBottomSheetState();
}

class _CreateLeaseBottomSheetState extends ConsumerState<CreateLeaseBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedPropertyId;
  String? _selectedUnitId;
  DateTime? _startDate = DateTime.now();
  DateTime? _endDate = DateTime.now().add(const Duration(days: 365));
  final _rentController = TextEditingController();
  final _agreementTextController = TextEditingController();
  bool _isLoading = false;
  List<dynamic> _properties = [];
  List<dynamic> _units = [];
  bool _fetchingProperties = true;

  @override
  void initState() {
    super.initState();
    _loadProperties();
  }

  @override
  void dispose() {
    _rentController.dispose();
    _agreementTextController.dispose();
    super.dispose();
  }

  Future<void> _loadProperties() async {
    try {
      final authState = ref.read(authStateProvider);
      final user = authState.valueOrNull;
      if (user == null) return;

      final managerWorkspace = user.workspaces.firstWhere(
        (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
      );

      final props = await ref
          .read(propertiesRepositoryProvider)
          .getProperties(managerWorkspace.workspaceId);

      if (mounted) {
        setState(() {
          _properties = props;
          _fetchingProperties = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _fetchingProperties = false);
      }
    }
  }

  void _onPropertySelected(String? propId) {
    setState(() {
      _selectedPropertyId = propId;
      _selectedUnitId = null;
      _units = [];
    });

    if (propId != null) {
      final prop = _properties.firstWhere((p) => p.id == propId, orElse: () => null);
      if (prop != null && prop.units != null) {
        setState(() {
          _units = prop.units;
        });
      }
    }
  }

  Future<void> _submitLease() async {
    if (!_formKey.currentState!.validate() || _selectedPropertyId == null || _startDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a property and start date.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final authState = ref.read(authStateProvider);
      final user = authState.valueOrNull;
      if (user == null) return;

      final managerWorkspace = user.workspaces.firstWhere(
        (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
      );

      final rent = double.tryParse(_rentController.text.trim()) ?? 0.0;

      await ref.read(tenantsRepositoryProvider).createLease(
            managerWorkspace.workspaceId,
            widget.tenantId,
            propertyId: _selectedPropertyId!,
            unitId: _selectedUnitId,
            startDate: DateFormat('yyyy-MM-dd').format(_startDate!),
            endDate: _endDate != null ? DateFormat('yyyy-MM-dd').format(_endDate!) : null,
            yearlyRent: rent,
            agreementText: _agreementTextController.text.trim(),
          );

      ref.invalidate(tenantsProvider);

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lease agreement created for ${widget.tenantName}!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create lease: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        top: 24,
        left: 24,
        right: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Assign Lease to ${widget.tenantName}',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Property Selector
              if (_fetchingProperties)
                const CircularProgressIndicator()
              else
                DropdownButtonFormField<String>(
                  value: _selectedPropertyId,
                  decoration: const InputDecoration(
                    labelText: 'Select Property *',
                    border: OutlineInputBorder(),
                  ),
                  items: _properties.map<DropdownMenuItem<String>>((p) {
                    return DropdownMenuItem<String>(
                      value: p.id as String,
                      child: Text(p.name as String),
                    );
                  }).toList(),
                  onChanged: _onPropertySelected,
                  validator: (v) => v == null ? 'Property is required' : null,
                ),
              const SizedBox(height: 16),

              // Unit Selector (Optional)
              if (_units.isNotEmpty) ...[
                DropdownButtonFormField<String>(
                  value: _selectedUnitId,
                  decoration: const InputDecoration(
                    labelText: 'Select Unit (Optional)',
                    border: OutlineInputBorder(),
                  ),
                  items: _units.map<DropdownMenuItem<String>>((u) {
                    return DropdownMenuItem<String>(
                      value: u.id as String,
                      child: Text('Unit ${u.unitNumber} (${u.type})'),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedUnitId = v),
                ),
                const SizedBox(height: 16),
              ],

              // Yearly Rent
              TextFormField(
                controller: _rentController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Yearly Rent (₦) *',
                  prefixText: '₦ ',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Rent amount is required' : null,
              ),
              const SizedBox(height: 16),

              // Start & End Date Selectors
              Row(
                children: [
                  Expanded(
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Start Date', style: TextStyle(fontSize: 12)),
                      subtitle: Text(
                        _startDate != null
                            ? DateFormat('MMM dd, yyyy').format(_startDate!)
                            : 'Select Date',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      trailing: const Icon(Icons.calendar_today, size: 18),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _startDate ?? DateTime.now(),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2030),
                        );
                        if (picked != null) setState(() => _startDate = picked);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('End Date', style: TextStyle(fontSize: 12)),
                      subtitle: Text(
                        _endDate != null
                            ? DateFormat('MMM dd, yyyy').format(_endDate!)
                            : 'Select Date',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      trailing: const Icon(Icons.calendar_today, size: 18),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _endDate ?? DateTime.now().add(const Duration(days: 365)),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2030),
                        );
                        if (picked != null) setState(() => _endDate = picked);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Submit Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submitLease,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Create Lease Agreement', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
