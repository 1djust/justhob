// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'lease_renewal_offer.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

LeaseRenewalOffer _$LeaseRenewalOfferFromJson(Map<String, dynamic> json) {
  return _LeaseRenewalOffer.fromJson(json);
}

/// @nodoc
mixin _$LeaseRenewalOffer {
  String get id => throw _privateConstructorUsedError;
  String get leaseId => throw _privateConstructorUsedError;
  double get newRent => throw _privateConstructorUsedError;
  DateTime get newStartDate => throw _privateConstructorUsedError;
  DateTime get newEndDate => throw _privateConstructorUsedError;
  String? get terms => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  DateTime get sentAt => throw _privateConstructorUsedError;
  DateTime? get respondedAt => throw _privateConstructorUsedError;

  /// Serializes this LeaseRenewalOffer to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of LeaseRenewalOffer
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $LeaseRenewalOfferCopyWith<LeaseRenewalOffer> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $LeaseRenewalOfferCopyWith<$Res> {
  factory $LeaseRenewalOfferCopyWith(
          LeaseRenewalOffer value, $Res Function(LeaseRenewalOffer) then) =
      _$LeaseRenewalOfferCopyWithImpl<$Res, LeaseRenewalOffer>;
  @useResult
  $Res call(
      {String id,
      String leaseId,
      double newRent,
      DateTime newStartDate,
      DateTime newEndDate,
      String? terms,
      String status,
      DateTime sentAt,
      DateTime? respondedAt});
}

/// @nodoc
class _$LeaseRenewalOfferCopyWithImpl<$Res, $Val extends LeaseRenewalOffer>
    implements $LeaseRenewalOfferCopyWith<$Res> {
  _$LeaseRenewalOfferCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of LeaseRenewalOffer
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? leaseId = null,
    Object? newRent = null,
    Object? newStartDate = null,
    Object? newEndDate = null,
    Object? terms = freezed,
    Object? status = null,
    Object? sentAt = null,
    Object? respondedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      leaseId: null == leaseId
          ? _value.leaseId
          : leaseId // ignore: cast_nullable_to_non_nullable
              as String,
      newRent: null == newRent
          ? _value.newRent
          : newRent // ignore: cast_nullable_to_non_nullable
              as double,
      newStartDate: null == newStartDate
          ? _value.newStartDate
          : newStartDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      newEndDate: null == newEndDate
          ? _value.newEndDate
          : newEndDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      terms: freezed == terms
          ? _value.terms
          : terms // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      sentAt: null == sentAt
          ? _value.sentAt
          : sentAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      respondedAt: freezed == respondedAt
          ? _value.respondedAt
          : respondedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$LeaseRenewalOfferImplCopyWith<$Res>
    implements $LeaseRenewalOfferCopyWith<$Res> {
  factory _$$LeaseRenewalOfferImplCopyWith(_$LeaseRenewalOfferImpl value,
          $Res Function(_$LeaseRenewalOfferImpl) then) =
      __$$LeaseRenewalOfferImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String leaseId,
      double newRent,
      DateTime newStartDate,
      DateTime newEndDate,
      String? terms,
      String status,
      DateTime sentAt,
      DateTime? respondedAt});
}

