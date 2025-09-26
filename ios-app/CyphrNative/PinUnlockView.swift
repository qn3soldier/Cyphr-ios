import SwiftUI

struct PinUnlockView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var digits: [String] = Array(repeating: "", count: 6)
    @State private var errorMessage: String?
    @FocusState private var focusedIndex: Int?

    let onSuccess: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Text("Enter PIN")
                .font(.title2.bold())

            HStack(spacing: 10) {
                ForEach(0..<6, id: \.self) { idx in
                    TextField("", text: Binding(
                        get: { digits[idx] },
                        set: { newValue in
                            let filtered = newValue.filter { $0.isNumber }
                            digits[idx] = String(filtered.prefix(1))
                            if !filtered.isEmpty && idx < 5 { focusedIndex = idx + 1 }
                            if allFilled { Task { await validate() } }
                        }
                    ))
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.center)
                    .frame(width: 44, height: 52)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.1)))
                    .foregroundColor(.white)
                    .focused($focusedIndex, equals: idx)
                }
            }

            if let errorMessage { Text(errorMessage).foregroundColor(.red).font(.footnote) }

            HStack(spacing: 16) {
                Button("Cancel") { dismiss() }
                    .foregroundColor(.secondary)
                Button("Unlock") { Task { await validate() } }
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .onAppear { focusedIndex = 0 }
        .background(
            LinearGradient(
                colors: [Color.black.opacity(0.9), Color.black.opacity(0.8)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
        )
    }

    private var allFilled: Bool { digits.allSatisfy { $0.count == 1 } }

    private func pinString() -> String { digits.joined() }

    private func validate() async {
        do {
            let ok = try await EnterpriseKeychainService.shared.verifyPIN(pinString())
            if ok {
                errorMessage = nil
                dismiss()
                onSuccess()
            } else {
                errorMessage = "Invalid PIN"
                digits = Array(repeating: "", count: 6)
                focusedIndex = 0
            }
        } catch let err as KeychainError {
            errorMessage = err.localizedDescription
        } catch {
            errorMessage = "Failed to verify PIN"
        }
    }
}
