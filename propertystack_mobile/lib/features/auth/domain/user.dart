import 'package:freezed_annotation/freezed_annotation.dart';
import 'workspace.dart';

part 'user.freezed.dart';
part 'user.g.dart';

@freezed
class User with _$User {
  const factory User({
    required String id,
    required String email,
    String? name,
    @Default([]) List<WorkspaceMember> workspaces,
    @Default(false) bool mustChangePassword,
    @Default(true) bool isOnboarded,
    String? role,
    String? globalRole,
    String? workspaceId,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}
