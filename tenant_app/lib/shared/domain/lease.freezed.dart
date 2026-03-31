// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'lease.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

Lease _$LeaseFromJson(Map<String, dynamic> json) {
  return _Lease.fromJson(json);
}

/// @nodoc
mixin _$Lease {
  String get id => throw _privateConstructorUsedError;
  String get tenantId => throw _privateConstructorUsedError;
  String get propertyId => throw _privateConstructorUsedError;
  DateTime get startDate => throw _privateConstructorUsedError;
  DateTime? get endDate => throw _privateConstructorUsedError;
  double get yearlyRent => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  Property? get property => throw _privateConstructorUsedError;

  /// Serializes this Lease to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Lease
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $LeaseCopyWith<Lease> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $LeaseCopyWith<$Res> {
  factory $LeaseCopyWith(Lease value, $Res Function(Lease) then) =
      _$LeaseCopyWithImpl<$Res, Lease>;
  @useResult
  $Res call({
    String id,
    String tenantId,
    String propertyId,
    DateTime startDate,
    DateTime? endDate,
    double yearlyRent,
    String status,
    Property? property,
  });

  $PropertyCopyWith<$Res>? get property;
}

/// @nodoc
class _$LeaseCopyWithImpl<$Res, $Val extends Lease>
    implements $LeaseCopyWith<$Res> {
  _$LeaseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Lease
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? tenantId = null,
    Object? propertyId = null,
    Object? startDate = null,
    Object? endDate = freezed,
    Object? yearlyRent = null,
    Object? status = null,
    Object? property = freezed,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            tenantId: null == tenantId
                ? _value.tenantId
                : tenantId // ignore: cast_nullable_to_non_nullable
                      as String,
            propertyId: null == propertyId
                ? _value.propertyId
                : propertyId // ignore: cast_nullable_to_non_nullable
                      as String,
            startDate: null == startDate
                ? _value.startDate
                : startDate // ignore: cast_nullable_to_non_nullable
                      as DateTime,
            endDate: freezed == endDate
                ? _value.endDate
                : endDate // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
            yearlyRent: null == yearlyRent
                ? _value.yearlyRent
                : yearlyRent // ignore: cast_nullable_to_non_nullable
                      as double,
            status: null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                      as String,
            property: freezed == property
                ? _value.property
                : property // ignore: cast_nullable_to_non_nullable
                      as Property?,
          )
          as $Val,
    );
  }

  /// Create a copy of Lease
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PropertyCopyWith<$Res>? get property {
    if (_value.property == null) {
      return null;
    }

    return $PropertyCopyWith<$Res>(_value.property!, (value) {
      return _then(_value.copyWith(property: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$LeaseImplCopyWith<$Res> implements $LeaseCopyWith<$Res> {
  factory _$$LeaseImplCopyWith(
    _$LeaseImpl value,
    $Res Function(_$LeaseImpl) then,
  ) = __$$LeaseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String tenantId,
    String propertyId,
    DateTime startDate,
    DateTime? endDate,
    double yearlyRent,
    String status,
    Property? property,
  });

  @override
  $PropertyCopyWith<$Res>? get property;
}

/// @nodoc
class __$$LeaseImplCopyWithImpl<$Res>
    extends _$LeaseCopyWithImpl<$Res, _$LeaseImpl>
    implements _$$LeaseImplCopyWith<$Res> {
  __$$LeaseImplCopyWithImpl(
    _$LeaseImpl _value,
    $Res Function(_$LeaseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Lease
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? tenantId = null,
    Object? propertyId = null,
    Object? startDate = null,
    Object? endDate = freezed,
    Object? yearlyRent = null,
    Object? status = null,
    Object? property = freezed,
  }) {
    return _then(
      _$LeaseImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        tenantId: null == tenantId
            ? _value.tenantId
            : tenantId // ignore: cast_nullable_to_non_nullable
                  as String,
        propertyId: null == propertyId
            ? _value.propertyId
            : propertyId // ignore: cast_nullable_to_non_nullable
                  as String,
        startDate: null == startDate
            ? _value.startDate
            : startDate // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        endDate: freezed == endDate
            ? _value.endDate
            : endDate // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        yearlyRent: null == yearlyRent
            ? _value.yearlyRent
            : yearlyRent // ignore: cast_nullable_to_non_nullable
                  as double,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as String,
        property: freezed == property
            ? _value.property
            : property // ignore: cast_nullable_to_non_nullable
                  as Property?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$LeaseImpl implements _Lease {
  const _$LeaseImpl({
    required this.id,
    required this.tenantId,
    required this.propertyId,
    required this.startDate,
    this.endDate,
    required this.yearlyRent,
    required this.status,
    this.property,
  });

  factory _$LeaseImpl.fromJson(Map<String, dynamic> json) =>
      _$$LeaseImplFromJson(json);

  @override
  final String id;
  @override
  final String tenantId;
  @override
  final String propertyId;
  @override
  final DateTime startDate;
  @override
  final DateTime? endDate;
  @override
  final double yearlyRent;
  @override
  final String status;
  @override
  final Property? property;

  @override
  String toString() {
    return 'Lease(id: $id, tenantId: $tenantId, propertyId: $propertyId, startDate: $startDate, endDate: $endDate, yearlyRent: $yearlyRent, status: $status, property: $property)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$LeaseImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.tenantId, tenantId) ||
                other.tenantId == tenantId) &&
            (identical(other.propertyId, propertyId) ||
                other.propertyId == propertyId) &&
            (identical(other.startDate, startDate) ||
                other.startDate == startDate) &&
            (identical(other.endDate, endDate) || other.endDate == endDate) &&
            (identical(other.yearlyRent, yearlyRent) ||
                other.yearlyRent == yearlyRent) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.property, property) ||
                other.property == property));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    tenantId,
    propertyId,
    startDate,
    endDate,
    yearlyRent,
    status,
    property,
  );

  /// Create a copy of Lease
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$LeaseImplCopyWith<_$LeaseImpl> get copyWith =>
      __$$LeaseImplCopyWithImpl<_$LeaseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$LeaseImplToJson(this);
  }
}

abstract class _Lease implements Lease {
  const factory _Lease({
    required final String id,
    required final String tenantId,
    required final String propertyId,
    required final DateTime startDate,
    final DateTime? endDate,
    required final double yearlyRent,
    required final String status,
    final Property? property,
  }) = _$LeaseImpl;

  factory _Lease.fromJson(Map<String, dynamic> json) = _$LeaseImpl.fromJson;

  @override
  String get id;
  @override
  String get tenantId;
  @override
  String get propertyId;
  @override
  DateTime get startDate;
  @override
  DateTime? get endDate;
  @override
  double get yearlyRent;
  @override
  String get status;
  @override
  Property? get property;

  /// Create a copy of Lease
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$LeaseImplCopyWith<_$LeaseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
