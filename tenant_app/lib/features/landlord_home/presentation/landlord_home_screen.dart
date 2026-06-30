import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../../../../core/theme/app_theme.dart';

class LandlordHomeScreen extends ConsumerWidget {
  const LandlordHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Landlord Dashboard'),
        actions: [
          IconButton(
            onPressed: () async {
              final auth = ref.read(authStateProvider.notifier);
              await auth.logout();
            },
            icon: const Icon(Icons.logout_outlined),
            tooltip: 'Sign Out',
          ),
        ],
      ),
      body: authState.when(
        data: (user) {
          if (user == null) {
            return const Center(child: Text('Not authenticated'));
          }

          // Gather roles
          final landlordWorkspaces = user.workspaces
              .where((m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER')
              .toList();
          final activeWorkspace = landlordWorkspaces.isNotEmpty
              ? landlordWorkspaces.first
              : null;

          return RefreshIndicator(
            onRefresh: () async {
              await ref.read(authStateProvider.notifier).checkAuth();
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Welcome Header
                  Text(
                    'Welcome back,',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: AppTheme.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user.name ?? user.email,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: theme.colorScheme.primary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Active Role & Workspace Info Card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'ACTIVE WORKSPACE',
                                style: theme.textTheme.labelMedium?.copyWith(
                                  color: AppTheme.textSecondary,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.0,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: theme.colorScheme.primary.withAlpha(26),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  activeWorkspace?.role.replaceAll('_', ' ') ?? 'LANDLORD',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: theme.colorScheme.primary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            activeWorkspace?.workspace.name ?? 'No active workspace',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user.email,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: AppTheme.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Operations Title
                  Text(
                    'Daily Operations',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Grid of Placeholder Features
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    childAspectRatio: 1.1,
                    children: [
                      _buildFeatureCard(
                        context,
                        title: 'Rent Payments',
                        subtitle: 'Verify transactions',
                        icon: Icons.payments_outlined,
                        color: const Color(0xFF10B981),
                      ),
                      _buildFeatureCard(
                        context,
                        title: 'Maintenance',
                        subtitle: 'Manage tickets',
                        icon: Icons.plumbing_outlined,
                        color: Colors.orange,
                      ),
                      _buildFeatureCard(
                        context,
                        title: 'Properties',
                        subtitle: 'Manage units & leases',
                        icon: Icons.apartment_outlined,
                        color: Colors.blue,
                      ),
                      _buildFeatureCard(
                        context,
                        title: 'Tenant Directory',
                        subtitle: 'Contact & leases',
                        icon: Icons.people_outline,
                        color: Colors.indigo,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
        loading: () => const Center(
          child: CircularProgressIndicator(),
        ),
        error: (err, stack) => Center(
          child: Text('Error loading dashboard: $err'),
        ),
      ),
    );
  }

  Widget _buildFeatureCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    final theme = Theme.of(context);

    return InkWell(
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$title dashboard is coming soon in mobile app!'),
            duration: const Duration(seconds: 2),
          ),
        );
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withAlpha(26),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: color,
                size: 24,
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
