// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'workspace.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

Workspace _$WorkspaceFromJson(Map<String, dynamic> json) {
  return _Workspace.fromJson(json);
}

/// @nodoc
mixin _$Workspace {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;

  /// Serializes this Workspace to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Workspace
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WorkspaceCopyWith<Workspace> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WorkspaceCopyWith<$Res> {
  factory $WorkspaceCopyWith(Workspace value, $Res Function(Workspace) then) =
      _$WorkspaceCopyWithImpl<$Res, Workspace>;
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class _$WorkspaceCopyWithImpl<$Res, $Val extends Workspace>
    implements $WorkspaceCopyWith<$Res> {
  _$WorkspaceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Workspace
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? id = null, Object? name = null}) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            name: null == name
                ? _value.name
                : name // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$WorkspaceImplCopyWith<$Res>
    implements $WorkspaceCopyWith<$Res> {
  factory _$$WorkspaceImplCopyWith(
    _$WorkspaceImpl value,
    $Res Function(_$WorkspaceImpl) then,
  ) = __$$WorkspaceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class __$$WorkspaceImplCopyWithImpl<$Res>
    extends _$WorkspaceCopyWithImpl<$Res, _$WorkspaceImpl>
    implements _$$WorkspaceImplCopyWith<$Res> {
  __$$WorkspaceImplCopyWithImpl(
    _$WorkspaceImpl _value,
    $Res Function(_$WorkspaceImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Workspace
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? id = null, Object? name = null}) {
    return _then(
      _$WorkspaceImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        name: null == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$WorkspaceImpl implements _Workspace {
  const _$WorkspaceImpl({required this.id, required this.name});

  factory _$WorkspaceImpl.fromJson(Map<String, dynamic> json) =>
      _$$WorkspaceImplFromJson(json);

  @override
  final String id;
  @override
  final String name;

  @override
  String toString() {
    return 'Workspace(id: $id, name: $name)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WorkspaceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name);

  /// Create a copy of Workspace
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WorkspaceImplCopyWith<_$WorkspaceImpl> get copyWith =>
      __$$WorkspaceImplCopyWithImpl<_$WorkspaceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WorkspaceImplToJson(this);
  }
}

abstract class _Workspace implements Workspace {
  const factory _Workspace({
    required final String id,
    required final String name,
  }) = _$WorkspaceImpl;

  factory _Workspace.fromJson(Map<String, dynamic> json) =
      _$WorkspaceImpl.fromJson;

  @override
  String get id;
  @override
  String get name;

  /// Create a copy of Workspace
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WorkspaceImplCopyWith<_$WorkspaceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

WorkspaceMember _$WorkspaceMemberFromJson(Map<String, dynamic> json) {
  return _WorkspaceMember.fromJson(json);
}

/// @nodoc
mixin _$WorkspaceMember {
  String get id => throw _privateConstructorUsedError;
  String get role => throw _privateConstructorUsedError;
  String get workspaceId => throw _privateConstructorUsedError;
  Workspace get workspace => throw _privateConstructorUsedError;

  /// Serializes this WorkspaceMember to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WorkspaceMember
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WorkspaceMemberCopyWith<WorkspaceMember> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WorkspaceMemberCopyWith<$Res> {
  factory $WorkspaceMemberCopyWith(
    WorkspaceMember value,
    $Res Function(WorkspaceMember) then,
  ) = _$WorkspaceMemberCopyWithImpl<$Res, WorkspaceMember>;
  @useResult
  $Res call({String id, String role, String workspaceId, Workspace workspace});

  $WorkspaceCopyWith<$Res> get workspace;
}

/// @nodoc
class _$WorkspaceMemberCopyWithImpl<$Res, $Val extends WorkspaceMember>
    implements $WorkspaceMemberCopyWith<$Res> {
  _$WorkspaceMemberCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WorkspaceMember
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? role = null,
    Object? workspaceId = null,
    Object? workspace = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            role: null == role
                ? _value.role
                : role // ignore: cast_nullable_to_non_nullable
                      as String,
            workspaceId: null == workspaceId
                ? _value.workspaceId
                : workspaceId // ignore: cast_nullable_to_non_nullable
                      as String,
            workspace: null == workspace
                ? _value.workspace
                : workspace // ignore: cast_nullable_to_non_nullable
                      as Workspace,
          )
          as $Val,
    );
  }

  /// Create a copy of WorkspaceMember
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WorkspaceCopyWith<$Res> get workspace {
    return $WorkspaceCopyWith<$Res>(_value.workspace, (value) {
      return _then(_value.copyWith(workspace: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$WorkspaceMemberImplCopyWith<$Res>
    implements $WorkspaceMemberCopyWith<$Res> {
  factory _$$WorkspaceMemberImplCopyWith(
    _$WorkspaceMemberImpl value,
    $Res Function(_$WorkspaceMemberImpl) then,
  ) = __$$WorkspaceMemberImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String role, String workspaceId, Workspace workspace});

  @override
  $WorkspaceCopyWith<$Res> get workspace;
}

/// @nodoc
class __$$WorkspaceMemberImplCopyWithImpl<$Res>
    extends _$WorkspaceMemberCopyWithImpl<$Res, _$WorkspaceMemberImpl>
    implements _$$WorkspaceMemberImplCopyWith<$Res> {
  __$$WorkspaceMemberImplCopyWithImpl(
    _$WorkspaceMemberImpl _value,
    $Res Function(_$WorkspaceMemberImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of WorkspaceMember
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? role = null,
    Object? workspaceId = null,
    Object? workspace = null,
  }) {
    return _then(
      _$WorkspaceMemberImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        role: null == role
            ? _value.role
            : role // ignore: cast_nullable_to_non_nullable
                  as String,
        workspaceId: null == workspaceId
            ? _value.workspaceId
            : workspaceId // ignore: cast_nullable_to_non_nullable
                  as String,
        workspace: null == workspace
            ? _value.workspace
            : workspace // ignore: cast_nullable_to_non_nullable
                  as Workspace,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$WorkspaceMemberImpl implements _WorkspaceMember {
  const _$WorkspaceMemberImpl({
    required this.id,
    required this.role,
    required this.workspaceId,
    required this.workspace,
  });

  factory _$WorkspaceMemberImpl.fromJson(Map<String, dynamic> json) =>
      _$$WorkspaceMemberImplFromJson(json);

  @override
  final String id;
  @override
  final String role;
  @override
  final String workspaceId;
  @override
  final Workspace workspace;

  @override
  String toString() {
    return 'WorkspaceMember(id: $id, role: $role, workspaceId: $workspaceId, workspace: $workspace)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WorkspaceMemberImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.workspaceId, workspaceId) ||
                other.workspaceId == workspaceId) &&
            (identical(other.workspace, workspace) ||
                other.workspace == workspace));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, role, workspaceId, workspace);

  /// Create a copy of WorkspaceMember
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WorkspaceMemberImplCopyWith<_$WorkspaceMemberImpl> get copyWith =>
      __$$WorkspaceMemberImplCopyWithImpl<_$WorkspaceMemberImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$WorkspaceMemberImplToJson(this);
  }
}

abstract class _WorkspaceMember implements WorkspaceMember {
  const factory _WorkspaceMember({
    required final String id,
    required final String role,
    required final String workspaceId,
    required final Workspace workspace,
  }) = _$WorkspaceMemberImpl;

  factory _WorkspaceMember.fromJson(Map<String, dynamic> json) =
      _$WorkspaceMemberImpl.fromJson;

  @override
  String get id;
  @override
  String get role;
  @override
  String get workspaceId;
  @override
  Workspace get workspace;

  /// Create a copy of WorkspaceMember
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WorkspaceMemberImplCopyWith<_$WorkspaceMemberImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
