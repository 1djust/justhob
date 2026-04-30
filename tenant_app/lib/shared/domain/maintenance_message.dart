import 'package:freezed_annotation/freezed_annotation.dart';

part 'maintenance_message.freezed.dart';
part 'maintenance_message.g.dart';

@freezed
class MaintenanceMessage with _$MaintenanceMessage {
  const factory MaintenanceMessage({
    required String id,
    required String content,
    @Default('USER') String type,
    required String requestId,
    String? senderId,
    Map<String, dynamic>? sender,
    required DateTime createdAt,
  }) = _MaintenanceMessage;

  factory MaintenanceMessage.fromJson(Map<String, dynamic> json) => _$MaintenanceMessageFromJson(json);
}
