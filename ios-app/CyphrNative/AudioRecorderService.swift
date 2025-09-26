import Foundation
import AVFoundation

/// Handles high quality audio capture for voice messages with real-time metering
/// to generate waveform previews. Produces encrypted-ready AAC data suited for
/// post-quantum payload delivery.
@MainActor
final class AudioRecorderService: NSObject, ObservableObject {

    static let shared = AudioRecorderService()

    enum RecordingState {
        case idle
        case preparing
        case recording(startedAt: Date)
    }

    enum RecorderError: LocalizedError {
        case microphonePermissionDenied
        case audioSessionFailed(String)
        case recorderSetupFailed
        case captureFailed

        var errorDescription: String? {
            switch self {
            case .microphonePermissionDenied:
                return "Microphone access is required to record voice messages."
            case .audioSessionFailed(let message):
                return "Audio session configuration failed: \(message)"
            case .recorderSetupFailed:
                return "Unable to configure the audio recorder. Please try again."
            case .captureFailed:
                return "Voice capture failed."
            }
        }
    }

    struct RecordingResult {
        let data: Data
        let duration: TimeInterval
        let waveform: [Float]
        let fileExtension: String
        let mimeType: String
    }

    @Published private(set) var state: RecordingState = .idle

    private var audioSession: AVAudioSession { .sharedInstance() }
    private var recorder: AVAudioRecorder?
    private var meteringTimer: DispatchSourceTimer?
    private var waveformSamples: [Float] = []
    private var tempFileURL: URL?

    private override init() {
        super.init()
    }

    func startRecording() async throws {
        guard case .idle = state else { return }

        state = .preparing

        let granted = try await requestMicrophonePermission()
        guard granted else {
            state = .idle
            throw RecorderError.microphonePermissionDenied
        }

        do {
            try configureSession()
        } catch {
            state = .idle
            throw error
        }

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            AVEncoderBitRateStrategyKey: AVAudioBitRateStrategy_Constant,
            AVEncoderBitRateKey: 64_000
        ]

        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("cyphr-voice-\(UUID().uuidString).m4a")

        do {
            recorder = try AVAudioRecorder(url: tempURL, settings: settings)
        } catch {
            state = .idle
            throw RecorderError.recorderSetupFailed
        }

        guard let recorder else {
            state = .idle
            throw RecorderError.recorderSetupFailed
        }

        tempFileURL = tempURL
        recorder.delegate = self
        recorder.isMeteringEnabled = true

        waveformSamples = []
        recorder.record()
        startMetering()

        state = .recording(startedAt: Date())
    }

    func stopRecording() async throws -> RecordingResult {
        guard case let .recording(startedAt: startDate) = state,
              let recorder,
              let fileURL = tempFileURL else {
            throw RecorderError.captureFailed
        }

        recorder.stop()
        stopMetering()

        do {
            try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            print("⚠️ Failed to deactivate audio session: \(error.localizedDescription)")
        }

        let duration = Date().timeIntervalSince(startDate)
        state = .idle

        do {
            let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
            cleanupTempFile()
            return RecordingResult(
                data: data,
                duration: duration,
                waveform: waveformSamples.isEmpty ? [0.1, 0.4, 0.2] : waveformSamples,
                fileExtension: "m4a",
                mimeType: "audio/m4a"
            )
        } catch {
            cleanupTempFile()
            throw RecorderError.captureFailed
        }
    }

    func cancelRecording() {
        recorder?.stop()
        recorder = nil
        stopMetering()
        cleanupTempFile()
        try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
        state = .idle
    }

    private func requestMicrophonePermission() async throws -> Bool {
        if #available(iOS 17.0, *) {
            switch AVAudioApplication.shared.recordPermission {
            case .granted:
                return true
            case .denied:
                return false
            case .undetermined:
                return await withCheckedContinuation { continuation in
                    AVAudioApplication.requestRecordPermission { granted in
                        continuation.resume(returning: granted)
                    }
                }
            @unknown default:
                return false
            }
        } else {
            switch audioSession.recordPermission {
            case .granted:
                return true
            case .denied:
                return false
            case .undetermined:
                return await withCheckedContinuation { continuation in
                    audioSession.requestRecordPermission { granted in
                        continuation.resume(returning: granted)
                    }
                }
            @unknown default:
                return false
            }
        }
    }

    private func configureSession() throws {
        do {
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetoothHFP])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            throw RecorderError.audioSessionFailed(error.localizedDescription)
        }
    }

    private func startMetering() {
        meteringTimer?.cancel()

        let timer = DispatchSource.makeTimerSource(queue: .global(qos: .userInitiated))
        timer.schedule(deadline: .now(), repeating: .milliseconds(120))
        timer.setEventHandler { [weak self] in
            guard let self, let recorder = self.recorder else { return }
            recorder.updateMeters()
            let power = recorder.averagePower(forChannel: 0)
            let normalized = Self.normalize(power: power)
            Task { @MainActor in
                self.waveformSamples.append(normalized)
                if self.waveformSamples.count > 120 { // keep ~15 seconds history
                    self.waveformSamples.removeFirst(self.waveformSamples.count - 120)
                }
            }
        }

        meteringTimer = timer
        timer.resume()
    }

    private func stopMetering() {
        meteringTimer?.cancel()
        meteringTimer = nil
    }

    private func cleanupTempFile() {
        if let url = tempFileURL {
            try? FileManager.default.removeItem(at: url)
        }
        tempFileURL = nil
        recorder = nil
    }

    private static func normalize(power: Float) -> Float {
        let minDb: Float = -80
        let clipped = max(minDb, power)
        let ratio = (clipped - minDb) / -minDb
        return pow(ratio, 1.5)
    }
}

// In Swift 6 the AVAudioRecorderDelegate requirements are nonisolated.
// Provide a nonisolated implementation and hop to the main actor internally.
extension AudioRecorderService: AVAudioRecorderDelegate {
    nonisolated func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        Task { @MainActor in
            self.cancelRecording()
        }
    }
}

// MARK: - Audio Playback

@MainActor
final class AudioPlaybackService: ObservableObject {
    static let shared = AudioPlaybackService()

    enum PlaybackState {
        case idle
        case playing(id: String, progress: Double)
        case paused(id: String, progress: Double)
    }

    @Published private(set) var state: PlaybackState = .idle

    private var player: AVAudioPlayer?
    private var progressTimer: DispatchSourceTimer?
    private init() {}

    func play(data: Data, messageId: String) throws {
        stop()

        player = try AVAudioPlayer(data: data)
        player?.prepareToPlay()
        player?.play()

        startProgressTimer(messageId: messageId)
    }

    func pause() {
        guard case .playing(let id, _) = state else { return }
        player?.pause()
        state = .paused(id: id, progress: currentProgress)
        progressTimer?.cancel()
    }

    func resume() {
        guard case .paused(let id, _) = state else { return }
        player?.play()
        startProgressTimer(messageId: id)
    }

    func stop() {
        player?.stop()
        player = nil
        progressTimer?.cancel()
        progressTimer = nil
        state = .idle
    }

    private var currentProgress: Double {
        guard let player else { return 0 }
        return player.currentTime / max(player.duration, 0.1)
    }

    private func startProgressTimer(messageId: String) {
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now(), repeating: .milliseconds(80))
        timer.setEventHandler { [weak self] in
            guard let self, let player = self.player else { return }
            if player.isPlaying {
                self.state = .playing(id: messageId, progress: self.currentProgress)
            } else {
                self.stop()
            }
        }
        progressTimer?.cancel()
        progressTimer = timer
        timer.resume()
    }
}
