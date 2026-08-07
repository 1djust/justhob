import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:propertystack_mobile/features/auth/domain/user.dart';
import 'package:propertystack_mobile/features/auth/domain/workspace.dart';
import 'package:propertystack_mobile/features/auth/presentation/auth_notifier.dart';
import 'package:propertystack_mobile/features/landlord_home/data/landlord_payments_repository.dart';
import 'package:propertystack_mobile/features/landlord_home/presentation/landlord_payments_screen.dart';
import 'package:propertystack_mobile/features/landlord_home/presentation/landlord_payment_review_screen.dart';
import 'package:propertystack_mobile/shared/domain/payment.dart';
import 'package:propertystack_mobile/core/theme/app_theme.dart';

// ---------------------------------------------------------------------------
// Stub AuthNotifier
// ---------------------------------------------------------------------------
class _StubAuthNotifier extends StateNotifier<AsyncValue<User?>>
    implements AuthNotifier {
  _StubAuthNotifier(super.initialState);
  @override
  Future<void> checkAuth() async {}
  @override
  Future<void> login(String email, String password) async {}
  @override
  void setUser(User? user) => state = AsyncValue.data(user);
  @override
  Future<void> logout() async => state = const AsyncValue.data(null);
  @override
  Future<bool> changePassword(String newPassword) async => false;
  @override
  Future<void> resetPassword(String email) async {}
  @override
  Future<bool> updateProfile({
    String? name,
    String? bankCode,
    String? accountNumber,
    String? accountName,
  }) async => true;
  @override
  String? lastError;
}

// ---------------------------------------------------------------------------
// Stub LandlordPaymentsRepository
// ---------------------------------------------------------------------------
class _StubLandlordPaymentsRepository implements LandlordPaymentsRepository {
  final List<Payment> mockPayments;
  bool reviewCalled = false;
  String? lastReviewedId;
  String? lastStatus;
  String? lastReason;

  _StubLandlordPaymentsRepository(this.mockPayments);

  @override
  Future<List<Payment>> getPayments(String workspaceId) async {
    return List.from(mockPayments);
  }

  @override
  Future<void> reviewPayment({
    required String workspaceId,
    required String paymentId,
    required String status,
    String? rejectionReason,
    double? approvedAmountPaid,
  }) async {
    reviewCalled = true;
    lastReviewedId = paymentId;
    lastStatus = status;
    lastReason = rejectionReason;
  }

  @override
  Future<void> sendReminder({
    required String workspaceId,
    required String paymentId,
  }) async {
    // Stub call for test
  }

  @override
  Future<void> recordOfflinePayment({
    required String workspaceId,
    required String leaseId,
    required double amount,
    required String dueDate,
    required String status,
    String? note,
  }) async {}

  @override
  Future<void> recordPartialPayment({
    required String workspaceId,
    required String paymentId,
    required double amount,
    String? balancePromiseDate,
    String? balancePromiseNote,
  }) async {}
}

// Helper builder
User _landlordUser() => User(
      id: 'user-landlord',
      email: 'landlord@test.com',
      name: 'Test Landlord',
      mustChangePassword: false,
      workspaces: [
        WorkspaceMember(
          id: 'm1',
          role: 'PROPERTY_MANAGER',
          workspaceId: 'ws-1',
          workspace: const Workspace(id: 'ws-1', name: 'Prime Properties'),
        ),
      ],
    );

