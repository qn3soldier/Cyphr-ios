import SwiftUI

extension View {
    @ViewBuilder
    func onChangeCompat<Value: Equatable>(of value: Value, perform action: @escaping () -> Void) -> some View {
        if #available(iOS 17, *) {
            self.onChange(of: value, initial: false) { _, _ in action() }
        } else {
            self.onChange(of: value) { _ in action() }
        }
    }
}