/// @nodoc
class __$$LeaseRenewalOfferImplCopyWithImpl<$Res>
    extends _$LeaseRenewalOfferCopyWithImpl<$Res, _$LeaseRenewalOfferImpl>
    implements _$$LeaseRenewalOfferImplCopyWith<$Res> {
  __$$LeaseRenewalOfferImplCopyWithImpl(_$LeaseRenewalOfferImpl _value,
      $Res Function(_$LeaseRenewalOfferImpl) _then)
      : super(_value, _then);

  /// Create a copy of LeaseRenewalOffer
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? leaseId = null,
    Object? newRent = null,
    Object? newStartDate = null,
    Object? newEndDate = null,
    Object? terms = freezed,
    Object? status = null,
    Object? sentAt = null,
    Object? respondedAt = freezed,
  }) {
    return _then(_$LeaseRenewalOfferImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      leaseId: null == leaseId
          ? _value.leaseId
          : leaseId // ignore: cast_nullable_to_non_nullable
              as String,
      newRent: null == newRent
          ? _value.newRent
          : newRent // ignore: cast_nullable_to_non_nullable
              as double,
      newStartDate: null == newStartDate
          ? _value.newStartDate
          : newStartDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      newEndDate: null == newEndDate
          ? _value.newEndDate
          : newEndDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      terms: freezed == terms
          ? _value.terms
          : terms // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      sentAt: null == sentAt
          ? _value.sentAt
          : sentAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      respondedAt: freezed == respondedAt
          ? _value.respondedAt
          : respondedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$LeaseRenewalOfferImpl implements _LeaseRenewalOffer {
  const _$LeaseRenewalOfferImpl(
      {required this.id,
      required this.leaseId,
      required this.newRent,
      required this.newStartDate,
      required this.newEndDate,
      this.terms,
      required this.status,
      required this.sentAt,
      this.respondedAt});

  factory _$LeaseRenewalOfferImpl.fromJson(Map<String, dynamic> json) =>
      _$$LeaseRenewalOfferImplFromJson(json);

  @override
  final String id;
  @override
  final String leaseId;
  @override
  final double newRent;
  @override
  final DateTime newStartDate;
  @override
  final DateTime newEndDate;
  @override
  final String? terms;
  @override
  final String status;
  @override
  final DateTime sentAt;
  @override
  final DateTime? respondedAt;

  @override
  String toString() {
    return 'LeaseRenewalOffer(id: $id, leaseId: $leaseId, newRent: $newRent, newStartDate: $newStartDate, newEndDate: $newEndDate, terms: $terms, status: $status, sentAt: $sentAt, respondedAt: $respondedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$LeaseRenewalOfferImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.leaseId, leaseId) || other.leaseId == leaseId) &&
            (identical(other.newRent, newRent) || other.newRent == newRent) &&
            (identical(other.newStartDate, newStartDate) ||
                other.newStartDate == newStartDate) &&
            (identical(other.newEndDate, newEndDate) ||
                other.newEndDate == newEndDate) &&
            (identical(other.terms, terms) || other.terms == terms) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.sentAt, sentAt) || other.sentAt == sentAt) &&
            (identical(other.respondedAt, respondedAt) ||
                other.respondedAt == respondedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, leaseId, newRent,
      newStartDate, newEndDate, terms, status, sentAt, respondedAt);

  /// Create a copy of LeaseRenewalOffer
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$LeaseRenewalOfferImplCopyWith<_$LeaseRenewalOfferImpl> get copyWith =>
      __$$LeaseRenewalOfferImplCopyWithImpl<_$LeaseRenewalOfferImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$LeaseRenewalOfferImplToJson(
      this,
    );
  }
}

abstract class _LeaseRenewalOffer implements LeaseRenewalOffer {
  const factory _LeaseRenewalOffer(
      {required final String id,
      required final String leaseId,
      required final double newRent,
      required final DateTime newStartDate,
      required final DateTime newEndDate,
      final String? terms,
      required final String status,
      required final DateTime sentAt,
      final DateTime? respondedAt}) = _$LeaseRenewalOfferImpl;

  factory _LeaseRenewalOffer.fromJson(Map<String, dynamic> json) =
      _$LeaseRenewalOfferImpl.fromJson;

  @override
  String get id;
  @override
  String get leaseId;
  @override
  double get newRent;
  @override
  DateTime get newStartDate;
  @override
  DateTime get newEndDate;
  @override
  String? get terms;
  @override
  String get status;
  @override
  DateTime get sentAt;
  @override
  DateTime? get respondedAt;

  /// Create a copy of LeaseRenewalOffer
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$LeaseRenewalOfferImplCopyWith<_$LeaseRenewalOfferImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