List<Payment> _mockPayments() => [
      Payment(
        id: 'pay-1',
        amount: 250000,
        dueDate: DateTime(2026, 6, 30),
        status: 'UNDER_REVIEW',
        leaseId: 'lease-1',
        amountPaid: 250000,
        note: 'June rent proof',
        // 1x1 transparent GIF base64 string - decodes safely in Flutter test engine
        proofUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        lease: const {
          'id': 'lease-1',
          'tenant': {'id': 't-1', 'name': 'John Doe'},
          'property': {'id': 'prop-1', 'name': 'Emerald Villa'}
        },
      ),
      Payment(
        id: 'pay-2',
        amount: 150000,
        dueDate: DateTime(2026, 6, 1),
        status: 'PAID',
        leaseId: 'lease-2',
        amountPaid: 150000,
        paidDate: DateTime(2026, 6, 2),
        lease: const {
          'id': 'lease-2',
          'tenant': {'id': 't-2', 'name': 'Jane Smith'},
          'property': {'id': 'prop-1', 'name': 'Emerald Villa'}
        },
      ),
      Payment(
        id: 'pay-3',
        amount: 300000,
        dueDate: DateTime(2026, 5, 1),
        status: 'OVERDUE',
        leaseId: 'lease-3',
        lease: const {
          'id': 'lease-3',
          'tenant': {'id': 't-3', 'name': 'Bob Johnson'},
          'property': {'id': 'prop-2', 'name': 'Ruby Mansions'}
        },
      ),
    ];

void main() {
  group('🪙 Landlord Rent Payments Feature Tests', () {
    late _StubLandlordPaymentsRepository repo;
    late _StubAuthNotifier authNotifier;

    Widget wrap(Widget child, ProviderContainer container) {
      return UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          home: child,
        ),
      );
    }

    ProviderContainer makeContainer() {
      repo = _StubLandlordPaymentsRepository(_mockPayments());
      authNotifier = _StubAuthNotifier(AsyncValue.data(_landlordUser()));

      final container = ProviderContainer(
        overrides: [
          authStateProvider.overrideWith((_) => authNotifier),
          landlordPaymentsRepositoryProvider.overrideWith((_) => repo),
        ],
      );
      addTearDown(container.dispose);
      return container;
    }

    testWidgets('Stats Banner displays correct aggregates', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final container = makeContainer();
      await tester.pumpWidget(wrap(const LandlordPaymentsScreen(), container));
      await tester.pumpAndSettle();

      // Total Collected for June (pay-2: 150k)
      expect(find.textContaining('150,000'), findsWidgets);

      // Pending Under Review (pay-1: 250k)
      expect(find.textContaining('250,000'), findsWidgets);

      // Overdue (pay-3: 300k)
      expect(find.textContaining('300,000'), findsWidgets);
    });

    testWidgets('Detail review screen displays layout correctly', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final container = makeContainer();
      final payments = _mockPayments();
      final target = payments.firstWhere((p) => p.id == 'pay-1');

      await tester.pumpWidget(wrap(LandlordPaymentReviewScreen(payment: target), container));
      await tester.pumpAndSettle();

      // Renders header information
      expect(find.text('John Doe'), findsOneWidget);
      expect(find.text('June rent proof'), findsWidgets);

      // Renders Approve/Reject buttons
      expect(find.text('Approve'), findsOneWidget);
      expect(find.text('Reject'), findsOneWidget);
    });

    testWidgets('Approving payment opens bottom sheet modal', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final container = makeContainer();
      final payments = _mockPayments();
      final target = payments.firstWhere((p) => p.id == 'pay-1');

      await tester.pumpWidget(wrap(LandlordPaymentReviewScreen(payment: target), container));
      await tester.pumpAndSettle();

      // Scroll button into view to bypass viewport tap warning/block
      await tester.ensureVisible(find.text('Approve'));

      // Tap Approve
      await tester.tap(find.text('Approve'));
      await tester.pumpAndSettle();

      // Modal bottom sheet opens
      expect(find.text('Approve Payment'), findsOneWidget);
    });

    testWidgets('Rejecting payment proof opens bottom sheet modal', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final container = makeContainer();
      final payments = _mockPayments();
      final target = payments.firstWhere((p) => p.id == 'pay-1');

      await tester.pumpWidget(wrap(LandlordPaymentReviewScreen(payment: target), container));
      await tester.pumpAndSettle();

      // Scroll button into view
      await tester.ensureVisible(find.text('Reject'));

      // Tap Reject to open modal
      await tester.tap(find.text('Reject'));
      await tester.pumpAndSettle();

      // Modal is open
      expect(find.text('Reject Payment Proof'), findsOneWidget);
    });
  });
}
