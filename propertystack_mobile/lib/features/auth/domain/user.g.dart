// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UserImpl _$$UserImplFromJson(Map<String, dynamic> json) => _$UserImpl(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String?,
      workspaces: (json['workspaces'] as List<dynamic>?)
              ?.map((e) => WorkspaceMember.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      mustChangePassword: json['mustChangePassword'] as bool? ?? false,
      isOnboarded: json['isOnboarded'] as bool? ?? true,
      role: json['role'] as String?,
      globalRole: json['globalRole'] as String?,
      workspaceId: json['workspaceId'] as String?,
    );

Map<String, dynamic> _$$UserImplToJson(_$UserImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'name': instance.name,
      'workspaces': instance.workspaces,
      'mustChangePassword': instance.mustChangePassword,
      'isOnboarded': instance.isOnboarded,
      'role': instance.role,
      'globalRole': instance.globalRole,
      'workspaceId': instance.workspaceId,
    };
