import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tenant_app/features/auth/domain/user.dart';
import 'package:tenant_app/features/auth/domain/workspace.dart';
import 'package:tenant_app/features/auth/presentation/auth_notifier.dart';
import 'package:tenant_app/features/landlord_home/data/landlord_payments_repository.dart';
import 'package:tenant_app/features/landlord_home/presentation/landlord_payments_screen.dart';
import 'package:tenant_app/features/landlord_home/presentation/landlord_payment_review_screen.dart';
import 'package:tenant_app/shared/domain/payment.dart';
import 'package:tenant_app/core/theme/app_theme.dart';

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
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      final container = makeContainer();
      await tester.pumpWidget(wrap(const LandlordPaymentsScreen(), container));
      await tester.pumpAndSettle();

      // Check stats cards labels
      expect(find.text('COLLECTED'), findsOneWidget);
      expect(find.text('PENDING'), findsOneWidget);
      expect(find.text('OVERDUE'), findsNWidgets(2));

      // Check stats value calculations
      // Total collected: pay-2 (150,000)
      expect(find.text('₦150,000'), findsNWidgets(2));
      // Pending review count: pay-1 (1)
      expect(find.text('1'), findsNWidgets(2)); // total 1 pending, 1 overdue in test layout
      // Overdue: pay-3 (1)
    });

    testWidgets('Tab filtering renders correctly', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      final container = makeContainer();
      await tester.pumpWidget(wrap(const LandlordPaymentsScreen(), container));
      await tester.pumpAndSettle();

      // All tab (default) should show 3 cards
      expect(find.text('John Doe'), findsOneWidget);
      expect(find.text('Jane Smith'), findsOneWidget);
      expect(find.text('Bob Johnson'), findsOneWidget);

      // Switch to Review tab (Tab controller vsync simulated by tapping)
      await tester.tap(find.text('Review'));
      await tester.pumpAndSettle();

      // Only John Doe is UNDER_REVIEW
      expect(find.text('John Doe'), findsOneWidget);
      expect(find.text('Jane Smith'), findsNothing);
      expect(find.text('Bob Johnson'), findsNothing);
    });

    testWidgets('Detail review screen displays layout correctly', (tester) async {
      final container = makeContainer();
      final payments = _mockPayments();
      final target = payments.firstWhere((p) => p.id == 'pay-1');

      await tester.pumpWidget(wrap(LandlordPaymentReviewScreen(payment: target), container));
      await tester.pumpAndSettle();

      // Renders header information
      expect(find.text('John Doe'), findsOneWidget);
      expect(find.text('Emerald Villa'), findsOneWidget);
      expect(find.text('June rent proof'), findsOneWidget);
      expect(find.text('Submitted Amount Paid'), findsOneWidget);

      // Renders Approve/Reject buttons
      expect(find.text('APPROVE'), findsOneWidget);
      expect(find.text('REJECT'), findsOneWidget);
    });

    testWidgets('Approving payment invokes review API', (tester) async {
      final container = makeContainer();
      final payments = _mockPayments();
      final target = payments.firstWhere((p) => p.id == 'pay-1');

      await tester.pumpWidget(wrap(LandlordPaymentReviewScreen(payment: target), container));
      await tester.pumpAndSettle();

      // Scroll button into view to bypass viewport tap warning/block
      await tester.ensureVisible(find.text('APPROVE'));

      // Tap Approve
      await tester.tap(find.text('APPROVE'));
      await tester.pumpAndSettle(); // settle async actions

      // Verify repository review method triggers
      expect(repo.reviewCalled, true);
      expect(repo.lastReviewedId, 'pay-1');
      expect(repo.lastStatus, 'PAID');
    });

    testWidgets('Rejecting payment proof captures rejection reason', (tester) async {
      final container = makeContainer();
      final payments = _mockPayments();
      final target = payments.firstWhere((p) => p.id == 'pay-1');

      await tester.pumpWidget(wrap(LandlordPaymentReviewScreen(payment: target), container));
      await tester.pumpAndSettle();

      // Scroll button into view
      await tester.ensureVisible(find.text('REJECT'));

      // Tap REJECT to open dialog
      await tester.tap(find.text('REJECT'));
      await tester.pumpAndSettle();

      // Dialog is open
      expect(find.text('Reject Payment Proof'), findsOneWidget);

      // Type reason
      await tester.enterText(find.byType(TextFormField), 'Incorrect screenshot');
      await tester.tap(find.text('SUBMIT'));
      await tester.pumpAndSettle();

      // Verify trigger parameters
      expect(repo.reviewCalled, true);
      expect(repo.lastReviewedId, 'pay-1');
      expect(repo.lastStatus, 'REJECTED');
      expect(repo.lastReason, 'Incorrect screenshot');
    });
  });
}
