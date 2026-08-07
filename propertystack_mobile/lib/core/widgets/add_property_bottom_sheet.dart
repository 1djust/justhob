import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/properties/data/properties_repository.dart';
import '../../features/properties/presentation/properties_notifier.dart';
import '../../features/owners/presentation/owners_notifier.dart';
import '../../features/auth/presentation/auth_notifier.dart';

class AddPropertyBottomSheet extends ConsumerStatefulWidget {
  const AddPropertyBottomSheet({super.key});

  @override
  ConsumerState<AddPropertyBottomSheet> createState() => _AddPropertyBottomSheetState();
}

class _AddPropertyBottomSheetState extends ConsumerState<AddPropertyBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _addressController = TextEditingController();
  String? _selectedOwnerId;
  bool _isLoading = false;
  bool _fetchingOwners = true;
  List<dynamic> _owners = [];

  final List<Map<String, String>> _units = [
    {'unitNumber': '1', 'type': 'Mini Flat'},
  ];

  final List<String> _propertyTypes = [
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
    _loadLandlords();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _loadLandlords() async {
    try {
      final authState = ref.read(authStateProvider);
      final user = authState.valueOrNull;
      if (user == null) return;

      final managerWorkspace = user.workspaces.firstWhere(
        (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
      );

      final owners = await ref
          .read(ownersRepositoryProvider)
          .fetchOwners(managerWorkspace.workspaceId);

      if (mounted) {
        setState(() {
          _owners = owners;
          _fetchingOwners = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _fetchingOwners = false);
    }
  }

  void _addUnitRow() {
    setState(() {
      _units.add({
        'unitNumber': '${_units.length + 1}',
        'type': 'Mini Flat',
      });
    });
  }

  void _removeUnitRow(int index) {
    if (_units.length > 1) {
      setState(() {
        _units.removeAt(index);
      });
    }
  }

  Future<void> _submitProperty() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final authState = ref.read(authStateProvider);
      final user = authState.valueOrNull;
      if (user == null) return;

      final managerWorkspace = user.workspaces.firstWhere(
        (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
      );

      await ref.read(propertiesRepositoryProvider).createProperty(
            managerWorkspace.workspaceId,
            name: _nameController.text.trim(),
            address: _addressController.text.trim(),
            ownerId: _selectedOwnerId,
            units: _units,
          );

      ref.invalidate(propertiesProvider);

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Property "${_nameController.text.trim()}" created successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create property: $e')),
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
                  const Text(
                    'Add New Property',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Property Name
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Property Name *',
                  hintText: 'e.g. Diamond Heights Estate',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Property name is required' : null,
              ),
              const SizedBox(height: 16),

              // Address
              TextFormField(
                controller: _addressController,
                decoration: const InputDecoration(
                  labelText: 'Address *',
                  hintText: 'e.g. 12 Allen Avenue, Ikeja',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Address is required' : null,
              ),
              const SizedBox(height: 16),

              // Landlord Selector
              if (_fetchingOwners)
                const LinearProgressIndicator()
              else if (_owners.isNotEmpty) ...[
                DropdownButtonFormField<String>(
                  value: _selectedOwnerId,
                  decoration: const InputDecoration(
                    labelText: 'Assign Landlord (Optional)',
                    border: OutlineInputBorder(),
                  ),
                  items: _owners.map<DropdownMenuItem<String>>((o) {
                    return DropdownMenuItem<String>(
                      value: o.id as String,
                      child: Text('${o.name} (${o.email})'),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedOwnerId = v),
                ),
                const SizedBox(height: 16),
              ],

              // Units Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Units & Apartments',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  TextButton.icon(
                    onPressed: _addUnitRow,
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Add Unit'),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Units List
              ..._units.asMap().entries.map((entry) {
                final idx = entry.key;
                final unit = entry.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: TextFormField(
                          initialValue: unit['unitNumber'],
                          decoration: InputDecoration(
                            labelText: 'Unit #${idx + 1}',
                            border: const OutlineInputBorder(),
                            isDense: true,
                          ),
                          onChanged: (val) => _units[idx]['unitNumber'] = val,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 3,
                        child: DropdownButtonFormField<String>(
                          value: unit['type'],
                          decoration: const InputDecoration(
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                          items: _propertyTypes.map((t) {
                            return DropdownMenuItem(value: t, child: Text(t, style: const TextStyle(fontSize: 13)));
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) setState(() => _units[idx]['type'] = val);
                          },
                        ),
                      ),
                      if (_units.length > 1)
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.red),
                          onPressed: () => _removeUnitRow(idx),
                        ),
                    ],
                  ),
                );
              }),

              const SizedBox(height: 20),

              // Submit Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submitProperty,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Save Property', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
