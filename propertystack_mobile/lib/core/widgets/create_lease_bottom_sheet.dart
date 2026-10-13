import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../features/tenants/data/tenants_repository.dart';
import '../../features/tenants/presentation/tenants_notifier.dart';
import '../../features/properties/data/properties_repository.dart';
import '../../features/properties/domain/property_model.dart';
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
  final _picker = ImagePicker();
  String? _selectedPropertyId;
  String? _selectedUnitId;
  DateTime? _startDate = DateTime.now();
  DateTime? _endDate = DateTime.now().add(const Duration(days: 365));
  final _rentController = TextEditingController();
  final _agreementTextController = TextEditingController();
  String? _attachedDocBase64;
  String? _attachedDocFileName;
  String? _propertyMasterDocUrl;
  bool _isLoading = false;
  List<PropertyModel> _properties = [];
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
      final matches = _properties.where((p) => p.id == propId);
      final prop = matches.isNotEmpty ? matches.first : null;
      if (prop != null) {
        setState(() {
          _units = prop.units;
          _propertyMasterDocUrl = prop.agreementDocUrl;
        });
        if (_agreementTextController.text.trim().isEmpty) {
          _agreementTextController.text =
              'Standard Tenancy Agreement for ${prop.name}.\n\n'
              '1. Rent is payable yearly as stated.\n'
              '2. The tenant agrees to keep the premises in good condition.\n'
              '3. Subletting without written permission is prohibited.\n'
              '4. Both parties agree to standard statutory notice periods prior to lease termination.';
        }
      }
    }
  }

  Future<void> _pickAgreementDocument(ImageSource source) async {
    try {
      final XFile? file = await _picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (file != null) {
        final bytes = await file.readAsBytes();
        setState(() {
          _attachedDocBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
          _attachedDocFileName = file.name;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to pick document: $e')),
        );
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
            legalDocUrl: _attachedDocBase64 ?? _propertyMasterDocUrl,
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
                      value: p.id,
                      child: Text(p.name),
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

              // Tenancy Agreement Terms Section
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.description_outlined, size: 18, color: Color(0xFF2563EB)),
                        const SizedBox(width: 8),
                        const Text(
                          'Tenancy Agreement Terms',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Terms below will be sent to the tenant to review, upload their passport photo, and digitally sign.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _agreementTextController,
                      maxLines: 4,
                      style: const TextStyle(fontSize: 13, height: 1.4),
                      decoration: InputDecoration(
                        hintText: 'Enter agreement terms or clauses...',
                        fillColor: Colors.white,
                        filled: true,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Attached Document / File
                    if (_attachedDocBase64 != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _attachedDocFileName ?? 'Agreement Document Attached',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF15803D)),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close_rounded, size: 16, color: Color(0xFFEF4444)),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () {
                                setState(() {
                                  _attachedDocBase64 = null;
                                  _attachedDocFileName = null;
                                });
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                    ] else if (_propertyMasterDocUrl != null) ...[
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.info_outline_rounded, color: Color(0xFF2563EB), size: 16),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Master Property Agreement attached automatically from building template.',
                                style: TextStyle(fontSize: 11, color: Color(0xFF1E40AF), fontWeight: FontWeight.w500),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Document Upload Buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _pickAgreementDocument(ImageSource.gallery),
                            icon: const Icon(Icons.attach_file_rounded, size: 16),
                            label: Text(
                              _attachedDocBase64 != null ? 'Replace File' : 'Attach Document',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF2563EB),
                              side: const BorderSide(color: Color(0xFFBFDBFE)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _pickAgreementDocument(ImageSource.camera),
                            icon: const Icon(Icons.camera_alt_outlined, size: 16),
                            label: const Text('Take Photo', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF475569),
                              side: const BorderSide(color: Color(0xFFCBD5E1)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

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
