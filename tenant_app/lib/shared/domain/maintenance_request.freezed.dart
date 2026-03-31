// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'maintenance_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

MaintenanceRequest _$MaintenanceRequestFromJson(Map<String, dynamic> json) {
  return _MaintenanceRequest.fromJson(json);
}

/// @nodoc
mixin _$MaintenanceRequest {
  String get id => throw _privateConstructorUsedError;
  String get description => throw _privateConstructorUsedError;
  String? get imageUrl => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  String get propertyId => throw _privateConstructorUsedError;

  /// Serializes this MaintenanceRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MaintenanceRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MaintenanceRequestCopyWith<MaintenanceRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MaintenanceRequestCopyWith<$Res> {
  factory $MaintenanceRequestCopyWith(
    MaintenanceRequest value,
    $Res Function(MaintenanceRequest) then,
  ) = _$MaintenanceRequestCopyWithImpl<$Res, MaintenanceRequest>;
  @useResult
  $Res call({
    String id,
    String description,
    String? imageUrl,
    String status,
    DateTime createdAt,
    String propertyId,
  });
}

/// @nodoc
class _$MaintenanceRequestCopyWithImpl<$Res, $Val extends MaintenanceRequest>
    implements $MaintenanceRequestCopyWith<$Res> {
  _$MaintenanceRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MaintenanceRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? description = null,
    Object? imageUrl = freezed,
    Object? status = null,
    Object? createdAt = null,
    Object? propertyId = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            description: null == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                      as String,
            imageUrl: freezed == imageUrl
                ? _value.imageUrl
                : imageUrl // ignore: cast_nullable_to_non_nullable
                      as String?,
            status: null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                      as String,
            createdAt: null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
            propertyId: null == propertyId
                ? _value.propertyId
                : propertyId // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$MaintenanceRequestImplCopyWith<$Res>
    implements $MaintenanceRequestCopyWith<$Res> {
  factory _$$MaintenanceRequestImplCopyWith(
    _$MaintenanceRequestImpl value,
    $Res Function(_$MaintenanceRequestImpl) then,
  ) = __$$MaintenanceRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String description,
    String? imageUrl,
    String status,
    DateTime createdAt,
    String propertyId,
  });
}

/// @nodoc
class __$$MaintenanceRequestImplCopyWithImpl<$Res>
    extends _$MaintenanceRequestCopyWithImpl<$Res, _$MaintenanceRequestImpl>
    implements _$$MaintenanceRequestImplCopyWith<$Res> {
  __$$MaintenanceRequestImplCopyWithImpl(
    _$MaintenanceRequestImpl _value,
    $Res Function(_$MaintenanceRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of MaintenanceRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? description = null,
    Object? imageUrl = freezed,
    Object? status = null,
    Object? createdAt = null,
    Object? propertyId = null,
  }) {
    return _then(
      _$MaintenanceRequestImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        description: null == description
            ? _value.description
            : description // ignore: cast_nullable_to_non_nullable
                  as String,
        imageUrl: freezed == imageUrl
            ? _value.imageUrl
            : imageUrl // ignore: cast_nullable_to_non_nullable
                  as String?,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as String,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        propertyId: null == propertyId
            ? _value.propertyId
            : propertyId // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$MaintenanceRequestImpl implements _MaintenanceRequest {
  const _$MaintenanceRequestImpl({
    required this.id,
    required this.description,
    this.imageUrl,
    required this.status,
    required this.createdAt,
    required this.propertyId,
  });

  factory _$MaintenanceRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$MaintenanceRequestImplFromJson(json);

  @override
  final String id;
  @override
  final String description;
  @override
  final String? imageUrl;
  @override
  final String status;
  @override
  final DateTime createdAt;
  @override
  final String propertyId;

  @override
  String toString() {
    return 'MaintenanceRequest(id: $id, description: $description, imageUrl: $imageUrl, status: $status, createdAt: $createdAt, propertyId: $propertyId)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MaintenanceRequestImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.imageUrl, imageUrl) ||
                other.imageUrl == imageUrl) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.propertyId, propertyId) ||
                other.propertyId == propertyId));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    description,
    imageUrl,
    status,
    createdAt,
    propertyId,
  );

  /// Create a copy of MaintenanceRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MaintenanceRequestImplCopyWith<_$MaintenanceRequestImpl> get copyWith =>
      __$$MaintenanceRequestImplCopyWithImpl<_$MaintenanceRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$MaintenanceRequestImplToJson(this);
  }
}

abstract class _MaintenanceRequest implements MaintenanceRequest {
  const factory _MaintenanceRequest({
    required final String id,
    required final String description,
    final String? imageUrl,
    required final String status,
    required final DateTime createdAt,
    required final String propertyId,
  }) = _$MaintenanceRequestImpl;

  factory _MaintenanceRequest.fromJson(Map<String, dynamic> json) =
      _$MaintenanceRequestImpl.fromJson;

  @override
  String get id;
  @override
  String get description;
  @override
  String? get imageUrl;
  @override
  String get status;
  @override
  DateTime get createdAt;
  @override
  String get propertyId;

  /// Create a copy of MaintenanceRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MaintenanceRequestImplCopyWith<_$MaintenanceRequestImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
