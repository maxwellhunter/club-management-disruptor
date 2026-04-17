import SwiftUI
import AVFoundation

// MARK: - Result Models
//
// `MemberScannerView` is intentionally generic: the scanner itself
// only reads the payload off a QR/barcode and posts it to
// /api/wallet/nfc (which resolves the member, validates status,
// logs the tap, and applies 30-second dedup). Callers decide what
// to do with the resolved member via the `onMemberScanned` callback.
//
// Reuse pattern (per user request — any verification contact point):
//   MemberScannerView(tapType: "restaurant_checkin") { scan in
//       // route to POS, dining reservation lookup, guest
//       // verification, pro-shop charge, etc.
//   }

/// Decoded response from POST /api/wallet/nfc.
struct ScannedMember: Decodable {
    let success: Bool
    let tapId: String?
    let memberName: String?
    let memberNumber: String?
    let tapType: String?
    let timestamp: String?
}

/// Request body shape consumed by /api/wallet/nfc.
private struct NfcTapBody: Encodable {
    let barcodePayload: String
    let tapType: String
    let location: String?
    let deviceId: String?
}

// MARK: - MemberScannerView

struct MemberScannerView: View {
    /// Logical tap type recorded in `nfc_tap_log.tap_type`. Callers
    /// pass the contact point (e.g. "check_in", "pro_shop",
    /// "restaurant", "guest_verify") so server-side analytics can
    /// segment without a schema change.
    let tapType: String

    /// Optional free-form location string attached to the tap.
    let location: String?

    /// Called after a successful scan+resolve with the server's
    /// decoded response. Presenter decides whether to dismiss or
    /// continue scanning.
    let onMemberScanned: (ScannedMember) -> Void

    @Environment(\.dismiss) private var dismiss

    // Scanner state
    @State private var cameraAuthorized: Bool = AVCaptureDevice.authorizationStatus(for: .video) == .authorized
    @State private var cameraDenied: Bool = AVCaptureDevice.authorizationStatus(for: .video) == .denied
    @State private var isResolving = false
    @State private var errorMessage: String?
    @State private var lastScannedPayload: String?
    @State private var scannedResult: ScannedMember?

    init(
        tapType: String = "check_in",
        location: String? = nil,
        onMemberScanned: @escaping (ScannedMember) -> Void = { _ in }
    ) {
        self.tapType = tapType
        self.location = location
        self.onMemberScanned = onMemberScanned
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if cameraDenied {
                deniedView
            } else if cameraAuthorized {
                CameraPreview(isPaused: isResolving || scannedResult != nil) { payload in
                    handleScan(payload: payload)
                }
                .ignoresSafeArea()

                scannerOverlay
            } else {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.white)
            }

            // Top toolbar — dark gradient so white controls stay legible
            // against bright camera scenes.
            VStack {
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 36, height: 36)
                            .background(.black.opacity(0.45), in: Circle())
                    }
                    .accessibilityLabel("Close scanner")
                    Spacer()
                    Text("Scan Member")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    // Right-side balance placeholder keeps title centered.
                    Color.clear.frame(width: 36, height: 36)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                Spacer()
            }
        }
        .task {
            if !cameraAuthorized && !cameraDenied {
                let granted = await AVCaptureDevice.requestAccess(for: .video)
                await MainActor.run {
                    cameraAuthorized = granted
                    cameraDenied = !granted
                }
            }
        }
        .sheet(item: $scannedResult) { result in
            ScannedMemberResultSheet(
                result: result,
                onDone: {
                    onMemberScanned(result)
                    scannedResult = nil
                    dismiss()
                },
                onScanAnother: {
                    // Allow the presenter's workflow to keep going
                    // (staff at check-in often want to scan many
                    // members back-to-back).
                    onMemberScanned(result)
                    scannedResult = nil
                    // Clear the dedup so the same payload can be
                    // re-scanned after the 30s server window.
                    lastScannedPayload = nil
                }
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
        .alert("Scan failed", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: - Overlay

    private var scannerOverlay: some View {
        VStack {
            Spacer()

            // Framing square — subtle rounded rect cutout so the
            // user knows where to aim the code.
            ZStack {
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.white.opacity(0.9), lineWidth: 3)
                    .frame(width: 260, height: 260)

                if isResolving {
                    RoundedRectangle(cornerRadius: 20)
                        .fill(.black.opacity(0.35))
                        .frame(width: 260, height: 260)
                        .overlay {
                            VStack(spacing: 8) {
                                ProgressView().tint(.white)
                                Text("Verifying…")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(.white)
                            }
                        }
                }
            }

            Spacer()

            VStack(spacing: 6) {
                Text("Align QR code inside the frame")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white)
                Text("Members can find their code in the app or their wallet pass")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.75))
                    .multilineTextAlignment(.center)
            }
            .padding(.bottom, 44)
            .padding(.horizontal, 32)
        }
    }

    private var deniedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "camera.slash")
                .font(.system(size: 44))
                .foregroundStyle(.white)
            Text("Camera access denied")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
            Text("Grant camera permission in Settings to scan member QR codes.")
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            } label: {
                Text("Open Settings")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.black)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(.white, in: Capsule())
            }
        }
    }

    // MARK: - Scan handling

    private func handleScan(payload: String) {
        guard !isResolving, scannedResult == nil else { return }
        // Local dedup: AVFoundation fires hits ~30/s while the code
        // stays in frame. Ignore repeats of the exact same payload
        // until the resolve completes and clears state.
        guard payload != lastScannedPayload else { return }
        lastScannedPayload = payload

        isResolving = true
        Task {
            do {
                let body = NfcTapBody(
                    barcodePayload: payload,
                    tapType: tapType,
                    location: location,
                    deviceId: UIDevice.current.identifierForVendor?.uuidString
                )
                let result: ScannedMember = try await APIClient.shared.post(
                    "/wallet/nfc",
                    body: body
                )
                await MainActor.run {
                    isResolving = false
                    scannedResult = result
                    // Haptic confirmation
                    let gen = UINotificationFeedbackGenerator()
                    gen.notificationOccurred(.success)
                }
            } catch {
                await MainActor.run {
                    isResolving = false
                    errorMessage = error.localizedDescription
                    // Allow retry on a fresh read.
                    lastScannedPayload = nil
                    let gen = UINotificationFeedbackGenerator()
                    gen.notificationOccurred(.error)
                }
            }
        }
    }
}

