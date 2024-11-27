"use client";

import React, { useState, useRef } from 'react';
import { Mic, Square, Trash, Loader2 } from 'lucide-react';

const VoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<
    { id: number; text: string; timestamp: string }[]
  >([]);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fixing TypeScript issue with useRef
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Get the API URL from environment variable
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        processRecording(audioBlob);
      };

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setError('');
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please grant permission.'
          : 'Error accessing microphone. Please ensure your device has a working microphone.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      const response = await fetch(`${API_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Transcription failed');
      }

      const data = await response.json();
      const timestamp = new Date().toLocaleTimeString();

      setRecordings((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: data.text,
          timestamp,
        },
      ]);
    } catch (err) {
      console.error('Error processing recording:', err);
      setError(`Error processing recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearRecordings = () => {
    setRecordings([]);
  };

  const deleteRecording = (id: number) => {
    setRecordings((prev) => prev.filter((recording) => recording.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-700">
        <h1 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Voice To Text
        </h1>

        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
              } px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRecording ? (
                <>
                  <Square className="w-5 h-5" /> Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" /> Start Recording
                </>
              )}
            </button>

            <button
              onClick={clearRecordings}
              disabled={recordings.length === 0}
              className="px-6 py-3 rounded-lg border border-gray-600 hover:bg-gray-700 flex items-center gap-2 font-semibold transition-all disabled:opacity-50"
            >
              Clear All
            </button>
          </div>

          {error && (
            <div className="w-full bg-red-900/50 border border-red-500/50 text-red-200 p-4 rounded-lg">
              {error}
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-3 text-blue-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing recording...
            </div>
          )}

          <div className="w-full mt-8">
            <h3 className="text-xl font-semibold mb-6 text-gray-300">
              Recording History
            </h3>
            <div className="space-y-4">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-blue-400 mb-2">
                        {recording.timestamp}
                      </p>
                      <p className="text-gray-200">{recording.text}</p>
                    </div>
                    <button
                      onClick={() => deleteRecording(recording.id)}
                      className="text-gray-400 hover:text-red-400 transition-colors p-2 hover:bg-gray-700 rounded-lg"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {recordings.length === 0 && (
                <div className="text-center text-gray-500 py-12 bg-gray-800/50 rounded-lg border border-gray-700">
                  No recordings yet. Click the Record button to start.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceRecorder;
