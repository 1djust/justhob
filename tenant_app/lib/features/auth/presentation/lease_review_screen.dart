import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_loading_indicator.dart';
import '../../home/presentation/home_notifier.dart';
import 'auth_notifier.dart';

class LeaseReviewScreen extends ConsumerStatefulWidget {
  const LeaseReviewScreen({super.key});

  @override
  ConsumerState<LeaseReviewScreen> createState() => _LeaseReviewScreenState();
}

class _LeaseReviewScreenState extends ConsumerState<LeaseReviewScreen> {
  final _signatureController = TextEditingController();
  final _reasonController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;
  String? _errorMessage;

  Uint8List? _getMemoryImage(String dataUrl) {
    try {
      final commaIndex = dataUrl.indexOf(',');
      if (commaIndex != -1) {
        final base64Str = dataUrl.substring(commaIndex + 1);
        return base64Decode(base64Str);
      }
    } catch (_) {}
    return null;
  }

  Future<void> _openPdf(String dataUrl) async {
    try {
      final uri = Uri.parse(dataUrl);
      if (dataUrl.startsWith('http') && await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
    } catch (_) {}

    try {
      final commaIndex = dataUrl.indexOf(',');
      if (commaIndex != -1) {
        final base64Str = dataUrl.substring(commaIndex + 1);
        final bytes = base64Decode(base64Str);
        final tempDir = await getTemporaryDirectory();
        final file = File('${tempDir.path}/lease_agreement.pdf');
        await file.writeAsBytes(bytes);
        
        final uri = Uri.file(file.path);
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open PDF: $e')),
        );
      }
    }
  }

