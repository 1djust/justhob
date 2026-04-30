// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'payment_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

PaymentInfo _$PaymentInfoFromJson(Map<String, dynamic> json) {
  return _PaymentInfo.fromJson(json);
}

/// @nodoc
mixin _$PaymentInfo {
  String? get payoutStrategy => throw _privateConstructorUsedError;
  String? get bankCode => throw _privateConstructorUsedError;
  String? get accountNumber => throw _privateConstructorUsedError;
  String? get accountName => throw _privateConstructorUsedError;

  /// Serializes this PaymentInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PaymentInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PaymentInfoCopyWith<PaymentInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PaymentInfoCopyWith<$Res> {
  factory $PaymentInfoCopyWith(
          PaymentInfo value, $Res Function(PaymentInfo) then) =
      _$PaymentInfoCopyWithImpl<$Res, PaymentInfo>;
  @useResult
  $Res call(
      {String? payoutStrategy,
      String? bankCode,
      String? accountNumber,
      String? accountName});
}

/// @nodoc
class _$PaymentInfoCopyWithImpl<$Res, $Val extends PaymentInfo>
    implements $PaymentInfoCopyWith<$Res> {
  _$PaymentInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PaymentInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? payoutStrategy = freezed,
    Object? bankCode = freezed,
    Object? accountNumber = freezed,
    Object? accountName = freezed,
  }) {
    return _then(
      _value.copyWith(
            payoutStrategy: freezed == payoutStrategy
                ? _value.payoutStrategy
                : payoutStrategy // ignore: cast_nullable_to_non_nullable
                      as String?,
            bankCode: freezed == bankCode
                ? _value.bankCode
                : bankCode // ignore: cast_nullable_to_non_nullable
                      as String?,
            accountNumber: freezed == accountNumber
                ? _value.accountNumber
                : accountNumber // ignore: cast_nullable_to_non_nullable
                      as String?,
            accountName: freezed == accountName
                ? _value.accountName
                : accountName // ignore: cast_nullable_to_non_nullable
                      as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$PaymentInfoImplCopyWith<$Res>
    implements $PaymentInfoCopyWith<$Res> {
  factory _$$PaymentInfoImplCopyWith(
    _$PaymentInfoImpl value,
    $Res Function(_$PaymentInfoImpl) then,
  ) = __$$PaymentInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String? payoutStrategy,
      String? bankCode,
      String? accountNumber,
      String? accountName});
}

/// @nodoc
class __$$PaymentInfoImplCopyWithImpl<$Res>
    extends _$PaymentInfoCopyWithImpl<$Res, _$PaymentInfoImpl>
    implements _$$PaymentInfoImplCopyWith<$Res> {
  __$$PaymentInfoImplCopyWithImpl(
    _$PaymentInfoImpl _value,
    $Res Function(_$PaymentInfoImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of PaymentInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? payoutStrategy = freezed,
    Object? bankCode = freezed,
    Object? accountNumber = freezed,
    Object? accountName = freezed,
  }) {
    return _then(
      _$PaymentInfoImpl(
        payoutStrategy: freezed == payoutStrategy
            ? _value.payoutStrategy
            : payoutStrategy // ignore: cast_nullable_to_non_nullable
                  as String?,
        bankCode: freezed == bankCode
            ? _value.bankCode
            : bankCode // ignore: cast_nullable_to_non_nullable
                  as String?,
        accountNumber: freezed == accountNumber
            ? _value.accountNumber
            : accountNumber // ignore: cast_nullable_to_non_nullable
                  as String?,
        accountName: freezed == accountName
            ? _value.accountName
            : accountName // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$PaymentInfoImpl implements _PaymentInfo {
  const _$PaymentInfoImpl({
    this.payoutStrategy,
    this.bankCode,
    this.accountNumber,
    this.accountName,
  });

  factory _$PaymentInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$PaymentInfoImplFromJson(json);

  @override
  final String? payoutStrategy;
  @override
  final String? bankCode;
  @override
  final String? accountNumber;
  @override
  final String? accountName;

  @override
  String toString() {
    return 'PaymentInfo(payoutStrategy: $payoutStrategy, bankCode: $bankCode, accountNumber: $accountNumber, accountName: $accountName)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PaymentInfoImpl &&
            (identical(other.payoutStrategy, payoutStrategy) ||
                other.payoutStrategy == payoutStrategy) &&
            (identical(other.bankCode, bankCode) ||
                other.bankCode == bankCode) &&
            (identical(other.accountNumber, accountNumber) ||
                other.accountNumber == accountNumber) &&
            (identical(other.accountName, accountName) ||
                other.accountName == accountName));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
        runtimeType,
        payoutStrategy,
        bankCode,
        accountNumber,
        accountName,
      );

  /// Create a copy of PaymentInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PaymentInfoImplCopyWith<_$PaymentInfoImpl> get copyWith =>
      __$$PaymentInfoImplCopyWithImpl<_$PaymentInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PaymentInfoImplToJson(this);
  }
}

abstract class _PaymentInfo implements PaymentInfo {
  const factory _PaymentInfo({
    final String? payoutStrategy,
    final String? bankCode,
    final String? accountNumber,
    final String? accountName,
  }) = _$PaymentInfoImpl;

  factory _PaymentInfo.fromJson(Map<String, dynamic> json) =
      _$PaymentInfoImpl.fromJson;

  @override
  String? get payoutStrategy;
  @override
  String? get bankCode;
  @override
  String? get accountNumber;
  @override
  String? get accountName;

  /// Create a copy of PaymentInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PaymentInfoImplCopyWith<_$PaymentInfoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
