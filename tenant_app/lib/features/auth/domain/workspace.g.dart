// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'workspace.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WorkspaceImpl _$$WorkspaceImplFromJson(Map<String, dynamic> json) =>
    _$WorkspaceImpl(id: json['id'] as String, name: json['name'] as String);

Map<String, dynamic> _$$WorkspaceImplToJson(_$WorkspaceImpl instance) =>
    <String, dynamic>{'id': instance.id, 'name': instance.name};

_$WorkspaceMemberImpl _$$WorkspaceMemberImplFromJson(
  Map<String, dynamic> json,
) => _$WorkspaceMemberImpl(
  id: json['id'] as String,
  role: json['role'] as String,
  workspaceId: json['workspaceId'] as String,
  workspace: Workspace.fromJson(json['workspace'] as Map<String, dynamic>),
);

Map<String, dynamic> _$$WorkspaceMemberImplToJson(
  _$WorkspaceMemberImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'role': instance.role,
  'workspaceId': instance.workspaceId,
  'workspace': instance.workspace,
};
