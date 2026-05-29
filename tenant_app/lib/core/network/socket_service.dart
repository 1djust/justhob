import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'api_client.dart';

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;

  io.Socket? _socket;
  final _eventController = StreamController<Map<String, dynamic>>.broadcast();

  String? _currentWorkspaceId;
  final Set<String> _currentMaintenanceRooms = {};

  Stream<Map<String, dynamic>> get eventStream => _eventController.stream;

  SocketService._internal();

  Future<void> init() async {
    final token = await ApiClient().storage.read(key: 'access_token');
    if (token == null) return;

    // Dispose old socket if it exists to refresh with new token
    if (_socket != null) {
      debugPrint('[Socket] Re-initializing socket with new token...');
      _socket?.dispose();
    }

    // Remove the '/api' suffix from baseUrl to get the root server URL for Socket.io
    final rootUrl = ApiConfig.baseUrl.replaceAll('/api', '');

    _socket = io.io(rootUrl, io.OptionBuilder()
      .setTransports(['websocket', 'polling']) // Allow polling fallback
      .setAuth({'token': token})
      .enableAutoConnect()
      .setReconnectionAttempts(10)
      .setReconnectionDelay(2000)
      .build());

    _socket?.onConnect((_) {
      debugPrint('[Socket] Connected to server: ${_socket?.id}');
      _eventController.add({'type': 'socket-connected'});
      // Auto-rejoin rooms if we were disconnected
      if (_currentWorkspaceId != null) {
        debugPrint('[Socket] Re-joining workspace: $_currentWorkspaceId');
        _socket?.emit('join-workspace', _currentWorkspaceId);
      }
      for (final reqId in _currentMaintenanceRooms) {
        if (_currentWorkspaceId != null) {
          _socket?.emit('join-maintenance', {'workspaceId': _currentWorkspaceId, 'requestId': reqId});
        }
      }
    });

    _socket?.onConnectError((data) {
      debugPrint('[Socket] Connection Error: $data');
    });

    _socket?.onDisconnect((data) {
      debugPrint('[Socket] Disconnected: $data');
    });

    _socket?.onError((data) {
      debugPrint('[Socket] Error: $data');
    });

    _socket?.on('PAYMENT_UPDATED', (data) {
      debugPrint('[Socket] Event: PAYMENT_UPDATED');
      _eventController.add({'type': 'PAYMENT_UPDATED', 'data': data});
    });

    _socket?.on('MAINTENANCE_UPDATED', (data) {
      debugPrint('[Socket] Event: MAINTENANCE_UPDATED');
      _eventController.add({'type': 'MAINTENANCE_UPDATED', 'data': data});
    });

    _socket?.on('LEASE_UPDATED', (data) {
      debugPrint('[Socket] Event: LEASE_UPDATED');
      _eventController.add({'type': 'LEASE_UPDATED', 'data': data});
    });
    
    _socket?.on('LEASE_RENEWAL_OFFER', (data) {
      debugPrint('[Socket] Event: LEASE_RENEWAL_OFFER');
      _eventController.add({'type': 'LEASE_RENEWAL_OFFER', 'data': data});
    });

    _socket?.on('LEASE_RENEWED', (data) {
      debugPrint('[Socket] Event: LEASE_RENEWED');
      _eventController.add({'type': 'LEASE_RENEWED', 'data': data});
    });

    _socket?.on('LEASE_RENEWAL_REJECTED', (data) {
      debugPrint('[Socket] Event: LEASE_RENEWAL_REJECTED');
      _eventController.add({'type': 'LEASE_RENEWAL_REJECTED', 'data': data});
    });

    _socket?.on('NOTIFICATION_CREATED', (data) {
      debugPrint('[Socket] Event: NOTIFICATION_CREATED');
      _eventController.add({'type': 'NOTIFICATION_CREATED', 'data': data});
    });

    _socket?.on('maintenance-message', (data) {
      debugPrint('[Socket] Event: maintenance-message');
      _eventController.add({'type': 'maintenance-message', 'data': data});
    });

    _socket?.connect();
  }

  void joinWorkspace(String workspaceId) {
    _currentWorkspaceId = workspaceId;
    if (_socket?.connected ?? false) {
      _socket?.emit('join-workspace', workspaceId);
      debugPrint('[Socket] Joined workspace room: $workspaceId');
    } else {
      // If not yet connected, retry after a short delay
      Future.delayed(const Duration(seconds: 2), () => joinWorkspace(workspaceId));
    }
  }

  void joinMaintenanceRoom(String workspaceId, String requestId) {
    _currentWorkspaceId = workspaceId;
    _currentMaintenanceRooms.add(requestId);
    if (_socket?.connected ?? false) {
      _socket?.emit('join-maintenance', {'workspaceId': workspaceId, 'requestId': requestId});
      debugPrint('[Socket] Joined maintenance room: $requestId');
    }
  }

  void leaveMaintenanceRoom(String requestId) {
    _currentMaintenanceRooms.remove(requestId);
    _socket?.emit('leave-maintenance', requestId);
    debugPrint('[Socket] Left maintenance room: $requestId');
  }

  void dispose() {
    _socket?.dispose();
    _eventController.close();
  }
}