  Widget _buildLeasePreview(dynamic activeLease, String agreementText) {
    final url = activeLease.legalDocUrl as String?;
    if (url == null || url.isEmpty) {
      return Expanded(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    agreementText,
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.5,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    Widget content;
    if (url.startsWith('data:image') || url.contains('.png') || url.contains('.jpg') || url.contains('.jpeg') || (url.startsWith('http') && !url.contains('.pdf'))) {
      if (url.startsWith('data:image')) {
        final imageBytes = _getMemoryImage(url);
        if (imageBytes != null) {
          content = InteractiveViewer(
            maxScale: 4.0,
            child: Image.memory(
              imageBytes,
              fit: BoxFit.contain,
            ),
          );
        } else {
          content = const Center(child: Text('Invalid image format'));
        }
      } else {
        content = InteractiveViewer(
          maxScale: 4.0,
          child: Image.network(
            url,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) => const Center(
              child: Text('Failed to load agreement image.'),
            ),
          ),
        );
      }
    } else {
      // PDF or other format
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Icon(
            Icons.picture_as_pdf,
            color: Colors.red,
            size: 64,
          ),
          const SizedBox(height: 16),
          const Text(
            'Official Legal Lease Agreement',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Please open and review the drafted PDF lease document before signing.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: AppTheme.textSecondary,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => _openPdf(url),
            icon: const Icon(Icons.open_in_new),
            label: const Text('Open PDF Document'),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(200, 48),
              backgroundColor: AppTheme.primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
            ),
          ),
        ],
      );
    }

    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Center(child: content),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _signatureController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _handleApprove(String leaseId) async {
    if (_signatureController.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Please type your name to sign the agreement.');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(tenantRepositoryProvider);
      await repo.approveLease(leaseId, _signatureController.text.trim());
      
      // Refresh the home notifier state to trigger router redirect back to '/'
      await ref.read(homeStateProvider.notifier).refresh();
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Future<void> _handleReject(String leaseId) async {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Lease Agreement'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Please provide a brief reason for rejecting the lease agreement terms. This will be shared with the manager.',
              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _reasonController,
              decoration: const InputDecoration(
                hintText: 'e.g. Rent amount is incorrect...',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              _reasonController.clear();
              Navigator.pop(ctx);
            },
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final reason = _reasonController.text.trim();
              if (reason.isEmpty) {
                return;
              }
              Navigator.pop(ctx);
              setState(() {
                _isSubmitting = true;
                _errorMessage = null;
              });

              try {
                final repo = ref.read(tenantRepositoryProvider);
                await repo.rejectLease(leaseId, reason);
                
                // Refresh homeState to trigger router redirect or show REJECTED state
                await ref.read(homeStateProvider.notifier).refresh();
              } catch (e) {
                if (mounted) {
                  setState(() {
                    _isSubmitting = false;
                    _errorMessage = e.toString().replaceFirst('Exception: ', '');
                  });
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              minimumSize: const Size(100, 45),
            ),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tenantState = ref.watch(homeStateProvider);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lease Agreement'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log Out',
            onPressed: () async {
              await ref.read(authStateProvider.notifier).logout();
            },
          ),
        ],
      ),
      body: tenantState.when(
        loading: () => const Center(child: AppLoadingIndicator()),
        error: (err, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 48),
                const SizedBox(height: 16),
                Text('Failed to load profile: $err'),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => ref.read(homeStateProvider.notifier).refresh(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (tenant) {
          final activeLease = tenant?.leases?.isNotEmpty == true ? tenant!.leases!.first : null;
          if (activeLease == null) {
            return const Center(
              child: Text('No lease agreement found for your account.'),
            );
          }

          final isRejected = activeLease.status == 'REJECTED';
          final agreementText = activeLease.agreementText ?? 'No agreement text provided.';

          return SafeArea(
            child: Form(
              key: _formKey,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (isRejected) ...[
                      Card(
                        color: Colors.red.shade50,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: Colors.red.shade200),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.warning_amber_rounded, color: Colors.red.shade700),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Lease Agreement Rejected',
                                    style: TextStyle(
                                      color: Colors.red.shade900,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'You rejected the agreement. Your feedback was: "${activeLease.rejectionReason ?? 'None'}"',
                                style: TextStyle(color: Colors.red.shade800, fontSize: 13),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Waiting for the property manager to modify terms and resubmit a new lease draft.',
                                style: TextStyle(color: Colors.red.shade900, fontSize: 13, fontWeight: FontWeight.w500),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    _buildLeasePreview(activeLease, agreementText),
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'LANDLORD SIGNATURE',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      color: AppTheme.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  if (activeLease.managerSignature != null && activeLease.managerSignature!.isNotEmpty)
                                    Text(
                                      activeLease.managerSignature!,
                                      style: const TextStyle(
                                        fontFamily: 'Caveat',
                                        fontSize: 22,
                                        fontStyle: FontStyle.italic,
                                        color: AppTheme.primaryColor,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    )
                                  else
                                    const Text(
                                      'Not Signed',
                                      style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.grey),
                                    ),
                                ],
                              ),
                            ),
                            Container(
                              width: 1,
                              height: 40,
                              color: Colors.grey.shade200,
                              margin: const EdgeInsets.symmetric(horizontal: 12),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'TENANT SIGNATURE',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      color: AppTheme.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  if (activeLease.signatureUrl != null && activeLease.signatureUrl!.isNotEmpty)
                                    Text(
                                      activeLease.signatureUrl!,
                                      style: const TextStyle(
                                        fontFamily: 'Caveat',
                                        fontSize: 22,
                                        fontStyle: FontStyle.italic,
                                        color: AppTheme.primaryColor,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    )
                                  else
                                    const Text(
                                      'Pending Signature',
                                      style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.grey),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (!isRejected) ...[
                      if (_errorMessage != null) ...[
                        Text(
                          _errorMessage!,
                          style: const TextStyle(color: Colors.red, fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                      ],
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Type Full Name to Sign Digitally',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 8),
                              TextFormField(
                                controller: _signatureController,
                                decoration: const InputDecoration(
                                  hintText: 'Type your name exactly...',
                                  border: OutlineInputBorder(),
                                  isDense: true,
                                ),
                                onChanged: (val) => setState(() {}),
                              ),
                              if (_signatureController.text.isNotEmpty) ...[
                                const SizedBox(height: 12),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade50,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.grey.shade200),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    _signatureController.text,
                                    style: const TextStyle(
                                      fontFamily: 'Caveat',
                                      fontSize: 22,
                                      fontStyle: FontStyle.italic,
                                      color: AppTheme.primaryColor,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _isSubmitting ? null : () => _handleReject(activeLease.id),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Colors.red),
                                foregroundColor: Colors.red,
                                minimumSize: const Size.fromHeight(56),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: const Text('Reject terms'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: _isSubmitting ? null : () => _handleApprove(activeLease.id),
                              child: _isSubmitting
                                  ? const SizedBox(
                                      height: 24,
                                      width: 24,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    )
                                  : const Text('Approve & Sign'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
