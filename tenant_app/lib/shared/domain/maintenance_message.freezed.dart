// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'maintenance_message.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

MaintenanceMessage _$MaintenanceMessageFromJson(Map<String, dynamic> json) {
  return _MaintenanceMessage.fromJson(json);
}

/// @nodoc
mixin _$MaintenanceMessage {
  String get id => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  String get requestId => throw _privateConstructorUsedError;
  String? get senderId => throw _privateConstructorUsedError;
  Map<String, dynamic>? get sender => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Serializes this MaintenanceMessage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MaintenanceMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MaintenanceMessageCopyWith<MaintenanceMessage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MaintenanceMessageCopyWith<$Res> {
  factory $MaintenanceMessageCopyWith(
    MaintenanceMessage value,
    $Res Function(MaintenanceMessage) then,
  ) = _$MaintenanceMessageCopyWithImpl<$Res, MaintenanceMessage>;
  @useResult
  $Res call({
    String id,
    String content,
    String type,
    String requestId,
    String? senderId,
    Map<String, dynamic>? sender,
    DateTime createdAt,
  });
}

/// @nodoc
class _$MaintenanceMessageCopyWithImpl<$Res, $Val extends MaintenanceMessage>
    implements $MaintenanceMessageCopyWith<$Res> {
  _$MaintenanceMessageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MaintenanceMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? content = null,
    Object? type = null,
    Object? requestId = null,
    Object? senderId = freezed,
    Object? sender = freezed,
    Object? createdAt = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            content: null == content
                ? _value.content
                : content // ignore: cast_nullable_to_non_nullable
                      as String,
            type: null == type
                ? _value.type
                : type // ignore: cast_nullable_to_non_nullable
                      as String,
            requestId: null == requestId
                ? _value.requestId
                : requestId // ignore: cast_nullable_to_non_nullable
                      as String,
            senderId: freezed == senderId
                ? _value.senderId
                : senderId // ignore: cast_nullable_to_non_nullable
                      as String?,
            sender: freezed == sender
                ? _value.sender
                : sender // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>?,
            createdAt: null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$MaintenanceMessageImplCopyWith<$Res>
    implements $MaintenanceMessageCopyWith<$Res> {
  factory _$$MaintenanceMessageImplCopyWith(
    _$MaintenanceMessageImpl value,
    $Res Function(_$MaintenanceMessageImpl) then,
  ) = __$$MaintenanceMessageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String content,
    String type,
    String requestId,
    String? senderId,
    Map<String, dynamic>? sender,
    DateTime createdAt,
  });
}

/// @nodoc
class __$$MaintenanceMessageImplCopyWithImpl<$Res>
    extends _$MaintenanceMessageCopyWithImpl<$Res, _$MaintenanceMessageImpl>
    implements _$$MaintenanceMessageImplCopyWith<$Res> {
  __$$MaintenanceMessageImplCopyWithImpl(
    _$MaintenanceMessageImpl _value,
    $Res Function(_$MaintenanceMessageImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of MaintenanceMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? content = null,
    Object? type = null,
    Object? requestId = null,
    Object? senderId = freezed,
    Object? sender = freezed,
    Object? createdAt = null,
  }) {
    return _then(
      _$MaintenanceMessageImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        content: null == content
            ? _value.content
            : content // ignore: cast_nullable_to_non_nullable
                  as String,
        type: null == type
            ? _value.type
            : type // ignore: cast_nullable_to_non_nullable
                  as String,
        requestId: null == requestId
            ? _value.requestId
            : requestId // ignore: cast_nullable_to_non_nullable
                  as String,
        senderId: freezed == senderId
            ? _value.senderId
            : senderId // ignore: cast_nullable_to_non_nullable
                  as String?,
        sender: freezed == sender
            ? _value._sender
            : sender // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$MaintenanceMessageImpl implements _MaintenanceMessage {
  const _$MaintenanceMessageImpl({
    required this.id,
    required this.content,
    this.type = 'USER',
    required this.requestId,
    this.senderId,
    final Map<String, dynamic>? sender,
    required this.createdAt,
  }) : _sender = sender;

  factory _$MaintenanceMessageImpl.fromJson(Map<String, dynamic> json) =>
      _$$MaintenanceMessageImplFromJson(json);

  @override
  final String id;
  @override
  final String content;
  @override
  @JsonKey()
  final String type;
  @override
  final String requestId;
  @override
  final String? senderId;
  final Map<String, dynamic>? _sender;
  @override
  Map<String, dynamic>? get sender {
    final value = _sender;
    if (value == null) return null;
    if (_sender is EqualUnmodifiableMapView) return _sender;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  final DateTime createdAt;

  @override
  String toString() {
    return 'MaintenanceMessage(id: $id, content: $content, type: $type, requestId: $requestId, senderId: $senderId, sender: $sender, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MaintenanceMessageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.content, content) || other.content == content) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.requestId, requestId) ||
                other.requestId == requestId) &&
            (identical(other.senderId, senderId) ||
                other.senderId == senderId) &&
            const DeepCollectionEquality().equals(other._sender, _sender) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    content,
    type,
    requestId,
    senderId,
    const DeepCollectionEquality().hash(_sender),
    createdAt,
  );

  /// Create a copy of MaintenanceMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MaintenanceMessageImplCopyWith<_$MaintenanceMessageImpl> get copyWith =>
      __$$MaintenanceMessageImplCopyWithImpl<_$MaintenanceMessageImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$MaintenanceMessageImplToJson(this);
  }
}

abstract class _MaintenanceMessage implements MaintenanceMessage {
  const factory _MaintenanceMessage({
    required final String id,
    required final String content,
    final String type,
    required final String requestId,
    final String? senderId,
    final Map<String, dynamic>? sender,
    required final DateTime createdAt,
  }) = _$MaintenanceMessageImpl;

  factory _MaintenanceMessage.fromJson(Map<String, dynamic> json) =
      _$MaintenanceMessageImpl.fromJson;

  @override
  String get id;
  @override
  String get content;
  @override
  String get type;
  @override
  String get requestId;
  @override
  String? get senderId;
  @override
  Map<String, dynamic>? get sender;
  @override
  DateTime get createdAt;

  /// Create a copy of MaintenanceMessage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MaintenanceMessageImplCopyWith<_$MaintenanceMessageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
