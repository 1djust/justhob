import 'package:dio/dio.dart';

String getFriendlyErrorMessage(Object error) {
  if (error is DioException) {
    if (error.response?.statusCode == 401) {
      return 'Your session has expired. Please log out and log back in.';
    } else if (error.type == DioExceptionType.connectionTimeout || 
               error.type == DioExceptionType.receiveTimeout) {
      return 'Connection timed out. Please check your internet and try again.';
    } else if (error.type == DioExceptionType.connectionError) {
      return 'No internet connection. Please check your network connection.';
    } else if (error.response != null) {
      final data = error.response?.data;
      if (data is Map && data['error'] != null) {
        return data['error'].toString();
      }
      if (data is Map && data['message'] != null) {
        return data['message'].toString();
      }
      return 'Server error (${error.response?.statusCode}). Please try again later.';
    }
    return 'Network error occurred. Please try again.';
  }
  return 'An unexpected error occurred. Please try again.';
}
