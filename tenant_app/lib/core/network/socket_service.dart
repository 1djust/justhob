import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'api_client.dart';

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;

  io.Socket? _socket;
  final _eventController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get eventStream => _eventController.stream;

  SocketService._internal();

  Future<void> init() async {
    final token = await ApiClient().storage.read(key: 'access_token');
    if (token == null) return;

    // Remove the '/api' suffix from baseUrl to get the root server URL for Socket.io
    final rootUrl = ApiConfig.baseUrl.replaceAll('/api', '');

    _socket = io.io(rootUrl, io.OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': token})
      .disableAutoConnect()
      .build());

    _socket?.onConnect((_) {
      print('[Socket] Connected to server');
    });

    _socket?.onDisconnect((_) {
      print('[Socket] Disconnected from server');
    });

    _socket?.on('PAYMENT_UPDATED', (data) {
      print('[Socket] Event: PAYMENT_UPDATED');
      _eventController.add({'type': 'PAYMENT_UPDATED', 'data': data});
    });

    _socket?.on('MAINTENANCE_UPDATED', (data) {
      print('[Socket] Event: MAINTENANCE_UPDATED');
      _eventController.add({'type': 'MAINTENANCE_UPDATED', 'data': data});
    });

    _socket?.on('maintenance-message', (data) {
      print('[Socket] Event: maintenance-message');
      _eventController.add({'type': 'maintenance-message', 'data': data});
    });

    _socket?.connect();
  }

  void joinWorkspace(String workspaceId) {
    if (_socket?.connected ?? false) {
      _socket?.emit('join-workspace', workspaceId);
      print('[Socket] Joined workspace room: $workspaceId');
    } else {
      // If not yet connected, retry after a short delay
      Future.delayed(const Duration(seconds: 2), () => joinWorkspace(workspaceId));
    }
  }

  void joinMaintenanceRoom(String workspaceId, String requestId) {
    if (_socket?.connected ?? false) {
      _socket?.emit('join-maintenance', {'workspaceId': workspaceId, 'requestId': requestId});
      print('[Socket] Joined maintenance room: $requestId');
    }
  }

  void leaveMaintenanceRoom(String requestId) {
    _socket?.emit('leave-maintenance', requestId);
    print('[Socket] Left maintenance room: $requestId');
  }

  void dispose() {
    _socket?.dispose();
    _eventController.close();
  }
}
