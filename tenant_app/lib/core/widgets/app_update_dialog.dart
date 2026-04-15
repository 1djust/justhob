import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/update_service.dart';

class AppUpdateDialog extends StatelessWidget {
  final UpdateInfo updateInfo;

  const AppUpdateDialog({super.key, required this.updateInfo});

  static Future<void> show(BuildContext context, UpdateInfo updateInfo) async {
    return showDialog(
      context: context,
      barrierDismissible: !updateInfo.isMandatory,
      builder: (context) => PopScope(
        canPop: !updateInfo.isMandatory,
        child: AppUpdateDialog(updateInfo: updateInfo),
      ),
    );
  }

  Future<void> _launchDownloadUrl() async {
    final uri = Uri.parse(updateInfo.downloadUrl);
    try {
      // Direct launch without checking canLaunchUrl helps bypass Android 11+ query restrictions
      // if the developer forgets to add the intent in AndroidManifest.xml
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('Could not launch \$uri: \$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          const Icon(Icons.system_update_rounded, color: Colors.indigo),
          const SizedBox(width: 8),
          const Text('Update Available'),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Version ${updateInfo.latestVersion} is now available.',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Text(updateInfo.releaseNotes),
          if (updateInfo.isMandatory) ...[
            const SizedBox(height: 16),
            const Text(
              'This is a required update.',
              style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12),
            ),
          ]
        ],
      ),
      actions: [
        if (!updateInfo.isMandatory)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Later', style: TextStyle(color: Colors.grey)),
          ),
        ElevatedButton(
          onPressed: _launchDownloadUrl,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.indigo,
            foregroundColor: Colors.white,
          ),
          child: const Text('Download Update'),
        ),
      ],
    );
  }
}
