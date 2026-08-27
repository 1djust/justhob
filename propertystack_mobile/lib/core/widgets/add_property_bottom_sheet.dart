import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
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
  File? _propertyImageFile;
  final ImagePicker _picker = ImagePicker();
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

  Future<void> _pickPropertyImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 80,
      );
      if (pickedFile != null) {
        setState(() {
          _propertyImageFile = File(pickedFile.path);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to select image: $e')),
        );
      }
    }
  }

  void _showImagePickerSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Property Picture',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 14),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(color: Color(0xFFEFF6FF), shape: BoxShape.circle),
                  child: const Icon(Icons.photo_camera_rounded, color: Color(0xFF2563EB)),
                ),
                title: const Text('Take Photo', style: TextStyle(fontWeight: FontWeight.w700)),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickPropertyImage(ImageSource.camera);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(color: Color(0xFFEFF6FF), shape: BoxShape.circle),
                  child: const Icon(Icons.photo_library_rounded, color: Color(0xFF2563EB)),
                ),
                title: const Text('Choose from Gallery', style: TextStyle(fontWeight: FontWeight.w700)),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickPropertyImage(ImageSource.gallery);
                },
              ),
              if (_propertyImageFile != null)
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(color: Color(0xFFFEE2E2), shape: BoxShape.circle),
                    child: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444)),
                  ),
                  title: const Text('Remove Photo', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEF4444))),
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() => _propertyImageFile = null);
                  },
                ),
            ],
          ),
        ),
      ),
    );
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

      String? imageUrl;
      if (_propertyImageFile != null) {
        final bytes = await _propertyImageFile!.readAsBytes();
        imageUrl = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      }

      await ref.read(propertiesRepositoryProvider).createProperty(
            managerWorkspace.workspaceId,
            name: _nameController.text.trim(),
            address: _addressController.text.trim(),
            ownerId: _selectedOwnerId,
            imageUrl: imageUrl,
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
              const SizedBox(height: 12),

              // Optional Property Photo Upload Card
              GestureDetector(
                onTap: _showImagePickerSheet,
                child: Container(
                  width: double.infinity,
                  height: 130,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _propertyImageFile != null ? const Color(0xFF2563EB) : const Color(0xFFCBD5E1),
                      width: _propertyImageFile != null ? 2 : 1.2,
                    ),
                  ),
                  child: _propertyImageFile != null
                      ? Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.file(
                                _propertyImageFile!,
                                width: double.infinity,
                                height: double.infinity,
                                fit: BoxFit.cover,
                              ),
                            ),
                            Positioned(
                              top: 8,
                              right: 8,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.65),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.edit_rounded, color: Colors.white, size: 13),
                                    SizedBox(width: 4),
                                    Text(
                                      'Change',
                                      style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        )
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: const BoxDecoration(
                                color: Color(0xFFEFF6FF),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.add_a_photo_outlined, color: Color(0xFF2563EB), size: 20),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Add Property Picture (Optional)',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              'Tap to upload estate / building photo from camera or gallery',
                              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                ),
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
