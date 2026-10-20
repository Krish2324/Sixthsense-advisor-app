import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING } from '../../src/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function VideoInterviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<any>(null);
  
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false);

  const toggleCameraFacing = () => {
    setFacing(prev => (prev === 'front' ? 'back' : 'front'));
  };
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setTimeElapsed(prev => {
          if (prev >= 300) { // 5 minutes max
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    if (cameraRef.current) {
      setIsRecording(true);
      setTimeElapsed(0);
      try {
        // Check if recordAsync is available (not available in Expo Go)
        if (typeof cameraRef.current.recordAsync !== 'function') {
          // Expo Go fallback - simulate recording for testing
          Alert.alert(
            'Test Mode',
            'Video recording is not available in Expo Go. Running in test mode - tap stop when ready to see the submit screen.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        const video = await cameraRef.current.recordAsync({
          maxDuration: 300, // 5 minutes
        });
        if (video && video.uri) {
          setRecordedVideo(video.uri);
        }
      } catch (error: any) {
        console.error('Recording error:', error);
        // If recording fails (Expo Go limitation), still allow testing the flow
        const errorMsg = error?.message || '';
        if (errorMsg.includes('record') || errorMsg.includes('Record') || errorMsg.includes('Calling')) {
          // Don't show error - user will use stopRecording which will set test mode
        }
      }
    }
  };

  const stopRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      
      // If we have a camera ref, try to stop it
      if (cameraRef.current && typeof cameraRef.current.stopRecording === 'function') {
        try {
          cameraRef.current.stopRecording();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
      
      // If no video was recorded (Expo Go limitation), set a placeholder so UI shows buttons
      if (!recordedVideo && timeElapsed > 0) {
        // Use a placeholder to trigger the UI change
        setRecordedVideo('test_mode_video');
      }
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Get stored application data
      const storedData = await AsyncStorage.getItem('application_data');
      
      if (!storedData) {
        Alert.alert('Error', 'Application data not found. Please start over.');
        router.replace('/application');
        return;
      }
      
      const applicationData = JSON.parse(storedData);
      
      // Try to upload the actual video file if we have a real local file
      let finalVideoUrl = recordedVideo || 'video_recorded_locally';
      const isRealFile = recordedVideo && (recordedVideo.startsWith('file://') || recordedVideo.startsWith('/'));
      
      if (isRealFile && recordedVideo) {
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: recordedVideo,
            type: 'video/mp4',
            name: 'advisor_video.mp4',
          } as any);
          
          const uploadResponse = await fetch(`${BACKEND_URL}/api/applications/upload-video`, {
            method: 'POST',
            body: formData,
          });
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            finalVideoUrl = `${BACKEND_URL}${uploadResult.video_url}`;
            console.log('Video uploaded successfully:', finalVideoUrl);
          }
        } catch (uploadError) {
          console.log('Video upload failed, using placeholder:', uploadError);
          // Continue with placeholder - will show "not uploaded" in admin
        }
      }
      
      // Add video info
      applicationData.video_url = finalVideoUrl;
      applicationData.video_duration = timeElapsed;
      
      // Submit to backend
      const response = await fetch(`${BACKEND_URL}/api/applications/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(applicationData),
      });
      
      if (response.ok) {
        // Clear stored data
        await AsyncStorage.removeItem('application_data');
        
        Alert.alert(
          'Application Submitted!',
          'Thank you for applying! You will receive an email confirmation shortly. Our team will review your application and get back to you within 1-2 weeks.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/application/pending'),
            },
          ]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to submit application. Please try again.');
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit application. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleRetake = () => {
    setRecordedVideo(null);
    setTimeElapsed(0);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <Ionicons name="videocam-off" size={60} color={COLORS.textMuted} />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          We need camera access to record your introduction video
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/application');
              }
            }}
          >
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          
          {/* Timer */}
          <View style={styles.timer}>
            <View style={[styles.recordingDot, isRecording && styles.recordingDotActive]} />
            <Text style={styles.timerText}>{formatTime(timeElapsed)} / 5:00</Text>
          </View>

          {/* Flip Camera Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={toggleCameraFacing}
          >
            <Ionicons name="camera-reverse" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Controls */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + SPACING.lg }]}>
          {recordedVideo ? (
            // Video recorded - show submit/retake
            <View style={styles.recordedControls}>
              <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
                <Ionicons name="refresh" size={24} color={COLORS.textPrimary} />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitText}>Submit Application</Text>
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            // Recording controls
            <View style={styles.recordingControls}>
              <Text style={styles.instructionText}>
                {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
              </Text>
              
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  isRecording && styles.recordButtonActive
                ]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <View style={[
                  styles.recordButtonInner,
                  isRecording && styles.recordButtonInnerActive
                ]} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  permissionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  permissionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.lg,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  camera: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    gap: SPACING.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.textMuted,
  },
  recordingDotActive: {
    backgroundColor: COLORS.error,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  recordingBanner: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,0,0,0.7)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
  },
  recordingControls: {
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: '#FFF',
    marginBottom: SPACING.md,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  recordButtonActive: {
    borderColor: COLORS.error,
  },
  recordButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: COLORS.error,
  },
  recordButtonInnerActive: {
    borderRadius: 8,
    width: '50%',
    height: '50%',
  },
  recordedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
