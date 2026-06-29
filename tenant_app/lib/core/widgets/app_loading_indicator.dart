import 'package:flutter/material.dart';

class AppLoadingIndicator extends StatelessWidget {
  final double size;

  const AppLoadingIndicator({
    super.key,
    this.size = 60,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Image.asset(
        'assets/icon/logo-loading.webp',
        width: size,
        height: size,
        fit: BoxFit.contain,
      ),
    );
  }
}