// MARK: - Scan Result Sheet

private struct ScannedMemberResultSheet: View {
    let result: ScannedMember
    let onDone: () -> Void
    let onScanAnother: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(Color.club.primary.opacity(0.15))
                    .frame(width: 72, height: 72)
                Image(systemName: "checkmark")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(Color.club.primary)
            }
            .padding(.top, 28)

            VStack(spacing: 4) {
                Text(result.memberName ?? "Unknown member")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Color.club.foreground)
                if let number = result.memberNumber {
                    Text("Member #\(number)")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
                if let tapType = result.tapType {
                    Text(formattedTapType(tapType))
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(0.5)
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.club.surfaceContainerHigh, in: Capsule())
                        .padding(.top, 4)
                }
            }

            Spacer(minLength: 8)

            VStack(spacing: 10) {
                Button(action: onScanAnother) {
                    Text("Scan Another")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 14))
                }
                .contentShape(RoundedRectangle(cornerRadius: 14))

                Button(action: onDone) {
                    Text("Done")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.club.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 14))
                }
                .contentShape(RoundedRectangle(cornerRadius: 14))
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .background(Color.club.background)
    }

    private func formattedTapType(_ raw: String) -> String {
        raw.split(separator: "_").map { $0.capitalized }.joined(separator: " ")
    }
}

// MARK: - Identifiable wrapper so ScannedMember works with `.sheet(item:)`

extension ScannedMember: Identifiable {
    var id: String { tapId ?? UUID().uuidString }
}

// MARK: - AVFoundation Camera Preview

private struct CameraPreview: UIViewControllerRepresentable {
    let isPaused: Bool
    let onScan: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    func makeUIViewController(context: Context) -> ScannerViewController {
        let vc = ScannerViewController()
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: ScannerViewController, context: Context) {
        context.coordinator.onScan = onScan
        if isPaused {
            vc.pauseSession()
        } else {
            vc.resumeSession()
        }
    }

    final class Coordinator: NSObject, ScannerViewControllerDelegate {
        var onScan: (String) -> Void
        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }
        func scannerDidRead(_ payload: String) { onScan(payload) }
    }
}

private protocol ScannerViewControllerDelegate: AnyObject {
    func scannerDidRead(_ payload: String)
}

private final class ScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    weak var delegate: ScannerViewControllerDelegate?
    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureSession()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        resumeSession()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        pauseSession()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.layer.bounds
    }

    func pauseSession() {
        guard session.isRunning else { return }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.session.stopRunning()
        }
    }

    func resumeSession() {
        guard !session.isRunning else { return }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.session.startRunning()
        }
    }

    private func configureSession() {
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: device)
        else { return }

        session.beginConfiguration()
        if session.canAddInput(input) { session.addInput(input) }

        let output = AVCaptureMetadataOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            // QR covers the digital-pass barcode; support aztec + code128
            // too so any wallet-pass format we swap to later still works.
            output.metadataObjectTypes = [.qr, .aztec, .code128, .pdf417]
        }
        session.commitConfiguration()

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        preview.frame = view.layer.bounds
        view.layer.addSublayer(preview)
        self.previewLayer = preview
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        for object in metadataObjects {
            if let readable = object as? AVMetadataMachineReadableCodeObject,
               let payload = readable.stringValue,
               !payload.isEmpty {
                delegate?.scannerDidRead(payload)
                return
            }
        }
    }
}
